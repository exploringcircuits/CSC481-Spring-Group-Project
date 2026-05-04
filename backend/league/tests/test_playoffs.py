from django.test import TestCase

from league.models import (
    FantasyTeam,
    FantasyTeamPlayer,
    League,
    LeagueMember,
    Playoff,
    PlayoffMatchup,
    PlayerMatchupStat,
)
from league.playoffs import PlayoffError, get_bracket_state, simulate_matchup, start_playoffs
from players.models import Player


def _make_league(status=League.Status.ACTIVE):
    return League.objects.create(name="Test League", commissioner_email="c@test.com", status=status)


def _make_player(name="Player", pts=15.0, reb=5.0, ast=3.0):
    import random
    slug = f"{name.lower().replace(' ', '-')}-{random.randint(1000, 9999)}"
    return Player.objects.create(
        person_id=random.randint(100000, 999999),
        full_name=name,
        player_slug=slug,
        pts=pts,
        reb=reb,
        ast=ast,
    )


def _make_team(league, slot, name="Team", add_players=True):
    member = LeagueMember.objects.create(
        league=league,
        email=f"slot{slot}@test.com",
        slot=slot,
    )
    team = FantasyTeam.objects.create(league=league, member=member, name=name)
    if add_players:
        player = _make_player(name=f"Player-{slot}")
        FantasyTeamPlayer.objects.create(team=team, player=player)
    return team


def _setup_four_team_league():
    league = _make_league()
    teams = [_make_team(league, slot=i + 1, name=f"Team {i + 1}") for i in range(4)]
    return league, teams


class StartPlayoffsTests(TestCase):
    def test_fails_if_league_not_active(self):
        league = _make_league(status=League.Status.SETUP)
        _make_team(league, slot=1)
        _make_team(league, slot=2)
        _make_team(league, slot=3)
        _make_team(league, slot=4)
        with self.assertRaises(PlayoffError):
            start_playoffs(league)

    def test_fails_if_fewer_than_4_teams(self):
        league = _make_league()
        _make_team(league, slot=1)
        _make_team(league, slot=2)
        with self.assertRaises(PlayoffError):
            start_playoffs(league)

    def test_fails_if_team_has_no_roster(self):
        league = _make_league()
        for i in range(3):
            _make_team(league, slot=i + 1)
        _make_team(league, slot=4, add_players=False)
        with self.assertRaises(PlayoffError):
            start_playoffs(league)

    def test_succeeds_creates_playoff_and_two_semis(self):
        league, _ = _setup_four_team_league()
        playoff = start_playoffs(league)

        league.refresh_from_db()
        self.assertEqual(league.status, League.Status.PLAYOFFS)
        self.assertIsNotNone(playoff.pk)

        semis = PlayoffMatchup.objects.filter(playoff=playoff, round=PlayoffMatchup.Round.SEMIFINAL)
        self.assertEqual(semis.count(), 2)

    def test_semis_seeded_by_slot(self):
        league, teams = _setup_four_team_league()
        playoff = start_playoffs(league)

        semis = list(PlayoffMatchup.objects.filter(
            playoff=playoff, round=PlayoffMatchup.Round.SEMIFINAL
        ).order_by("id"))

        self.assertEqual(semis[0].team_a, teams[0])
        self.assertEqual(semis[0].team_b, teams[1])
        self.assertEqual(semis[1].team_a, teams[2])
        self.assertEqual(semis[1].team_b, teams[3])


class SimulateMatchupTests(TestCase):
    def setUp(self):
        self.league, self.teams = _setup_four_team_league()
        self.playoff = start_playoffs(self.league)
        self.semis = list(
            PlayoffMatchup.objects.filter(
                playoff=self.playoff, round=PlayoffMatchup.Round.SEMIFINAL
            ).order_by("id")
        )

    def test_fails_if_already_simulated(self):
        simulate_matchup(self.semis[0], seed=1)
        with self.assertRaises(PlayoffError):
            simulate_matchup(self.semis[0], seed=1)

    def test_simulating_one_semi_does_not_create_final(self):
        simulate_matchup(self.semis[0], seed=1)
        finals = PlayoffMatchup.objects.filter(playoff=self.playoff, round=PlayoffMatchup.Round.FINAL)
        self.assertEqual(finals.count(), 0)

    def test_simulating_both_semis_creates_final(self):
        simulate_matchup(self.semis[0], seed=1)
        simulate_matchup(self.semis[1], seed=2)
        finals = PlayoffMatchup.objects.filter(playoff=self.playoff, round=PlayoffMatchup.Round.FINAL)
        self.assertEqual(finals.count(), 1)

    def test_final_teams_are_semi_winners(self):
        s0 = simulate_matchup(self.semis[0], seed=1)
        s1 = simulate_matchup(self.semis[1], seed=2)
        final = PlayoffMatchup.objects.get(playoff=self.playoff, round=PlayoffMatchup.Round.FINAL)

        self.assertIn(final.team_a, [s0.winner, s1.winner])
        self.assertIn(final.team_b, [s0.winner, s1.winner])
        self.assertNotEqual(final.team_a, final.team_b)

    def test_simulating_final_sets_champion_and_completes_league(self):
        simulate_matchup(self.semis[0], seed=1)
        simulate_matchup(self.semis[1], seed=2)
        final = PlayoffMatchup.objects.get(playoff=self.playoff, round=PlayoffMatchup.Round.FINAL)
        simulate_matchup(final, seed=3)

        self.playoff.refresh_from_db()
        self.league.refresh_from_db()

        self.assertIsNotNone(self.playoff.champion)
        self.assertEqual(self.playoff.status, Playoff.Status.COMPLETE)
        self.assertEqual(self.league.status, League.Status.COMPLETE)

    def test_player_matchup_stats_created_for_all_rostered_players(self):
        matchup = self.semis[0]
        simulate_matchup(matchup, seed=42)

        team_a_count = FantasyTeamPlayer.objects.filter(team=matchup.team_a).count()
        team_b_count = FantasyTeamPlayer.objects.filter(team=matchup.team_b).count()
        expected = team_a_count + team_b_count

        actual = PlayerMatchupStat.objects.filter(matchup=matchup).count()
        self.assertEqual(actual, expected)

    def test_seeded_simulate_is_deterministic(self):
        matchup = self.semis[0]
        simulate_matchup(matchup, seed=77)
        score_a_first = matchup.team_a_score

        # Reset to re-run (create a fresh duplicate scenario via another league)
        league2, teams2 = _setup_four_team_league()
        playoff2 = start_playoffs(league2)
        semi2 = PlayoffMatchup.objects.filter(
            playoff=playoff2, round=PlayoffMatchup.Round.SEMIFINAL
        ).order_by("id").first()
        simulate_matchup(semi2, seed=77)

        self.assertEqual(matchup.team_a_score, semi2.team_a_score)

    def test_end_to_end_champion_is_one_of_original_teams(self):
        simulate_matchup(self.semis[0], seed=10)
        simulate_matchup(self.semis[1], seed=20)
        final = PlayoffMatchup.objects.get(playoff=self.playoff, round=PlayoffMatchup.Round.FINAL)
        simulate_matchup(final, seed=30)

        self.playoff.refresh_from_db()
        self.league.refresh_from_db()

        self.assertIn(self.playoff.champion, self.teams)
        self.assertEqual(self.league.status, League.Status.COMPLETE)


class GetBracketStateTests(TestCase):
    def test_returns_not_started_when_no_playoff(self):
        league = _make_league()
        state = get_bracket_state(league)
        self.assertFalse(state["started"])
        self.assertEqual(state["matchups"], [])
        self.assertIsNone(state["champion"])

    def test_bracket_includes_matchups_after_start(self):
        league, _ = _setup_four_team_league()
        start_playoffs(league)
        state = get_bracket_state(league)
        self.assertTrue(state["started"])
        self.assertEqual(len(state["matchups"]), 2)

    def test_bracket_includes_player_stats_after_simulate(self):
        league, _ = _setup_four_team_league()
        start_playoffs(league)
        playoff = league.playoff
        semi = PlayoffMatchup.objects.filter(
            playoff=playoff, round=PlayoffMatchup.Round.SEMIFINAL
        ).first()
        simulate_matchup(semi, seed=5)

        state = get_bracket_state(league)
        simulated_matchup = next(m for m in state["matchups"] if m["simulated"])
        self.assertGreater(len(simulated_matchup["player_stats"]), 0)

    def test_bracket_shows_champion_after_final(self):
        league, _ = _setup_four_team_league()
        start_playoffs(league)
        playoff = league.playoff
        semis = list(
            PlayoffMatchup.objects.filter(
                playoff=playoff, round=PlayoffMatchup.Round.SEMIFINAL
            ).order_by("id")
        )
        simulate_matchup(semis[0], seed=1)
        simulate_matchup(semis[1], seed=2)
        final = PlayoffMatchup.objects.get(playoff=playoff, round=PlayoffMatchup.Round.FINAL)
        simulate_matchup(final, seed=3)

        state = get_bracket_state(league)
        self.assertIsNotNone(state["champion_name"])
