# league/urls.py

from django.urls import path

from .views import (
    LeagueListCreate,
    LeagueDetail,
    StartDraft,
    MakePick,
    LeagueTeams,
    ResetLeague,
)

urlpatterns = [
    # /league/leagues/
    path("leagues/", LeagueListCreate.as_view(), name="league-list-create"),

    # /league/leagues/<id>/
    path("leagues/<int:league_id>/", LeagueDetail.as_view(), name="league-detail"),

    # /league/leagues/<id>/start-draft/
    path("leagues/<int:league_id>/start-draft/", StartDraft.as_view(), name="league-start-draft"),

    # /league/leagues/<id>/pick/
    path("leagues/<int:league_id>/pick/", MakePick.as_view(), name="league-make-pick"),

    # /league/leagues/<id>/teams/
    path("leagues/<int:league_id>/teams/", LeagueTeams.as_view(), name="league-teams"),

    path("leagues/<int:league_id>/reset/", ResetLeague.as_view(), name="league-reset"),
]