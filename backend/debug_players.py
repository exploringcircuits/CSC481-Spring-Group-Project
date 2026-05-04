import json

with open("data/players.json", "r", encoding="utf-8") as f:
    players = json.load(f)

for i, p in enumerate(players):
    if p.get("TEAM_SLUG") is None:
        print("Missing TEAM_SLUG at index:", i)
        print(p)
        print("-" * 50)