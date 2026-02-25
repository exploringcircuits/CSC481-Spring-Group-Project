from django.db import models
from django.utils import timezone


class League(models.Model):
    class Status(models.TextChoices):
        SETUP = "SETUP"
        DRAFTING = "DRAFTING"
        ACTIVE = "ACTIVE"

    name = models.CharField(max_length=120)
    commissioner_email = models.EmailField()
    max_players = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SETUP)
    created_at = models.DateTimeField(default=timezone.now)


class LeagueMember(models.Model):
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="members")
    email = models.EmailField()
    display_name = models.CharField(max_length=80, blank=True)
    slot = models.PositiveSmallIntegerField()  # 1..max_players
    is_commissioner = models.BooleanField(default=False)

    class Meta:
        unique_together = [("league", "email")]


class FantasyTeam(models.Model):
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="teams")
    member = models.OneToOneField(LeagueMember, on_delete=models.CASCADE, related_name="team")
    name = models.CharField(max_length=120, default="My Team")


class Draft(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED"
        IN_PROGRESS = "IN_PROGRESS"
        COMPLETE = "COMPLETE"

    league = models.OneToOneField(League, on_delete=models.CASCADE, related_name="draft")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    current_slot = models.PositiveSmallIntegerField(default=1)
    round = models.PositiveIntegerField(default=1)
    pick_number = models.PositiveIntegerField(default=1)
    started_at = models.DateTimeField(null=True, blank=True)


class DraftPick(models.Model):
    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name="picks")
    pick_number = models.PositiveIntegerField()
    round = models.PositiveIntegerField()
    slot = models.PositiveSmallIntegerField()
    member = models.ForeignKey(LeagueMember, on_delete=models.CASCADE)
    player_id = models.IntegerField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [
            ("draft", "player_id"),
            ("draft", "pick_number"),
        ]