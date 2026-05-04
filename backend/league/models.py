from django.db import models
from django.utils import timezone
from players.models import Player


class League(models.Model):
    class Status(models.TextChoices):
        SETUP = "SETUP", "Setup"
        DRAFTING = "DRAFTING", "Drafting"
        ACTIVE = "ACTIVE", "Active"
        PLAYOFFS = "PLAYOFFS", "Playoffs"
        COMPLETE = "COMPLETE", "Complete"

    name = models.CharField(max_length=120)
    commissioner_email = models.EmailField()
    max_players = models.PositiveSmallIntegerField(default=4)
    roster_size = models.PositiveSmallIntegerField(default=12)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SETUP
    )
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name


class LeagueMember(models.Model):
    league = models.ForeignKey(
        League,
        on_delete=models.CASCADE,
        related_name="members"
    )
    email = models.EmailField()
    display_name = models.CharField(max_length=80, blank=True)
    slot = models.PositiveSmallIntegerField()
    is_commissioner = models.BooleanField(default=False)

    class Meta:
        unique_together = [("league", "email")]
        ordering = ["slot"]

    def __str__(self):
        return f"{self.email} ({self.league.name})"


class FantasyTeam(models.Model):
    league = models.ForeignKey(
        League,
        on_delete=models.CASCADE,
        related_name="teams"
    )
    member = models.OneToOneField(
        LeagueMember,
        on_delete=models.CASCADE,
        related_name="team"
    )
    name = models.CharField(max_length=120, default="My Team")

    def __str__(self):
        return self.name


class FantasyTeamPlayer(models.Model):
    class AcquisitionType(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        TRADE = "TRADE", "Trade"
        FREE_AGENT = "FREE_AGENT", "Free Agent"

    team = models.ForeignKey(
        FantasyTeam,
        on_delete=models.CASCADE,
        related_name="roster"
    )
    player = models.ForeignKey(
        Player,
        on_delete=models.CASCADE,
        related_name="fantasy_roster_entries"
    )
    acquired_via = models.CharField(
        max_length=20,
        choices=AcquisitionType.choices,
        default=AcquisitionType.DRAFT
    )
    acquired_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [("team", "player")]

    def __str__(self):
        return f"{self.player.full_name} on {self.team.name}"


class Draft(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not Started"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETE = "COMPLETE", "Complete"

    class DraftType(models.TextChoices):
        SNAKE = "SNAKE", "Snake"
        OFFLINE = "OFFLINE", "Offline"
        AUTOPICK = "AUTOPICK", "Autopick"
        SALARY_CAP = "SALARY_CAP", "Salary Cap"

    class DraftOrder(models.TextChoices):
        RANDOM = "RANDOM", "Randomized One Hour Prior to Draft Time"
        CUSTOM = "CUSTOM", "Custom Draft Order"

    league = models.OneToOneField(
        League,
        on_delete=models.CASCADE,
        related_name="draft"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED
    )
    draft_type = models.CharField(
        max_length=20,
        choices=DraftType.choices,
        default=DraftType.SNAKE
    )
    scheduled_date = models.DateTimeField(null=True, blank=True)
    time_per_pick = models.PositiveIntegerField(default=90, help_text="Time in seconds")
    draft_order = models.CharField(
        max_length=20,
        choices=DraftOrder.choices,
        default=DraftOrder.RANDOM
    )
    current_slot = models.PositiveSmallIntegerField(default=1)
    round = models.PositiveIntegerField(default=1)
    pick_number = models.PositiveIntegerField(default=1)
    started_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Draft for {self.league.name}"


class DraftPick(models.Model):
    draft = models.ForeignKey(
        Draft,
        on_delete=models.CASCADE,
        related_name="picks"
    )
    pick_number = models.PositiveIntegerField()
    round = models.PositiveIntegerField()
    slot = models.PositiveSmallIntegerField()
    member = models.ForeignKey(
        LeagueMember,
        on_delete=models.CASCADE
    )
    player = models.ForeignKey(
        Player,
        on_delete=models.CASCADE,
        related_name="drafted_picks"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [
            ("draft", "player"),
            ("draft", "pick_number"),
        ]
        ordering = ["pick_number"]

    def __str__(self):
        return f"Pick {self.pick_number} - {self.player.full_name}"
    
class Trade(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    league = models.ForeignKey(
        League,
        on_delete=models.CASCADE,
        related_name="trades"
    )
    proposed_by = models.ForeignKey(
        LeagueMember,
        on_delete=models.CASCADE,
        related_name="trades_proposed"
    )
    proposed_to = models.ForeignKey(
        LeagueMember,
        on_delete=models.CASCADE,
        related_name="trades_received"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    created_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Trade {self.id} in {self.league.name}"


class TradePlayer(models.Model):
    trade = models.ForeignKey(
        Trade,
        on_delete=models.CASCADE,
        related_name="trade_players"
    )
    player = models.ForeignKey(
        Player,
        on_delete=models.CASCADE
    )
    from_member = models.ForeignKey(
        LeagueMember,
        on_delete=models.CASCADE
    )

    class Meta:
        unique_together = [("trade", "player")]

    def __str__(self):
        return f"{self.player.full_name} from {self.from_member.email}"


class Playoff(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not Started"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETE = "COMPLETE", "Complete"

    league = models.OneToOneField(
        League,
        on_delete=models.CASCADE,
        related_name="playoff"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED
    )
    champion = models.ForeignKey(
        "FantasyTeam",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="championships_won"
    )
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Playoff for {self.league.name}"


class PlayoffMatchup(models.Model):
    class Round(models.TextChoices):
        SEMIFINAL = "SEMIFINAL", "Semifinal"
        FINAL = "FINAL", "Final"

    playoff = models.ForeignKey(
        Playoff,
        on_delete=models.CASCADE,
        related_name="matchups"
    )
    round = models.CharField(max_length=20, choices=Round.choices)
    team_a = models.ForeignKey(
        FantasyTeam,
        on_delete=models.CASCADE,
        related_name="matchups_as_a"
    )
    team_b = models.ForeignKey(
        FantasyTeam,
        on_delete=models.CASCADE,
        related_name="matchups_as_b"
    )
    team_a_score = models.FloatField(null=True, blank=True)
    team_b_score = models.FloatField(null=True, blank=True)
    winner = models.ForeignKey(
        FantasyTeam,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="matchups_won"
    )
    simulated = models.BooleanField(default=False)

    class Meta:
        ordering = ["round", "id"]

    def __str__(self):
        return f"{self.round}: {self.team_a.name} vs {self.team_b.name}"


class PlayerMatchupStat(models.Model):
    matchup = models.ForeignKey(
        PlayoffMatchup,
        on_delete=models.CASCADE,
        related_name="player_stats"
    )
    team = models.ForeignKey(
        FantasyTeam,
        on_delete=models.CASCADE,
        related_name="matchup_stats"
    )
    player = models.ForeignKey(
        Player,
        on_delete=models.CASCADE,
        related_name="matchup_stats"
    )
    pts = models.FloatField()
    reb = models.FloatField()
    ast = models.FloatField()
    fantasy_score = models.FloatField()

    class Meta:
        unique_together = [("matchup", "player")]

    def __str__(self):
        return f"{self.player.full_name} in {self.matchup}"