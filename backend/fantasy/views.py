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
    DEFAULT_SCORING_WEIGHTS,
    LineupEntry,
    Matchup,
    Player,
    PlayerSeasonAverage,
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
    PlayerGameStatsSerializer,
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

_DB_STAT_FIELDS = {
    # ordering/threshold key → PlayerSeasonAverage column
    "pts": "pts",
    "reb": "reb",
    "ast": "ast",
    "stl": "stl",
    "blk": "blk",
    "tov": "tov",
    "min": "minutes",
    "fg_pct": "fg_pct",
    "ft_pct": "ft_pct",
    "fg3_pct": "fg3_pct",
    "fg3m": "fg3m",
    "gp": "games_played",
}


def _fppg_expression(prefix: str = ""):
    """SQL expression mirroring PlayerSeasonAverage.fantasy_ppg property.
    `prefix` is the join path, e.g. "season_averages__" when annotating a Player
    queryset, or "" when annotating PlayerSeasonAverage itself."""
    from django.db.models import ExpressionWrapper, F, FloatField

    w = DEFAULT_SCORING_WEIGHTS
    return ExpressionWrapper(
        F(f"{prefix}pts") * w["pts"]
        + F(f"{prefix}reb") * w["reb"]
        + F(f"{prefix}ast") * w["ast"]
        + F(f"{prefix}stl") * w["stl"]
        + F(f"{prefix}blk") * w["blk"]
        + F(f"{prefix}tov") * w["tov"],
        output_field=FloatField(),
    )


class PlayerListView(generics.ListAPIView):
    """ESPN-spreadsheet-style player list. Returns full Player payload so the
    table can render every stat column inline.

    Query params:
      position, team, search, health, available_in_league — filtering
      min_fppg, min_pts, min_min, min_gp — stat-threshold filters (player kept
        if any of their season_averages rows meets the threshold)
      ordering — one of fppg/pts/reb/ast/stl/blk/tov/min/fg_pct/ft_pct/fg3_pct/
                 fg3m/gp/name, prefix with '-' for descending. Defaults to '-fppg'.
    """

    serializer_class = PlayerSerializer
    # Public NBA stats — no auth needed so the marketing landing + mock draft
    # sandbox can hit it without an account.
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.db.models import Exists, F, Max, OuterRef

        qs = Player.objects.exclude(slug="league-average").prefetch_related("season_averages")
        params = self.request.query_params

        position = params.get("position")
        team = params.get("team")
        search = params.get("search")
        only_available_in_league = params.get("available_in_league")
        health = params.get("health")  # all | healthy | injured

        if position and position not in {"All", "ALL", ""}:
            qs = qs.filter(primary_position=position)
        if team and team not in {"All", "ALL", ""}:
            qs = qs.filter(team_abbr=team)
        if search:
            qs = qs.filter(full_name__icontains=search)
        if health == "healthy":
            qs = qs.filter(is_injured=False)
        elif health == "injured":
            qs = qs.filter(is_injured=True)
        if only_available_in_league:
            qs = qs.exclude(roster_entries__team__league_id=int(only_available_in_league))

        # Stat thresholds — Exists subquery keeps a player as long as ANY of
        # their season_averages rows meets the threshold.
        threshold_specs: list[tuple[str, str | None]] = [
            ("min_fppg", None),  # FPPG is computed inline, no direct field
            ("min_pts", "pts"),
            ("min_min", "minutes"),
            ("min_gp", "games_played"),
        ]
        for param_key, db_field in threshold_specs:
            raw = params.get(param_key)
            if raw in (None, ""):
                continue
            try:
                threshold = float(raw)
            except (TypeError, ValueError):
                continue
            if db_field is None:  # FPPG threshold
                sub = (
                    PlayerSeasonAverage.objects
                    .filter(player=OuterRef("pk"))
                    .annotate(_fppg=_fppg_expression())
                    .filter(_fppg__gte=threshold)
                )
            else:
                sub = PlayerSeasonAverage.objects.filter(
                    player=OuterRef("pk"),
                    **{f"{db_field}__gte": threshold},
                )
            qs = qs.filter(Exists(sub))

        ordering_raw = params.get("ordering", "-fppg")
        descending = ordering_raw.startswith("-")
        key = ordering_raw.lstrip("-")

        if key == "name":
            qs = qs.order_by("-last_name" if descending else "last_name", "first_name")
        else:
            if key == "fppg":
                qs = qs.annotate(_sort_value=Max(_fppg_expression(prefix="season_averages__")))
            else:
                db_field = _DB_STAT_FIELDS.get(key, "pts")
                qs = qs.annotate(_sort_value=Max(f"season_averages__{db_field}"))
            direction = (
                F("_sort_value").desc(nulls_last=True)
                if descending
                else F("_sort_value").asc(nulls_last=True)
            )
            qs = qs.order_by(direction, "last_name", "first_name")

        return qs


class PlayerDetailView(generics.RetrieveAPIView):
    queryset = Player.objects.all().prefetch_related("season_averages")
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]


class PlayerGameLogView(generics.ListAPIView):
    """Recent PlayerGameStats for a single player. ?limit=N to bound the result."""

    serializer_class = PlayerGameStatsSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        from .models import PlayerGameStats
        try:
            limit = max(1, min(82, int(self.request.query_params.get("limit", 10))))
        except (TypeError, ValueError):
            limit = 10
        return (
            PlayerGameStats.objects
            .filter(player_id=self.kwargs["pk"])
            .order_by("-game_date")[:limit]
        )


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

        # Replicate across the week. Wipe the day's lineup first so that
        # moving a player between slots doesn't transiently violate the
        # (team, game_date, player) unique constraint mid-iteration.
        from datetime import timedelta
        cursor = week.start_date
        while cursor <= week.end_date:
            LineupEntry.objects.filter(team=team, game_date=cursor).delete()
            for slot_name, player_id in assignments.items():
                LineupEntry.objects.create(
                    team=team, game_date=cursor, slot=slot_name, player_id=player_id,
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
    # Compute last-5 per team from settled matchups
    settled = (
        Matchup.objects
        .filter(week__league=league, is_settled=True)
        .select_related("week", "winner")
        .order_by("-week__week_number")
    )
    by_team: dict[int, list[str]] = {}
    for m in settled:
        for tid in (m.home_team_id, m.away_team_id):
            results = by_team.setdefault(tid, [])
            if len(results) >= 5:
                continue
            if m.winner_id is None:
                results.append("T")
            elif m.winner_id == tid:
                results.append("W")
            else:
                results.append("L")

    payload = TeamLightSerializer(teams, many=True).data
    for row in payload:
        # most-recent-first → reverse so the sparkline reads left-to-right oldest→newest
        row["last_5"] = list(reversed(by_team.get(row["id"], [])))
    return Response(payload)


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


def _record_pick(draft, league, member, player, taken_player_ids):
    """Persist a single draft selection plus its roster + transaction rows.
    Mutates draft.current_pick_index. Caller is responsible for saving the draft."""
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
        payload={
            "player_id": player.id,
            "pick_number": draft.current_pick_index + 1,
            "round_number": round_number,
            "is_bot": member.is_bot,
        },
    )
    taken_player_ids.add(player.id)
    draft.current_pick_index += 1


def _autofill_bots(draft, league, taken_player_ids):
    """Auto-pick for every consecutive bot starting at the on-the-clock pointer.
    Stops at the next human, at the end of the draft, or if the draft is paused.
    Returns the number of bot picks made. Caller should save the draft + league."""
    from .schedule import snake_pick_pointer

    total_picks = len(draft.draft_order) * league.roster_size
    bots_picked = 0
    while draft.current_pick_index < total_picks and not draft.is_paused:
        member_id = snake_pick_pointer(draft.draft_order, draft.current_pick_index)
        member = LeagueMember.objects.get(pk=member_id)
        if not member.is_bot:
            break
        player = autopick_for_member(league, taken_player_ids)
        if player is None:
            break
        _record_pick(draft, league, member, player, taken_player_ids)
        bots_picked += 1

    if draft.current_pick_index >= total_picks:
        draft.status = DraftStatus.COMPLETE
        draft.completed_at = datetime.now(timezone.utc)
        league.status = LeagueStatus.REGULAR
        league.save(update_fields=["status"])

    return bots_picked


class DraftPickView(views.APIView):
    """Make a single draft pick. The on-the-clock member must be the actor."""
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    @transaction.atomic
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        draft = get_object_or_404(Draft, league=league)

        if draft.status != DraftStatus.IN_PROGRESS:
            return Response({"detail": "Draft is not in progress."}, status=400)
        if draft.is_paused and not request.user.is_staff:
            return Response({"detail": "Draft is paused."}, status=400)

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
        taken_player_ids = set(
            DraftSelection.objects.filter(draft=draft).values_list("player_id", flat=True)
        )

        _record_pick(draft, league, member, player, taken_player_ids)
        # After the human pick, auto-fill any bots until the next human turn
        # (or end of draft).
        _autofill_bots(draft, league, taken_player_ids)
        draft.save()

        return Response(DraftSerializer(draft).data, status=200)


class DraftStartView(views.APIView):
    """Kick off the draft. Anyone in the league can start it; the draft will
    auto-fill bot picks until the next human is on the clock."""
    permission_classes = [permissions.IsAuthenticated, IsLeagueMember]

    @transaction.atomic
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        draft = get_object_or_404(Draft, league=league)

        if draft.status == DraftStatus.COMPLETE:
            return Response({"detail": "Draft already complete."}, status=400)
        if draft.status == DraftStatus.NOT_STARTED:
            draft.status = DraftStatus.IN_PROGRESS
            draft.started_at = datetime.now(timezone.utc)
            draft.is_paused = False
            league.status = LeagueStatus.DRAFTING
            league.save(update_fields=["status"])

        taken = set(DraftSelection.objects.filter(draft=draft).values_list("player_id", flat=True))
        _autofill_bots(draft, league, taken)
        draft.save()
        return Response(DraftSerializer(draft).data)


class DraftCommissionerView(views.APIView):
    """Pause / resume / undo / reset endpoints. Commissioner-only.

    POST body: {"action": "pause" | "resume" | "undo" | "reset"}"""
    permission_classes = [permissions.IsAuthenticated, IsLeagueCommissioner]

    @transaction.atomic
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        draft = get_object_or_404(Draft, league=league)
        action = request.data.get("action")

        if action == "pause":
            draft.is_paused = True
            draft.save(update_fields=["is_paused"])
        elif action == "resume":
            draft.is_paused = False
            draft.save(update_fields=["is_paused"])
            if draft.status == DraftStatus.IN_PROGRESS:
                taken = set(DraftSelection.objects.filter(draft=draft).values_list("player_id", flat=True))
                _autofill_bots(draft, league, taken)
                draft.save()
        elif action == "undo":
            last = DraftSelection.objects.filter(draft=draft).order_by("-pick_number").first()
            if last is None:
                return Response({"detail": "No picks to undo."}, status=400)
            # Remove the roster entry, the selection, and the matching transaction.
            Roster.objects.filter(team=last.member.team, player=last.player).delete()
            Transaction.objects.filter(
                league=league,
                type=TransactionType.DRAFT_PICK,
                payload__pick_number=last.pick_number,
            ).delete()
            last.delete()
            draft.current_pick_index = max(0, draft.current_pick_index - 1)
            if draft.status == DraftStatus.COMPLETE:
                draft.status = DraftStatus.IN_PROGRESS
                draft.completed_at = None
                league.status = LeagueStatus.DRAFTING
                league.save(update_fields=["status"])
            draft.save()
        elif action == "reset":
            # Wipe selections, rosters from this draft's picks, transactions, and
            # rewind the draft. Keeps the draft order intact.
            picks = list(DraftSelection.objects.filter(draft=draft).values_list("pick_number", flat=True))
            for sel in DraftSelection.objects.filter(draft=draft).select_related("member__team", "player"):
                Roster.objects.filter(team=sel.member.team, player=sel.player).delete()
            DraftSelection.objects.filter(draft=draft).delete()
            Transaction.objects.filter(
                league=league,
                type=TransactionType.DRAFT_PICK,
                payload__pick_number__in=picks,
            ).delete()
            draft.status = DraftStatus.NOT_STARTED
            draft.current_pick_index = 0
            draft.started_at = None
            draft.completed_at = None
            draft.is_paused = False
            draft.save()
            league.status = LeagueStatus.SETUP
            league.save(update_fields=["status"])
        else:
            return Response({"detail": f"Unknown action: {action!r}"}, status=400)

        return Response(DraftSerializer(draft).data)


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
            Transaction.objects.create(
                league=trade.league,
                team=trade.proposer,
                type=TransactionType.TRADE_CANCELLED,
                summary=f"Trade #{trade.id} cancelled by {trade.proposer.name}",
                payload={"trade_id": trade.id},
            )
        elif action == "reject":
            if not is_admin and actor_team_id != trade.recipient_id:
                return Response({"detail": "Only the recipient can reject."}, status=403)
            trade.status = TradeStatus.REJECTED
            Transaction.objects.create(
                league=trade.league,
                team=trade.recipient,
                type=TransactionType.TRADE_REJECTED,
                summary=f"Trade #{trade.id} rejected by {trade.recipient.name}",
                payload={"trade_id": trade.id},
            )
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
