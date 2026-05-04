import json
from django.core.management.base import BaseCommand
from players.models import Player


class Command(BaseCommand):
    help = 'Load NBA player data from data/players.json'

    def handle(self, *args, **options):
        try:
            with open('data/players.json', 'r', encoding='utf-8') as f:
                players_data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR('data/players.json not found'))
            return

        created_count = 0
        updated_count = 0
        error_count = 0

        for player_data in players_data:
            try:
                first = player_data.get('PLAYER_FIRST_NAME', '')
                last = player_data.get('PLAYER_LAST_NAME', '')
                player, created = Player.objects.update_or_create(
                    person_id=player_data['PERSON_ID'],
                    defaults={
                        'first_name': first,
                        'last_name': last,
                        'full_name': f"{first} {last}".strip(),
                        'player_slug': player_data.get('PLAYER_SLUG', ''),
                        'team_id': player_data.get('TEAM_ID'),
                        'team_slug': player_data.get('TEAM_SLUG') or '',
                        'team_city': player_data.get('TEAM_CITY') or '',
                        'team_name': player_data.get('TEAM_NAME') or '',
                        'team_abbreviation': player_data.get('TEAM_ABBREVIATION') or '',
                        'jersey_number': str(player_data.get('JERSEY_NUMBER', '')),
                        'position': player_data.get('POSITION', ''),
                        'height': player_data.get('HEIGHT', ''),
                        'weight': str(player_data.get('WEIGHT', '')),
                        'college': player_data.get('COLLEGE', ''),
                        'country': player_data.get('COUNTRY', ''),
                        'draft_year': player_data.get('DRAFT_YEAR'),
                        'draft_round': player_data.get('DRAFT_ROUND'),
                        'draft_number': player_data.get('DRAFT_NUMBER'),
                        'roster_status': bool(player_data.get('ROSTER_STATUS', True)),
                        'from_year': str(player_data.get('FROM_YEAR', '')),
                        'to_year': str(player_data.get('TO_YEAR', '')),
                        'pts': player_data.get('PTS'),
                        'reb': player_data.get('REB'),
                        'ast': player_data.get('AST'),
                        'stats_timeframe': player_data.get('STATS_TIMEFRAME', ''),
                        'player_last_initial': player_data.get('PLAYER_LAST_INITIAL', ''),
                        'historic': bool(player_data.get('HISTORIC', False)),
                        'is_defunct': bool(player_data.get('IS_DEFUNCT', False)),
                    }
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.WARNING(
                    f"Error loading player {player_data.get('PERSON_ID')}: {e}"
                ))

        self.stdout.write(self.style.SUCCESS(
            f'Done — created: {created_count}, updated: {updated_count}, errors: {error_count}'
        ))
