from django.core.management.base import BaseCommand
from nba_api.stats.static import players
from nba_api.stats.endpoints import (
    playercareerstats,
    commonplayerinfo,
    leaguedashplayerstats,
)
from nba_players.models import Player, PlayerStats
import time
import random


def normalize_position(position_str):
    """
    Normalize position strings to standard abbreviations.

    Converts full position names to abbreviations:
    - Point Guard / PG → PG
    - Shooting Guard / SG → SG
    - Small Forward / SF → SF
    - Power Forward / PF → PF
    - Center / C → C
    - Guard → G
    - Forward → F
    - Guard-Forward → G-F
    - Forward-Center → F-C
    - Forward-Guard → G-F
    """
    if not position_str:
        return ""

    position_str = str(position_str).strip()

    # Direct abbreviation mappings
    position_map = {
        "Point Guard": "PG",
        "Shooting Guard": "SG",
        "Small Forward": "SF",
        "Power Forward": "PF",
        "Center": "C",
        "Guard": "G",
        "Forward": "F",
        "Guard-Forward": "G-F",
        "Forward-Guard": "G-F",
        "Forward-Center": "F-C",
        "Center-Forward": "F-C",
    }

    # Check exact matches first
    if position_str in position_map:
        return position_map[position_str]

    # Check if already abbreviated
    if position_str in [
        "PG",
        "SG",
        "SF",
        "PF",
        "C",
        "G",
        "F",
        "G-F",
        "F-C",
        "F-G",
        "C-F",
    ]:
        # Normalize compound positions
        if position_str in ["F-G"]:
            return "G-F"
        if position_str in ["C-F"]:
            return "F-C"
        return position_str

    # Handle partial matches
    position_lower = position_str.lower()
    if "point" in position_lower and "guard" in position_lower:
        return "PG"
    elif "shooting" in position_lower and "guard" in position_lower:
        return "SG"
    elif "small" in position_lower and "forward" in position_lower:
        return "SF"
    elif "power" in position_lower and "forward" in position_lower:
        return "PF"
    elif "center" in position_lower:
        return "C"
    elif "guard" in position_lower and "forward" in position_lower:
        return "G-F"
    elif "forward" in position_lower and "center" in position_lower:
        return "F-C"
    elif "guard" in position_lower:
        return "G"
    elif "forward" in position_lower:
        return "F"

    # Return as-is if no match
    return position_str


class Command(BaseCommand):
    help = "Fetch NBA player data from nba_api and populate the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Limit number of players to fetch (default: 100, use 0 for all)",
        )
        parser.add_argument(
            "--offset",
            type=int,
            default=0,
            help="Skip first N players (default: 0)",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=40,
            help="Number of players per batch before pause (default: 40)",
        )
        parser.add_argument(
            "--batch-delay",
            type=int,
            default=30,
            help="Delay in seconds between batches (default: 30)",
        )
        parser.add_argument(
            "--season",
            type=str,
            default="2025-26",
            help="NBA season to fetch (default: 2025-26)",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        offset = options["offset"]
        season = options["season"]
        batch_size = options["batch_size"]

        self.stdout.write(
            self.style.SUCCESS(f"Fetching NBA players for season {season}...")
        )

        # Get all NBA players from the static data
        all_players = players.get_active_players()

        # Skip first N players (offset) and limit
        all_players = (
            all_players[offset : offset + limit] if limit > 0 else all_players[offset:]
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Processing players {offset + 1} to {offset + len(all_players)}"
            )
        )
        self.stdout.write(f"Found {len(all_players)} players to process")

        # Fetch current season stats for all players
        stats_map = {}
        try:
            self.stdout.write("Fetching league-wide player stats...")
            league_stats = leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                per_mode_detailed="PerGame",
                season_type_all_star="Regular Season",
            )
            stats_df = league_stats.get_data_frames()[0]

            # Create a mapping of player_id to stats
            for _, row in stats_df.iterrows():
                player_id = int(row["PLAYER_ID"])
                stats_map[player_id] = row

            self.stdout.write(
                self.style.SUCCESS(f"Fetched stats for {len(stats_map)} players")
            )

        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Could not fetch league stats: {e}"))

        # Process players in batches
        created_count = 0
        updated_count = 0
        batch_num = 0

        for batch_start in range(0, len(all_players), batch_size):
            batch_end = min(batch_start + batch_size, len(all_players))
            batch_players = all_players[batch_start:batch_end]
            batch_num += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n=== Processing Batch {batch_num} (Players {batch_start+1}-{batch_end}) ==="
                )
            )

            for idx, player_data in enumerate(batch_players):
                player_id = player_data["id"]
                player_idx = batch_start + idx + 1

                try:
                    # Get or create player
                    player, created = Player.objects.get_or_create(
                        player_id=player_id,
                        defaults={
                            "full_name": player_data["full_name"],
                            "first_name": player_data.get("first_name", ""),
                            "last_name": player_data.get("last_name", ""),
                            "is_active": player_data.get("is_active", True),
                        },
                    )

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

                    # Just use the data we have and save it
                    player.save()

                    # Add stats if available
                    if player_id in stats_map:
                        stats = stats_map[player_id]

                        # Update player team info from stats if not already set
                        if not player.team_abbreviation:
                            player.team_abbreviation = stats.get(
                                "TEAM_ABBREVIATION", ""
                            )

                        player.save()

                        # Create or update stats
                        player_stats, _ = PlayerStats.objects.update_or_create(
                            player=player,
                            season=season,
                            period_type="season",
                            defaults={
                                "games_played": int(stats.get("GP", 0)),
                                "min_avg": float(stats.get("MIN", 0)),
                                "fgm_avg": float(stats.get("FGM", 0)),
                                "fga_avg": float(stats.get("FGA", 0)),
                                "fg_pct": float(stats.get("FG_PCT", 0)),
                                "ftm_avg": float(stats.get("FTM", 0)),
                                "fta_avg": float(stats.get("FTA", 0)),
                                "ft_pct": float(stats.get("FT_PCT", 0)),
                                "fg3m_avg": float(stats.get("FG3M", 0)),
                                "fg3a_total": int(stats.get("FG3A", 0)),
                                "fg3_pct": float(stats.get("FG3_PCT", 0)),
                                "reb_avg": float(stats.get("REB", 0)),
                                "oreb_total": int(stats.get("OREB", 0)),
                                "dreb_total": int(stats.get("DREB", 0)),
                                "ast_avg": float(stats.get("AST", 0)),
                                "stl_avg": float(stats.get("STL", 0)),
                                "blk_avg": float(stats.get("BLK", 0)),
                                "tov_avg": float(stats.get("TOV", 0)),
                                "pts_avg": float(stats.get("PTS", 0)),
                                "plus_minus_avg": float(stats.get("PLUS_MINUS", 0)),
                            },
                        )

                        # Calculate totals from averages
                        if player_stats.games_played > 0:
                            player_stats.min_total = (
                                player_stats.min_avg * player_stats.games_played
                            )
                            player_stats.fgm_total = int(
                                player_stats.fgm_avg * player_stats.games_played
                            )
                            player_stats.fga_total = int(
                                player_stats.fga_avg * player_stats.games_played
                            )
                            player_stats.ftm_total = int(
                                player_stats.ftm_avg * player_stats.games_played
                            )
                            player_stats.fta_total = int(
                                player_stats.fta_avg * player_stats.games_played
                            )
                            player_stats.fg3m_total = int(
                                player_stats.fg3m_avg * player_stats.games_played
                            )
                            player_stats.reb_total = int(
                                player_stats.reb_avg * player_stats.games_played
                            )
                            player_stats.ast_total = int(
                                player_stats.ast_avg * player_stats.games_played
                            )
                            player_stats.stl_total = int(
                                player_stats.stl_avg * player_stats.games_played
                            )
                            player_stats.blk_total = int(
                                player_stats.blk_avg * player_stats.games_played
                            )
                            player_stats.tov_total = int(
                                player_stats.tov_avg * player_stats.games_played
                            )
                            player_stats.pts_total = int(
                                player_stats.pts_avg * player_stats.games_played
                            )
                            player_stats.plus_minus_total = int(
                                player_stats.plus_minus_avg * player_stats.games_played
                            )

                            # Calculate fantasy points (ESPN Standard Scoring)
                            fp_total, fp_avg = player_stats.calculate_fantasy_points()
                            player_stats.fantasy_points_total = fp_total
                            player_stats.fantasy_points_avg = fp_avg

                            player_stats.save()

                    else:
                        player.save()

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error processing player {player_data.get("full_name")}: {e}'
                        )
                    )
                    continue

            # Progress for this batch
            self.stdout.write(
                f"  Batch {batch_num} complete: {len(batch_players)} players processed"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Successfully processed {len(all_players)} players "
                f"({created_count} created, {updated_count} updated)"
            )
        )
