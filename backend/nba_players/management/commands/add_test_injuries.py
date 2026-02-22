from django.core.management.base import BaseCommand
from nba_players.models import Player


class Command(BaseCommand):
    help = "Add test injury statuses to a few players"

    def handle(self, *args, **options):
        players = list(Player.objects.all().order_by("full_name")[:10])

        if len(players) >= 6:
            # Set various injury statuses for testing
            players[0].injury_status = "Out"
            players[0].is_healthy = False
            players[0].save()

            players[1].injury_status = "Day-to-Day"
            players[1].is_healthy = False
            players[1].save()

            players[2].injury_status = "Questionable"
            players[2].is_healthy = False
            players[2].save()

            players[3].injury_status = "Doubtful"
            players[3].is_healthy = False
            players[3].save()

            players[4].injury_status = "IR"
            players[4].is_healthy = False
            players[4].save()

            players[5].injury_status = "Probable"
            players[5].is_healthy = True
            players[5].save()

            self.stdout.write(self.style.SUCCESS("Added injury statuses:"))
            for p in players[:6]:
                self.stdout.write(f"  {p.full_name}: {p.injury_status}")
        else:
            self.stdout.write(self.style.ERROR("Not enough players in database"))
