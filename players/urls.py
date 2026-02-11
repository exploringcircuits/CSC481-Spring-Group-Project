from django.urls import path
from .views import (
    PlayerDetail,
    PlayerSearch,
    TeamList,
    TeamRoster,
)

urlpatterns = [
    path("players/search/", PlayerSearch.as_view()),
    path("players/<int:player_id>/", PlayerDetail.as_view()),
    path("teams/", TeamList.as_view()),
    path("teams/<str:team_abbr>/roster/", TeamRoster.as_view()),
]
