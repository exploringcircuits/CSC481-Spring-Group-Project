"""Populate Player.nba_player_id from data/nba_player_ids.json.

Tries an exact slug match first, then a diacritic-stripped fallback so that
players whose names contain accents (Dončić, Jokić, Pacôme) match against
the ASCII-only mapping in the JSON.
"""

from __future__ import annotations

import json
import unicodedata

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from fantasy.models import Player


def _ascii_slug(value: str) -> str:
    """Slug after stripping combining diacritics and any 'ø'/'ł' style replacements."""
    if not value:
        return ""
    nfd = unicodedata.normalize("NFD", value)
    stripped = "".join(c for c in nfd if not unicodedata.combining(c))
    stripped = stripped.replace("ø", "o").replace("Ø", "O").replace("ł", "l").replace("Ł", "L")
    return slugify(stripped)


class Command(BaseCommand):
    help = "Populate Player.nba_player_id from fantasy/data/nba_player_ids.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-resolve every Player even if nba_player_id is already set.",
        )

    def handle(self, *args, **options):
        path = settings.BASE_DIR / "fantasy" / "data" / "nba_player_ids.json"
        mapping: dict[str, int] = json.loads(path.read_text(encoding="utf-8"))

        # Build an ASCII-fallback index alongside the literal slugs.
        ascii_index: dict[str, int] = {}
        for slug, pid in mapping.items():
            ascii_key = _ascii_slug(slug.replace("-", " "))
            ascii_index.setdefault(ascii_key, pid)

        qs = Player.objects.all() if options["force"] else Player.objects.filter(nba_player_id__isnull=True)

        updated = 0
        missing: list[str] = []
        for p in qs.iterator():
            if not p.full_name or p.full_name == "League Average":
                continue
            pid = mapping.get(p.slug)
            if pid is None:
                pid = ascii_index.get(_ascii_slug(p.full_name))
            if pid is None:
                missing.append(p.slug)
                continue
            if p.nba_player_id != pid:
                p.nba_player_id = pid
                p.save(update_fields=["nba_player_id"])
                updated += 1

        total = qs.count()
        self.stdout.write(f"Updated {updated} of {total} players ({len(missing)} unresolved)")
        if missing and len(missing) <= 30:
            self.stdout.write("Unresolved slugs: " + ", ".join(missing[:30]))
