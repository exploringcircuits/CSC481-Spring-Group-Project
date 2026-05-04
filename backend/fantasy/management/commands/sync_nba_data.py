"""Scrape current-season NBA player season averages from basketball-reference.

Single page → all active NBA players. Cached locally so repeat runs need no
internet. The cache is committed alongside the code so a fresh checkout can
populate the database without ever calling out.

Usage:
  python manage.py sync_nba_data                # use cached page if present
  python manage.py sync_nba_data --refresh      # re-fetch the page
  python manage.py sync_nba_data --season-end-year 2026
"""

from __future__ import annotations

from typing import Optional

import requests
from bs4 import BeautifulSoup, Comment
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from fantasy.models import Player, PlayerSeasonAverage

URL_TEMPLATE = "https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html"

# Mapping of basketball-reference data-stat keys we care about to model fields.
# Some pages use "pts_per_g", others use "pts" — we try both.
STAT_KEYS = {
    "minutes": ["mp_per_g", "mp"],
    "pts": ["pts_per_g", "pts"],
    "reb": ["trb_per_g", "trb"],
    "ast": ["ast_per_g", "ast"],
    "stl": ["stl_per_g", "stl"],
    "blk": ["blk_per_g", "blk"],
    "tov": ["tov_per_g", "tov"],
    "fgm": ["fg_per_g", "fg"],
    "fga": ["fga_per_g", "fga"],
    "ftm": ["ft_per_g", "ft"],
    "fta": ["fta_per_g", "fta"],
    "fg3m": ["fg3_per_g", "fg3"],
    "fg3a": ["fg3a_per_g", "fg3a"],
    "fg_pct": ["fg_pct"],
    "ft_pct": ["ft_pct"],
    "fg3_pct": ["fg3_pct"],
}


class Command(BaseCommand):
    help = "Scrape current-season NBA player averages from basketball-reference."

    def add_arguments(self, parser):
        parser.add_argument("--season-end-year", type=int, default=2026)
        parser.add_argument("--refresh", action="store_true",
                            help="Re-fetch the page even if cached locally.")
        parser.add_argument("--limit", type=int, default=None,
                            help="Only ingest the first N rows.")

    def handle(self, *args, season_end_year, refresh, limit, **kwargs):
        cache_dir = settings.BASE_DIR / "data" / "cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = cache_dir / f"bbref_per_game_{season_end_year}.html"
        season_label = f"{season_end_year - 1}-{season_end_year % 100:02d}"

        html = self._load_html(cache_file, season_end_year, refresh)
        soup = BeautifulSoup(html, "html.parser")
        table = self._find_per_game_table(soup)
        if table is None:
            self.stderr.write("Could not find per_game_stats table. Page structure may have changed.")
            return

        rows = table.find("tbody").find_all("tr")
        if limit:
            rows = rows[:limit]

        created = 0
        updated = 0
        seen_slugs: set[str] = set()

        with transaction.atomic():
            for row in rows:
                cls = row.get("class") or []
                if "thead" in cls:
                    continue
                cells = {c.get("data-stat"): c for c in row.find_all(["td", "th"])}
                name_cell = cells.get("name_display") or cells.get("player")
                if not name_cell:
                    continue
                full_name = name_cell.get_text(strip=True)
                if not full_name:
                    continue

                slug = slugify(full_name)
                if slug in seen_slugs:
                    # Mid-season trades produce a TOT row plus per-team rows; the first
                    # row (TOT or first stint) wins.
                    continue
                seen_slugs.add(slug)

                bbref_id = ""
                a = name_cell.find("a")
                if a and a.get("href"):
                    bbref_id = a["href"].rstrip("/").split("/")[-1].replace(".html", "")

                pos_cell = cells.get("pos")
                primary_pos = ""
                if pos_cell:
                    text = pos_cell.get_text(strip=True)
                    primary_pos = text.split("-")[0].strip() if text else ""

                team_cell = cells.get("team_name_abbr") or cells.get("team_id")
                team_abbr = team_cell.get_text(strip=True) if team_cell else ""

                gp_cell = cells.get("games") or cells.get("g")
                games_played = self._to_int(gp_cell.get_text(strip=True)) if gp_cell else 0

                # Build the season-average payload
                stat_payload: dict[str, float] = {}
                for field, candidates in STAT_KEYS.items():
                    value: Optional[float] = None
                    for key in candidates:
                        cell = cells.get(key)
                        if cell is not None:
                            value = self._to_float(cell.get_text(strip=True))
                            break
                    stat_payload[field] = value if value is not None else 0.0

                first, *rest = full_name.split(" ", 1)
                last = rest[0] if rest else ""

                player, was_created = Player.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "full_name": full_name,
                        "first_name": first,
                        "last_name": last,
                        "team_abbr": team_abbr,
                        "primary_position": primary_pos,
                        "eligible_positions": [primary_pos] if primary_pos else [],
                        "bbref_id": bbref_id,
                        "is_active": True,
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

                PlayerSeasonAverage.objects.update_or_create(
                    player=player, season=season_label,
                    defaults={
                        "games_played": games_played,
                        **stat_payload,
                    },
                )

        self.stdout.write(self.style.SUCCESS(
            f"Done. {created} new players, {updated} updated. Season: {season_label}"
        ))

    def _load_html(self, cache_file, season_end_year, refresh):
        if cache_file.exists() and not refresh:
            self.stdout.write(f"Using cached HTML at {cache_file}")
            return cache_file.read_text(encoding="utf-8")
        url = URL_TEMPLATE.format(year=season_end_year)
        self.stdout.write(f"Fetching {url}")
        resp = requests.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=30,
        )
        resp.raise_for_status()
        cache_file.write_text(resp.text, encoding="utf-8")
        return resp.text

    def _find_per_game_table(self, soup):
        table = soup.find("table", id="per_game_stats")
        if table is not None:
            return table
        # basketball-reference often renders advanced/per-game tables inside HTML
        # comments, which the page assembles client-side. Walk every comment node.
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            if "per_game_stats" not in comment:
                continue
            inner = BeautifulSoup(comment, "html.parser")
            t = inner.find("table", id="per_game_stats")
            if t is not None:
                return t
        return None

    @staticmethod
    def _to_float(text: str) -> Optional[float]:
        if not text:
            return None
        try:
            return float(text)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_int(text: str) -> int:
        if not text:
            return 0
        try:
            return int(float(text))
        except (TypeError, ValueError):
            return 0
