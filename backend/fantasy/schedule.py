"""Schedule generation and playoff bracket construction.

Round-robin schedule via circle method. With N teams (N even) the season is
N-1 weeks of distinct pairings; if `regular_season_weeks > N-1`, we cycle
through the round-robin again. With N odd, one team gets a bye each week
which we currently don't support — even team counts only for now.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from django.db import transaction

from .models import (
    LeagueMember,
    LineupEntry,
    Matchup,
    Roster,
    Team,
    Week,
)


def generate_round_robin_pairings(team_ids: list[int]) -> list[list[tuple[int, int]]]:
    """Return a list of weeks; each week is a list of (home_team_id, away_team_id) pairs.

    Uses the circle method: fix team 0, rotate the rest. Produces N-1 unique
    weeks of pairings for N (even) teams. Each team plays once per week.
    """
    if len(team_ids) < 2:
        return []
    if len(team_ids) % 2 != 0:
        # Add a phantom "bye" sentinel; pairs containing it are dropped.
        team_ids = list(team_ids) + [-1]

    n = len(team_ids)
    rotation = list(team_ids)
    weeks: list[list[tuple[int, int]]] = []

    for _ in range(n - 1):
        week_pairs: list[tuple[int, int]] = []
        for i in range(n // 2):
            a = rotation[i]
            b = rotation[n - 1 - i]
            if a == -1 or b == -1:
                continue
            # Alternate home/away by week index for fairness
            if (i + len(weeks)) % 2 == 0:
                week_pairs.append((a, b))
            else:
                week_pairs.append((b, a))
        weeks.append(week_pairs)
        # Rotate everything except the first team
        rotation = [rotation[0]] + [rotation[-1]] + rotation[1:-1]

    return weeks


@transaction.atomic
def build_regular_season(league, season_start: date) -> list[Week]:
    """Create Week + Matchup rows for the regular season.

    Existing Week rows for this league are deleted first — this is meant to be
    called once at season setup or when resetting.
    """
    league.weeks.filter(is_playoff=False).delete()

    teams = list(league.teams.order_by("member__slot"))
    if len(teams) < 2:
        return []

    team_ids = [t.id for t in teams]
    pairings = generate_round_robin_pairings(team_ids)

    weeks: list[Week] = []
    cycle_length = len(pairings)
    for week_idx in range(league.regular_season_weeks):
        start = season_start + timedelta(days=7 * week_idx)
        end = start + timedelta(days=6)
        week = Week.objects.create(
            league=league,
            week_number=week_idx + 1,
            start_date=start,
            end_date=end,
            is_playoff=False,
        )
        weekly = pairings[week_idx % cycle_length] if cycle_length else []
        for home_id, away_id in weekly:
            Matchup.objects.create(
                week=week,
                home_team_id=home_id,
                away_team_id=away_id,
            )
        weeks.append(week)
    return weeks


@transaction.atomic
def build_playoff_bracket(league, top_n: int = 4) -> list[Week]:
    """Create playoff Week + Matchup rows seeded by current standings.

    Top-N teams by record advance. Round 1 = semifinals (top_n / 2 matchups).
    Round 2 = final. Re-seeded between rounds.

    Idempotent — clears existing playoff weeks first.
    """
    from .scoring import standings_for_league

    league.weeks.filter(is_playoff=True).delete()

    standings = standings_for_league(league)
    seeded = standings[:top_n]
    if len(seeded) < 2 or len(seeded) % 2 != 0:
        return []

    last_week = league.weeks.order_by("-week_number").first()
    next_week_number = (last_week.week_number if last_week else 0) + 1
    next_start = (last_week.end_date + timedelta(days=1)) if last_week else date.today()

    weeks: list[Week] = []
    rounds = ["semifinal", "final"]
    if top_n == 8:
        rounds = ["quarterfinal", "semifinal", "final"]
    if top_n == 2:
        rounds = ["final"]

    semis_week = None
    for round_idx, round_name in enumerate(rounds):
        start = next_start + timedelta(days=7 * round_idx)
        end = start + timedelta(days=6)
        week = Week.objects.create(
            league=league,
            week_number=next_week_number + round_idx,
            start_date=start,
            end_date=end,
            is_playoff=True,
            playoff_round=round_name,
        )
        weeks.append(week)
        if round_idx == 0:
            # First round: pair top vs bottom-most
            half = len(seeded) // 2
            for i in range(half):
                Matchup.objects.create(
                    week=week,
                    home_team=seeded[i],
                    away_team=seeded[-1 - i],
                )
            semis_week = week
        # Subsequent rounds get filled when the previous round's winners are known
        # (see advance_playoffs).

    return weeks


@transaction.atomic
def advance_playoffs(league) -> Week | None:
    """After a playoff round is settled, populate the next round's matchups
    with the winners. Returns the round that was populated, or None if no
    further round needed."""
    settled_playoff_weeks = league.weeks.filter(is_playoff=True, is_settled=True).order_by("week_number")
    pending_playoff_weeks = league.weeks.filter(is_playoff=True, is_settled=False).order_by("week_number")
    if not pending_playoff_weeks.exists():
        return None
    if not settled_playoff_weeks.exists():
        return None

    next_round = pending_playoff_weeks.first()
    if next_round.matchups.exists():
        return next_round  # already populated

    last_settled = settled_playoff_weeks.last()
    winners = [m.winner for m in last_settled.matchups.all() if m.winner is not None]
    if len(winners) < 2:
        return None

    # Re-seed by record
    winners.sort(key=lambda t: (-t.wins, -t.points_for))
    half = len(winners) // 2
    for i in range(half):
        Matchup.objects.create(
            week=next_round,
            home_team=winners[i],
            away_team=winners[-1 - i],
        )
    return next_round


@transaction.atomic
def populate_default_lineups(league, week: Week, randomize: bool = False) -> int:
    """Assign every team's roster into starter slots for every day in `week`.

    Strategy: greedy-fill — for each team, walk slots in roster_template order,
    fill each with a roster player whose primary_position fits. Players left
    over go to BN slots. Same lineup is replicated for every day in the week
    (consistent with weekly-lock mode).

    Returns the number of LineupEntry rows created.
    """
    rng = random.Random(week.id)
    template = league.roster_template
    created = 0

    for team in league.teams.all():
        roster_players = list(
            Roster.objects.filter(team=team).select_related("player")
        )
        if randomize:
            rng.shuffle(roster_players)
        else:
            roster_players.sort(key=lambda r: -_player_strength(r.player))

        # Greedy slot assignment
        assignments: dict[str, int] = {}
        used: set[int] = set()
        for slot_def in template:
            slot_name = slot_def["slot"]
            allowed = set(slot_def["allowed"])
            for r in roster_players:
                if r.player_id in used:
                    continue
                if r.player.primary_position in allowed:
                    assignments[slot_name] = r.player_id
                    used.add(r.player_id)
                    break

        # Fill missing slots from any unused player (overflow into BN-style slots)
        for slot_def in template:
            slot_name = slot_def["slot"]
            if slot_name in assignments:
                continue
            for r in roster_players:
                if r.player_id not in used:
                    assignments[slot_name] = r.player_id
                    used.add(r.player_id)
                    break

        # Replicate across the week's days
        from datetime import timedelta
        cursor = week.start_date
        while cursor <= week.end_date:
            for slot_name, player_id in assignments.items():
                LineupEntry.objects.update_or_create(
                    team=team,
                    game_date=cursor,
                    slot=slot_name,
                    defaults={"player_id": player_id},
                )
                created += 1
            cursor = cursor + timedelta(days=1)

    return created


def _player_strength(player) -> float:
    """Rough projection used to rank a team's roster for greedy lineup fill."""
    sa = player.season_averages.first()
    if sa is None:
        return 0.0
    return sa.fantasy_ppg


@transaction.atomic
def assign_default_draft_order(league) -> list[int]:
    """Random draft order from current league members. Stable per call."""
    member_ids = list(LeagueMember.objects.filter(league=league).values_list("id", flat=True).order_by("slot"))
    random.shuffle(member_ids)
    return member_ids


def snake_pick_pointer(draft_order: list[int], pick_index: int) -> int:
    """Return the LeagueMember.id whose turn it is given the snake order.

    Snake: round 0 = forward, round 1 = backward, round 2 = forward, ...
    """
    if not draft_order:
        raise ValueError("Empty draft order")
    n = len(draft_order)
    round_num = pick_index // n
    pos_in_round = pick_index % n
    if round_num % 2 == 0:
        return draft_order[pos_in_round]
    return draft_order[n - 1 - pos_in_round]
