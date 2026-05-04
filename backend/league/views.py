import random

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from players.models import Player
from players.serializers import PlayerSerializer
from .models import (
    League,
    LeagueMember,
    FantasyTeam,
    FantasyTeamPlayer,
    Draft,
    DraftPick,
    Playoff,
    PlayoffMatchup,
    Trade,
    TradePlayer,
)
from .serializers import (
    LeagueSerializer,
    LeagueCreateSerializer,
    StartDraftSerializer,
    MakePickSerializer,
    ResetLeagueSerializer,
    DraftSettingsSerializer,
    TradeSerializer,
    ProposeTradeSerializer,
    TradeActionSerializer,
    PlayoffBracketSerializer,
    PlayoffMatchupSerializer,
    StartPlayoffsSerializer,
    SimulateMatchupSerializer,
)
from .playoffs import PlayoffError, start_playoffs, simulate_matchup, get_bracket_state

def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _get_member_by_email(league, email):
    return league.members.filter(email=_normalize_email(email)).first()


def _advance_turn(draft, member_count):
    if draft.current_slot >= member_count:
        draft.current_slot = 1
        draft.round += 1
    else:
        draft.current_slot += 1

    draft.pick_number += 1

class LeagueListCreate(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        leagues = League.objects.all().order_by("-created_at")
        serializer = LeagueSerializer(leagues, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = LeagueCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data["name"]
        commissioner_email = _normalize_email(serializer.validated_data["commissioner_email"])
        invite_emails = serializer.validated_data.get("invite_emails", [])
        max_players = serializer.validated_data.get("max_players", 4)
        roster_size = serializer.validated_data.get("roster_size", 12)

        if max_players < 2 or max_players > 4:
            return Response(
                {"error": "max_players must be between 2 and 4"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned_invites = []
        for email in invite_emails:
            normalized = _normalize_email(email)
            if normalized and normalized != commissioner_email and normalized not in cleaned_invites:
                cleaned_invites.append(normalized)

        total_members = 1 + len(cleaned_invites)
        if total_members > max_players:
            return Response(
                {"error": f"Too many invite emails for max_players={max_players}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            league = League.objects.create(
                name=name,
                commissioner_email=commissioner_email,
                max_players=max_players,
                roster_size=roster_size,
                status=League.Status.SETUP,
            )

            commissioner = LeagueMember.objects.create(
                league=league,
                email=commissioner_email,
                display_name="Commissioner",
                slot=1,
                is_commissioner=True,
            )
            FantasyTeam.objects.create(
                league=league,
                member=commissioner,
                name="Commissioner Team"
            )

            slot = 2
            for email in cleaned_invites:
                member = LeagueMember.objects.create(
                    league=league,
                    email=email,
                    display_name=email.split("@")[0],
                    slot=slot,
                    is_commissioner=False,
                )
                FantasyTeam.objects.create(
                    league=league,
                    member=member,
                    name=f"{member.display_name}'s Team"
                )
                slot += 1

            Draft.objects.create(league=league)

        return Response(LeagueSerializer(league).data, status=status.HTTP_201_CREATED)


class SeedExampleLeague(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        """Create (or return existing) example league for local testing."""
        league_name = "Example League"
        commissioner_email = "example.manager@email.com"

        with transaction.atomic():
            league, _ = League.objects.get_or_create(
                name=league_name,
                commissioner_email=commissioner_email,
                defaults={
                    "max_players": 4,
                    "roster_size": 12,
                    "status": League.Status.SETUP,
                },
            )

            commissioner, _ = LeagueMember.objects.get_or_create(
                league=league,
                email=commissioner_email,
                defaults={
                    "display_name": "Example Manager",
                    "slot": 1,
                    "is_commissioner": True,
                },
            )

            FantasyTeam.objects.get_or_create(
                league=league,
                member=commissioner,
                defaults={"name": "Empty Test Team"},
            )

            Draft.objects.get_or_create(league=league)

        return Response(LeagueSerializer(league).data, status=status.HTTP_200_OK)


class LeagueDetail(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        serializer = LeagueSerializer(league)

        data = serializer.data
        actions = {
            "start_draft": request.build_absolute_uri(f"/api/leagues/{league.id}/start-draft/"),
            "make_pick": request.build_absolute_uri(f"/api/leagues/{league.id}/pick/"),
            "teams": request.build_absolute_uri(f"/api/leagues/{league.id}/teams/"),
            "reset": request.build_absolute_uri(f"/api/leagues/{league.id}/reset/"),
            "draft_settings": request.build_absolute_uri(f"/api/leagues/{league.id}/draft-settings/"),
            "draft_settings_reset": request.build_absolute_uri(f"/api/leagues/{league.id}/draft-settings/reset/"),
            "fill_bots": request.build_absolute_uri(f"/api/leagues/{league.id}/fill-bots/"),
            "view_trades": request.build_absolute_uri(f"/api/leagues/{league.id}/trades/"),
            "propose_trade": request.build_absolute_uri(f"/api/leagues/{league.id}/trades/propose/"),
        }

        draft = getattr(league, "draft", None)
        if league.status == League.Status.ACTIVE and draft and draft.status == Draft.Status.COMPLETE:
            actions["start_playoffs"] = request.build_absolute_uri(
                f"/api/leagues/{league.id}/start-playoffs/"
            )

        if league.status in (League.Status.PLAYOFFS, League.Status.COMPLETE):
            actions["bracket"] = request.build_absolute_uri(
                f"/api/leagues/{league.id}/bracket/"
            )
            actions["simulate_matchup"] = request.build_absolute_uri(
                f"/api/leagues/{league.id}/matchups/{{matchup_id}}/simulate/"
            )

        data["actions"] = actions

        data["trade_actions_template"] = {
            "accept_trade": request.build_absolute_uri("/api/trades/{trade_id}/accept/"),
            "reject_trade": request.build_absolute_uri("/api/trades/{trade_id}/reject/"),
            "cancel_trade": request.build_absolute_uri("/api/trades/{trade_id}/cancel/"),
            "view_trade_detail": request.build_absolute_uri("/api/trades/{trade_id}/"),
        }

        return Response(data, status=status.HTTP_200_OK)


class DraftSettings(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, league_id):
        """Get current draft settings"""
        league = get_object_or_404(League, pk=league_id)
        draft, _ = Draft.objects.get_or_create(league=league)

        return Response({
            "scheduled_date": draft.scheduled_date,
            "time_per_pick": draft.time_per_pick,
            "draft_order": draft.draft_order,
            "draft_type": draft.draft_type,
        }, status=status.HTTP_200_OK)

    def post(self, request, league_id):
        """Update draft settings"""
        league = get_object_or_404(League, pk=league_id)

        if league.members.count() < league.max_players:
            return Response(
                {"error": "Draft cannot be scheduled until all league users have joined."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.GET.get("email"):
            email = _normalize_email(request.GET.get("email"))
            if email != _normalize_email(league.commissioner_email):
                return Response(
                    {"error": "Only commissioner can change draft settings"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = DraftSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        draft, _ = Draft.objects.get_or_create(league=league)

        draft.scheduled_date = serializer.validated_data["scheduled_date"]
        draft.time_per_pick = serializer.validated_data["time_per_pick"]
        draft.draft_order = serializer.validated_data["draft_order"]
        draft.draft_type = Draft.DraftType.SNAKE
        draft.save()

        return Response({
            "scheduled_date": draft.scheduled_date,
            "time_per_pick": draft.time_per_pick,
            "draft_order": draft.draft_order,
            "draft_type": draft.draft_type,
        }, status=status.HTTP_200_OK)


class DraftSettingsReset(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        """Reset draft settings to defaults for testing"""
        league = get_object_or_404(League, pk=league_id)
        draft, _ = Draft.objects.get_or_create(league=league)

        draft.scheduled_date = None
        draft.time_per_pick = 90
        draft.draft_order = Draft.DraftOrder.RANDOM
        draft.draft_type = Draft.DraftType.SNAKE
        draft.status = Draft.Status.NOT_STARTED
        draft.started_at = None
        draft.save()

        return Response(
            {
                "scheduled_date": draft.scheduled_date,
                "time_per_pick": draft.time_per_pick,
                "draft_order": draft.draft_order,
                "draft_type": draft.draft_type,
            },
            status=status.HTTP_200_OK,
        )


class FillLeagueWithBots(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        """Fill remaining league slots with bot managers for testing."""
        league = get_object_or_404(League, pk=league_id)

        existing_members = list(league.members.all())
        existing_slots = {member.slot for member in existing_members}

        available_slots = [slot for slot in range(1, league.max_players + 1) if slot not in existing_slots]
        bots_added = []

        with transaction.atomic():
            for slot in available_slots:
                bot_index = slot
                while league.members.filter(email=f"bot{bot_index}@fantasy.local").exists():
                    bot_index += 10

                email = f"bot{bot_index}@fantasy.local"
                display_name = f"Bot {slot}"

                member = LeagueMember.objects.create(
                    league=league,
                    email=email,
                    display_name=display_name,
                    slot=slot,
                    is_commissioner=False,
                )

                FantasyTeam.objects.get_or_create(
                    league=league,
                    member=member,
                    defaults={"name": f"Team {slot}"},
                )

                bots_added.append({"email": email, "display_name": display_name, "slot": slot})

        return Response(
            {
                "league_id": league.id,
                "added_count": len(bots_added),
                "bots": bots_added,
            },
            status=status.HTTP_200_OK,
        )


class AutoDraftLeague(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        """Start the draft and randomly fill all team rosters in one shot (testing only)."""
        league = get_object_or_404(League, pk=league_id)

        if league.status not in (League.Status.SETUP, League.Status.DRAFTING):
            return Response(
                {"error": "League must be in SETUP or DRAFTING status to auto-draft"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if league.members.count() < 2:
            return Response(
                {"error": "At least 2 members are required before auto-drafting"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            draft, _ = Draft.objects.get_or_create(
                league=league,
                defaults={
                    "status": Draft.Status.IN_PROGRESS,
                    "current_slot": 1,
                    "round": 1,
                    "pick_number": 1,
                    "started_at": timezone.now(),
                },
            )

            if draft.status == Draft.Status.COMPLETE:
                return Response(
                    {"error": "Draft is already complete"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            draft.status = Draft.Status.IN_PROGRESS
            draft.started_at = draft.started_at or timezone.now()
            draft.save()

            already_drafted_ids = set(
                DraftPick.objects.filter(draft=draft).values_list("player_id", flat=True)
            )

            available_players = list(
                Player.objects.exclude(pk__in=already_drafted_ids)
            )
            random.shuffle(available_players)

            members = list(league.members.select_related("team").order_by("slot"))
            pick_number = draft.pick_number
            players_assigned = 0

            player_iter = iter(available_players)
            for member in members:
                team = getattr(member, "team", None)
                if not team:
                    continue
                current_count = FantasyTeamPlayer.objects.filter(team=team).count()
                slots_needed = league.roster_size - current_count
                for _ in range(slots_needed):
                    player = next(player_iter, None)
                    if player is None:
                        return Response(
                            {"error": "Not enough players in the database to fill all rosters"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    DraftPick.objects.create(
                        draft=draft,
                        pick_number=pick_number,
                        round=((pick_number - 1) // league.members.count()) + 1,
                        slot=member.slot,
                        member=member,
                        player=player,
                    )
                    FantasyTeamPlayer.objects.create(
                        team=team,
                        player=player,
                        acquired_via=FantasyTeamPlayer.AcquisitionType.DRAFT,
                    )
                    pick_number += 1
                    players_assigned += 1

            draft.status = Draft.Status.COMPLETE
            draft.save()

            league.status = League.Status.ACTIVE
            league.save(update_fields=["status"])

        return Response(
            {
                "league_id": league.id,
                "players_assigned": players_assigned,
                "message": "Draft complete. League is now ACTIVE.",
            },
            status=status.HTTP_200_OK,
        )


class StartDraft(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        serializer = StartDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        starter_email = _normalize_email(serializer.validated_data.get("starter_email", ""))

        if starter_email and starter_email != _normalize_email(league.commissioner_email):
            return Response(
                {"error": "Only commissioner can start draft"},
                status=status.HTTP_403_FORBIDDEN,
            )

        member_count = league.members.count()
        if member_count < 2:
            return Response(
                {"error": "At least 2 members are required to start draft"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            draft, created = Draft.objects.select_for_update().get_or_create(
                league=league,
                defaults={
                    "status": Draft.Status.IN_PROGRESS,
                    "current_slot": 1,
                    "round": 1,
                    "pick_number": 1,
                    "started_at": timezone.now(),
                }
            )

            if not created and draft.status == Draft.Status.IN_PROGRESS:
                return Response(
                    {"error": "Draft already in progress"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            draft.status = Draft.Status.IN_PROGRESS
            draft.current_slot = 1
            draft.round = 1
            draft.pick_number = 1
            draft.started_at = timezone.now()
            draft.save()

            league.status = League.Status.DRAFTING
            league.save(update_fields=["status"])

        league.refresh_from_db()
        return Response(LeagueSerializer(league).data, status=status.HTTP_200_OK)


class MakePick(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        serializer = MakePickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = _normalize_email(serializer.validated_data["email"])
        player_id = serializer.validated_data["player_id"]

        member = _get_member_by_email(league, email)
        if not member:
            return Response(
                {"error": "That email is not a member of this league"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        player = Player.objects.filter(person_id=player_id).first()
        if not player:
            return Response(
                {"error": "Player not found in local player database"},
                status=status.HTTP_404_NOT_FOUND,
            )

        member_count = league.members.count()

        with transaction.atomic():
            try:
                draft = Draft.objects.select_for_update().get(league=league)
            except Draft.DoesNotExist:
                return Response(
                    {"error": "Draft has not started"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if draft.status != Draft.Status.IN_PROGRESS:
                return Response(
                    {"error": "Draft is not in progress"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if member.slot != draft.current_slot:
                current_member = league.members.filter(slot=draft.current_slot).first()
                return Response(
                    {
                        "error": "Not your turn",
                        "current_turn": None if not current_member else {
                            "slot": current_member.slot,
                            "email": current_member.email,
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if DraftPick.objects.filter(draft=draft, player=player).exists():
                return Response(
                    {"error": "Player already drafted"},
                    status=status.HTTP_409_CONFLICT,
                )

            if FantasyTeamPlayer.objects.filter(team__league=league, player=player).exists():
                return Response(
                    {"error": "Player is already on a fantasy roster in this league"},
                    status=status.HTTP_409_CONFLICT,
                )

            current_member_pick_count = FantasyTeamPlayer.objects.filter(team=member.team).count()
            if current_member_pick_count >= league.roster_size:
                return Response(
                    {"error": "This member has already drafted the maximum number of players"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            DraftPick.objects.create(
                draft=draft,
                pick_number=draft.pick_number,
                round=draft.round,
                slot=member.slot,
                member=member,
                player=player,
            )

            FantasyTeamPlayer.objects.create(
                team=member.team,
                player=player,
                acquired_via=FantasyTeamPlayer.AcquisitionType.DRAFT,
            )

            total_possible_picks = league.members.count() * league.roster_size
            current_pick_total = FantasyTeamPlayer.objects.filter(team__league=league).count()

            if current_pick_total >= total_possible_picks:
                draft.status = Draft.Status.COMPLETE
                league.status = League.Status.ACTIVE
            else:
                _advance_turn(draft, member_count)

            draft.save()
            league.save(update_fields=["status"])

        league.refresh_from_db()
        return Response(LeagueSerializer(league).data, status=status.HTTP_200_OK)


class LeagueTeams(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)

        teams_data = []

        for member in league.members.all().order_by("slot"):
            roster_entries = member.team.roster.select_related("player").order_by("acquired_at")
            players = [
                {
                    "entry_id": entry.id,
                    "acquired_via": entry.acquired_via,
                    "acquired_at": entry.acquired_at,
                    "player": PlayerSerializer(entry.player).data,
                }
                for entry in roster_entries
            ]

            teams_data.append({
                "member": {
                    "id": member.id,
                    "email": member.email,
                    "display_name": member.display_name,
                    "slot": member.slot,
                    "is_commissioner": member.is_commissioner,
                },
                "team_name": getattr(member.team, "name", ""),
                "players": players,
            })

        return Response(
            {
                "league_id": league.id,
                "teams": teams_data,
            },
            status=status.HTTP_200_OK,
        )


class ResetLeague(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        serializer = ResetLeagueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        starter_email = _normalize_email(serializer.validated_data.get("starter_email", ""))

        if starter_email and starter_email != _normalize_email(league.commissioner_email):
            return Response(
                {"error": "Only commissioner can reset league"},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            draft = Draft.objects.filter(league=league).first()
            if draft:
                DraftPick.objects.filter(draft=draft).delete()
                draft.delete()

            FantasyTeamPlayer.objects.filter(team__league=league).delete()

            league.status = League.Status.SETUP
            league.save(update_fields=["status"])

            Draft.objects.create(league=league)

        league.refresh_from_db()
        return Response(LeagueSerializer(league).data, status=status.HTTP_200_OK)
    
class LeagueTrades(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        trades = league.trades.select_related("proposed_by", "proposed_to").prefetch_related("trade_players__player", "trade_players__from_member").order_by("-created_at")
        return Response(TradeSerializer(trades, many=True).data, status=status.HTTP_200_OK)


class ProposeTrade(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, league_id):
        return Response(
            {
                "message": "Use POST to propose a trade.",
                "example": {
                    "proposed_by_email": "me@test.com",
                    "proposed_to_email": "a@test.com",
                    "offered_player_ids": [2544],
                    "requested_player_ids": [201939],
                },
            },
            status=status.HTTP_200_OK,
        )
        
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)

        if league.status != League.Status.ACTIVE:
            return Response(
                {"error": "Trades can only be proposed when the league is active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProposeTradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        proposed_by_email = _normalize_email(serializer.validated_data["proposed_by_email"])
        proposed_to_email = _normalize_email(serializer.validated_data["proposed_to_email"])
        offered_player_ids = serializer.validated_data["offered_player_ids"]
        requested_player_ids = serializer.validated_data["requested_player_ids"]

        if proposed_by_email == proposed_to_email:
            return Response(
                {"error": "You cannot propose a trade to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        proposed_by = _get_member_by_email(league, proposed_by_email)
        proposed_to = _get_member_by_email(league, proposed_to_email)

        if not proposed_by or not proposed_to:
            return Response(
                {"error": "Both users must be members of this league."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(set(offered_player_ids)) != len(offered_player_ids):
            return Response(
                {"error": "Duplicate offered players are not allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(set(requested_player_ids)) != len(requested_player_ids):
            return Response(
                {"error": "Duplicate requested players are not allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            trade = Trade.objects.create(
                league=league,
                proposed_by=proposed_by,
                proposed_to=proposed_to,
                status=Trade.Status.PENDING,
            )

            # Offered players must currently belong to proposed_by
            for person_id in offered_player_ids:
                player = Player.objects.filter(person_id=person_id).first()
                if not player:
                    transaction.set_rollback(True)
                    return Response(
                        {"error": f"Offered player {person_id} was not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                owns_player = FantasyTeamPlayer.objects.filter(
                    team=proposed_by.team,
                    player=player
                ).exists()

                if not owns_player:
                    transaction.set_rollback(True)
                    return Response(
                        {"error": f"{proposed_by.email} does not own player {person_id}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                TradePlayer.objects.create(
                    trade=trade,
                    player=player,
                    from_member=proposed_by,
                )

            # Requested players must currently belong to proposed_to
            for person_id in requested_player_ids:
                player = Player.objects.filter(person_id=person_id).first()
                if not player:
                    transaction.set_rollback(True)
                    return Response(
                        {"error": f"Requested player {person_id} was not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                owns_player = FantasyTeamPlayer.objects.filter(
                    team=proposed_to.team,
                    player=player
                ).exists()

                if not owns_player:
                    transaction.set_rollback(True)
                    return Response(
                        {"error": f"{proposed_to.email} does not own player {person_id}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                TradePlayer.objects.create(
                    trade=trade,
                    player=player,
                    from_member=proposed_to,
                )

        return Response(TradeSerializer(trade).data, status=status.HTTP_201_CREATED)


class TradeDetail(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, trade_id):
        trade = get_object_or_404(
            Trade.objects.select_related("proposed_by", "proposed_to").prefetch_related("trade_players__player", "trade_players__from_member"),
            pk=trade_id
        )
        return Response(TradeSerializer(trade).data, status=status.HTTP_200_OK)


class AcceptTrade(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, trade_id):
        trade = get_object_or_404(Trade, pk=trade_id)
        serializer = TradeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        acting_email = _normalize_email(serializer.validated_data["acting_email"])

        if trade.status != Trade.Status.PENDING:
            return Response(
                {"error": "Only pending trades can be accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if acting_email != _normalize_email(trade.proposed_to.email):
            return Response(
                {"error": "Only the receiving user can accept this trade."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            trade_players = list(trade.trade_players.select_related("player", "from_member"))

            # Verify all players are still owned by the expected members
            for trade_player in trade_players:
                expected_team = trade_player.from_member.team
                still_owned = FantasyTeamPlayer.objects.filter(
                    team=expected_team,
                    player=trade_player.player
                ).exists()

                if not still_owned:
                    return Response(
                        {"error": f"{trade_player.player.full_name} is no longer on the expected roster."},
                        status=status.HTTP_409_CONFLICT,
                    )

            # Move players
            for trade_player in trade_players:
                current_entry = FantasyTeamPlayer.objects.get(
                    team=trade_player.from_member.team,
                    player=trade_player.player
                )

                if trade_player.from_member_id == trade.proposed_by_id:
                    new_team = trade.proposed_to.team
                else:
                    new_team = trade.proposed_by.team

                current_entry.team = new_team
                current_entry.acquired_via = FantasyTeamPlayer.AcquisitionType.TRADE
                current_entry.save()

            trade.status = Trade.Status.ACCEPTED
            trade.responded_at = timezone.now()
            trade.save()

        return Response(TradeSerializer(trade).data, status=status.HTTP_200_OK)


class RejectTrade(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, trade_id):
        trade = get_object_or_404(Trade, pk=trade_id)
        serializer = TradeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        acting_email = _normalize_email(serializer.validated_data["acting_email"])

        if trade.status != Trade.Status.PENDING:
            return Response(
                {"error": "Only pending trades can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if acting_email != _normalize_email(trade.proposed_to.email):
            return Response(
                {"error": "Only the receiving user can reject this trade."},
                status=status.HTTP_403_FORBIDDEN,
            )

        trade.status = Trade.Status.REJECTED
        trade.responded_at = timezone.now()
        trade.save()

        return Response(TradeSerializer(trade).data, status=status.HTTP_200_OK)


class CancelTrade(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, trade_id):
        trade = get_object_or_404(Trade, pk=trade_id)
        serializer = TradeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        acting_email = _normalize_email(serializer.validated_data["acting_email"])

        if trade.status != Trade.Status.PENDING:
            return Response(
                {"error": "Only pending trades can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if acting_email != _normalize_email(trade.proposed_by.email):
            return Response(
                {"error": "Only the proposing user can cancel this trade."},
                status=status.HTTP_403_FORBIDDEN,
            )

        trade.status = Trade.Status.CANCELLED
        trade.responded_at = timezone.now()
        trade.save()

        return Response(TradeSerializer(trade).data, status=status.HTTP_200_OK)


# ── Playoff views ──────────────────────────────────────────────────────────────

class StartPlayoffs(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)
        serializer = StartPlayoffsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        commissioner_email = _normalize_email(serializer.validated_data["commissioner_email"])
        if commissioner_email != _normalize_email(league.commissioner_email):
            return Response(
                {"error": "Only the commissioner can start playoffs"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            playoff = start_playoffs(league)
        except PlayoffError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        playoff_with_matchups = (
            Playoff.objects.select_related("champion")
            .prefetch_related("matchups__team_a", "matchups__team_b", "matchups__winner", "matchups__player_stats__player", "matchups__player_stats__team")
            .get(pk=playoff.pk)
        )
        return Response(PlayoffBracketSerializer(playoff_with_matchups).data, status=status.HTTP_201_CREATED)


class PlayoffBracket(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, league_id):
        league = get_object_or_404(League, pk=league_id)

        if league.status not in (League.Status.PLAYOFFS, League.Status.COMPLETE):
            return Response(
                {"error": "Playoffs have not started for this league"},
                status=status.HTTP_404_NOT_FOUND,
            )

        playoff = get_object_or_404(
            Playoff.objects.select_related("champion")
            .prefetch_related(
                "matchups__team_a",
                "matchups__team_b",
                "matchups__winner",
                "matchups__player_stats__player",
                "matchups__player_stats__team",
            ),
            league=league,
        )
        return Response(PlayoffBracketSerializer(playoff).data, status=status.HTTP_200_OK)


class SimulateMatchup(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, league_id, matchup_id):
        league = get_object_or_404(League, pk=league_id)
        serializer = SimulateMatchupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        commissioner_email = _normalize_email(serializer.validated_data["commissioner_email"])
        if commissioner_email != _normalize_email(league.commissioner_email):
            return Response(
                {"error": "Only the commissioner can simulate matchups"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            playoff = league.playoff
        except Playoff.DoesNotExist:
            return Response(
                {"error": "Playoffs have not started for this league"},
                status=status.HTTP_404_NOT_FOUND,
            )

        matchup = get_object_or_404(PlayoffMatchup, pk=matchup_id, playoff=playoff)

        seed = serializer.validated_data.get("seed")

        try:
            matchup = simulate_matchup(matchup, seed=seed)
        except PlayoffError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        matchup_fresh = (
            PlayoffMatchup.objects.select_related("playoff", "team_a", "team_b", "winner")
            .prefetch_related("player_stats__player", "player_stats__team")
            .get(pk=matchup.pk)
        )
        return Response(PlayoffMatchupSerializer(matchup_fresh).data, status=status.HTTP_200_OK)
