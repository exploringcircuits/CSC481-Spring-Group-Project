"""H2H Points scoring.

The single source of truth for "what does a player score?" Used by:
- Week settlement (compute matchup scores)
- Standings refresh (after a week is settled)
- Draft autopick projections (rank free agents by projected fantasy points)

The formula is `sum(stat_value * weight)` over a configurable set of stats.
Default weights are Yahoo's classic H2H Points: PTS=1, REB=1.2, AST=1.5,
STL=3, BLK=3, TO=−1.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Mapping

from django.db.models import Q

from .models import (
    DEFAULT_SCORING_WEIGHTS,
    LineupEntry,
    Matchup,
    Player,
    PlayerGameStats,
    PlayerSeasonAverage,
    Team,
    Week,
)


def score_stat_line(stats: PlayerGameStats | Mapping[str, float], weights: Mapping[str, float]) -> float:
    """Apply weights to a stat line. Works on PlayerGameStats or any mapping."""
    if isinstance(stats, PlayerGameStats):
        getters = {
            "pts": stats.pts,
            "reb": stats.reb,
            "ast": stats.ast,
            "stl": stats.stl,
            "blk": stats.blk,
            "tov": stats.tov,
            "fgm": stats.fgm,
            "fga": stats.fga,
            "ftm": stats.ftm,
            "fta": stats.fta,
            "fg3m": stats.fg3m,
        }
    else:
        getters = stats

    total = 0.0
    for key, weight in weights.items():
        total += float(weight) * float(getters.get(key, 0.0))
    return total


def project_fantasy_ppg(season_avg: PlayerSeasonAverage, weights: Mapping[str, float]) -> float:
    """Projected fantasy points per game from season averages.
    Used by autopick to rank free agents."""
    return score_stat_line(
        {
            "pts": season_avg.pts,
            "reb": season_avg.reb,
            "ast": season_avg.ast,
            "stl": season_avg.stl,
            "blk": season_avg.blk,
            "tov": season_avg.tov,
            "fgm": season_avg.fgm,
            "fga": season_avg.fga,
            "ftm": season_avg.ftm,
            "fta": season_avg.fta,
            "fg3m": season_avg.fg3m,
        },
        weights,
    )


def date_range(start: date, end: date) -> Iterable[date]:
    """Inclusive date range from start..end."""
    cursor = start
    while cursor <= end:
        yield cursor
        cursor = cursor + timedelta(days=1)


def score_team_for_date(team: Team, game_date: date, weights: Mapping[str, float], starter_slots: set[str]) -> float:
    """Sum fantasy points for a team's *starting* lineup on a single date."""
    entries = LineupEntry.objects.filter(team=team, game_date=game_date, slot__in=starter_slots)
    if not entries:
        return 0.0
    player_ids = [e.player_id for e in entries]
    stats = {
        s.player_id: s
        for s in PlayerGameStats.objects.filter(player_id__in=player_ids, game_date=game_date)
    }
    total = 0.0
    for entry in entries:
        line = stats.get(entry.player_id)
        if line is None:
            continue
        total += score_stat_line(line, weights)
    return total


def score_team_for_week(team: Team, week: Week) -> float:
    """Sum fantasy points across all dates in a week's range."""
    weights: Mapping[str, float] = team.league.scoring_weights or DEFAULT_SCORING_WEIGHTS
    starter_slots = {s["slot"] for s in team.league.roster_template if s.get("starter")}
    return sum(
        score_team_for_date(team, day, weights, starter_slots)
        for day in date_range(week.start_date, week.end_date)
    )


def settle_week(week: Week) -> list[Matchup]:
    """Compute matchup scores for a week, set winners, refresh team standings.

    Idempotent — safe to call multiple times. Returns the matchups that
    transitioned to settled in this call.
    """
    if week.is_settled:
        return list(week.matchups.all())

    settled: list[Matchup] = []
    for matchup in week.matchups.select_related("home_team", "away_team", "home_team__league"):
        home_score = score_team_for_week(matchup.home_team, week)
        away_score = score_team_for_week(matchup.away_team, week)
        matchup.home_score = home_score
        matchup.away_score = away_score
        if home_score > away_score:
            matchup.winner = matchup.home_team
        elif away_score > home_score:
            matchup.winner = matchup.away_team
        else:
            matchup.winner = None  # tie
        matchup.is_settled = True
        matchup.save()
        settled.append(matchup)

    refresh_standings(week)
    week.is_settled = True
    week.save(update_fields=["is_settled"])
    return settled


def refresh_standings(week: Week) -> None:
    """Recompute every team's W-L-T and PF/PA from settled matchups up to and
    including the given week. Resets cumulatives — single source of truth."""
    league = week.league
    for team in league.teams.all():
        team.wins = 0
        team.losses = 0
        team.ties = 0
        team.points_for = 0.0
        team.points_against = 0.0

        all_settled = Matchup.objects.filter(
            week__league=league,
            week__is_playoff=False,
            is_settled=True,
        ).filter(Q(home_team=team) | Q(away_team=team))

        for m in all_settled:
            if m.home_team_id == team.pk:
                team.points_for += m.home_score
                team.points_against += m.away_score
                if m.winner_id == team.pk:
                    team.wins += 1
                elif m.winner_id is None:
                    team.ties += 1
                else:
                    team.losses += 1
            else:
                team.points_for += m.away_score
                team.points_against += m.home_score
                if m.winner_id == team.pk:
                    team.wins += 1
                elif m.winner_id is None:
                    team.ties += 1
                else:
                    team.losses += 1
        team.save(update_fields=["wins", "losses", "ties", "points_for", "points_against"])


def standings_for_league(league) -> list[Team]:
    """Return teams sorted by H2H standing — wins desc, points_for desc."""
    return list(
        Team.objects.filter(league=league)
        .order_by("-wins", "-points_for", "-points_against")
    )


def autopick_for_member(league, taken_player_ids: set[int]) -> Player | None:
    """Highest projected fantasy PPG among undrafted active players."""
    weights = league.scoring_weights or DEFAULT_SCORING_WEIGHTS
    candidates = (
        PlayerSeasonAverage.objects.filter(season=league.season_label)
        .exclude(player_id__in=taken_player_ids)
        .select_related("player")
    )
    best_player: Player | None = None
    best_score = float("-inf")
    for sa in candidates:
        score = project_fantasy_ppg(sa, weights)
        if score > best_score:
            best_score = score
            best_player = sa.player
    return best_player
