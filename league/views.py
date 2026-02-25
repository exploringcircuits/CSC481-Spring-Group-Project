# league/views.py

from __future__ import annotations
from dataclasses import dataclass
from typing import Any
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import League, LeagueMember, FantasyTeam, Draft, DraftPick


# ----------------------------
# Helpers
# ----------------------------

def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _league_member_count(league: League) -> int:
    return league.members.count()


def _get_member_by_email(league: League, email: str) -> LeagueMember | None:
    email = _normalize_email(email)
    if not email:
        return None
    return league.members.filter(email=email).first()


def _serialize_member(m: LeagueMember) -> dict[str, Any]:
    return {
        "id": m.id,
        "email": m.email,
        "display_name": m.display_name,
        "slot": m.slot,
        "is_commissioner": m.is_commissioner,
    }


def _serialize_league(league: League) -> dict[str, Any]:
    draft = getattr(league, "draft", None)
    members = list(league.members.order_by("slot"))

    current_turn = None
    if draft and draft.status == Draft.Status.IN_PROGRESS:
        current_member = next((m for m in members if m.slot == draft.current_slot), None)
        if current_member:
            current_turn = {"slot": draft.current_slot, "email": current_member.email}

    return {
        "id": league.id,
        "name": league.name,
        "commissioner_email": league.commissioner_email,
        "max_players": league.max_players,
        "status": league.status,
        "created_at": league.created_at,
        "members": [_serialize_member(m) for m in members],
        "draft": None if not draft else {
            "status": draft.status,
            "current_slot": draft.current_slot,
            "round": draft.round,
            "pick_number": draft.pick_number,
            "started_at": draft.started_at,
            "current_turn": current_turn,
        }
    }


def _advance_turn(draft: Draft, member_count: int) -> None:
    """
    Simple turn order: 1..N, wrap back to 1.
    Increments round when wrapping.
    """
    if member_count <= 0:
        return

    if draft.current_slot >= member_count:
        draft.current_slot = 1
        draft.round += 1
    else:
        draft.current_slot += 1

    draft.pick_number += 1


# ----------------------------
# Views
# ----------------------------

class LeagueListCreate(APIView):
    """
    POST /league/leagues/
    Body:
    {
      "name": "My League",
      "commissioner_email": "me@test.com",
      "invite_emails": ["a@test.com","b@test.com"],
      "max_players": 4
    }

    """

    def get(self, request):
        leagues = League.objects.order_by("-created_at")[:50]
        return Response([_serialize_league(l) for l in leagues], status=status.HTTP_200_OK)

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        commissioner_email = _normalize_email(request.data.get("commissioner_email") or "")
        invite_emails = request.data.get("invite_emails") or []
        max_players = int(request.data.get("max_players") or 4)

        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not commissioner_email:
            return Response({"error": "commissioner_email is required"}, status=status.HTTP_400_BAD_REQUEST)
        if max_players < 2 or max_players > 4:
            return Response({"error": "max_players must be between 2 and 4 for Sprint 1"}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(invite_emails, list):
            return Response({"error": "invite_emails must be a list"}, status=status.HTTP_400_BAD_REQUEST)

        normalized_invites = []
        for e in invite_emails:
            ne = _normalize_email(str(e))
            if ne and ne != commissioner_email and ne not in normalized_invites:
                normalized_invites.append(ne)

        # Total participants includes commissioner
        total = 1 + len(normalized_invites)
        if total > max_players:
            return Response(
                {"error": f"Too many emails. max_players={max_players} includes commissioner."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            league = League.objects.create(
                name=name,
                commissioner_email=commissioner_email,
                max_players=max_players,
                status=League.Status.SETUP,
            )

            # Commissioner slot is always 1 for Sprint 1
            commissioner_member = LeagueMember.objects.create(
                league=league,
                email=commissioner_email,
                display_name="Commissioner",
                slot=1,
                is_commissioner=True,
            )
            FantasyTeam.objects.create(league=league, member=commissioner_member, name="Commissioner Team")

            # Invites get slots 2..N
            slot = 2
            for email in normalized_invites:
                member = LeagueMember.objects.create(
                    league=league,
                    email=email,
                    display_name=email.split("@")[0][:30],
                    slot=slot,
                    is_commissioner=False,
                )
                FantasyTeam.objects.create(league=league, member=member, name=f"{member.display_name}'s Team")
                slot += 1

        return Response(_serialize_league(league), status=status.HTTP_201_CREATED)


class LeagueDetail(APIView):
    """
    GET /league/leagues/<league_id>/
    """

    def get(self, request, league_id: int):
        league = get_object_or_404(League, pk=league_id)
        return Response(_serialize_league(league), status=status.HTTP_200_OK)


class StartDraft(APIView):
    """
    POST /league/leagues/<league_id>/start-draft/
    Body: { "starter_email": "example@test.com" }

    """

    def post(self, request, league_id: int):
        league = get_object_or_404(League, pk=league_id)

        starter_email = _normalize_email(request.data.get("starter_email") or "")
        if starter_email and starter_email != _normalize_email(league.commissioner_email):
            return Response({"error": "Only commissioner can start draft (starter_email mismatch)"},
                            status=status.HTTP_403_FORBIDDEN)

        member_count = _league_member_count(league)
        if member_count < 2:
            return Response({"error": "Need at least 2 members to start draft"},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # If draft exists, don't recreate it
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
                return Response({"error": "Draft already in progress"}, status=status.HTTP_400_BAD_REQUEST)

            # If exists but not started, start it
            draft.status = Draft.Status.IN_PROGRESS
            draft.current_slot = 1
            draft.round = 1
            draft.pick_number = 1
            draft.started_at = timezone.now()
            draft.save()

            league.status = League.Status.DRAFTING
            league.save(update_fields=["status"])

        league.refresh_from_db()
        return Response(_serialize_league(league), status=status.HTTP_200_OK)


class MakePick(APIView):
    """
    POST /league/leagues/<league_id>/pick/
    Body:
    {
      "email": "a@test.com",
      "player_id": <player_id>
    }
    
    """

    def post(self, request, league_id: int):
        league = get_object_or_404(League, pk=league_id)

        email = _normalize_email(request.data.get("email") or "")
        player_id_raw = request.data.get("player_id", None)

        if not email:
            return Response({"error": "email is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            player_id = int(player_id_raw)
        except Exception:
            return Response({"error": "player_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        member = _get_member_by_email(league, email)
        if not member:
            return Response({"error": "That email is not a member of this league"}, status=status.HTTP_400_BAD_REQUEST)

        member_count = _league_member_count(league)

        with transaction.atomic():
            # Lock draft row to avoid 2 picks at once
            try:
                draft = Draft.objects.select_for_update().get(league=league)
            except Draft.DoesNotExist:
                return Response({"error": "Draft not started"}, status=status.HTTP_400_BAD_REQUEST)

            if draft.status != Draft.Status.IN_PROGRESS:
                return Response({"error": f"Draft status is {draft.status}, not in progress"},
                                status=status.HTTP_400_BAD_REQUEST)

            if member.slot != draft.current_slot:
                # Give frontend an easy indicator of whose turn it is
                current_member = league.members.filter(slot=draft.current_slot).first()
                return Response(
                    {
                        "error": "Not your turn",
                        "current_turn": None if not current_member else {
                            "slot": draft.current_slot,
                            "email": current_member.email
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Prevent duplicate player picks
            if DraftPick.objects.filter(draft=draft, player_id=player_id).exists():
                return Response({"error": "Player already drafted"}, status=status.HTTP_409_CONFLICT)

            # Create pick
            DraftPick.objects.create(
                draft=draft,
                pick_number=draft.pick_number,
                round=draft.round,
                slot=member.slot,
                member=member,
                player_id=player_id,
            )

            # Advance turn
            _advance_turn(draft, member_count)
            draft.save()

        league.refresh_from_db()
        return Response(_serialize_league(league), status=status.HTTP_200_OK)


class LeagueTeams(APIView):
    """
    GET /league/leagues/<league_id>/teams/
    Returns each member + drafted player_ids (from picks).
    """

    def get(self, request, league_id: int):
        league = get_object_or_404(League, pk=league_id)

        draft = getattr(league, "draft", None)
        members = list(league.members.order_by("slot"))

        picks_by_member: dict[int, list[int]] = {m.id: [] for m in members}
        if draft:
            for p in draft.picks.order_by("pick_number").all():
                picks_by_member[p.member_id].append(p.player_id)

        payload = {
            "league_id": league.id,
            "teams": [
                {
                    "member": _serialize_member(m),
                    "team_name": getattr(getattr(m, "team", None), "name", ""),
                    "player_ids": picks_by_member.get(m.id, []),
                }
                for m in members
            ],
        }
        return Response(payload, status=status.HTTP_200_OK)
    
class ResetLeague(APIView):
    """
    POST /league/leagues/<league_id>/reset/
    Body (optional): {"starter_email": "me@test.com"}
    """

    def post(self, request, league_id: int):
        league = get_object_or_404(League, pk=league_id)

        starter_email = (request.data.get("starter_email") or "").strip().lower()
        if starter_email and starter_email != league.commissioner_email.lower():
            return Response({"error": "Only commissioner can reset league"}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            # If there's a draft, delete picks then draft
            try:
                draft = Draft.objects.select_for_update().get(league=league)
            except Draft.DoesNotExist:
                draft = None

            if draft:
                DraftPick.objects.filter(draft=draft).delete()
                draft.delete()

            league.status = League.Status.SETUP
            league.save(update_fields=["status"])

        league.refresh_from_db()
        return Response(_serialize_league(league), status=status.HTTP_200_OK)