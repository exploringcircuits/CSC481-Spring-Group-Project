import json

from django.test import TestCase, Client

from league.models import (
    Draft,
    FantasyTeam,
    FantasyTeamPlayer,
    League,
    LeagueMember,
)
from league.serializers import LeagueCreateSerializer
from players.models import Player


def _make_player(n):
    return Player.objects.create(
        person_id=800000 + n,
        full_name=f"Player {n}",
        player_slug=f"player-{n}",
        pts=float(n),
        reb=5.0,
        ast=2.0,
    )


def _setup_league(roster_size=5, num_members=2):
    """Create a league, members, teams, draft, and players ready to pick."""
    league = League.objects.create(
        name="Draft Test League",
        commissioner_email="commissioner@test.com",
        max_players=num_members,
        roster_size=roster_size,
        status=League.Status.SETUP,
    )
    members = []
    for i in range(num_members):
        email = "commissioner@test.com" if i == 0 else f"member{i}@test.com"
        m = LeagueMember.objects.create(
            league=league, email=email, slot=i + 1,
            is_commissioner=(i == 0),
        )
        FantasyTeam.objects.create(league=league, member=m, name=f"Team {i+1}")
        members.append(m)

    Draft.objects.create(league=league)
    players = [_make_player(i) for i in range(roster_size * num_members + 2)]
    return league, members, players


class RosterSizeSerializerTests(TestCase):

    def test_default_roster_size_is_12(self):
        s = LeagueCreateSerializer(data={
            "name": "Test", "commissioner_email": "a@b.com",
        })
        self.assertTrue(s.is_valid(), s.errors)
        self.assertEqual(s.validated_data["roster_size"], 12)

    def test_roster_size_below_min_rejected(self):
        s = LeagueCreateSerializer(data={
            "name": "Test", "commissioner_email": "a@b.com", "roster_size": 4,
        })
        self.assertFalse(s.is_valid())
        self.assertIn("roster_size", s.errors)

    def test_roster_size_above_max_rejected(self):
        s = LeagueCreateSerializer(data={
            "name": "Test", "commissioner_email": "a@b.com", "roster_size": 16,
        })
        self.assertFalse(s.is_valid())
        self.assertIn("roster_size", s.errors)

    def test_roster_size_at_min_boundary_accepted(self):
        s = LeagueCreateSerializer(data={
            "name": "Test", "commissioner_email": "a@b.com", "roster_size": 5,
        })
        self.assertTrue(s.is_valid(), s.errors)

    def test_roster_size_at_max_boundary_accepted(self):
        s = LeagueCreateSerializer(data={
            "name": "Test", "commissioner_email": "a@b.com", "roster_size": 15,
        })
        self.assertTrue(s.is_valid(), s.errors)


class RosterSizeDraftTests(TestCase):

    def setUp(self):
        self.client = Client()

    def _post(self, url, data):
        return self.client.post(
            url, data=json.dumps(data), content_type="application/json"
        )

    def _start_draft(self, league_id, email):
        return self._post(
            f"/api/leagues/{league_id}/start-draft/",
            {"starter_email": email},
        )

    def _pick(self, league_id, email, person_id):
        return self._post(
            f"/api/leagues/{league_id}/pick/",
            {"email": email, "player_id": person_id},
        )

    def test_default_roster_size_saved_when_created_via_api(self):
        resp = self._post("/api/leagues/", {
            "name": "API League",
            "commissioner_email": "c@test.com",
            "invite_emails": [],
            "max_players": 2,
        })
        self.assertEqual(resp.status_code, 201)
        league = League.objects.get(pk=resp.json()["id"])
        self.assertEqual(league.roster_size, 12)

    def test_roster_size_persisted_when_specified(self):
        resp = self._post("/api/leagues/", {
            "name": "API League",
            "commissioner_email": "c@test.com",
            "invite_emails": [],
            "max_players": 2,
            "roster_size": 7,
        })
        self.assertEqual(resp.status_code, 201)
        league = League.objects.get(pk=resp.json()["id"])
        self.assertEqual(league.roster_size, 7)

    def test_per_member_cap_uses_roster_size_not_max_players(self):
        """Member with max_players=2 but roster_size=5 should be able to pick 5 players."""
        league, members, players = _setup_league(roster_size=5, num_members=2)
        self._start_draft(league.id, "commissioner@test.com")

        # Make roster_size picks for slot 1, interleaved with slot 2
        for i in range(5):
            # slot 1 pick
            r = self._pick(league.id, "commissioner@test.com", players[i * 2].person_id)
            self.assertEqual(r.status_code, 200, f"Pick {i+1} slot1 failed: {r.json()}")
            # slot 2 pick (keep draft moving)
            r = self._pick(league.id, "member1@test.com", players[i * 2 + 1].person_id)
            self.assertEqual(r.status_code, 200, f"Pick {i+1} slot2 failed: {r.json()}")

        # commissioner now has 5 picks — a 6th should be rejected
        extra = _make_player(999)
        r = self._pick(league.id, "commissioner@test.com", extra.person_id)
        # draft is complete at this point (both teams full), so "not in progress" is also valid
        self.assertIn(r.status_code, [400, 409])

    def test_draft_completes_after_members_times_roster_size_picks(self):
        """Draft status flips to COMPLETE after members × roster_size total picks."""
        roster_size = 5
        league, members, players = _setup_league(roster_size=roster_size, num_members=2)
        self._start_draft(league.id, "commissioner@test.com")

        total_picks = 2 * roster_size  # 10
        for i in range(total_picks):
            slot_email = "commissioner@test.com" if i % 2 == 0 else "member1@test.com"
            r = self._pick(league.id, slot_email, players[i].person_id)
            self.assertEqual(r.status_code, 200, f"Pick {i+1} failed: {r.json()}")

        draft = Draft.objects.get(league=league)
        league.refresh_from_db()
        self.assertEqual(draft.status, Draft.Status.COMPLETE)
        self.assertEqual(league.status, League.Status.ACTIVE)

    def test_draft_does_not_complete_early_with_large_roster_size(self):
        """With roster_size=6, completing only 4 picks (old max_players count) is not enough."""
        league, members, players = _setup_league(roster_size=6, num_members=2)
        self._start_draft(league.id, "commissioner@test.com")

        # Make only 4 picks (what old max_players=2 logic would have considered complete)
        for i in range(4):
            slot_email = "commissioner@test.com" if i % 2 == 0 else "member1@test.com"
            self._pick(league.id, slot_email, players[i].person_id)

        draft = Draft.objects.get(league=league)
        league.refresh_from_db()
        self.assertNotEqual(draft.status, Draft.Status.COMPLETE)
        self.assertNotEqual(league.status, League.Status.ACTIVE)
