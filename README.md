# Fantasy Hoops

A demo-grade fantasy-basketball web app. Single-league, head-to-head points
scoring, snake draft, weekly matchups, configurable playoff bracket, trade
flow. Built solo over a marathon session as a presentation deliverable.

```
React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui
        │
        ▼  /api/*  (Vite dev proxy → 127.0.0.1:8000)
        │
Django 6 + DRF + SQLite + SimpleJWT
        │
        ├── accounts/      User (email-as-username) + register / login / me
        └── fantasy/       all the basketball — players, leagues, draft,
                           weekly matchups, lineups, trades, audit log,
                           scoring + schedule helpers, admin panel API
```

## What's in the box

- **Real player data.** ~580 active NBA players scraped once from
  basketball-reference into the local DB. No API calls during normal use.
- **Per-day stat lines.** 8 weeks (~32k rows) generated from each player's
  season averages with Gaussian noise. Deterministic per seed.
- **Full game loop.** Snake draft, round-robin schedule, daily lineup
  snapshots (bench scores nothing), week settlement, standings refresh,
  top-N playoff bracket, single-elimination through to a champion.
- **Admin demo panel.** One-click presenter shortcuts: reset, seed a demo
  league with 7 bots, run the draft, simulate the regular season, start
  playoffs, propose example trade. Everything you need on stage.
- **Three-tier roles.** `User.is_staff` for site admin (sees the demo panel),
  `LeagueMember.is_commissioner` for commissioners, default member otherwise.

## Prerequisites

- Python 3.10+ on PATH
- Node.js 20+ (with npm) on PATH
- Windows PowerShell (the launcher is `start-app.ps1`)

## Quick start

```powershell
.\start-app.ps1
```

First run: creates `.venv`, installs Python + Node deps, runs migrations,
ensures the admin user exists, scrapes basketball-reference once (cached
locally), generates 8 weeks of player game stats, then boots both servers.
Subsequent runs are fast (`-SkipInstall` skips dep install entirely).

To regenerate the per-day stats fixture (e.g. fresh seed for a new demo):

```powershell
.\start-app.ps1 -SeedFreshDemo
```

Default credentials:

| Role         | Email              | Password    |
| ------------ | ------------------ | ----------- |
| Site admin   | admin@demo.local   | demoadmin   |

You can also create regular accounts through the **Sign up** page.

## URLs

- Frontend: <http://localhost:5173>
- Backend: <http://127.0.0.1:8000>
- Django admin: <http://127.0.0.1:8000/admin/>
- API root (auth endpoints): `/api/auth/` ·
  fantasy: `/api/leagues/` `/api/teams/` `/api/players/` `/api/admin/`

## Demo flow

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the click-by-click
presentation script. The short version:

1. Sign in as `admin@demo.local`.
2. Open **Admin** in the top right → **Reset everything** → **Seed demo league**.
3. Click **Run draft** → the 8-team draft runs to completion in seconds.
4. Click **Build schedule** → the regular-season weeks appear with default
   lineups.
5. Click **Simulate to playoffs** to fast-forward through the regular season.
6. Click **Start playoffs** → the top-4 bracket is seeded by standings.
7. Click **Simulate next round** twice (semis + final) → champion crowned.
8. Click **Propose example trade** → switch to the **Trades** tab → accept
   the incoming trade.

## Repo layout

```
backend/
  config/             Django project (settings, urls, asgi/wsgi)
  accounts/           Custom User (email-as-username) + auth views
  fantasy/            Domain models, scoring, schedule, views, admin panel
    models.py         15 models in one file (Player, League, Team, Week, ...)
    scoring.py        Yahoo-flavored H2H Points, settle_week, refresh_standings
    schedule.py       Round-robin generator, playoff bracket builder, snake pointer
    permissions.py    IsLeagueMember / IsLeagueCommissioner / IsSiteAdmin
    views.py          Read-side + member-side API endpoints
    admin_views.py    Demo control panel endpoints (is_staff only)
    serializers.py    DRF serializers (~16 of them)
    management/commands/
      sync_nba_data.py
      generate_player_game_stats.py
      seed_admin_user.py
  data/cache/         Scraped HTML (committed; offline runs work)
  requirements.txt    Django 6 + DRF + SimpleJWT + requests + bs4

frontend/
  src/
    pages/            One file per route (10 demo pages)
    components/
      layout/         Top nav shell
      ui/             shadcn/ui primitives (~15)
      ProtectedRoute.tsx
    services/         apiFetch + per-domain client (auth, leagues, teams,
                      draft, trades, players, admin)
    contexts/         AuthContext provider
    hooks/            useAuth
    lib/              storage helpers, cn() util
    types/            shared TS types

start-app.ps1         Windows launcher (creates venv, installs, ingests, runs)
README.md             You are here
docs/DEMO_SCRIPT.md   Click-by-click presentation script
```

## Architecture decisions

The vault at `~/Documents/Vaults/fantasy-project-context-vault/` records
the decisions made during this revamp as ADRs (architecture-decision
records). Highlights:

- 001: Unify Player models — keep one schema, scrape live NBA data.
- 003: Tailwind v4 + shadcn/ui as the UI stack.
- 004: Email-as-username + bind league identity to JWT.
- 005: H2H season model — single Week + Matchup table, daily LineupEntry
  snapshots.
- 006: Static stats snapshot via basketball-reference + Poisson per-day
  generator.

## What this project deliberately does not do

- No live NBA data during gameplay. The snapshot is refreshed manually.
- No daily-lineup-changes-mid-week. Weekly lock only.
- No FAAB waivers, no free-agent claims, no player news feed.
- Not mobile-responsive. Designed for desktop demos.
- No production deployment story. SQLite + dev servers; not production-ready.
