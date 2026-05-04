"""Custom DRF permissions for the fantasy app."""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import League, LeagueMember, Team


class IsSiteAdmin(BasePermission):
    """User has Django staff flag — used to gate the demo control panel."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsLeagueMember(BasePermission):
    """Authenticated user is a member of the league referenced by the URL.

    Site admins (is_staff) bypass this check so the demo presenter can view
    every league regardless of membership.

    Looks for `league_id` in URL kwargs first, then falls back to the
    object's `.league` attribute when checking object-level permission.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        league_id = view.kwargs.get("league_id") or view.kwargs.get("pk")
        if league_id is None:
            return True  # rely on object-level check
        return LeagueMember.objects.filter(league_id=league_id, user=request.user).exists()

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        league = _resolve_league(obj)
        if league is None:
            return False
        return LeagueMember.objects.filter(league=league, user=request.user).exists()


class IsLeagueCommissioner(BasePermission):
    """Authenticated user is the commissioner of the league referenced by URL.

    Site admins (is_staff) automatically pass — useful for the demo panel.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        league_id = view.kwargs.get("league_id") or view.kwargs.get("pk")
        if league_id is None:
            return True
        return LeagueMember.objects.filter(
            league_id=league_id, user=request.user, is_commissioner=True
        ).exists()

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        league = _resolve_league(obj)
        if league is None:
            return False
        return LeagueMember.objects.filter(
            league=league, user=request.user, is_commissioner=True
        ).exists()


class IsLeagueMemberOrReadOnly(BasePermission):
    """Read access for any authenticated user; write access for league members."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        league = _resolve_league(obj)
        if league is None:
            return False
        return LeagueMember.objects.filter(league=league, user=request.user).exists()


def _resolve_league(obj) -> League | None:
    if isinstance(obj, League):
        return obj
    if isinstance(obj, Team):
        return obj.league
    league = getattr(obj, "league", None)
    return league if isinstance(league, League) else None
