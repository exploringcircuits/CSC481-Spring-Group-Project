from django.db import models


class Player(models.Model):
    """Model representing an NBA player with their basic information."""

    player_id = models.IntegerField(unique=True)
    full_name = models.CharField(max_length=200)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    team_name = models.CharField(max_length=100, null=True, blank=True)
    team_abbreviation = models.CharField(max_length=5, null=True, blank=True)
    position = models.CharField(max_length=10, null=True, blank=True)
    height = models.CharField(max_length=20, null=True, blank=True)
    weight = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    jersey_number = models.CharField(max_length=5, null=True, blank=True)

    # Roster status
    roster_status = models.CharField(
        max_length=10,
        choices=[
            ("FA", "Free Agent"),
            ("RW", "Rostered - Waiver"),
            ("IL", "Injured List"),
        ],
        default="FA",
    )

    # Health status
    injury_status = models.CharField(max_length=50, null=True, blank=True)
    is_healthy = models.BooleanField(default=True)

    # Ownership
    roster_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-roster_percent", "full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.team_abbreviation})"


class PlayerStats(models.Model):
    """Model representing player statistics for different time periods."""

    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="stats")

    # Time period
    season = models.CharField(max_length=20)  # e.g., "2025-26"
    period_type = models.CharField(
        max_length=20,
        choices=[
            ("season", "Full Season"),
            ("last7", "Last 7 Games"),
            ("last15", "Last 15 Games"),
            ("last30", "Last 30 Games"),
        ],
        default="season",
    )

    # Game stats
    games_played = models.IntegerField(default=0)
    games_started = models.IntegerField(default=0)

    # Minutes
    min_total = models.DecimalField(max_digits=10, decimal_places=1, default=0)
    min_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Field Goals
    fgm_total = models.IntegerField(default=0)
    fga_total = models.IntegerField(default=0)
    fg_pct = models.DecimalField(max_digits=5, decimal_places=3, default=0)
    fgm_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fga_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Free Throws
    ftm_total = models.IntegerField(default=0)
    fta_total = models.IntegerField(default=0)
    ft_pct = models.DecimalField(max_digits=5, decimal_places=3, default=0)
    ftm_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fta_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Three Pointers
    fg3m_total = models.IntegerField(default=0)
    fg3a_total = models.IntegerField(default=0)
    fg3_pct = models.DecimalField(max_digits=5, decimal_places=3, default=0)
    fg3m_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Rebounds
    reb_total = models.IntegerField(default=0)
    reb_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    oreb_total = models.IntegerField(default=0)
    dreb_total = models.IntegerField(default=0)

    # Assists
    ast_total = models.IntegerField(default=0)
    ast_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Steals
    stl_total = models.IntegerField(default=0)
    stl_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Blocks
    blk_total = models.IntegerField(default=0)
    blk_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Turnovers
    tov_total = models.IntegerField(default=0)
    tov_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Points
    pts_total = models.IntegerField(default=0)
    pts_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Plus/Minus
    plus_minus_total = models.IntegerField(default=0)
    plus_minus_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    # Fantasy Points (ESPN Standard Scoring)
    # PTS*1 + REB*1.2 + AST*1.5 + STL*2 + BLK*2 + TOV*-1
    fantasy_points_total = models.DecimalField(
        max_digits=10, decimal_places=1, default=0
    )
    fantasy_points_avg = models.DecimalField(max_digits=8, decimal_places=1, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pts_avg"]
        unique_together = ["player", "season", "period_type"]

    def __str__(self):
        return f"{self.player.full_name} - {self.season} ({self.period_type})"

    def calculate_fantasy_points(self):
        """
        Calculate fantasy points using ESPN Standard Scoring:
        - Points (PTS): 1 point
        - Rebounds (REB): 1.2 points
        - Assists (AST): 1.5 points
        - Steals (STL): 2 points
        - Blocks (BLK): 2 points
        - Turnovers (TOV): -1 point
        """
        fp_total = (
            self.pts_total * 1.0
            + self.reb_total * 1.2
            + self.ast_total * 1.5
            + self.stl_total * 2.0
            + self.blk_total * 2.0
            + self.tov_total * -1.0
        )
        fp_avg = fp_total / self.games_played if self.games_played > 0 else 0
        return round(fp_total, 1), round(fp_avg, 1)
