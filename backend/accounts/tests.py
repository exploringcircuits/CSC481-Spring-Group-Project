from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_login_me_flow(self):
        register_url = reverse("accounts:register")
        login_url = reverse("accounts:login")
        me_url = reverse("accounts:me")

        # Register a fresh user
        resp = self.client.post(register_url, {
            "email": "alice@example.com",
            "password": "supersecret",
            "display_name": "Alice",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["email"], "alice@example.com")

        # Log in
        resp = self.client.post(login_url, {
            "email": "alice@example.com",
            "password": "supersecret",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("user", resp.data)
        self.assertEqual(resp.data["user"]["email"], "alice@example.com")

        # /me/ requires the access token
        access = resp.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.get(me_url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "alice@example.com")

    def test_register_requires_password_min_length(self):
        resp = self.client.post(reverse("accounts:register"), {
            "email": "bob@example.com",
            "password": "short",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(email="dup@example.com", password="supersecret")
        resp = self.client.post(reverse("accounts:register"), {
            "email": "dup@example.com",
            "password": "supersecret",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
