from django.db import models


class Player(models.Model):
    """NBA Player model with stats relationship."""
    
    player_id = models.IntegerField(unique=True)  # PERSON_ID from data
    full_name = models.CharField(max_length=255)
    first_name = models.CharField(max_length=128, blank=True)
    last_name = models.CharField(max_length=128, blank=True)
    
    team_name = models.CharField(max_length=100, blank=True, null=True)
    team_abbreviation = models.CharField(max_length=10, blank=True, null=True)
    position = models.CharField(max_length=10, blank=True)
    
    height = models.CharField(max_length=20, blank=True)
    weight = models.CharField(max_length=20, blank=True, null=True)
    jersey_number = models.CharField(max_length=10, blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    roster_status = models.CharField(
        max_length=2,
        choices=[
            ('FA', 'Free Agent'),
            ('RW', 'On Waivers'),
            ('IL', 'Injured List'),
            ('R', 'Active'),
        ],
        default='FA'
    )
    
    injury_status = models.CharField(max_length=255, blank=True, null=True)
    is_healthy = models.BooleanField(default=True)
    
    roster_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.0
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        return self.full_name


class PlayerStats(models.Model):
    """Player statistics for different seasons and periods."""
    
    player = models.ForeignKey(
        Player,
        on_delete=models.CASCADE,
        related_name='stats'
    )
    
    season = models.CharField(max_length=10)  # e.g., "2025-26"
    period_type = models.CharField(
        max_length=20,
        choices=[
            ('season', 'Season'),
            ('last7', 'Last 7 Days'),
            ('last15', 'Last 15 Days'),
            ('last30', 'Last 30 Days'),
        ],
        default='season'
    )
    
    games_played = models.IntegerField(default=0)
    
    # Minutes
    min_total = models.DecimalField(max_digits=10, decimal_places=1, default=0)
    min_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Field Goals
    fgm_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fga_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fg_pct = models.DecimalField(max_digits=5, decimal_places=3, default=0)
    fgm_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fga_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Free Throws
    ftm_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fta_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    ft_pct = models.DecimalField(max_digits=5, decimal_places=3, default=0)
    ftm_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fta_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Three Pointers
    fg3m_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fg3a_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    fg3_pct = models.DecimalField(max_digits=5, decimal_places=3, default=0)
    fg3m_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Rebounds
    reb_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    reb_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    oreb_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    dreb_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Assists
    ast_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    ast_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Steals
    stl_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    stl_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Blocks
    blk_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    blk_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Turnovers
    tov_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    tov_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Points
    pts_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    pts_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Plus/Minus
    plus_minus_total = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    plus_minus_avg = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Fantasy Points
    fantasy_points_total = models.DecimalField(max_digits=10, decimal_places=1, default=0)
    fantasy_points_avg = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-season', 'period_type']
        unique_together = ['player', 'season', 'period_type']
    
    def __str__(self):
        return f"{self.player.full_name} - {self.season} ({self.period_type})"
