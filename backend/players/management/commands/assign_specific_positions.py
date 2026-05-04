from django.core.management.base import BaseCommand
from players.models import Player

POSITION_MAP = {
    "G":   "PG/SG",
    "F":   "PF/SF",
    "C":   "C",
    "G-F": "SG/SF",
    "F-G": "SF/SG",
    "F-C": "PF/C",
    "C-F": "C/PF",
}


class Command(BaseCommand):
    help = "Assign specific_position values based on the broad position field"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing to the database",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        counts = {v: 0 for v in POSITION_MAP.values()}
        skipped = {}

        for player in Player.objects.all():
            specific = POSITION_MAP.get(player.position)
            if specific:
                counts[specific] += 1
                if not dry_run:
                    Player.objects.filter(pk=player.pk).update(specific_position=specific)
            else:
                pos = player.position or "(blank)"
                skipped[pos] = skipped.get(pos, 0) + 1
                if not dry_run:
                    Player.objects.filter(pk=player.pk).update(specific_position="")

        prefix = "[DRY RUN] " if dry_run else ""

        for label, count in counts.items():
            self.stdout.write(f"{prefix}{label:<8} assigned : {count}")

        if skipped:
            self.stdout.write(self.style.WARNING(
                f"{prefix}Skipped        : {sum(skipped.values())} "
                f"(unrecognized positions: {dict(skipped)})"
            ))
        else:
            self.stdout.write(f"{prefix}Skipped        : 0")

        if not dry_run:
            self.stdout.write(self.style.SUCCESS("Done."))
