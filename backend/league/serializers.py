from rest_framework import serializers

from players.serializers import PlayerSerializer
from .models import (
    League,
    LeagueMember,
    FantasyTeam,
    FantasyTeamPlayer,
    Draft,
    DraftPick,
    Playoff,
    PlayoffMatchup,
    PlayerMatchupStat,
    Trade,
    TradePlayer,
)


class LeagueMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeagueMember
        fields = ["id", "email", "display_name", "slot", "is_commissioner"]


class FantasyTeamPlayerSerializer(serializers.ModelSerializer):
    player_id = serializers.IntegerField(source="player.person_id", read_only=True)
    player_name = serializers.CharField(source="player.full_name", read_only=True)
    player = PlayerSerializer(read_only=True)

    class Meta:
        model = FantasyTeamPlayer
        fields = [
            "id",
            "player_id",
            "player_name",
            "player",
            "acquired_via",
            "acquired_at",
        ]


class DraftPickSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="member.email", read_only=True)
    player_id = serializers.IntegerField(source="player.person_id", read_only=True)
    player_name = serializers.CharField(source="player.full_name", read_only=True)
    player = PlayerSerializer(read_only=True)

    class Meta:
        model = DraftPick
        fields = [
            "pick_number",
            "round",
            "slot",
            "email",
            "player_id",
            "player_name",
            "player",
            "created_at",
        ]


class DraftSerializer(serializers.ModelSerializer):
    current_turn = serializers.SerializerMethodField()
    picks = DraftPickSerializer(many=True, read_only=True)

    class Meta:
        model = Draft
        fields = [
            "status",
            "draft_type",
            "scheduled_date",
            "time_per_pick",
            "draft_order",
            "current_slot",
            "round",
            "pick_number",
            "started_at",
            "current_turn",
            "picks",
        ]

    def get_current_turn(self, obj):
        current_member = obj.league.members.filter(slot=obj.current_slot).first()
        if not current_member:
            return None
        return {
            "slot": current_member.slot,
            "email": current_member.email,
            "display_name": current_member.display_name,
        }


class FantasyTeamSerializer(serializers.ModelSerializer):
    member = LeagueMemberSerializer(read_only=True)
    roster = FantasyTeamPlayerSerializer(many=True, read_only=True)

    class Meta:
        model = FantasyTeam
        fields = ["id", "name", "member", "roster"]


class LeagueSerializer(serializers.ModelSerializer):
    members = LeagueMemberSerializer(many=True, read_only=True)
    draft = DraftSerializer(read_only=True)
    teams = FantasyTeamSerializer(many=True, read_only=True)

    class Meta:
        model = League
        fields = [
            "id",
            "name",
            "commissioner_email",
            "max_players",
            "roster_size",
            "status",
            "created_at",
            "members",
            "draft",
            "teams",
        ]


class LeagueCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    commissioner_email = serializers.EmailField()
    invite_emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        allow_empty=True
    )
    max_players = serializers.IntegerField(default=4)
    roster_size = serializers.IntegerField(default=12, min_value=5, max_value=15)


class StartDraftSerializer(serializers.Serializer):
    starter_email = serializers.EmailField(required=False)


class DraftSettingsSerializer(serializers.Serializer):
    scheduled_date = serializers.DateTimeField()
    time_per_pick = serializers.IntegerField(default=90, min_value=30, max_value=600)
    draft_order = serializers.ChoiceField(choices=["RANDOM", "CUSTOM"])


class MakePickSerializer(serializers.Serializer):
    email = serializers.EmailField()
    player_id = serializers.IntegerField()


class ResetLeagueSerializer(serializers.Serializer):
    starter_email = serializers.EmailField(required=False)


class LeagueTeamsSerializer(serializers.Serializer):
    league_id = serializers.IntegerField()
    teams = serializers.ListField()
    
class TradePlayerSerializer(serializers.ModelSerializer):
    player_id = serializers.IntegerField(source="player.person_id", read_only=True)
    player_name = serializers.CharField(source="player.full_name", read_only=True)
    from_member_email = serializers.EmailField(source="from_member.email", read_only=True)
    player = PlayerSerializer(read_only=True)

    class Meta:
        model = TradePlayer
        fields = [
            "id",
            "player_id",
            "player_name",
            "from_member_email",
            "player",
        ]


class TradeSerializer(serializers.ModelSerializer):
    proposed_by_email = serializers.EmailField(source="proposed_by.email", read_only=True)
    proposed_to_email = serializers.EmailField(source="proposed_to.email", read_only=True)
    trade_players = TradePlayerSerializer(many=True, read_only=True)

    class Meta:
        model = Trade
        fields = [
            "id",
            "league",
            "proposed_by",
            "proposed_by_email",
            "proposed_to",
            "proposed_to_email",
            "status",
            "created_at",
            "responded_at",
            "trade_players",
        ]


class ProposeTradeSerializer(serializers.Serializer):
    proposed_by_email = serializers.EmailField()
    proposed_to_email = serializers.EmailField()
    offered_player_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
    requested_player_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )


class TradeActionSerializer(serializers.Serializer):
    acting_email = serializers.EmailField()


# ── Playoff serializers ────────────────────────────────────────────────────────

class PlayerMatchupStatSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source="player.full_name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)

    class Meta:
        model = PlayerMatchupStat
        fields = ["id", "player_id", "player_name", "team_id", "team_name",
                  "pts", "reb", "ast", "fantasy_score"]
        read_only_fields = fields


class PlayoffMatchupSerializer(serializers.ModelSerializer):
    match_number = serializers.SerializerMethodField()
    home_team_id = serializers.IntegerField(source="team_a_id", read_only=True)
    home_team_name = serializers.CharField(source="team_a.name", read_only=True)
    away_team_id = serializers.IntegerField(source="team_b_id", read_only=True)
    away_team_name = serializers.CharField(source="team_b.name", read_only=True)
    winner_name = serializers.SerializerMethodField()
    home_score = serializers.FloatField(source="team_a_score", read_only=True)
    away_score = serializers.FloatField(source="team_b_score", read_only=True)
    player_stats_by_team = serializers.SerializerMethodField()

    class Meta:
        model = PlayoffMatchup
        fields = [
            "id", "round", "match_number",
            "home_team_id", "home_team_name",
            "away_team_id", "away_team_name",
            "home_score", "away_score",
            "winner_id", "winner_name",
            "simulated",
            "player_stats_by_team",
        ]
        read_only_fields = fields

    def get_match_number(self, obj):
        ids = list(obj.playoff.matchups.order_by("id").values_list("id", flat=True))
        return ids.index(obj.id) + 1

    def get_winner_name(self, obj):
        return obj.winner.name if obj.winner_id else None

    def get_player_stats_by_team(self, obj):
        stats = obj.player_stats.select_related("player", "team").all()
        grouped = {}
        for stat in stats:
            tid = stat.team_id
            if tid not in grouped:
                grouped[tid] = {"team_id": tid, "team_name": stat.team.name, "players": []}
            grouped[tid]["players"].append(PlayerMatchupStatSerializer(stat).data)
        return list(grouped.values())


class PlayoffBracketSerializer(serializers.ModelSerializer):
    matchups = PlayoffMatchupSerializer(many=True, read_only=True)
    champion_id = serializers.SerializerMethodField()
    champion_name = serializers.SerializerMethodField()

    class Meta:
        model = Playoff
        fields = ["id", "status", "created_at", "matchups", "champion_id", "champion_name"]

    def get_champion_id(self, obj):
        return obj.champion_id

    def get_champion_name(self, obj):
        return obj.champion.name if obj.champion_id and obj.champion else None


# ── Playoff input serializers ──────────────────────────────────────────────────

class StartPlayoffsSerializer(serializers.Serializer):
    commissioner_email = serializers.EmailField()


class SimulateMatchupSerializer(serializers.Serializer):
    commissioner_email = serializers.EmailField()
    seed = serializers.IntegerField(required=False, allow_null=True)