"""Generate per-day PlayerGameStats from season averages.

Each player gets `weeks * 7` days of stat lines. On any given day, the player
plays with probability proportional to their season GP/82, and stat values
are sampled around their averages with Gaussian noise (a Poisson-like
approximation that's good enough for a demo).

Deterministic with --seed so the demo plays the same way every run.

Usage:
  python manage.py generate_player_game_stats                  # default 8 weeks
  python manage.py generate_player_game_stats --weeks 12 --seed 7
  python manage.py generate_player_game_stats --clear --start-date 2026-04-01
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from random import Random
from typing import Iterable

from django.core.management.base import BaseCommand
from django.db import transaction

from fantasy.models import PlayerGameStats, PlayerSeasonAverage


class Command(BaseCommand):
    help = "Generate per-day PlayerGameStats from season averages."

    def add_arguments(self, parser):
        parser.add_argument("--start-date", default=None,
                            help="ISO date (YYYY-MM-DD). Defaults to (today - 7*weeks + 1).")
        parser.add_argument("--weeks", type=int, default=8)
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--season-label", default="2025-26")
        parser.add_argument("--clear", action="store_true",
                            help="Delete existing PlayerGameStats before generating.")

    def handle(self, *args, start_date, weeks, seed, season_label, clear, **kwargs):
        days = weeks * 7
        rng = Random(seed)

        if start_date:
            start = date.fromisoformat(start_date)
        else:
            start = date.today() - timedelta(days=days - 1)

        if clear:
            self.stdout.write("Clearing existing PlayerGameStats...")
            PlayerGameStats.objects.all().delete()

        averages = list(
            PlayerSeasonAverage.objects.filter(season=season_label).select_related("player")
        )
        if not averages:
            self.stderr.write(
                f"No PlayerSeasonAverage rows for season {season_label}. "
                "Run sync_nba_data first."
            )
            return

        self.stdout.write(
            f"Generating {days} days of stats for {len(averages)} players, "
            f"start={start}, seed={seed}"
        )

        total = 0
        with transaction.atomic():
            for sa in averages:
                player_seed = (seed * 31) ^ sa.player_id
                player_rng = Random(player_seed)
                play_prob = _gp_to_play_prob(sa.games_played)

                for d in range(days):
                    game_date = start + timedelta(days=d)
                    did_play = player_rng.random() < play_prob
                    if not did_play:
                        PlayerGameStats.objects.update_or_create(
                            player=sa.player,
                            game_date=game_date,
                            defaults={"did_play": False},
                        )
                        total += 1
                        continue

                    line = {
                        "minutes": _sample_count(player_rng, sa.minutes, std_floor=4.0),
                        "pts": _sample_count(player_rng, sa.pts),
                        "reb": _sample_count(player_rng, sa.reb),
                        "ast": _sample_count(player_rng, sa.ast),
                        "stl": _sample_count(player_rng, sa.stl),
                        "blk": _sample_count(player_rng, sa.blk),
                        "tov": _sample_count(player_rng, sa.tov),
                        "fgm": _sample_count(player_rng, sa.fgm),
                        "fga": _sample_count(player_rng, sa.fga),
                        "ftm": _sample_count(player_rng, sa.ftm),
                        "fta": _sample_count(player_rng, sa.fta),
                        "fg3m": _sample_count(player_rng, sa.fg3m),
                        "did_play": True,
                    }
                    PlayerGameStats.objects.update_or_create(
                        player=sa.player,
                        game_date=game_date,
                        defaults=line,
                    )
                    total += 1

        self.stdout.write(self.style.SUCCESS(f"Generated {total} stat lines."))


def _gp_to_play_prob(games_played: int) -> float:
    """Map GP (0..82+) to a per-day play probability."""
    if games_played <= 0:
        return 0.05
    raw = games_played / 82.0
    return max(0.05, min(0.95, raw))


def _sample_count(rng: Random, mean: float, std_floor: float = 0.8) -> float:
    """Gaussian sample around the mean, clipped at zero, rounded to one decimal."""
    if mean <= 0:
        return 0.0
    std = max(std_floor, math.sqrt(max(mean, 0.5)))
    sample = rng.gauss(mean, std)
    return max(0.0, round(sample, 1))


def chunked(iterable: Iterable, size: int) -> Iterable[list]:
    """Yield successive chunks from an iterable. Currently unused; kept for
    when we batch update_or_create into bulk_create."""
    chunk: list = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk
