"""Admin demo control panel URLs. Mounted at /api/admin/ from config/urls.py."""

from django.urls import path

from . import admin_views

app_name = "fantasy_admin"

urlpatterns = [
    path("status/", admin_views.admin_status, name="status"),
    path("reset/", admin_views.reset_demo, name="reset"),
    path("seed-demo/", admin_views.seed_demo, name="seed-demo"),
    path("leagues/<int:league_id>/run-draft/", admin_views.run_draft, name="run-draft"),
    path("leagues/<int:league_id>/build-schedule/", admin_views.build_schedule, name="build-schedule"),
    path("leagues/<int:league_id>/set-default-lineups/", admin_views.set_default_lineups, name="set-default-lineups"),
    path("leagues/<int:league_id>/advance-week/", admin_views.advance_week, name="advance-week"),
    path("leagues/<int:league_id>/simulate-to-playoffs/", admin_views.simulate_to_playoffs, name="simulate-to-playoffs"),
    path("leagues/<int:league_id>/start-playoffs/", admin_views.start_playoffs, name="start-playoffs"),
    path("leagues/<int:league_id>/simulate-next/", admin_views.simulate_next, name="simulate-next"),
    path("leagues/<int:league_id>/example-trade/", admin_views.example_trade, name="example-trade"),
]
