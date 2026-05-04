"""
End-to-end playoff verification script.

Setup (run once before this script):
    python manage.py migrate
    python manage.py load_players
    python manage.py runserver          # leave running, then open another terminal

Run:
    python e2e_playoffs.py
"""
import json
import sys
import requests

BASE = "http://localhost:8000/api"
COMMISSIONER = "commissioner@e2e.com"
MEMBERS = ["alice@e2e.com", "bob@e2e.com", "carol@e2e.com"]
SEED = 42


# ── helpers ───────────────────────────────────────────────────────────────────

def pp(data):
    print(json.dumps(data, indent=2))


def step(label, resp, expect):
    print(f"\n{'─'*64}")
    print(f"STEP: {label}")
    print(f"  {resp.request.method} {resp.url}  →  HTTP {resp.status_code}")
    try:
        body = resp.json()
    except Exception:
        body = resp.text
    pp(body)
    if resp.status_code not in expect:
        print(f"\n✗  Expected one of {expect}, got {resp.status_code}. Aborting.")
        sys.exit(1)
    print(f"✓  OK (HTTP {resp.status_code})")
    return body


# ── 0. Fetch players for draft picks ─────────────────────────────────────────

print("\n" + "="*64)
print("SETUP: fetching players for draft picks...")
resp = requests.get(f"{BASE}/players/?ordering=-pts")
raw = resp.json()
players = raw.get("results", raw) if isinstance(raw, dict) else raw
scorers = [
    p for p in players
    if p.get("pts") and p.get("reb") and p.get("ast")
    and p["pts"] > 0 and p["reb"] > 0 and p["ast"] > 0
]

if len(scorers) < 20:
    print(f"✗  Need ≥20 players with pts/reb/ast all populated, found {len(scorers)}.")
    print("   Run: python manage.py load_players  then retry.")
    sys.exit(1)

player_ids = [p["person_id"] for p in scorers]
print(f"   Using player person_ids: {player_ids[:20]}")


# ── 1. Create league ──────────────────────────────────────────────────────────

body = step(
    "1. Create league with 4 members",
    requests.post(f"{BASE}/leagues/", json={
        "name": "E2E Playoff League",
        "commissioner_email": COMMISSIONER,
        "invite_emails": MEMBERS,
        "max_players": 4,
        "roster_size": 5,
    }),
    expect=[201],
)
league_id = body["id"]
print(f"\n   >>> league_id = {league_id}")


# ── 2. Start draft ────────────────────────────────────────────────────────────

step(
    "2. Start draft",
    requests.post(f"{BASE}/leagues/{league_id}/start-draft/", json={
        "starter_email": COMMISSIONER,
    }),
    expect=[200],
)


# ── 3. Complete draft: 4 rounds × 4 slots = 16 picks (sequential slot order) ─

member_emails = [COMMISSIONER] + MEMBERS   # slot 1–4
pick_index = 0
ROSTER_SIZE = 5  # matches roster_size sent at league creation

print(f"\n{'─'*64}")
print(f"STEP: 3. Make all {ROSTER_SIZE * 4} draft picks ({ROSTER_SIZE} rounds × 4 slots)")
for round_num in range(1, ROSTER_SIZE + 1):
    for slot_index in range(4):
        email = member_emails[slot_index]
        pid = player_ids[pick_index]
        r = requests.post(f"{BASE}/leagues/{league_id}/pick/", json={
            "email": email,
            "player_id": pid,
        })
        if r.status_code not in (200,):
            print(f"  ✗  Pick {pick_index+1} failed (round {round_num}, slot {slot_index+1}): "
                  f"HTTP {r.status_code} — {r.json()}")
            sys.exit(1)
        data = r.json()
        print(f"  Pick {pick_index+1:>2} | round {round_num} slot {slot_index+1} "
              f"({email}) → player {pid} | league status: {data.get('status')}")
        pick_index += 1

print("✓  Draft complete — league should now be ACTIVE")


# ── 4. Start playoffs ─────────────────────────────────────────────────────────

bracket = step(
    "4. POST /start-playoffs/  (expect: 2 SEMIFINAL matchups, no champion)",
    requests.post(f"{BASE}/leagues/{league_id}/start-playoffs/", json={
        "commissioner_email": COMMISSIONER,
    }),
    expect=[201],
)

matchups = bracket["matchups"]
semis = [m for m in matchups if m["round"] == "SEMIFINAL"]
finals = [m for m in matchups if m["round"] == "FINAL"]
assert len(semis) == 2,  f"Expected 2 semis, got {len(semis)}"
assert len(finals) == 0, f"Expected 0 finals, got {len(finals)}"
assert bracket["champion_id"] is None
print(f"\n   >>> SF1 matchup_id = {semis[0]['id']}  ({semis[0]['home_team_name']} vs {semis[0]['away_team_name']})")
print(f"   >>> SF2 matchup_id = {semis[1]['id']}  ({semis[1]['home_team_name']} vs {semis[1]['away_team_name']})")
sf1_id, sf2_id = semis[0]["id"], semis[1]["id"]


# ── 5. GET /bracket/ — 2 semis, no final, no champion ────────────────────────

bracket = step(
    "5. GET /bracket/  (2 semis unplayed, no final, champion=null)",
    requests.get(f"{BASE}/leagues/{league_id}/bracket/"),
    expect=[200],
)
assert len([m for m in bracket["matchups"] if m["round"] == "SEMIFINAL"]) == 2
assert bracket["champion_id"] is None
print("✓  Assertions passed: 2 semis, no final, no champion")


# ── 6. Simulate SF1 ───────────────────────────────────────────────────────────

sf1 = step(
    f"6. POST /matchups/{sf1_id}/simulate/  (SF1)",
    requests.post(f"{BASE}/leagues/{league_id}/matchups/{sf1_id}/simulate/", json={
        "commissioner_email": COMMISSIONER,
        "seed": SEED,
    }),
    expect=[200],
)
assert sf1["simulated"] is True
assert sf1["winner_id"] is not None
print(f"\n   >>> SF1 winner: {sf1['winner_name']}  "
      f"({sf1['home_score']} vs {sf1['away_score']})")
sf1_winner_id = sf1["winner_id"]


# ── 7. GET /bracket/ — SF1 simulated, still no final ─────────────────────────

bracket = step(
    "7. GET /bracket/  (SF1 simulated with winner, SF2 unplayed, no final yet)",
    requests.get(f"{BASE}/leagues/{league_id}/bracket/"),
    expect=[200],
)
sim_matchups = [m for m in bracket["matchups"] if m["simulated"]]
final_matchups = [m for m in bracket["matchups"] if m["round"] == "FINAL"]
assert len(sim_matchups) == 1, f"Expected 1 simulated matchup, got {len(sim_matchups)}"
assert len(final_matchups) == 0, f"Expected no final yet, got {len(final_matchups)}"
print("✓  Assertions passed: SF1 simulated, no final yet")


# ── 8. Simulate SF2 ───────────────────────────────────────────────────────────

sf2 = step(
    f"8. POST /matchups/{sf2_id}/simulate/  (SF2)",
    requests.post(f"{BASE}/leagues/{league_id}/matchups/{sf2_id}/simulate/", json={
        "commissioner_email": COMMISSIONER,
        "seed": SEED + 1,
    }),
    expect=[200],
)
assert sf2["simulated"] is True
assert sf2["winner_id"] is not None
print(f"\n   >>> SF2 winner: {sf2['winner_name']}  "
      f"({sf2['home_score']} vs {sf2['away_score']})")
sf2_winner_id = sf2["winner_id"]


# ── 9. GET /bracket/ — Final auto-created with semi winners ──────────────────

bracket = step(
    "9. GET /bracket/  (Final auto-created, teams are SF1 + SF2 winners)",
    requests.get(f"{BASE}/leagues/{league_id}/bracket/"),
    expect=[200],
)
final_matchups = [m for m in bracket["matchups"] if m["round"] == "FINAL"]
assert len(final_matchups) == 1, f"Expected 1 final, got {len(final_matchups)}"
final = final_matchups[0]
final_team_ids = {final["home_team_id"], final["away_team_id"]}
assert sf1_winner_id in final_team_ids, "SF1 winner not in Final"
assert sf2_winner_id in final_team_ids, "SF2 winner not in Final"
assert final["simulated"] is False
assert bracket["champion_id"] is None
print(f"\n   >>> Final matchup_id = {final['id']}  "
      f"({final['home_team_name']} vs {final['away_team_name']})")
final_id = final["id"]
print("✓  Assertions passed: Final exists with correct teams, unplayed, no champion")


# ── 10. Simulate Final ────────────────────────────────────────────────────────

final_result = step(
    f"10. POST /matchups/{final_id}/simulate/  (Final)",
    requests.post(f"{BASE}/leagues/{league_id}/matchups/{final_id}/simulate/", json={
        "commissioner_email": COMMISSIONER,
        "seed": SEED + 2,
    }),
    expect=[200],
)
assert final_result["simulated"] is True
assert final_result["winner_id"] is not None
print(f"\n   >>> Champion: {final_result['winner_name']}")


# ── 11. GET /bracket/ — champion set, league COMPLETE ────────────────────────

bracket = step(
    "11. GET /bracket/  (champion set, playoff COMPLETE)",
    requests.get(f"{BASE}/leagues/{league_id}/bracket/"),
    expect=[200],
)
assert bracket["champion_id"] is not None, "champion_id should be set"
assert bracket["champion_name"] is not None, "champion_name should be set"
assert bracket["status"] == "COMPLETE", f"playoff status should be COMPLETE, got {bracket['status']}"

# Verify league status via league detail
league_data = requests.get(f"{BASE}/leagues/{league_id}/").json()
assert league_data["status"] == "COMPLETE", f"league status should be COMPLETE, got {league_data['status']}"
print(f"\n   >>> Champion: {bracket['champion_name']}")
print(f"   >>> League status: {league_data['status']}")
print("✓  Assertions passed: champion set, playoff + league both COMPLETE")


# ── 12. Simulate Final again — expect 400 ────────────────────────────────────

step(
    f"12. POST /matchups/{final_id}/simulate/ again  (expect 400 already-simulated)",
    requests.post(f"{BASE}/leagues/{league_id}/matchups/{final_id}/simulate/", json={
        "commissioner_email": COMMISSIONER,
        "seed": 999,
    }),
    expect=[400],
)
print("✓  Correctly rejected with 400")


# ── 13. Start playoffs again — expect 400 ────────────────────────────────────

step(
    "13. POST /start-playoffs/ again  (expect 400 — league not ACTIVE)",
    requests.post(f"{BASE}/leagues/{league_id}/start-playoffs/", json={
        "commissioner_email": COMMISSIONER,
    }),
    expect=[400],
)
print("✓  Correctly rejected with 400")


# ── Done ──────────────────────────────────────────────────────────────────────

print(f"\n{'='*64}")
print("ALL STEPS PASSED ✓")
print(f"  League ID   : {league_id}")
print(f"  Champion    : {bracket['champion_name']}")
print(f"  SF1 winner  : {semis[0]['home_team_name'] if sf1_winner_id == semis[0]['home_team_id'] else semis[0]['away_team_name']}")
print(f"  SF2 winner  : {semis[1]['home_team_name'] if sf2_winner_id == semis[1]['home_team_id'] else semis[1]['away_team_name']}")
print(f"{'='*64}\n")
