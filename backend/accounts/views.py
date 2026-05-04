from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer, TokenWithUserSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Public account-creation endpoint.

    Accepts {email, password, display_name?} and returns the created user.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """JWT token endpoint that also returns the user object."""
    serializer_class = TokenWithUserSerializer


class MeView(APIView):
    """Return the currently authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    """Stateless logout. The client drops its tokens; nothing to do server-side
    until token blacklisting is added."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)
