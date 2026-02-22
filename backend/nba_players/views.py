from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Prefetch
from .models import Player, PlayerStats
from .serializers import PlayerSerializer, PlayerListSerializer, PlayerStatsSerializer


class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing NBA players with filtering and sorting.

    Query Parameters:
    - position: Filter by position (PG, SG, SF, PF, C, G, F)
    - team: Filter by team abbreviation
    - status: Filter by roster status (All, Available, On Waivers, Free Agents, On Rosters)
    - health: Filter by health status (All, IR-Eligible, Healthy)
    - search: Search by player name
    - ordering: Sort by field (e.g., pts_avg, min_avg, full_name)
    - stat_period: Stats period (season, last7, last15, last30)
    - season: Season year (e.g., 2025-26)
    """

    queryset = Player.objects.all()
    serializer_class = PlayerListSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["full_name", "first_name", "last_name"]
    ordering_fields = "__all__"
    ordering = ["-roster_percent"]

    def get_queryset(self):
        """Apply custom filters to the queryset."""
        # Get the season and period type parameters
        season = self.request.query_params.get("season", "2025-26")
        period_type = self.request.query_params.get("stat_period", "season")

        # Prefetch only the relevant stats for the requested season/period
        player_stats_prefetch = Prefetch(
            "stats",
            PlayerStats.objects.filter(season=season, period_type=period_type),
        )

        queryset = Player.objects.prefetch_related(player_stats_prefetch)

        # Position filter with flexible matching
        position = self.request.query_params.get("position", None)
        if position and position not in ["All Players", "All"]:
            # Position filter logic:
            # - Specific positions (PG, SG, SF, PF) match ONLY that exact position
            # - Generic positions work as follows:
            #   - G (Guard): matches PG, SG, G, and G-F (all guard positions)
            #   - F (Forward): matches SF, PF, F, G-F, and F-C (all forward positions)
            #   - C (Center): matches C and F-C
            # - Multi-position players (G-F, F-C) match their component filters

            position_queries = Q()

            if position == "G":
                # Generic Guard: matches all guard positions
                position_queries = Q(position__in=["PG", "SG", "G", "G-F"])
            elif position == "F":
                # Generic Forward: matches all forward positions
                position_queries = Q(position__in=["SF", "PF", "F", "G-F", "F-C"])
            elif position == "PG":
                # Point Guard: exact match only
                position_queries = Q(position="PG")
            elif position == "SG":
                # Shooting Guard: exact match only
                position_queries = Q(position="SG")
            elif position == "SF":
                # Small Forward: exact match only
                position_queries = Q(position="SF")
            elif position == "PF":
                # Power Forward: exact match only
                position_queries = Q(position="PF")
            elif position == "C":
                # Center: matches C and F-C
                position_queries = Q(position__in=["C", "F-C"])
            else:
                # Exact match for any other positions
                position_queries = Q(position=position)

            queryset = queryset.filter(position_queries)

        # Team filter
        team = self.request.query_params.get("team", None)
        if team and team != "All":
            queryset = queryset.filter(team_abbreviation=team)

        # Status filter for fantasy league roster status
        # - Free Agents: Available for pickup (roster_status = "FA")
        # - On Waivers: Dropped players waiting for waiver claims (roster_status = "RW")
        # - Available: Players that can be picked up (Free Agents + On Waivers)
        # - On Rosters: Players already on fantasy teams (not implemented - returns empty)
        status = self.request.query_params.get("status", None)
        if status and status != "All":
            if status == "Free Agents":
                # Only free agents (never drafted)
                queryset = queryset.filter(roster_status="FA")
            elif status == "On Waivers":
                # Only on waivers (dropped and in waiver queue)
                queryset = queryset.filter(roster_status="RW")
            elif status == "Available":
                # Both free agents and on waivers (pickupable)
                queryset = queryset.filter(roster_status__in=["FA", "RW"])
            elif status == "On Rosters":
                # Players on fantasy teams (not yet implemented in fantasy system)
                # Return empty queryset for now
                queryset = queryset.none()

        # Active players only (optional)
        active_only = self.request.query_params.get("active_only", "true")
        if active_only.lower() == "true":
            queryset = queryset.filter(is_active=True)

        return queryset

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "retrieve":
            return PlayerSerializer
        return PlayerListSerializer

    def filter_queryset(self, queryset):
        """Custom filtering to handle stats field sorting."""
        # Get the ordering parameter
        ordering = self.request.query_params.get("ordering", None)

        if ordering:
            # Handle sorting by stats fields
            # Convert current_stats__field to stats__field for proper ordering
            if "current_stats__" in ordering:
                ordering = ordering.replace("current_stats__", "stats__")

            # Apply manual ordering to bypass OrderingFilter's default behavior
            # This allows us to sort by related table fields
            queryset = queryset.order_by(ordering)

            # Don't call super() to avoid OrderingFilter re-applying defaults
            return queryset

        # If no ordering specified, use default ordering
        if self.ordering:
            queryset = queryset.order_by(*self.ordering)

        return queryset

    @action(detail=False, methods=["get"])
    def positions(self, request):
        """Get list of all available positions."""
        positions = Player.objects.values_list("position", flat=True).distinct()
        return Response(list(filter(None, positions)))

    @action(detail=False, methods=["get"])
    def teams(self, request):
        """Get list of all NBA teams."""
        teams = Player.objects.values_list("team_abbreviation", "team_name").distinct()
        return Response(
            [{"abbreviation": abbr, "name": name} for abbr, name in teams if abbr]
        )
