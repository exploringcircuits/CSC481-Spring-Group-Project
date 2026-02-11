from django.urls import path
from .views import PlayerDetail, PlayerSearch

urlpatterns = [
    path("players/search/", PlayerSearch.as_view()),
    path("players/<int:player_id>/", PlayerDetail.as_view()),
]
