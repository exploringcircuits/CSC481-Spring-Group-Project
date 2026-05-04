"""DRF serializers for the fantasy domain."""

from rest_framework import serializers

from accounts.serializers import UserSerializer

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


# -----------------------------------------------------------------------------
# Players
# -----------------------------------------------------------------------------

class PlayerSeasonAverageSerializer(serializers.ModelSerializer):
    fantasy_ppg = serializers.FloatField(read_only=True)

    class Meta:
        model = PlayerSeasonAverage
        fields = (
            "season", "games_played", "minutes",
            "pts", "reb", "ast", "stl", "blk", "tov",
            "fgm", "fga", "ftm", "fta", "fg3m", "fg3a",
            "fg_pct", "ft_pct", "fg3_pct",
            "fantasy_ppg",
        )


class PlayerSerializer(serializers.ModelSerializer):
    """Full Player payload with embedded current-season averages and the
    full season_averages history so the UI can compare seasons."""
    current_season = serializers.SerializerMethodField()
    season_averages = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = (
            "id", "slug", "full_name", "first_name", "last_name",
            "team_abbr", "primary_position", "eligible_positions",
            "is_active", "is_injured", "injury_status",
            "height_inches", "weight_lbs", "jersey_number",
            "nba_player_id",
            "current_season", "season_averages",
        )

    def get_current_season(self, obj) -> dict | None:
        sa = obj.season_averages.first()
        return PlayerSeasonAverageSerializer(sa).data if sa else None

    def get_season_averages(self, obj) -> list[dict]:
        # Player.Meta.ordering on PlayerSeasonAverage is ("-pts",) which is
        # not what callers want; serve newest-first so timelines render right.
        return PlayerSeasonAverageSerializer(
            obj.season_averages.order_by("-season"),
            many=True,
        ).data


class PlayerLightSerializer(serializers.ModelSerializer):
    """Trimmed Player payload for list endpoints and roster cells."""
    fantasy_ppg = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = (
            "id", "full_name", "team_abbr", "primary_position",
            "is_active", "is_injured", "injury_status",
            "nba_player_id", "fantasy_ppg",
        )

    def get_fantasy_ppg(self, obj) -> float | None:
        sa = obj.season_averages.first()
        return round(sa.fantasy_ppg, 2) if sa else None


class PlayerGameStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerGameStats
        fields = (
            "id", "game_date", "minutes",
            "pts", "reb", "ast", "stl", "blk", "tov",
            "fgm", "fga", "ftm", "fta", "fg3m", "did_play",
        )


# -----------------------------------------------------------------------------
# League members + teams
# -----------------------------------------------------------------------------

class LeagueMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = LeagueMember
        fields = (
            "id", "slot", "is_bot", "is_commissioner",
            "bot_name", "user", "display_name",
        )


class RosterEntrySerializer(serializers.ModelSerializer):
    player = PlayerLightSerializer(read_only=True)

    class Meta:
        model = Roster
        fields = ("id", "player", "acquired_at", "acquired_via")


class TeamLightSerializer(serializers.ModelSerializer):
    member = LeagueMemberSerializer(read_only=True)
    record = serializers.CharField(read_only=True)

    class Meta:
        model = Team
        fields = (
            "id", "name", "wins", "losses", "ties",
            "points_for", "points_against", "record",
            "member",
        )


class TeamDetailSerializer(serializers.ModelSerializer):
    member = LeagueMemberSerializer(read_only=True)
    roster_entries = RosterEntrySerializer(many=True, read_only=True)
    record = serializers.CharField(read_only=True)

    class Meta:
        model = Team
        fields = (
            "id", "name", "wins", "losses", "ties",
            "points_for", "points_against", "record",
            "member", "roster_entries",
        )


# -----------------------------------------------------------------------------
# Season (weeks + matchups)
# -----------------------------------------------------------------------------

class MatchupSerializer(serializers.ModelSerializer):
    home_team = TeamLightSerializer(read_only=True)
    away_team = TeamLightSerializer(read_only=True)
    winner = TeamLightSerializer(read_only=True)

    class Meta:
        model = Matchup
        fields = (
            "id", "home_team", "away_team",
            "home_score", "away_score",
            "winner", "is_settled",
        )


class WeekSerializer(serializers.ModelSerializer):
    matchups = MatchupSerializer(many=True, read_only=True)

    class Meta:
        model = Week
        fields = (
            "id", "week_number", "start_date", "end_date",
            "is_playoff", "playoff_round", "is_settled",
            "matchups",
        )


class LineupEntrySerializer(serializers.ModelSerializer):
    player = PlayerLightSerializer(read_only=True)

    class Meta:
        model = LineupEntry
        fields = ("id", "game_date", "slot", "player")


# -----------------------------------------------------------------------------
# Draft
# -----------------------------------------------------------------------------

class DraftSelectionSerializer(serializers.ModelSerializer):
    player = PlayerLightSerializer(read_only=True)
    member = LeagueMemberSerializer(read_only=True)

    class Meta:
        model = DraftSelection
        fields = ("id", "pick_number", "round_number", "selected_at", "player", "member")


class DraftSerializer(serializers.ModelSerializer):
    selections = DraftSelectionSerializer(many=True, read_only=True)
    on_the_clock = serializers.SerializerMethodField()

    class Meta:
        model = Draft
        fields = (
            "id", "status", "draft_order", "current_pick_index",
            "started_at", "completed_at",
            "is_paused",
            "on_the_clock", "selections",
        )

    def get_on_the_clock(self, obj) -> int | None:
        if obj.status != "in_progress" or not obj.draft_order:
            return None
        from .schedule import snake_pick_pointer
        try:
            return snake_pick_pointer(obj.draft_order, obj.current_pick_index)
        except ValueError:
            return None


# -----------------------------------------------------------------------------
# Trades
# -----------------------------------------------------------------------------

class TradeAssetSerializer(serializers.ModelSerializer):
    player = PlayerLightSerializer(read_only=True)
    from_team = TeamLightSerializer(read_only=True)
    to_team = TeamLightSerializer(read_only=True)

    class Meta:
        model = TradeAsset
        fields = ("id", "player", "from_team", "to_team")


class TradeSerializer(serializers.ModelSerializer):
    proposer = TeamLightSerializer(read_only=True)
    recipient = TeamLightSerializer(read_only=True)
    assets = TradeAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Trade
        fields = (
            "id", "status", "proposer", "recipient",
            "proposed_at", "responded_at", "processed_at",
            "note", "assets",
        )


class TradeProposeSerializer(serializers.Serializer):
    """Input shape for proposing a trade."""
    recipient_team_id = serializers.IntegerField()
    proposer_player_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    recipient_player_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    note = serializers.CharField(required=False, allow_blank=True, max_length=400)


# -----------------------------------------------------------------------------
# Leagues
# -----------------------------------------------------------------------------

class LeagueListSerializer(serializers.ModelSerializer):
    """Lightweight league summary — used by the league-selection screen."""
    member_count = serializers.IntegerField(read_only=True)
    is_commissioner = serializers.SerializerMethodField()

    class Meta:
        model = League
        fields = (
            "id", "name", "season_label", "status",
            "max_teams", "regular_season_weeks", "playoff_team_count",
            "current_week_number", "invite_code",
            "member_count", "is_commissioner",
        )

    def get_is_commissioner(self, obj) -> bool:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.commissioner_id == request.user.id
        return False


class LeagueDetailSerializer(serializers.ModelSerializer):
    members = LeagueMemberSerializer(many=True, read_only=True)
    teams = TeamLightSerializer(many=True, read_only=True)
    commissioner = UserSerializer(read_only=True)
    is_commissioner = serializers.SerializerMethodField()
    my_team_id = serializers.SerializerMethodField()

    class Meta:
        model = League
        fields = (
            "id", "name", "season_label", "status",
            "max_teams", "regular_season_weeks", "playoff_team_count",
            "current_week_number",
            "scoring_weights", "roster_template",
            "lineup_lock_mode", "trade_review_mode",
            "invite_code", "commissioner",
            "members", "teams",
            "is_commissioner", "my_team_id",
            "created_at",
        )

    def get_is_commissioner(self, obj) -> bool:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.commissioner_id == request.user.id
        return False

    def get_my_team_id(self, obj) -> int | None:
        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            return None
        member = obj.members.filter(user=request.user).first()
        if not member:
            return None
        team = getattr(member, "team", None)
        return team.id if team else None


class LeagueCreateSerializer(serializers.ModelSerializer):
    """Input shape for creating a league. Commissioner is set from request.user
    in the view; not accepted from the client."""

    class Meta:
        model = League
        fields = (
            "name", "season_label",
            "max_teams", "regular_season_weeks", "playoff_team_count",
        )


class LeagueJoinSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=12)
    team_name = serializers.CharField(max_length=120, required=False)


# -----------------------------------------------------------------------------
# Audit
# -----------------------------------------------------------------------------

class TransactionSerializer(serializers.ModelSerializer):
    team = TeamLightSerializer(read_only=True)

    class Meta:
        model = Transaction
        fields = ("id", "type", "summary", "payload", "team", "created_at")


# -----------------------------------------------------------------------------
# Lineup setting
# -----------------------------------------------------------------------------

class LineupSetSerializer(serializers.Serializer):
    """Input shape for setting a team's lineup for a week.

    Payload: {"week_id": int, "assignments": {"PG": player_id, "SG": player_id, ...}}
    """
    week_id = serializers.IntegerField()
    assignments = serializers.DictField(child=serializers.IntegerField())
