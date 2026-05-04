from django.urls import path

from . import views

app_name = "fantasy"

urlpatterns = [
    # Players
    path("players/", views.PlayerListView.as_view(), name="player-list"),
    path("players/<int:pk>/", views.PlayerDetailView.as_view(), name="player-detail"),

    # Leagues
    path("leagues/", views.LeagueListCreateView.as_view(), name="league-list-create"),
    path("leagues/join/", views.LeagueJoinView.as_view(), name="league-join"),
    path("leagues/<int:league_id>/", views.LeagueDetailView.as_view(), name="league-detail"),
    path("leagues/<int:league_id>/standings/", views.standings, name="league-standings"),
    path("leagues/<int:league_id>/weeks/", views.WeekListView.as_view(), name="week-list"),
    path("leagues/<int:league_id>/weeks/<int:week_number>/", views.WeekDetailView.as_view(), name="week-detail"),
    path("leagues/<int:league_id>/draft/", views.DraftDetailView.as_view(), name="draft-detail"),
    path("leagues/<int:league_id>/draft/pick/", views.DraftPickView.as_view(), name="draft-pick"),
    path("leagues/<int:league_id>/trades/", views.TradeListView.as_view(), name="trade-list"),
    path("leagues/<int:league_id>/trades/propose/", views.TradeProposeView.as_view(), name="trade-propose"),
    path("leagues/<int:league_id>/transactions/", views.TransactionListView.as_view(), name="transaction-list"),

    # Trades (cross-league action)
    path("trades/<int:pk>/respond/", views.TradeRespondView.as_view(), name="trade-respond"),

    # Teams
    path("teams/<int:pk>/", views.TeamDetailView.as_view(), name="team-detail"),
    path("teams/<int:pk>/lineup/", views.TeamLineupView.as_view(), name="team-lineup"),
]
