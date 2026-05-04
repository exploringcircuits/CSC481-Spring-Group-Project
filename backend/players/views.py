from django.db.models import Q
from rest_framework import viewsets, filters, generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Player
from .serializers import PlayerSerializer, TeamSerializer


class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    lookup_field = "person_id"

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "first_name",
        "last_name",
        "full_name",
        "team_name",
        "team_abbreviation",
        "player_slug",
    ]
    ordering_fields = [
        "first_name",
        "last_name",
        "full_name",
        "pts",
        "reb",
        "ast",
        "draft_year",
    ]

    def get_queryset(self):
        queryset = Player.objects.all()

        team = self.request.query_params.get("team")
        position = self.request.query_params.get("position")
        country = self.request.query_params.get("country")
        active_only = self.request.query_params.get("active_only")

        if team:
            queryset = queryset.filter(team_abbreviation__iexact=team)

        if position:
            queryset = queryset.filter(position__icontains=position)

        if country:
            queryset = queryset.filter(country__iexact=country)

        if active_only == "true":
            queryset = queryset.exclude(team_id=0)

        return queryset.order_by("last_name", "first_name")


class TeamListView(APIView):
    def get(self, request):
        teams = (
            Player.objects
            .exclude(Q(team_id=0) | Q(team_abbreviation="") | Q(team_name=""))
            .values(
                "team_id",
                "team_slug",
                "team_city",
                "team_name",
                "team_abbreviation",
            )
            .distinct()
            .order_by("team_name")
        )

        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)


class TeamRosterView(generics.ListAPIView):
    serializer_class = PlayerSerializer

    def get_queryset(self):
        team_abbreviation = self.kwargs["team_abbreviation"]
        return (
            Player.objects
            .filter(team_abbreviation__iexact=team_abbreviation)
            .order_by("last_name", "first_name")
        )