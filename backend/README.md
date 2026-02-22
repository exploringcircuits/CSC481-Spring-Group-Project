# Fantasy Basketball Backend

Django REST Framework backend API for the Fantasy Basketball application.

## Quick Start

### 1. Setup

```bash
# Create virtual environment
python -m venv backend_env

# Activate (Windows PowerShell)
.\backend_env\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate
```

### 2. Load Data

```bash
# Fetch NBA player data
python manage.py fetch_nba_data --limit 50

# (or fetch all: python manage.py fetch_nba_data)
```

### 3. Run Server

```bash
python manage.py runserver 8000
```

API available at `http://localhost:8000/api/`

## Project Structure

```
backend/
├── backend/                    # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── nba_players/                # Main app with models & API
│   ├── models.py               # Player & PlayerStats
│   ├── views.py                # API ViewSets
│   ├── serializers.py          # Data serialization
│   ├── management/commands/    # Data fetching scripts
│   └── migrations/
├── manage.py
└── requirements.txt
```

## API Endpoints

### List Players

```
GET /api/players/
```

Query parameters:

- `position` - Filter by position (PG, SG, SF, PF, C, G, F)
- `team` - Filter by team (LAL, BOS, etc.)
- `search` - Search by player name
- `ordering` - Sort by field (e.g., `-current_stats__pts_avg`)
- `page` - Page number (50 results per page)

Example:

```
GET /api/players/?position=PG&ordering=-current_stats__pts_avg&page=1
```

### Player Details

```
GET /api/players/{id}/
```

Returns full player info including stats and injury status.

### Teams List

```
GET /api/players/teams/
```

Returns all NBA teams with abbreviations.

## Models

### Player

- Basic info: name, team, position, height, weight
- Status: roster, health, injury data
- `roster_percent` - Ownership percentage

### PlayerStats

- Stats by season: points, rebounds, assists, blocks, etc.
- Supports different time periods (season, last7, last15, last30)
- `fantasy_points_avg` - Calculated fantasy score

## Management Commands

### Fetch NBA Data

```bash
python manage.py fetch_nba_data              # Fetch all players
python manage.py fetch_nba_data --limit 50   # Fetch 50 players only
python manage.py fetch_nba_data --season 2024-25  # Specific season
```

### Add Test Data

```bash
python manage.py add_test_injuries
```

## Troubleshooting

### CORS Errors

Frontend can't reach backend? Check `CORS_ALLOWED_ORIGINS` in `settings.py`

### Database Issues

- Fresh start: `python manage.py migrate`
- Fetch data: `python manage.py fetch_nba_data --limit 50`

### Connection Refused

Make sure Django is running: `python manage.py runserver 8000`

## Technologies

- Django 5.2.11
- Django REST Framework 3.16
- NBA API for data
- SQLite (development)
