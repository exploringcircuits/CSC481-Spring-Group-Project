from django.db import models

class Player(models.Model):
    person_id = models.IntegerField(unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    full_name = models.CharField(max_length=120)
    player_slug = models.SlugField(max_length=120, unique=True)

    team_id = models.IntegerField(null=True, blank=True)
    team_slug = models.CharField(max_length=50, blank=True)
    team_city = models.CharField(max_length=50, blank=True)
    team_name = models.CharField(max_length=50, blank=True)
    team_abbreviation = models.CharField(max_length=10, blank=True)

    jersey_number = models.CharField(max_length=10, blank=True)
    position = models.CharField(max_length=10, blank=True)
    specific_position = models.CharField(max_length=10, blank=True, default="")
    height = models.CharField(max_length=10, blank=True)
    weight = models.CharField(max_length=10, blank=True)

    college = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)

    draft_year = models.IntegerField(null=True, blank=True)
    draft_round = models.IntegerField(null=True, blank=True)
    draft_number = models.IntegerField(null=True, blank=True)

    roster_status = models.BooleanField(default=True)
    from_year = models.CharField(max_length=10, blank=True)
    to_year = models.CharField(max_length=10, blank=True)

    pts = models.FloatField(null=True, blank=True)
    reb = models.FloatField(null=True, blank=True)
    ast = models.FloatField(null=True, blank=True)

    stats_timeframe = models.CharField(max_length=30, blank=True)
    player_last_initial = models.CharField(max_length=1, blank=True)
    historic = models.BooleanField(default=False)
    is_defunct = models.BooleanField(default=False)

    def __str__(self):
        return self.full_name