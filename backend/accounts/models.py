from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    """User where email is the login identifier."""

    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ("email",)

    def __str__(self) -> str:
        return self.email

    @property
    def name(self) -> str:
        return self.display_name or self.email
