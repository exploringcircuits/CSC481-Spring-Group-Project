from django.contrib import admin

from .models import (
    Draft,
    DraftSelection,
    League,
    LeagueMember,
    LineupEntry,
    Matchup,
    Player,
    PlayerGameStats,
    PlayerSeasonAverage,
    Roster,
    Team,
    Trade,
    TradeAsset,
    Transaction,
    Week,
)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "team_abbr", "primary_position", "is_active", "is_injured")
    list_filter = ("primary_position", "team_abbr", "is_active", "is_injured")
    search_fields = ("full_name", "first_name", "last_name", "slug")


@admin.register(PlayerSeasonAverage)
class PlayerSeasonAverageAdmin(admin.ModelAdmin):
    list_display = ("player", "season", "games_played", "pts", "reb", "ast")
    list_filter = ("season",)
    search_fields = ("player__full_name",)


@admin.register(PlayerGameStats)
class PlayerGameStatsAdmin(admin.ModelAdmin):
    list_display = ("player", "game_date", "pts", "reb", "ast", "did_play")
    list_filter = ("game_date",)
    search_fields = ("player__full_name",)
    date_hierarchy = "game_date"


@admin.register(League)
class LeagueAdmin(admin.ModelAdmin):
    list_display = ("name", "season_label", "status", "max_teams", "current_week_number", "commissioner")
    list_filter = ("status", "season_label")
    search_fields = ("name", "invite_code")


@admin.register(LeagueMember)
class LeagueMemberAdmin(admin.ModelAdmin):
    list_display = ("league", "slot", "is_bot", "is_commissioner", "user", "bot_name")
    list_filter = ("is_bot", "is_commissioner")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "league", "wins", "losses", "ties", "points_for")
    list_filter = ("league",)


@admin.register(Roster)
class RosterAdmin(admin.ModelAdmin):
    list_display = ("team", "player", "acquired_via", "acquired_at")
    list_filter = ("acquired_via",)


@admin.register(Week)
class WeekAdmin(admin.ModelAdmin):
    list_display = ("league", "week_number", "start_date", "end_date", "is_playoff", "is_settled")
    list_filter = ("league", "is_playoff", "is_settled")


@admin.register(Matchup)
class MatchupAdmin(admin.ModelAdmin):
    list_display = ("week", "home_team", "away_team", "home_score", "away_score", "winner", "is_settled")
    list_filter = ("week__league", "is_settled")


@admin.register(LineupEntry)
class LineupEntryAdmin(admin.ModelAdmin):
    list_display = ("team", "game_date", "slot", "player")
    list_filter = ("game_date",)
    search_fields = ("team__name", "player__full_name")


@admin.register(Draft)
class DraftAdmin(admin.ModelAdmin):
    list_display = ("league", "status", "current_pick_index", "started_at", "completed_at")


@admin.register(DraftSelection)
class DraftSelectionAdmin(admin.ModelAdmin):
    list_display = ("draft", "pick_number", "round_number", "member", "player")
    list_filter = ("draft__league",)


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = ("league", "proposer", "recipient", "status", "proposed_at")
    list_filter = ("status", "league")


@admin.register(TradeAsset)
class TradeAssetAdmin(admin.ModelAdmin):
    list_display = ("trade", "from_team", "to_team", "player")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("league", "team", "type", "summary", "created_at")
    list_filter = ("type", "league")
    date_hierarchy = "created_at"
