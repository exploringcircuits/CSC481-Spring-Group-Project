"""Create the default admin/demo user used by the demo control panel.

Idempotent — re-runs are safe.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create the admin@demo.local staff user with a known password."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="admin@demo.local")
        parser.add_argument("--password", default="demoadmin")
        parser.add_argument("--display-name", default="Demo Admin")

    def handle(self, *args, email, password, display_name, **kwargs):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "display_name": display_name,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        # Always ensure the password and staff flags match — useful when
        # bootstrapping a fresh DB or rotating the demo password.
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.display_name = display_name
        user.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{verb} admin user: {email} (password: {password})"
        ))
