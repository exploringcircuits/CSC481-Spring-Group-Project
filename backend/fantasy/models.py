"""Fantasy domain models.

Layout:
- Player surface: Player, PlayerSeasonAverage, PlayerGameStats
- League surface: League, LeagueMember, Team, Roster
- Season surface: Week, Matchup, LineupEntry
- Draft surface: Draft, DraftSelection
- Trade surface: Trade, TradeAsset
- Audit: Transaction

The two load-bearing decisions:
- Stats are time-keyed (PlayerGameStats per game_date), not flat on Player.
- Lineups are stored as daily snapshots (LineupEntry per game_date per slot).
  Bench slots exist but bench players don't score.
"""

from __future__ import annotations

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


# -----------------------------------------------------------------------------
# Defaults
# -----------------------------------------------------------------------------

DEFAULT_SCORING_WEIGHTS: dict[str, float] = {
    "pts": 1.0,
    "reb": 1.2,
    "ast": 1.5,
    "stl": 3.0,
    "blk": 3.0,
    "tov": -1.0,
}

# Yahoo-flavored 13-slot template. Each slot describes which player positions
# can fill it and whether scoring counts the slot's player.
ROSTER_SLOT_PG = "PG"
ROSTER_SLOT_SG = "SG"
ROSTER_SLOT_SF = "SF"
ROSTER_SLOT_PF = "PF"
ROSTER_SLOT_C = "C"

ALL_POSITIONS = [ROSTER_SLOT_PG, ROSTER_SLOT_SG, ROSTER_SLOT_SF, ROSTER_SLOT_PF, ROSTER_SLOT_C]

DEFAULT_ROSTER_TEMPLATE: list[dict] = [
    {"slot": "PG",     "allowed": ["PG"],          "starter": True},
    {"slot": "SG",     "allowed": ["SG"],          "starter": True},
    {"slot": "G",      "allowed": ["PG", "SG"],    "starter": True},
    {"slot": "SF",     "allowed": ["SF"],          "starter": True},
    {"slot": "PF",     "allowed": ["PF"],          "starter": True},
    {"slot": "F",      "allowed": ["SF", "PF"],    "starter": True},
    {"slot": "C1",     "allowed": ["C"],           "starter": True},
    {"slot": "C2",     "allowed": ["C"],           "starter": True},
    {"slot": "UTIL1",  "allowed": ALL_POSITIONS,   "starter": True},
    {"slot": "UTIL2",  "allowed": ALL_POSITIONS,   "starter": True},
    {"slot": "BN1",    "allowed": ALL_POSITIONS,   "starter": False},
    {"slot": "BN2",    "allowed": ALL_POSITIONS,   "starter": False},
    {"slot": "BN3",    "allowed": ALL_POSITIONS,   "starter": False},
]


# -----------------------------------------------------------------------------
# Player surface
# -----------------------------------------------------------------------------

class Player(models.Model):
    """An NBA player. Identity is (slug, full_name); external NBA IDs live as
    a separate field for cross-referencing data sources."""

    slug = models.SlugField(max_length=120, unique=True)
    full_name = models.CharField(max_length=120)
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)

    team_abbr = models.CharField(max_length=8, blank=True)
    primary_position = models.CharField(
        max_length=4,
        blank=True,
        help_text="One of PG / SG / SF / PF / C",
    )
    eligible_positions = models.JSONField(
        default=list,
        blank=True,
        help_text='List of positions the player can fill, e.g. ["SF", "PF"]',
    )

    is_active = models.BooleanField(default=True)
    is_injured = models.BooleanField(default=False)
    injury_status = models.CharField(max_length=200, blank=True)

    # Bio. Populated by sync_nba_data via stats.nba.com leaguedashplayerbiostats.
    height_inches = models.PositiveSmallIntegerField(null=True, blank=True)
    weight_lbs = models.PositiveSmallIntegerField(null=True, blank=True)
    jersey_number = models.CharField(max_length=4, blank=True)

    # (Player model continues below — the next field is bbref_id.)

    # Optional cross-reference to basketball-reference / NBA IDs
    bbref_id = models.CharField(max_length=40, blank=True, db_index=True)
    nba_player_id = models.IntegerField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("last_name", "first_name")
        indexes = [
            models.Index(fields=["team_abbr"]),
            models.Index(fields=["primary_position"]),
        ]

    def __str__(self) -> str:
        return self.full_name


class PlayerSeasonAverage(models.Model):
    """Per-game season averages — the canonical reference data populated by
    the basketball-reference scrape. Used to project performance and derive
    per-day stats during the demo."""

    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="season_averages")
    season = models.CharField(
        max_length=10,
        help_text='Season label, e.g. "2025-26"',
    )
    games_played = models.IntegerField(default=0)
    minutes = models.FloatField(default=0)
    pts = models.FloatField(default=0)
    reb = models.FloatField(default=0)
    ast = models.FloatField(default=0)
    stl = models.FloatField(default=0)
    blk = models.FloatField(default=0)
    tov = models.FloatField(default=0)
    fgm = models.FloatField(default=0)
    fga = models.FloatField(default=0)
    ftm = models.FloatField(default=0)
    fta = models.FloatField(default=0)
    fg3m = models.FloatField(default=0)
    fg3a = models.FloatField(default=0)
    fg_pct = models.FloatField(default=0)
    ft_pct = models.FloatField(default=0)
    fg3_pct = models.FloatField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-pts",)
        constraints = [
            models.UniqueConstraint(fields=["player", "season"], name="uniq_seasonavg_player_season"),
        ]

    def __str__(self) -> str:
        return f"{self.player.full_name} ({self.season})"

    @property
    def fantasy_ppg(self) -> float:
        """Default-weighted fantasy points per game."""
        w = DEFAULT_SCORING_WEIGHTS
        return (
            w["pts"] * self.pts
            + w["reb"] * self.reb
            + w["ast"] * self.ast
            + w["stl"] * self.stl
            + w["blk"] * self.blk
            + w["tov"] * self.tov
        )


class PlayerGameStats(models.Model):
    """A single player's stat line for a single game date. Generated by
    sampling around season averages with Poisson noise (Phase 4 generator)."""

    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="game_stats")
    game_date = models.DateField(db_index=True)

    minutes = models.FloatField(default=0)
    pts = models.FloatField(default=0)
    reb = models.FloatField(default=0)
    ast = models.FloatField(default=0)
    stl = models.FloatField(default=0)
    blk = models.FloatField(default=0)
    tov = models.FloatField(default=0)
    fgm = models.FloatField(default=0)
    fga = models.FloatField(default=0)
    ftm = models.FloatField(default=0)
    fta = models.FloatField(default=0)
    fg3m = models.FloatField(default=0)

    did_play = models.BooleanField(default=True)

    class Meta:
        ordering = ("-game_date",)
        constraints = [
            models.UniqueConstraint(fields=["player", "game_date"], name="uniq_gamestats_player_date"),
        ]

    def __str__(self) -> str:
        return f"{self.player.full_name} on {self.game_date}"


# -----------------------------------------------------------------------------
# League surface
# -----------------------------------------------------------------------------

class LeagueStatus(models.TextChoices):
    SETUP = "setup", "Setup"
    DRAFTING = "drafting", "Drafting"
    REGULAR = "regular", "Regular Season"
    PLAYOFFS = "playoffs", "Playoffs"
    COMPLETE = "complete", "Complete"


class LineupLockMode(models.TextChoices):
    WEEKLY = "weekly", "Weekly"
    DAILY = "daily", "Daily (game-time)"


class TradeReviewMode(models.TextChoices):
    AUTO = "auto", "Auto-process on accept"
    COMMISSIONER = "commissioner", "Commissioner review"
    LEAGUE_VOTE = "league_vote", "League vote"


class League(models.Model):
    """Top-level league container. Owns its season config and member list."""

    name = models.CharField(max_length=120)
    commissioner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="commissioned_leagues",
    )
    season_label = models.CharField(max_length=20, default="2025-26")
    status = models.CharField(
        max_length=12,
        choices=LeagueStatus.choices,
        default=LeagueStatus.SETUP,
    )

    max_teams = models.IntegerField(default=8, validators=[MinValueValidator(2)])
    regular_season_weeks = models.IntegerField(default=6, validators=[MinValueValidator(2)])
    playoff_team_count = models.IntegerField(default=4, validators=[MinValueValidator(2)])

    scoring_weights = models.JSONField(default=dict)
    roster_template = models.JSONField(default=list)
    lineup_lock_mode = models.CharField(
        max_length=8,
        choices=LineupLockMode.choices,
        default=LineupLockMode.WEEKLY,
    )
    trade_review_mode = models.CharField(
        max_length=16,
        choices=TradeReviewMode.choices,
        default=TradeReviewMode.AUTO,
    )

    invite_code = models.CharField(max_length=12, unique=True, db_index=True)
    current_week_number = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        # Apply Yahoo-flavored defaults once at creation time.
        if not self.scoring_weights:
            self.scoring_weights = dict(DEFAULT_SCORING_WEIGHTS)
        if not self.roster_template:
            self.roster_template = list(DEFAULT_ROSTER_TEMPLATE)
        if not self.invite_code:
            from secrets import token_urlsafe
            self.invite_code = token_urlsafe(6).replace("_", "a").replace("-", "b").upper()[:8]
        super().save(*args, **kwargs)

    @property
    def roster_size(self) -> int:
        return len(self.roster_template)

    @property
    def starter_count(self) -> int:
        return sum(1 for slot in self.roster_template if slot.get("starter"))


class LeagueMember(models.Model):
    """A user's membership in a league. The owner of a fantasy team."""

    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="league_memberships",
        null=True,
        blank=True,
        help_text="Null for bot members.",
    )
    is_bot = models.BooleanField(default=False)
    bot_name = models.CharField(max_length=120, blank=True)
    is_commissioner = models.BooleanField(default=False)
    slot = models.IntegerField(help_text="1-indexed draft order slot")

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("league_id", "slot")
        constraints = [
            models.UniqueConstraint(fields=["league", "slot"], name="uniq_member_league_slot"),
            models.UniqueConstraint(
                fields=["league", "user"],
                name="uniq_member_league_user",
                condition=models.Q(user__isnull=False),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.display_name} in {self.league.name}"

    @property
    def display_name(self) -> str:
        if self.is_bot:
            return self.bot_name or f"Bot {self.slot}"
        if self.user:
            return self.user.name
        return f"Slot {self.slot}"


class Team(models.Model):
    """The fantasy team owned by a league member."""

    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="teams")
    member = models.OneToOneField(LeagueMember, on_delete=models.CASCADE, related_name="team")
    name = models.CharField(max_length=120)

    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    ties = models.IntegerField(default=0)
    points_for = models.FloatField(default=0)
    points_against = models.FloatField(default=0)

    class Meta:
        ordering = ("-wins", "-points_for")

    def __str__(self) -> str:
        return self.name

    @property
    def record(self) -> str:
        return f"{self.wins}-{self.losses}-{self.ties}"


class Roster(models.Model):
    """A player's ownership by a team. Unique on (league, player) — a player
    is on exactly one team in a league."""

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="roster_entries")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="roster_entries")
    acquired_at = models.DateTimeField(auto_now_add=True)
    acquired_via = models.CharField(
        max_length=12,
        default="draft",
        choices=[("draft", "Draft"), ("trade", "Trade"), ("free_agent", "Free agent")],
    )

    class Meta:
        ordering = ("team_id", "acquired_at")
        constraints = [
            # Player is on exactly one team in a league. Enforce via app-level
            # check on Roster.add since a player can be on different leagues'
            # teams; the (team, player) constraint covers double-add to the
            # same team.
            models.UniqueConstraint(fields=["team", "player"], name="uniq_roster_team_player"),
        ]

    def __str__(self) -> str:
        return f"{self.player.full_name} -> {self.team.name}"


# -----------------------------------------------------------------------------
# Season surface
# -----------------------------------------------------------------------------

class Week(models.Model):
    """A scoring period within a league's season. Regular and playoff weeks
    share this table, distinguished by `is_playoff` + `playoff_round`."""

    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="weeks")
    week_number = models.IntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    is_playoff = models.BooleanField(default=False)
    playoff_round = models.CharField(
        max_length=20,
        blank=True,
        help_text='e.g. "semifinal", "final"',
    )
    is_settled = models.BooleanField(
        default=False,
        help_text="Set after matchup scores are computed and standings updated.",
    )

    class Meta:
        ordering = ("league_id", "week_number")
        constraints = [
            models.UniqueConstraint(fields=["league", "week_number"], name="uniq_week_league_number"),
        ]

    def __str__(self) -> str:
        kind = self.playoff_round or ("playoff" if self.is_playoff else "regular")
        return f"{self.league.name} W{self.week_number} ({kind})"


class Matchup(models.Model):
    """A single H2H matchup in a Week. Each team plays exactly one matchup
    per week. Scores are cached after settlement."""

    week = models.ForeignKey(Week, on_delete=models.CASCADE, related_name="matchups")
    home_team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="matchups_as_home",
    )
    away_team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="matchups_as_away",
    )
    home_score = models.FloatField(default=0)
    away_score = models.FloatField(default=0)
    winner = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matchups_won",
    )
    is_settled = models.BooleanField(default=False)

    class Meta:
        ordering = ("week_id", "id")

    def __str__(self) -> str:
        return f"{self.home_team.name} vs {self.away_team.name} (W{self.week.week_number})"


class LineupEntry(models.Model):
    """A single slot of a team's daily lineup. Load-bearing for scoring:
    only entries on starter slots count toward the team's day score.

    Keyed (team, game_date, slot) — same shape works for daily-lock and
    weekly-lock leagues (in weekly-lock the snapshot is identical for all 7 days)."""

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="lineup_entries")
    game_date = models.DateField()
    slot = models.CharField(max_length=12)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="lineup_entries")

    class Meta:
        ordering = ("game_date", "team_id", "slot")
        constraints = [
            models.UniqueConstraint(fields=["team", "game_date", "slot"], name="uniq_lineup_team_date_slot"),
            models.UniqueConstraint(fields=["team", "game_date", "player"], name="uniq_lineup_team_date_player"),
        ]

    def __str__(self) -> str:
        return f"{self.team.name} {self.game_date} {self.slot}: {self.player.full_name}"


# -----------------------------------------------------------------------------
# Draft surface
# -----------------------------------------------------------------------------

class DraftStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETE = "complete", "Complete"


class Draft(models.Model):
    league = models.OneToOneField(League, on_delete=models.CASCADE, related_name="draft")
    status = models.CharField(
        max_length=12,
        choices=DraftStatus.choices,
        default=DraftStatus.NOT_STARTED,
    )
    draft_order = models.JSONField(
        default=list,
        help_text="Ordered list of LeagueMember ids representing the first-round pick order.",
    )
    current_pick_index = models.IntegerField(default=0, help_text="0-based pointer into the snake order.")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_paused = models.BooleanField(default=False, help_text="Commissioner-controlled pause flag — bots stop auto-filling while true.")

    def __str__(self) -> str:
        return f"Draft for {self.league.name}"


class DraftSelection(models.Model):
    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name="selections")
    member = models.ForeignKey(LeagueMember, on_delete=models.CASCADE, related_name="draft_picks")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="drafted_in")
    pick_number = models.IntegerField(help_text="1-indexed overall pick number.")
    round_number = models.IntegerField()
    selected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("draft_id", "pick_number")
        constraints = [
            models.UniqueConstraint(fields=["draft", "pick_number"], name="uniq_pick_draft_number"),
            models.UniqueConstraint(fields=["draft", "player"], name="uniq_pick_draft_player"),
        ]

    def __str__(self) -> str:
        return f"#{self.pick_number} {self.player.full_name} -> {self.member.display_name}"


# -----------------------------------------------------------------------------
# Trade surface
# -----------------------------------------------------------------------------

class TradeStatus(models.TextChoices):
    PROPOSED = "proposed", "Proposed"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"
    PROCESSED = "processed", "Processed"


class Trade(models.Model):
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="trades")
    proposer = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="trades_proposed")
    recipient = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="trades_received")
    status = models.CharField(
        max_length=12,
        choices=TradeStatus.choices,
        default=TradeStatus.PROPOSED,
    )
    proposed_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=400, blank=True)

    class Meta:
        ordering = ("-proposed_at",)

    def __str__(self) -> str:
        return f"Trade #{self.pk} {self.proposer.name}→{self.recipient.name} [{self.status}]"


class TradeAsset(models.Model):
    """One side of a trade — a player going from one team to another."""

    trade = models.ForeignKey(Trade, on_delete=models.CASCADE, related_name="assets")
    from_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="trade_assets_out")
    to_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="trade_assets_in")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="trade_assets")

    class Meta:
        ordering = ("trade_id", "id")

    def __str__(self) -> str:
        return f"{self.player.full_name}: {self.from_team.name}→{self.to_team.name}"


# -----------------------------------------------------------------------------
# Audit log
# -----------------------------------------------------------------------------

class TransactionType(models.TextChoices):
    DRAFT_PICK = "draft_pick", "Draft pick"
    TRADE = "trade", "Trade"
    TRADE_PROPOSED = "trade_proposed", "Trade proposed"
    TRADE_REJECTED = "trade_rejected", "Trade rejected"
    TRADE_CANCELLED = "trade_cancelled", "Trade cancelled"
    LINEUP_SET = "lineup_set", "Lineup set"
    WEEK_ADVANCED = "week_advanced", "Week advanced"
    COMMISSIONER_OVERRIDE = "commissioner_override", "Commissioner override"
    OTHER = "other", "Other"


class Transaction(models.Model):
    """Audit log of league events. Used for activity feed + commissioner
    reverse-transaction power. Append-only."""

    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="transactions")
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="transactions",
    )
    type = models.CharField(max_length=24, choices=TransactionType.choices)
    summary = models.CharField(max_length=400)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"[{self.type}] {self.summary[:60]}"
