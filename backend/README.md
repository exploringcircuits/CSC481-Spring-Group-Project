# Fantasy Hoops — backend

Django 6 + Django REST Framework + SQLite + SimpleJWT. Two apps, ~15 models,
one external dependency at ingest time (basketball-reference) and zero at
runtime.

```
backend/
├── manage.py
├── requirements.txt          Django 6 + DRF + SimpleJWT + requests + bs4
├── data/
│   └── cache/
│       └── bbref_per_game_2026.html   committed snapshot, used by sync_nba_data
├── db.sqlite3                ignored by git, recreated by bootstrap_demo
├── config/                   Django project module
│   ├── settings.py           env-driven config (SECRET_KEY, DEBUG, JWT, CORS)
│   ├── urls.py               top-level routing
│   ├── wsgi.py / asgi.py
│   └── __init__.py
├── accounts/                 custom User model + register / login / me / logout
│   ├── models.py             email-as-username User extending AbstractUser
│   ├── managers.py           UserManager
│   ├── serializers.py        Register, User, TokenWithUser
│   ├── views.py              RegisterView, LoginView, MeView, LogoutView
│   ├── urls.py
│   ├── admin.py
│   ├── tests.py              register + login + me + duplicate + min length
│   └── migrations/
└── fantasy/                  the basketball game
    ├── models.py             15 models (see below)
    ├── scoring.py            H2H Points, settle_week, refresh_standings, autopick
    ├── schedule.py           round-robin, playoff bracket, snake pointer, default lineups
    ├── permissions.py        IsLeagueMember, IsLeagueCommissioner, IsSiteAdmin
    ├── serializers.py        DRF serializers for every domain object
    ├── views.py              member-side endpoints
    ├── admin_views.py        site-admin demo control panel endpoints
    ├── urls.py / admin_urls.py
    ├── admin.py              Django admin registrations for every model
    ├── management/commands/
    │   ├── bootstrap_demo.py        one-shot setup
    │   ├── sync_nba_data.py         scrape basketball-reference once
    │   ├── generate_player_game_stats.py    Poisson-noise per-day stats
    │   └── seed_admin_user.py       create admin@demo.local
    └── migrations/
```

## Running

The backend lives behind a Python virtual environment at `<repo>/.venv/`.
Activate it in every new shell before running `manage.py` or `pip`. If the
venv doesn't exist yet, create it first.

**Windows PowerShell** (from the project root):

```powershell
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\Activate.ps1
cd backend
python manage.py runserver
```

**macOS / Linux** (from the project root):

```bash
[ -d .venv ] || python -m venv .venv
source .venv/bin/activate
cd backend
python manage.py runserver
```

Default URL: <http://127.0.0.1:8000>. Combine with `npm run dev` from
`frontend/` (in another terminal) for the full app. See the top-level
[`README.md`](../README.md) for the full one-time setup (pip install,
npm install, `bootstrap_demo`).

## Data model

All in `fantasy/models.py`. Three families:

**Player surface**

| Model | Notes |
|---|---|
| `Player` | NBA player — slug + full_name + team_abbr + primary_position + eligible_positions JSON. Optional cross-references (bbref_id, nba_player_id). |
| `PlayerSeasonAverage` | per-(player, season) averages. Populated by `sync_nba_data`. Has `fantasy_ppg` property using default weights. |
| `PlayerGameStats` | per-(player, game_date) stat lines. Populated by `generate_player_game_stats`. |

**League surface**

| Model | Notes |
|---|---|
| `League` | name, commissioner FK, season_label, status enum, scoring_weights JSON, roster_template JSON, lineup_lock_mode, trade_review_mode, invite_code (auto-generated), current_week_number. |
| `LeagueMember` | per-league membership. `user` FK is nullable for bots (with `is_bot` + `bot_name`). |
| `Team` | one team per LeagueMember. Cached W-L-T + PF/PA. |
| `Roster` | (team, player) ownership. Unique on (team, player). |

**Season surface**

| Model | Notes |
|---|---|
| `Week` | (league, week_number, start_date, end_date, is_playoff, playoff_round). Regular + playoff weeks share this table. |
| `Matchup` | (week, home_team, away_team, scores, winner, is_settled). One per team per week. |
| `LineupEntry` | (team, game_date, slot, player). The load-bearing daily snapshot. Bench slots score nothing. |

**Draft surface**

| Model | Notes |
|---|---|
| `Draft` | (league OneToOne, status, draft_order JSON of LeagueMember IDs, current_pick_index). |
| `DraftSelection` | (draft, member, player, pick_number, round_number). |

**Trade surface**

| Model | Notes |
|---|---|
| `Trade` | (league, proposer team, recipient team, status, timestamps, note). |
| `TradeAsset` | (trade, from_team, to_team, player). |

**Audit log**

| Model | Notes |
|---|---|
| `Transaction` | (league, team, type, summary, payload JSON). Append-only audit feed; surfaced in the LeagueHome activity card. |

Defaults baked into `models.py`:

- `DEFAULT_SCORING_WEIGHTS = {"pts": 1.0, "reb": 1.2, "ast": 1.5, "stl": 3.0, "blk": 3.0, "tov": -1.0}`
- `DEFAULT_ROSTER_TEMPLATE` — Yahoo-style 13 slots: PG, SG, G, SF, PF, F, C, C, UTIL, UTIL + 3 BN.

## API surface

All endpoints are JSON. JWT Bearer auth on every endpoint except
register/login/refresh.

### Auth (`/api/auth/`)

| Method | Path | Notes |
|---|---|---|
| POST | `/register/` | `{email, password, display_name?}` → User |
| POST | `/login/` | `{email, password}` → `{access, refresh, user}` |
| POST | `/refresh/` | `{refresh}` → `{access}` |
| POST | `/logout/` | 204; client drops tokens |
| GET | `/me/` | current User |

### Players & leagues (`/api/`)

| Method | Path | Notes |
|---|---|---|
| GET | `/players/` | filter by `position`, `team`, `search`, `available_in_league`, `page` |
| GET | `/players/<id>/` | full Player detail with current-season averages |
| GET | `/leagues/` | leagues the user is a member of |
| POST | `/leagues/` | create — payload: name, season_label?, max_teams?, regular_season_weeks?, playoff_team_count?, team_name? |
| POST | `/leagues/join/` | `{invite_code, team_name?}` |
| GET | `/leagues/<id>/` | full league detail |
| GET | `/leagues/<id>/standings/` | sorted Team[] |
| GET | `/leagues/<id>/weeks/` | every week + matchups |
| GET | `/leagues/<id>/weeks/<n>/` | single week |
| GET | `/leagues/<id>/draft/` | Draft state + selections + on_the_clock |
| POST | `/leagues/<id>/draft/pick/` | `{player_id}` — must be the on-clock member (or admin) |
| GET | `/leagues/<id>/trades/` | trades for the league |
| POST | `/leagues/<id>/trades/propose/` | `{recipient_team_id, proposer_player_ids[], recipient_player_ids[], note?}` |
| GET | `/leagues/<id>/transactions/` | last 200 audit-log entries |
| POST | `/trades/<id>/respond/` | `{action: "accept" \| "reject" \| "cancel"}` |
| GET | `/teams/<id>/` | full team detail with roster |
| GET | `/teams/<id>/lineup/?week_id=<id>` | lineup entries for a week |
| POST | `/teams/<id>/lineup/` | `{week_id, assignments: {slot: player_id, ...}}` |

### Admin demo panel (`/api/admin/`) — `is_staff` only

| Method | Path | Notes |
|---|---|---|
| GET | `/status/` | snapshot of every league's progression |
| POST | `/reset/` | wipe all leagues / teams / drafts / weeks / lineups / trades. Players + stats preserved. |
| POST | `/seed-demo/` | create "Demo Showcase" league with admin + 7 bots |
| POST | `/leagues/<id>/run-draft/` | autopick to completion using projected fantasy PPG |
| POST | `/leagues/<id>/build-schedule/` | round-robin regular season + default lineups |
| POST | `/leagues/<id>/set-default-lineups/` | greedy-fill lineups for every week |
| POST | `/leagues/<id>/advance-week/` | settle current week + bump pointer |
| POST | `/leagues/<id>/simulate-to-playoffs/` | settle every regular-season week |
| POST | `/leagues/<id>/start-playoffs/` | seed top-N bracket from standings |
| POST | `/leagues/<id>/simulate-next/` | settle next pending week (auto-advances bracket between rounds) |
| POST | `/leagues/<id>/example-trade/` | bot proposes a sample trade to admin's team |

## Permissions

- `IsSiteAdmin` — `request.user.is_staff`. Gates the admin demo panel.
- `IsLeagueMember` — actor is a member of the URL's `<league_id>`. Site admin
  bypasses (so the demo presenter can view any league).
- `IsLeagueCommissioner` — actor is the league's commissioner *or* a site admin.
- All league mutations derive the actor from `request.user` — no email or
  user_id from the request body. JWT is the source of truth.

## Scoring

`fantasy.scoring.score_team_for_week(team, week)`:

```
total = sum over each game_date in week.start_date..week.end_date:
          sum over each LineupEntry where slot is a starter:
            sum_i (PlayerGameStats[player, game_date].stat_i × scoring_weights[stat_i])
```

`settle_week(week)` is idempotent: computes scores, sets winners, refreshes
standings, marks `Matchup.is_settled` and `Week.is_settled`.

## Schedule

`fantasy.schedule`:

- `generate_round_robin_pairings(team_ids)` — circle method. Even N teams →
  N-1 distinct weeks. Odd N adds a phantom team and treats those slots as byes.
- `build_regular_season(league, season_start)` — creates Week + Matchup rows.
- `build_playoff_bracket(league, top_n)` — top-N seeded by standings, semis
  populated, final left empty until semis settle.
- `advance_playoffs(league)` — when a round settles, populates the next
  round's matchups with re-seeded winners.
- `populate_default_lineups(league, week)` — greedy slot-by-slot fill,
  highest-FPPG first, position-eligible only.
- `snake_pick_pointer(draft_order, pick_index)` — round 0 forward, round 1
  reversed, round 2 forward, …

## Management commands

| Command | Notes |
|---|---|
| `python manage.py bootstrap_demo` | migrate + seed_admin_user + sync_nba_data + generate_player_game_stats. Idempotent. |
| `python manage.py bootstrap_demo --regenerate-stats` | Same, but force-regenerate stats. |
| `python manage.py sync_nba_data` | Scrape basketball-reference (cached). |
| `python manage.py sync_nba_data --refresh` | Re-fetch the cached page. |
| `python manage.py generate_player_game_stats --weeks 8 --seed 42 --start-date 2026-03-10 --clear` | Generate per-day stats. |
| `python manage.py seed_admin_user` | Create / refresh admin@demo.local (idempotent). |
| `python manage.py createsuperuser` | Django built-in. Create a custom superuser. |
| `python manage.py test accounts` | Run auth-flow tests. |

## Settings (env-driven)

`config/settings.py` reads from environment with safe dev defaults:

| Variable | Default | Notes |
|---|---|---|
| `DJANGO_SECRET_KEY` | dev-only placeholder | Set in production. |
| `DJANGO_DEBUG` | `1` | Set to `0` in production. |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,testserver` | Comma-separated. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated. |

JWT lifetimes (in `settings.py:SIMPLE_JWT`): 4-hour access, 7-day refresh.

## Tests

```bash
python manage.py test accounts -v 2
```

Three auth-flow tests in `accounts/tests.py` — register + login + me, password
length validation, duplicate-email rejection. Fantasy domain test coverage is
deliberately deferred (see the project root README's "What this project
deliberately does not do").

## Database

SQLite for the demo. The DB file is `backend/db.sqlite3` (gitignored).

Schema is defined entirely in `fantasy/models.py` + `accounts/models.py`.
Migrations are committed; `python manage.py migrate` from a clean checkout
recreates everything.
