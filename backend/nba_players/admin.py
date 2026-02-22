from django.contrib import admin
from .models import Player, PlayerStats


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = [
        "full_name",
        "team_abbreviation",
        "position",
        "roster_status",
        "is_healthy",
        "roster_percent",
    ]
    list_filter = [
        "team_abbreviation",
        "position",
        "roster_status",
        "is_healthy",
        "is_active",
    ]
    search_fields = ["full_name", "first_name", "last_name"]
    ordering = ["-roster_percent", "full_name"]


@admin.register(PlayerStats)
class PlayerStatsAdmin(admin.ModelAdmin):
    list_display = [
        "player",
        "season",
        "period_type",
        "games_played",
        "pts_avg",
        "reb_avg",
        "ast_avg",
    ]
    list_filter = ["season", "period_type"]
    search_fields = ["player__full_name"]
    ordering = ["-pts_avg"]
