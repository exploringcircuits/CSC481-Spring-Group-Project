"""DRF views for the fantasy domain.

Endpoints follow REST-ish conventions with action-style nested URLs for
mutations that don't map cleanly onto CRUD (lineup-set, trade-respond, etc.).

Heavy automation (run-draft-to-completion, simulate-week, etc.) lives in
the admin panel — see admin_views.py and Phase 6.
"""

from __future__ import annotations

from datetime import datetime, timezone

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, views
from rest_framework.decorators import api_view, permission_classes as perm_decorator
from rest_framework.response import Response

from .models import (
    Draft,
    DraftSelection,
    DraftStatus,
    League,
    LeagueMember,
    LeagueStatus,
    LineupEntry,
    Matchup,
    Player,
    Roster,
    Team,
    Trade,
    TradeAsset,
    TradeStatus,
    Transaction,
    TransactionType,
    Week,
)
from .permissions import IsLeagueCommissioner, IsLeagueMember
from .scoring import autopick_for_member, score_team_for_week
from .serializers import (
    DraftSerializer,
    LeagueCreateSerializer,
    LeagueDetailSerializer,
    LeagueJoinSerializer,
    LeagueListSerializer,
    LineupEntrySerializer,
    LineupSetSerializer,
    MatchupSerializer,
    PlayerSerializer,
    PlayerLightSerializer,
    TeamDetailSerializer,
    TeamLightSerializer,
    TradeProposeSerializer,
    TradeSerializer,
    TransactionSerializer,
    WeekSerializer,
)


# -----------------------------------------------------------------------------
# Players
# -----------------------------------------------------------------------------

class PlayerListView(generics.ListAPIView):
    serializer_class = PlayerLightSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Player.objects.all().prefetch_related("season_averages")
        params = self.request.query_params

        position = params.get("position")
        team = params.get("team")
        search = params.get("search")
        only_available_in_league = params.get("available_in_league")

        if position and position not in {"All", "ALL", ""}:
            qs = qs.filter(primary_position=position)
        if team and team not in {"All", "ALL", ""}:
            qs = qs.filter(team_abbr=team)
        if search:
            qs = qs.filter(full_name__icontains=search)
        if only_available_in_league:
            qs = qs.exclude(roster_entries__team__league_id=int(only_available_in_league))

        return qs.distinct()


class PlayerDetailView(generics.RetrieveAPIView):
    queryset = Player.objects.all().prefetch_related("season_averages")
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]


# -----------------------------------------------------------------------------
# Leagues
# -----------------------------------------------------------------------------

class LeagueListCreateView(generics.ListCreateAPIView):
    """List leagues the user is a member of; create a new league."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            League.objects.filter(members__user=self.request.user)
            .annotate(member_count=Count("members"))
            .distinct()
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        return LeagueCreateSerializer if self.request.method == "POST" else LeagueListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = LeagueCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        league = serializer.save(commissioner=request.user)

        # Commissioner becomes the first member + team
        member = LeagueMember.objects.create(
            league=league,
            user=request.user,
            slot=1,
            is_commissioner=True,
        )
        Team.objects.create(
            league=league,
            member=member,
            name=request.data.get("team_name") or f"{request.user.name}'s Team",
        )
        Draft.objects.create(league=league)

        return Response(
            LeagueDetailSerializer(league, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class LeagueDetailView(generics.RetrieveAPIView):
    serializer_class = LeagueDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]
    queryset = League.objects.all().select_related("commissioner").prefetch_related(
        "members", "members__user", "teams", "teams__member", "teams__member__user",
    )
    lookup_url_kwarg = "league_id"


class LeagueJoinView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = LeagueJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_code = serializer.validated_data["invite_code"].upper().strip()
        team_name = serializer.validated_data.get("team_name")

        try:
            league = League.objects.get(invite_code=invite_code)
        except League.DoesNotExist:
            return Response({"detail": "Invalid invite code."}, status=404)

        if LeagueMember.objects.filter(league=league, user=request.user).exists():
            return Response({"detail": "You are already a member of this league."}, status=400)

        existing_count = league.members.count()
        if existing_count >= league.max_teams:
            return Response({"detail": "League is full."}, status=400)

        member = LeagueMember.objects.create(
            league=league,
            user=request.user,
            slot=existing_count + 1,
        )
        Team.objects.create(
            league=league,
            member=member,
            name=team_name or f"{request.user.name}'s Team",
        )

        return Response(
            LeagueDetailSerializer(league, context={"request": request}).data,
            status=200,
        )


# -----------------------------------------------------------------------------
# Teams
# -----------------------------------------------------------------------------

class TeamDetailView(generics.RetrieveAPIView):
    queryset = Team.objects.all().select_related("member", "member__user", "league").prefetch_related(
        "roster_entries", "roster_entries__player",
    )
    serializer_class = TeamDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]


class TeamLineupView(views.APIView):
    """GET: current week's lineup. POST: set lineup for a week."""
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    def get(self, request, pk):
        team = get_object_or_404(Team, pk=pk)
        self.check_object_permissions(request, team)
        week_id = request.query_params.get("week_id")
        if week_id:
            week = get_object_or_404(Week, pk=week_id, league=team.league)
            entries = LineupEntry.objects.filter(team=team, game_date__range=(week.start_date, week.end_date))
        else:
            entries = LineupEntry.objects.filter(team=team)
        entries = entries.select_related("player").order_by("game_date", "slot")
        return Response(LineupEntrySerializer(entries, many=True).data)

    @transaction.atomic
    def post(self, request, pk):
        team = get_object_or_404(Team, pk=pk)
        self.check_object_permissions(request, team)

        # Owner check: only the team owner (or commissioner) can set their lineup.
        member = LeagueMember.objects.filter(league=team.league, user=request.user).first()
        is_owner = member and member.team_id == team.id
        is_commissioner = member and member.is_commissioner
        is_admin = request.user.is_staff
        if not (is_owner or is_commissioner or is_admin):
            return Response({"detail": "Only the team owner or commissioner can set this lineup."}, status=403)

        serializer = LineupSetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        week = get_object_or_404(Week, pk=serializer.validated_data["week_id"], league=team.league)

        roster_player_ids = set(team.roster_entries.values_list("player_id", flat=True))
        valid_slots = {s["slot"]: s for s in team.league.roster_template}
        assignments = serializer.validated_data["assignments"]

        used_player_ids: set[int] = set()
        for slot_name, player_id in assignments.items():
            if slot_name not in valid_slots:
                return Response({"detail": f"Unknown slot: {slot_name}"}, status=400)
            if player_id not in roster_player_ids:
                return Response({"detail": f"Player {player_id} is not on this roster."}, status=400)
            if player_id in used_player_ids:
                return Response({"detail": f"Player {player_id} assigned to multiple slots."}, status=400)
            used_player_ids.add(player_id)

        # Replicate across the week
        from datetime import timedelta
        cursor = week.start_date
        while cursor <= week.end_date:
            for slot_name, player_id in assignments.items():
                LineupEntry.objects.update_or_create(
                    team=team, game_date=cursor, slot=slot_name,
                    defaults={"player_id": player_id},
                )
            cursor = cursor + timedelta(days=1)

        Transaction.objects.create(
            league=team.league,
            team=team,
            type=TransactionType.LINEUP_SET,
            summary=f"{team.name} set lineup for week {week.week_number}",
            payload={"week_id": week.id, "assignments": assignments},
        )

        entries = LineupEntry.objects.filter(team=team, game_date__range=(week.start_date, week.end_date))
        return Response(LineupEntrySerializer(entries, many=True).data)


# -----------------------------------------------------------------------------
# Standings + weeks
# -----------------------------------------------------------------------------

@api_view(["GET"])
@perm_decorator([permissions.IsAuthenticated, IsLeagueMember])
def standings(request, league_id):
    league = get_object_or_404(League, pk=league_id)
    teams = league.teams.select_related("member", "member__user").order_by(
        "-wins", "-points_for", "-points_against"
    )
    return Response(TeamLightSerializer(teams, many=True).data)


class WeekListView(generics.ListAPIView):
    serializer_class = WeekSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    def get_queryset(self):
        league_id = self.kwargs["league_id"]
        return Week.objects.filter(league_id=league_id).prefetch_related(
            "matchups", "matchups__home_team", "matchups__away_team",
            "matchups__home_team__member", "matchups__away_team__member",
        ).order_by("week_number")


class WeekDetailView(generics.RetrieveAPIView):
    serializer_class = WeekSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    def get_queryset(self):
        return Week.objects.prefetch_related(
            "matchups", "matchups__home_team", "matchups__away_team",
        )

    def get_object(self):
        return get_object_or_404(
            Week,
            league_id=self.kwargs["league_id"],
            week_number=self.kwargs["week_number"],
        )


# -----------------------------------------------------------------------------
# Draft
# -----------------------------------------------------------------------------

class DraftDetailView(generics.RetrieveAPIView):
    serializer_class = DraftSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    def get_object(self):
        league_id = self.kwargs["league_id"]
        return get_object_or_404(Draft, league_id=league_id)


class DraftPickView(views.APIView):
    """Make a single draft pick. The on-the-clock member must be the actor."""
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    @transaction.atomic
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        draft = get_object_or_404(Draft, league=league)

        if draft.status != DraftStatus.IN_PROGRESS:
            return Response({"detail": "Draft is not in progress."}, status=400)

        from .schedule import snake_pick_pointer
        on_clock_member_id = snake_pick_pointer(draft.draft_order, draft.current_pick_index)
        actor_member = LeagueMember.objects.filter(league=league, user=request.user).first()
        if not actor_member or actor_member.id != on_clock_member_id:
            if not request.user.is_staff:
                return Response({"detail": "Not your pick."}, status=403)

        player_id = request.data.get("player_id")
        if not player_id:
            return Response({"detail": "player_id required."}, status=400)
        player = get_object_or_404(Player, pk=player_id)

        if DraftSelection.objects.filter(draft=draft, player=player).exists():
            return Response({"detail": "Player already drafted."}, status=400)

        member = LeagueMember.objects.get(pk=on_clock_member_id)
        team = member.team
        round_number = (draft.current_pick_index // len(draft.draft_order)) + 1

        DraftSelection.objects.create(
            draft=draft,
            member=member,
            player=player,
            pick_number=draft.current_pick_index + 1,
            round_number=round_number,
        )
        Roster.objects.create(team=team, player=player, acquired_via="draft")
        Transaction.objects.create(
            league=league,
            team=team,
            type=TransactionType.DRAFT_PICK,
            summary=f"{team.name} drafted {player.full_name} (pick {draft.current_pick_index + 1})",
            payload={"player_id": player.id, "pick_number": draft.current_pick_index + 1},
        )

        draft.current_pick_index += 1
        total_picks = len(draft.draft_order) * league.roster_size
        if draft.current_pick_index >= total_picks:
            draft.status = DraftStatus.COMPLETE
            draft.completed_at = datetime.now(timezone.utc)
            league.status = LeagueStatus.REGULAR
            league.save(update_fields=["status"])
        draft.save()

        return Response(DraftSerializer(draft).data, status=200)


# -----------------------------------------------------------------------------
# Trades
# -----------------------------------------------------------------------------

class TradeListView(generics.ListAPIView):
    serializer_class = TradeSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    def get_queryset(self):
        league_id = self.kwargs["league_id"]
        return Trade.objects.filter(league_id=league_id).prefetch_related(
            "assets", "assets__player", "assets__from_team", "assets__to_team",
            "proposer", "recipient",
        ).order_by("-proposed_at")


class TradeProposeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    @transaction.atomic
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        member = LeagueMember.objects.filter(league=league, user=request.user).first()
        if not member or not getattr(member, "team", None):
            return Response({"detail": "You don't have a team in this league."}, status=400)
        proposer_team = member.team

        serializer = TradeProposeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        recipient_team = get_object_or_404(Team, pk=data["recipient_team_id"], league=league)
        if recipient_team == proposer_team:
            return Response({"detail": "You can't trade with yourself."}, status=400)

        proposer_pids = set(data["proposer_player_ids"])
        recipient_pids = set(data["recipient_player_ids"])
        proposer_owns = set(proposer_team.roster_entries.values_list("player_id", flat=True))
        recipient_owns = set(recipient_team.roster_entries.values_list("player_id", flat=True))
        if not proposer_pids.issubset(proposer_owns):
            return Response({"detail": "Proposer does not own all listed players."}, status=400)
        if not recipient_pids.issubset(recipient_owns):
            return Response({"detail": "Recipient does not own all listed players."}, status=400)

        trade = Trade.objects.create(
            league=league,
            proposer=proposer_team,
            recipient=recipient_team,
            note=data.get("note", ""),
        )
        for pid in proposer_pids:
            TradeAsset.objects.create(trade=trade, from_team=proposer_team, to_team=recipient_team, player_id=pid)
        for pid in recipient_pids:
            TradeAsset.objects.create(trade=trade, from_team=recipient_team, to_team=proposer_team, player_id=pid)

        return Response(TradeSerializer(trade).data, status=201)


class TradeRespondView(views.APIView):
    """Accept/reject/cancel a trade. Auto-processes on accept (Phase-3 default)."""
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        trade = get_object_or_404(Trade, pk=pk)
        action = request.data.get("action")
        if action not in {"accept", "reject", "cancel"}:
            return Response({"detail": "action must be one of accept|reject|cancel."}, status=400)

        actor_member = LeagueMember.objects.filter(league=trade.league, user=request.user).first()
        actor_team_id = getattr(actor_member, "team_id", None) if actor_member else None
        is_admin = request.user.is_staff

        if action == "cancel":
            if not is_admin and actor_team_id != trade.proposer_id:
                return Response({"detail": "Only the proposer can cancel."}, status=403)
            trade.status = TradeStatus.CANCELLED
        elif action == "reject":
            if not is_admin and actor_team_id != trade.recipient_id:
                return Response({"detail": "Only the recipient can reject."}, status=403)
            trade.status = TradeStatus.REJECTED
        else:  # accept
            if not is_admin and actor_team_id != trade.recipient_id:
                return Response({"detail": "Only the recipient can accept."}, status=403)
            if trade.status != TradeStatus.PROPOSED:
                return Response({"detail": "Trade is no longer pending."}, status=400)
            _execute_trade(trade)
            trade.status = TradeStatus.PROCESSED
            trade.processed_at = datetime.now(timezone.utc)

        trade.responded_at = datetime.now(timezone.utc)
        trade.save()
        return Response(TradeSerializer(trade).data)


def _execute_trade(trade: Trade) -> None:
    """Move players between teams per the trade's assets."""
    for asset in trade.assets.all():
        Roster.objects.filter(team=asset.from_team, player=asset.player).delete()
        Roster.objects.create(
            team=asset.to_team,
            player=asset.player,
            acquired_via="trade",
        )
    Transaction.objects.create(
        league=trade.league,
        team=trade.recipient,
        type=TransactionType.TRADE,
        summary=(
            f"Trade #{trade.id}: {trade.proposer.name} ↔ {trade.recipient.name}"
        ),
        payload={"trade_id": trade.id},
    )


# -----------------------------------------------------------------------------
# Activity log
# -----------------------------------------------------------------------------

class TransactionListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    def get_queryset(self):
        return Transaction.objects.filter(league_id=self.kwargs["league_id"]).order_by("-created_at")[:200]
