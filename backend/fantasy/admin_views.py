"""Admin demo control panel — backend endpoints.

Each endpoint is a one-click presenter shortcut:

  POST /api/admin/reset/
  POST /api/admin/seed-demo/
  POST /api/admin/leagues/<id>/run-draft/
  POST /api/admin/leagues/<id>/build-schedule/
  POST /api/admin/leagues/<id>/set-default-lineups/
  POST /api/admin/leagues/<id>/advance-week/
  POST /api/admin/leagues/<id>/simulate-to-playoffs/
  POST /api/admin/leagues/<id>/start-playoffs/
  POST /api/admin/leagues/<id>/simulate-next/
  POST /api/admin/leagues/<id>/example-trade/

All gated by IsSiteAdmin (Django is_staff). The demo presenter logs in as a
staff user (default admin@demo.local) and clicks through.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
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
from .permissions import IsSiteAdmin
from .schedule import (
    advance_playoffs,
    build_playoff_bracket,
    build_regular_season,
    populate_default_lineups,
    snake_pick_pointer,
)
from .scoring import autopick_for_member, settle_week, standings_for_league
from .serializers import LeagueDetailSerializer

User = get_user_model()

DEMO_SEASON_START = date(2026, 3, 10)  # matches the default of generate_player_game_stats
DEMO_BOT_NAMES = [
    "Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta",
    "Bot Echo", "Bot Foxtrot", "Bot Golf", "Bot Hotel",
]


# -----------------------------------------------------------------------------
# Reset / seed
# -----------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def reset_demo(request):
    """Wipe leagues + dependent rows. Players + stats stay."""
    Transaction.objects.all().delete()
    TradeAsset.objects.all().delete()
    Trade.objects.all().delete()
    LineupEntry.objects.all().delete()
    Matchup.objects.all().delete()
    Week.objects.all().delete()
    DraftSelection.objects.all().delete()
    Draft.objects.all().delete()
    Roster.objects.all().delete()
    Team.objects.all().delete()
    LeagueMember.objects.all().delete()
    League.objects.all().delete()
    return Response({"detail": "Demo state wiped (players + stats preserved)."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def seed_demo(request):
    """Create a fresh demo league with the admin as commissioner + 7 bot teams."""
    admin_user = request.user

    league = League.objects.create(
        name="Demo Showcase",
        commissioner=admin_user,
        max_teams=8,
        regular_season_weeks=6,
        playoff_team_count=4,
    )

    # Admin = first slot, commissioner
    admin_member = LeagueMember.objects.create(
        league=league,
        user=admin_user,
        slot=1,
        is_commissioner=True,
    )
    Team.objects.create(league=league, member=admin_member, name=f"{admin_user.name}'s Team")

    # 7 bot members in slots 2..8
    for i, bot_name in enumerate(DEMO_BOT_NAMES[:7], start=2):
        member = LeagueMember.objects.create(
            league=league,
            slot=i,
            is_bot=True,
            bot_name=bot_name,
        )
        Team.objects.create(league=league, member=member, name=f"{bot_name}'s Squad")

    # Initialise the draft with a randomized order
    member_ids = list(LeagueMember.objects.filter(league=league).order_by("slot").values_list("id", flat=True))
    rng = random.Random(league.id)
    rng.shuffle(member_ids)

    Draft.objects.create(league=league, draft_order=member_ids)

    Transaction.objects.create(
        league=league,
        type=TransactionType.OTHER,
        summary=f"Demo league seeded with {len(member_ids)} teams.",
    )

    return Response(
        LeagueDetailSerializer(league, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


# -----------------------------------------------------------------------------
# Draft
# -----------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def run_draft(request, league_id):
    """Autopick the entire draft using projected fantasy PPG."""
    league = get_object_or_404(League, pk=league_id)
    draft = get_object_or_404(Draft, league=league)

    if draft.status == DraftStatus.COMPLETE:
        return Response({"detail": "Draft already complete."})

    if draft.status == DraftStatus.NOT_STARTED:
        draft.status = DraftStatus.IN_PROGRESS
        draft.started_at = datetime.now(timezone.utc)
        league.status = LeagueStatus.DRAFTING
        league.save(update_fields=["status"])

    total_picks = len(draft.draft_order) * league.roster_size
    taken_player_ids = set(DraftSelection.objects.filter(draft=draft).values_list("player_id", flat=True))

    # Use the shared _record_pick helper so admin auto-runs also produce
    # per-pick Transaction rows (so they show up in the activity feed).
    from .views import _record_pick

    while draft.current_pick_index < total_picks:
        member_id = snake_pick_pointer(draft.draft_order, draft.current_pick_index)
        member = LeagueMember.objects.get(pk=member_id)
        player = autopick_for_member(league, taken_player_ids)
        if player is None:
            break
        _record_pick(draft, league, member, player, taken_player_ids)

    draft.status = DraftStatus.COMPLETE
    draft.completed_at = datetime.now(timezone.utc)
    draft.save()

    league.status = LeagueStatus.REGULAR
    league.save(update_fields=["status"])

    Transaction.objects.create(
        league=league,
        type=TransactionType.OTHER,
        summary=f"Draft auto-completed: {draft.current_pick_index} picks across {len(draft.draft_order)} teams.",
    )
    return Response({"detail": f"Drafted {draft.current_pick_index} picks."})


# -----------------------------------------------------------------------------
# Schedule + lineups
# -----------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def build_schedule(request, league_id):
    """Generate Week + Matchup rows for the regular season."""
    league = get_object_or_404(League, pk=league_id)
    weeks = build_regular_season(league, DEMO_SEASON_START)

    # Auto-populate week 1 lineups so simulating immediately produces real scores.
    for week in weeks:
        populate_default_lineups(league, week)

    if league.current_week_number == 0 and weeks:
        league.current_week_number = 1
        league.save(update_fields=["current_week_number"])

    Transaction.objects.create(
        league=league,
        type=TransactionType.OTHER,
        summary=f"Built {len(weeks)}-week regular season schedule.",
    )
    return Response({"detail": f"Built {len(weeks)} weeks. Lineups defaulted."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def set_default_lineups(request, league_id):
    """Set every team's lineup to the greedy-best assignment for every week."""
    league = get_object_or_404(League, pk=league_id)
    total = 0
    for week in league.weeks.all():
        total += populate_default_lineups(league, week)
    return Response({"detail": f"Wrote {total} lineup entries across all weeks."})


# -----------------------------------------------------------------------------
# Week advancement
# -----------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def advance_week(request, league_id):
    """Settle the current week and move the pointer forward."""
    league = get_object_or_404(League, pk=league_id)
    current_number = max(league.current_week_number or 1, 1)
    week = league.weeks.filter(week_number=current_number).first()
    if not week:
        return Response({"detail": "No current week to advance."}, status=400)
    if not week.matchups.exists():
        return Response({"detail": f"Week {current_number} has no matchups (regular season not built?)."}, status=400)

    settle_week(week)

    next_week = league.weeks.filter(week_number=current_number + 1).first()
    if next_week:
        league.current_week_number = current_number + 1
        league.save(update_fields=["current_week_number"])
    elif league.status == LeagueStatus.REGULAR:
        league.status = LeagueStatus.PLAYOFFS
        league.save(update_fields=["status"])

    Transaction.objects.create(
        league=league,
        type=TransactionType.WEEK_ADVANCED,
        summary=f"Week {current_number} settled.",
    )
    return Response({"detail": f"Week {current_number} settled."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def simulate_to_playoffs(request, league_id):
    """Settle every regular-season week. Stops before playoffs."""
    league = get_object_or_404(League, pk=league_id)
    settled = 0
    for week in league.weeks.filter(is_playoff=False).order_by("week_number"):
        if not week.matchups.exists():
            continue
        if week.is_settled:
            continue
        settle_week(week)
        settled += 1

    last_regular = league.weeks.filter(is_playoff=False).order_by("-week_number").first()
    if last_regular:
        league.current_week_number = last_regular.week_number
    if league.status == LeagueStatus.REGULAR:
        league.status = LeagueStatus.REGULAR  # ready for playoffs but not auto-started
    league.save(update_fields=["current_week_number", "status"])

    Transaction.objects.create(
        league=league,
        type=TransactionType.OTHER,
        summary=f"Simulated {settled} regular-season weeks.",
    )
    return Response({"detail": f"Simulated {settled} regular-season weeks."})


# -----------------------------------------------------------------------------
# Playoffs
# -----------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def start_playoffs(request, league_id):
    """Initialise the bracket (top-N seeded by regular-season standings)."""
    league = get_object_or_404(League, pk=league_id)
    weeks = build_playoff_bracket(league, top_n=league.playoff_team_count)
    if not weeks:
        return Response({"detail": "Could not build bracket. Did the regular season finish?"}, status=400)

    populate_default_lineups(league, weeks[0])

    first = weeks[0]
    league.current_week_number = first.week_number
    league.status = LeagueStatus.PLAYOFFS
    league.save(update_fields=["current_week_number", "status"])

    Transaction.objects.create(
        league=league,
        type=TransactionType.OTHER,
        summary=f"Playoffs started. Top {league.playoff_team_count} teams seeded.",
    )
    return Response({"detail": f"Bracket created across {len(weeks)} round(s)."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def simulate_next(request, league_id):
    """Settle the next pending week (regular or playoff). Auto-advances the
    bracket between rounds."""
    league = get_object_or_404(League, pk=league_id)
    week = league.weeks.filter(is_settled=False).order_by("week_number").first()
    if not week:
        return Response({"detail": "Nothing left to simulate."})
    if not week.matchups.exists():
        # If this is a downstream playoff round whose matchups haven't been
        # filled in, advance the bracket first.
        advanced = advance_playoffs(league)
        if advanced is None or not advanced.matchups.exists():
            return Response({"detail": "No matchups available to settle."}, status=400)
        week = advanced
        populate_default_lineups(league, week)

    settle_week(week)

    if week.is_playoff:
        # Try to populate the next round's matchups.
        advance_playoffs(league)
        next_week = league.weeks.filter(is_playoff=True, is_settled=False).order_by("week_number").first()
        if next_week:
            league.current_week_number = next_week.week_number
            populate_default_lineups(league, next_week)
        else:
            # Last playoff round just settled — crown the champion.
            league.status = LeagueStatus.COMPLETE
            league.current_week_number = week.week_number
        league.save(update_fields=["current_week_number", "status"])
    else:
        next_regular = league.weeks.filter(is_playoff=False, week_number__gt=week.week_number).first()
        if next_regular:
            league.current_week_number = next_regular.week_number
            league.save(update_fields=["current_week_number"])

    summary_word = "playoff round" if week.is_playoff else f"week {week.week_number}"
    Transaction.objects.create(
        league=league,
        type=TransactionType.OTHER,
        summary=f"Simulated {summary_word}.",
    )
    return Response({"detail": f"Simulated {summary_word}."})


# -----------------------------------------------------------------------------
# Example trade
# -----------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
@transaction.atomic
def example_trade(request, league_id):
    """Create a sample PROPOSED trade where a bot offers their highest-FPPG
    player to the admin's team in exchange for the admin's lowest-FPPG starter."""
    league = get_object_or_404(League, pk=league_id)

    admin_member = LeagueMember.objects.filter(league=league, user=request.user).select_related("team").first()
    if not admin_member or not getattr(admin_member, "team", None):
        return Response({"detail": "Admin doesn't have a team in this league."}, status=400)

    bot_member = (
        LeagueMember.objects.filter(league=league, is_bot=True)
        .exclude(pk=admin_member.pk)
        .select_related("team")
        .first()
    )
    if not bot_member or not getattr(bot_member, "team", None):
        return Response({"detail": "No bot teams found."}, status=400)

    bot_top = _highest_fppg(bot_member.team)
    admin_low = _lowest_fppg(admin_member.team)
    if not bot_top or not admin_low:
        return Response({"detail": "Rosters empty — run the draft first."}, status=400)

    trade = Trade.objects.create(
        league=league,
        proposer=bot_member.team,
        recipient=admin_member.team,
        status=TradeStatus.PROPOSED,
        note=f"{bot_member.display_name} wants to swap.",
    )
    TradeAsset.objects.create(
        trade=trade,
        from_team=bot_member.team,
        to_team=admin_member.team,
        player=bot_top,
    )
    TradeAsset.objects.create(
        trade=trade,
        from_team=admin_member.team,
        to_team=bot_member.team,
        player=admin_low,
    )

    Transaction.objects.create(
        league=league,
        team=bot_member.team,
        type=TransactionType.OTHER,
        summary=f"Example trade proposed: {bot_top.full_name} for {admin_low.full_name}",
        payload={"trade_id": trade.id},
    )
    return Response({"detail": f"Trade proposed: {bot_top.full_name} ↔ {admin_low.full_name}.", "trade_id": trade.id})


def _highest_fppg(team: Team) -> Player | None:
    candidates = list(
        Roster.objects.filter(team=team)
        .select_related("player")
        .prefetch_related("player__season_averages")
    )
    best = None
    best_score = float("-inf")
    for r in candidates:
        sa = r.player.season_averages.first()
        score = sa.fantasy_ppg if sa else 0
        if score > best_score:
            best = r.player
            best_score = score
    return best


def _lowest_fppg(team: Team) -> Player | None:
    candidates = list(
        Roster.objects.filter(team=team)
        .select_related("player")
        .prefetch_related("player__season_averages")
    )
    worst = None
    worst_score = float("inf")
    for r in candidates:
        sa = r.player.season_averages.first()
        score = sa.fantasy_ppg if sa else 0
        if score < worst_score:
            worst = r.player
            worst_score = score
    return worst


# -----------------------------------------------------------------------------
# Read-only status (used by the AdminPanelPage)
# -----------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsSiteAdmin])
def admin_status(request):
    """Return a snapshot of the demo state for the admin panel."""
    leagues = league_summaries()
    return Response({
        "leagues": leagues,
        "totals": {
            "leagues": League.objects.count(),
            "members": LeagueMember.objects.count(),
            "teams": Team.objects.count(),
            "roster_entries": Roster.objects.count(),
            "weeks": Week.objects.count(),
            "matchups": Matchup.objects.count(),
            "trades": Trade.objects.count(),
            "transactions": Transaction.objects.count(),
            "players": Player.objects.count(),
        },
    })


def league_summaries() -> list[dict]:
    summaries = []
    for league in League.objects.all().select_related("commissioner").prefetch_related("weeks", "teams", "draft"):
        draft = getattr(league, "draft", None)
        weeks = list(league.weeks.all())
        regular = [w for w in weeks if not w.is_playoff]
        playoff = [w for w in weeks if w.is_playoff]
        settled_regular = [w for w in regular if w.is_settled]
        settled_playoff = [w for w in playoff if w.is_settled]
        standings = standings_for_league(league)
        summaries.append({
            "id": league.id,
            "name": league.name,
            "status": league.status,
            "current_week_number": league.current_week_number,
            "team_count": len(league.teams.all()),
            "draft_status": draft.status if draft else "missing",
            "draft_picks": (
                DraftSelection.objects.filter(draft=draft).count() if draft else 0
            ),
            "regular_weeks_total": len(regular),
            "regular_weeks_settled": len(settled_regular),
            "playoff_weeks_total": len(playoff),
            "playoff_weeks_settled": len(settled_playoff),
            "standings_top": [
                {"name": t.name, "record": t.record, "points_for": round(t.points_for, 1)}
                for t in standings[:4]
            ],
        })
    return summaries
