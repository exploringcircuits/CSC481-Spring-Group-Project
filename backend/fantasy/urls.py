from django.urls import path

from . import views

app_name = "fantasy"

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
]
