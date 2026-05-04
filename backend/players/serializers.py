from rest_framework import serializers
from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = "__all__"


class TeamSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()
    team_slug = serializers.CharField()
    team_city = serializers.CharField()
    team_name = serializers.CharField()
    team_abbreviation = serializers.CharField()