import json
from pathlib import Path

from django.core.management.base import BaseCommand
from players.models import Player


class Command(BaseCommand):
    help = "Seed the database with NBA players from data/players.json"

    def handle(self, *args, **kwargs):
        file_path = Path("data/players.json")

        if not file_path.exists():
            self.stdout.write(
                self.style.ERROR("players.json not found in data/")
            )
            return

        with open(file_path, "r", encoding="utf-8") as f:
            players = json.load(f)

        created_or_updated_count = 0

        for p in players:
            Player.objects.update_or_create(
                person_id=p["PERSON_ID"],
                defaults={
                    "first_name": p.get("PLAYER_FIRST_NAME") or "",
                    "last_name": p.get("PLAYER_LAST_NAME") or "",
                    "full_name": f"{p.get('PLAYER_FIRST_NAME') or ''} {p.get('PLAYER_LAST_NAME') or ''}".strip(),
                    "player_slug": p.get("PLAYER_SLUG") or "",

                    "team_id": p.get("TEAM_ID") or 0,
                    "team_slug": p.get("TEAM_SLUG") or "",
                    "team_city": p.get("TEAM_CITY") or "",
                    "team_name": p.get("TEAM_NAME") or "",
                    "team_abbreviation": p.get("TEAM_ABBREVIATION") or "",

                    "jersey_number": p.get("JERSEY_NUMBER") or "",
                    "position": p.get("POSITION") or "",
                    "height": p.get("HEIGHT") or "",
                    "weight": str(p.get("WEIGHT") or ""),

                    "college": p.get("COLLEGE") or "",
                    "country": p.get("COUNTRY") or "",

                    "draft_year": p.get("DRAFT_YEAR"),
                    "draft_round": p.get("DRAFT_ROUND"),
                    "draft_number": p.get("DRAFT_NUMBER"),

                    "roster_status": bool(p.get("ROSTER_STATUS") or 0),
                    "from_year": p.get("FROM_YEAR") or "",
                    "to_year": p.get("TO_YEAR") or "",

                    "pts": p.get("PTS"),
                    "reb": p.get("REB"),
                    "ast": p.get("AST"),

                    "stats_timeframe": p.get("STATS_TIMEFRAME") or "",
                    "player_last_initial": p.get("PLAYER_LAST_INITIAL") or "",
                    "historic": bool(p.get("HISTORIC") or False),
                    "is_defunct": bool(p.get("IS_DEFUNCT") or 0),
                }
            )
            created_or_updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_or_updated_count} players successfully."
            )
        )