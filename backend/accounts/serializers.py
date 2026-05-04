from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Public user representation. Returned by /api/auth/me/ and embedded in login."""

    class Meta:
        model = User
        fields = ("id", "email", "display_name", "is_staff", "date_joined")
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    """Account creation payload."""

    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = User
        fields = ("email", "display_name", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class TokenWithUserSerializer(TokenObtainPairSerializer):
    """SimpleJWT token serializer that also returns the user object on login.

    Saves the frontend a follow-up call to /api/auth/me/ right after login.
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
