"""One-shot setup for a fresh checkout: migrate, seed admin, sync NBA data,
generate per-day stats.

Idempotent — safe to re-run. The heavy `generate_player_game_stats` step is
skipped on re-runs unless `--regenerate-stats` is passed.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run all the one-time setup steps to prepare a demo environment."

    def add_arguments(self, parser):
        parser.add_argument(
            "--regenerate-stats",
            action="store_true",
            help="Wipe and regenerate per-day PlayerGameStats from scratch.",
        )
        parser.add_argument(
            "--season-end-year",
            type=int,
            default=2026,
            help="Season end year for the basketball-reference scrape (default: 2026).",
        )
        parser.add_argument(
            "--start-date",
            default="2026-03-10",
            help="ISO start date for generated stat lines (default: 2026-03-10).",
        )

    def handle(self, *args, regenerate_stats, season_end_year, start_date, **kwargs):
        self.stdout.write(self.style.SUCCESS("\n=== 1/4 applying migrations ==="))
        call_command("migrate", "--noinput")

        self.stdout.write(self.style.SUCCESS("\n=== 2/4 ensuring admin user ==="))
        call_command("seed_admin_user")

        self.stdout.write(self.style.SUCCESS("\n=== 3/4 syncing NBA player data ==="))
        call_command("sync_nba_data", season_end_year=season_end_year)

        from fantasy.models import PlayerGameStats

        self.stdout.write(self.style.SUCCESS("\n=== 4/4 generating per-day stats ==="))
        if regenerate_stats or not PlayerGameStats.objects.exists():
            call_command(
                "generate_player_game_stats",
                weeks=8,
                seed=42,
                start_date=start_date,
                clear=True,
            )
        else:
            self.stdout.write(
                "Stats already present — skipping. Pass --regenerate-stats to redo."
            )

        self.stdout.write(self.style.SUCCESS("\nReady to roll."))
        self.stdout.write("Start the dev servers in two terminals:")
        self.stdout.write("  Backend:   python manage.py runserver        (from backend/)")
        self.stdout.write("  Frontend:  npm run dev                       (from frontend/)")
        self.stdout.write("\nThen open http://localhost:5173 and sign in:")
        self.stdout.write("  admin@demo.local / demoadmin")
