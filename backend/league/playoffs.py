from django.db import transaction

from .models import (
    FantasyTeam,
    FantasyTeamPlayer,
    League,
    Playoff,
    PlayoffMatchup,
    PlayerMatchupStat,
)
from .scoring import simulate_team_score


class PlayoffError(Exception):
    pass


@transaction.atomic
def start_playoffs(league):
    if league.status != League.Status.ACTIVE:
        raise PlayoffError(
            f"League must be ACTIVE to start playoffs (current: {league.status})"
        )

    teams = list(
        FantasyTeam.objects.filter(league=league)
        .select_related("member")
        .order_by("member__slot")
    )

    if len(teams) != 4:
        raise PlayoffError(
            f"League must have exactly 4 teams to start playoffs (found: {len(teams)})"
        )

    for team in teams:
        if not FantasyTeamPlayer.objects.filter(team=team).exists():
            raise PlayoffError(
                f"Team '{team.name}' has no rostered players"
            )

    playoff = Playoff.objects.create(
        league=league,
        status=Playoff.Status.IN_PROGRESS,
    )

    PlayoffMatchup.objects.create(
        playoff=playoff,
        round=PlayoffMatchup.Round.SEMIFINAL,
        team_a=teams[0],
        team_b=teams[1],
    )
    PlayoffMatchup.objects.create(
        playoff=playoff,
        round=PlayoffMatchup.Round.SEMIFINAL,
        team_a=teams[2],
        team_b=teams[3],
    )

    league.status = League.Status.PLAYOFFS
    league.save(update_fields=["status"])

    return playoff


@transaction.atomic
def simulate_matchup(matchup, seed=None):
    if matchup.simulated:
        raise PlayoffError(f"Matchup {matchup.id} has already been simulated")

    score_a, stats_a = simulate_team_score(matchup.team_a, seed=seed)
    score_b, stats_b = simulate_team_score(
        matchup.team_b,
        seed=None if seed is None else seed + 1000,
    )

    bulk_stats = []
    for result in stats_a:
        bulk_stats.append(PlayerMatchupStat(
            matchup=matchup,
            team=matchup.team_a,
            player_id=result["player_id"],
            pts=result["sim_pts"],
            reb=result["sim_reb"],
            ast=result["sim_ast"],
            fantasy_score=result["fantasy_score"],
        ))
    for result in stats_b:
        bulk_stats.append(PlayerMatchupStat(
            matchup=matchup,
            team=matchup.team_b,
            player_id=result["player_id"],
            pts=result["sim_pts"],
            reb=result["sim_reb"],
            ast=result["sim_ast"],
            fantasy_score=result["fantasy_score"],
        ))
    PlayerMatchupStat.objects.bulk_create(bulk_stats)

    matchup.team_a_score = score_a
    matchup.team_b_score = score_b
    matchup.winner = matchup.team_a if score_a >= score_b else matchup.team_b
    matchup.simulated = True
    matchup.save(update_fields=["team_a_score", "team_b_score", "winner", "simulated"])

    playoff = matchup.playoff

    if matchup.round == PlayoffMatchup.Round.SEMIFINAL:
        semis = PlayoffMatchup.objects.filter(
            playoff=playoff,
            round=PlayoffMatchup.Round.SEMIFINAL,
        )
        if semis.count() == 2 and all(s.simulated for s in semis):
            winners = [s.winner for s in semis.order_by("id")]
            PlayoffMatchup.objects.create(
                playoff=playoff,
                round=PlayoffMatchup.Round.FINAL,
                team_a=winners[0],
                team_b=winners[1],
            )

    elif matchup.round == PlayoffMatchup.Round.FINAL:
        playoff.champion = matchup.winner
        playoff.status = Playoff.Status.COMPLETE
        playoff.save(update_fields=["champion", "status"])

        league = playoff.league
        league.status = League.Status.COMPLETE
        league.save(update_fields=["status"])

    return matchup


def get_bracket_state(league):
    try:
        playoff = Playoff.objects.select_related("champion").get(league=league)
    except Playoff.DoesNotExist:
        return {"started": False, "matchups": [], "champion": None}

    matchups_data = []
    for matchup in playoff.matchups.prefetch_related(
        "player_stats__player", "team_a", "team_b", "winner"
    ).order_by("round", "id"):
        player_stats = [
            {
                "player_id": s.player_id,
                "player_name": s.player.full_name,
                "team_id": s.team_id,
                "pts": s.pts,
                "reb": s.reb,
                "ast": s.ast,
                "fantasy_score": s.fantasy_score,
            }
            for s in matchup.player_stats.all()
        ]
        matchups_data.append({
            "id": matchup.id,
            "round": matchup.round,
            "team_a_id": matchup.team_a_id,
            "team_a_name": matchup.team_a.name,
            "team_b_id": matchup.team_b_id,
            "team_b_name": matchup.team_b.name,
            "team_a_score": matchup.team_a_score,
            "team_b_score": matchup.team_b_score,
            "winner_id": matchup.winner_id,
            "simulated": matchup.simulated,
            "player_stats": player_stats,
        })

    return {
        "started": True,
        "playoff_status": playoff.status,
        "matchups": matchups_data,
        "champion_id": playoff.champion_id,
        "champion_name": playoff.champion.name if playoff.champion else None,
    }
