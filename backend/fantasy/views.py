from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Lightweight health check for the fantasy app — confirms the URL graph
    and auth wiring are intact even before the domain models exist.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "fantasy"})
