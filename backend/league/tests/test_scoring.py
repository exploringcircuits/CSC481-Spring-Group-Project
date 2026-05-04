from unittest.mock import MagicMock

from django.test import TestCase

from league.scoring import simulate_player_performance, simulate_team_score


def _make_player(pts, reb, ast):
    p = MagicMock()
    p.pts = pts
    p.reb = reb
    p.ast = ast
    p.id = 1
    p.full_name = "Test Player"
    return p


class SimulatePlayerPerformanceTests(TestCase):
    def test_seeded_simulation_is_deterministic(self):
        player = _make_player(20.0, 5.0, 4.0)
        result_a = simulate_player_performance(player, seed=42)
        result_b = simulate_player_performance(player, seed=42)
        self.assertEqual(result_a, result_b)

    def test_different_seeds_produce_different_outputs(self):
        player = _make_player(20.0, 5.0, 4.0)
        result_a = simulate_player_performance(player, seed=1)
        result_b = simulate_player_performance(player, seed=2)
        self.assertNotEqual(result_a, result_b)

    def test_null_stats_return_zero_fantasy_score_no_crash(self):
        player = _make_player(None, None, None)
        result = simulate_player_performance(player, seed=0)
        self.assertEqual(result["fantasy_score"], 0.0)
        self.assertEqual(result["sim_pts"], 0.0)
        self.assertEqual(result["sim_reb"], 0.0)
        self.assertEqual(result["sim_ast"], 0.0)

    def test_zero_stats_return_zero_fantasy_score(self):
        player = _make_player(0, 0, 0)
        result = simulate_player_performance(player, seed=0)
        self.assertEqual(result["fantasy_score"], 0.0)

    def test_star_outscores_bench_on_average(self):
        star = _make_player(25.0, 5.0, 5.0)
        bench = _make_player(5.0, 2.0, 1.0)

        star_avg = sum(
            simulate_player_performance(star, seed=i)["fantasy_score"]
            for i in range(100)
        ) / 100

        bench_avg = sum(
            simulate_player_performance(bench, seed=i)["fantasy_score"]
            for i in range(100)
        ) / 100

        self.assertGreater(star_avg, bench_avg)


class SimulateTeamScoreTests(TestCase):
    def _make_team_with_roster(self, player_stats):
        from unittest.mock import patch, PropertyMock

        players = [_make_player(*s) for s in player_stats]
        entries = []
        for i, p in enumerate(players):
            entry = MagicMock()
            entry.player = p
            entry.player.id = i + 1
            entry.player.full_name = f"Player {i + 1}"
            entries.append(entry)

        team = MagicMock()
        team.id = 1

        with patch("league.scoring.FantasyTeamPlayer") as mock_ftp:
            mock_ftp.objects.filter.return_value.select_related.return_value = entries
            total, results = simulate_team_score(team, seed=99)

        return total, results

    def test_team_score_equals_sum_of_player_scores(self):
        total, results = self._make_team_with_roster(
            [(20.0, 5.0, 4.0), (10.0, 8.0, 2.0), (5.0, 2.0, 1.0)]
        )
        expected = round(sum(r["fantasy_score"] for r in results), 2)
        self.assertAlmostEqual(total, expected, places=1)

    def test_seeded_team_score_is_deterministic(self):
        from unittest.mock import patch

        players = [_make_player(15.0, 6.0, 3.0) for _ in range(3)]
        entries = []
        for i, p in enumerate(players):
            entry = MagicMock()
            entry.player = p
            entry.player.id = i + 1
            entry.player.full_name = f"Player {i + 1}"
            entries.append(entry)

        team = MagicMock()

        with patch("league.scoring.FantasyTeamPlayer") as mock_ftp:
            mock_ftp.objects.filter.return_value.select_related.return_value = entries
            total_a, _ = simulate_team_score(team, seed=7)

        with patch("league.scoring.FantasyTeamPlayer") as mock_ftp:
            mock_ftp.objects.filter.return_value.select_related.return_value = entries
            total_b, _ = simulate_team_score(team, seed=7)

        self.assertEqual(total_a, total_b)
