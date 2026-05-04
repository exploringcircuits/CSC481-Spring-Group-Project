from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PlayerViewSet, TeamListView, TeamRosterView

router = DefaultRouter()
router.register(r"players", PlayerViewSet, basename="players")

urlpatterns = router.urls + [
    path("teams/", TeamListView.as_view(), name="team-list"),
    path("teams/<str:team_abbreviation>/", TeamRosterView.as_view(), name="team-roster"),
]