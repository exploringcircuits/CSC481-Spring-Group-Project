import random

from .models import FantasyTeamPlayer


def _sigma(mean):
    return max(mean * 0.3, 2.0)


def simulate_player_performance(player, seed=None):
    rng = random.Random(seed)

    pts_mean = float(player.pts or 0)
    reb_mean = float(player.reb or 0)
    ast_mean = float(player.ast or 0)

    if pts_mean == 0 and reb_mean == 0 and ast_mean == 0:
        return {"sim_pts": 0.0, "sim_reb": 0.0, "sim_ast": 0.0, "fantasy_score": 0.0}

    sim_pts = max(0.0, rng.gauss(pts_mean, _sigma(pts_mean)))
    sim_reb = max(0.0, rng.gauss(reb_mean, _sigma(reb_mean)))
    sim_ast = max(0.0, rng.gauss(ast_mean, _sigma(ast_mean)))

    fantasy_score = sim_pts + sim_reb * 1.2 + sim_ast * 1.5

    return {
        "sim_pts": round(sim_pts, 2),
        "sim_reb": round(sim_reb, 2),
        "sim_ast": round(sim_ast, 2),
        "fantasy_score": round(fantasy_score, 2),
    }


def simulate_team_score(fantasy_team, seed=None):
    roster_entries = FantasyTeamPlayer.objects.filter(team=fantasy_team).select_related("player")

    player_results = []
    total = 0.0

    for i, entry in enumerate(roster_entries):
        player_seed = None if seed is None else seed + i
        result = simulate_player_performance(entry.player, seed=player_seed)
        result["player_id"] = entry.player.id
        result["player_name"] = entry.player.full_name
        player_results.append(result)
        total += result["fantasy_score"]

    return round(total, 2), player_results
