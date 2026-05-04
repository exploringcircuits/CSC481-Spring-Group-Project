from rest_framework import serializers
from .models import Player, PlayerStats
from django.contrib.auth.models import User

class PlayerStatsSerializer(serializers.ModelSerializer):
    """Serializer for player statistics."""

    # Override DecimalField to return numbers instead of strings
    min_total = serializers.DecimalField(
        max_digits=10, decimal_places=1, coerce_to_string=False
    )
    min_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    fg_pct = serializers.DecimalField(
        max_digits=5, decimal_places=3, coerce_to_string=False
    )
    fgm_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    fga_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    ft_pct = serializers.DecimalField(
        max_digits=5, decimal_places=3, coerce_to_string=False
    )
    ftm_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    fta_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    fg3_pct = serializers.DecimalField(
        max_digits=5, decimal_places=3, coerce_to_string=False
    )
    fg3m_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    reb_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    ast_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    stl_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    blk_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    tov_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    pts_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    plus_minus_avg = serializers.DecimalField(
        max_digits=5, decimal_places=1, coerce_to_string=False
    )
    fantasy_points_total = serializers.DecimalField(
        max_digits=10, decimal_places=1, coerce_to_string=False
    )
    fantasy_points_avg = serializers.DecimalField(
        max_digits=8, decimal_places=1, coerce_to_string=False
    )

    class Meta:
        model = PlayerStats
        fields = [
            "id",
            "season",
            "period_type",
            "games_played",
            "min_total",
            "min_avg",
            "fgm_total",
            "fga_total",
            "fg_pct",
            "fgm_avg",
            "fga_avg",
            "ftm_total",
            "fta_total",
            "ft_pct",
            "ftm_avg",
            "fta_avg",
            "fg3m_total",
            "fg3a_total",
            "fg3_pct",
            "fg3m_avg",
            "reb_total",
            "reb_avg",
            "oreb_total",
            "dreb_total",
            "ast_total",
            "ast_avg",
            "stl_total",
            "stl_avg",
            "blk_total",
            "blk_avg",
            "tov_total",
            "tov_avg",
            "pts_total",
            "pts_avg",
            "plus_minus_total",
            "plus_minus_avg",
            "fantasy_points_total",
            "fantasy_points_avg",
        ]


class PlayerSerializer(serializers.ModelSerializer):
    """Serializer for player basic information."""

    stats = PlayerStatsSerializer(many=True, read_only=True)
    roster_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, coerce_to_string=False
    )

    class Meta:
        model = Player
        fields = [
            "id",
            "player_id",
            "full_name",
            "first_name",
            "last_name",
            "team_name",
            "team_abbreviation",
            "position",
            "height",
            "weight",
            "is_active",
            "jersey_number",
            "roster_status",
            "injury_status",
            "is_healthy",
            "roster_percent",
            "stats",
        ]


class PlayerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for player lists with current season stats."""

    # Get the current season stats
    current_stats = serializers.SerializerMethodField()
    roster_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, coerce_to_string=False
    )

    class Meta:
        model = Player
        fields = [
            "id",
            "player_id",
            "full_name",
            "team_abbreviation",
            "position",
            "roster_status",
            "is_healthy",
            "injury_status",
            "roster_percent",
            "current_stats",
        ]

    def get_current_stats(self, obj):
        """Get stats for the requested period (default to current season)."""
        request = self.context.get("request")
        period_type = (
            request.query_params.get("stat_period", "season") if request else "season"
        )
        season = request.query_params.get("season", "2025-26") if request else "2025-26"

        stat = obj.stats.filter(season=season, period_type=period_type).first()
        if stat:
            return PlayerStatsSerializer(stat).data
        return None
    
class RegisterSerializer(serializers.ModelSerializer):
    retype_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'retype_password')
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        # Ensure the passwords match
        if data['password'] != data['retype_password']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        # Remove retype_password before saving, as the User model doesn't have that field
        validated_data.pop('retype_password', None)
        
        # VERY IMPORTANT: Use create_user to automatically hash the password!
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user
