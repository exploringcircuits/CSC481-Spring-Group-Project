# Fantasy Basketball Frontend

Simple React + TypeScript frontend for the Fantasy Basketball app.

## Quick Start

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

Default frontend URL: http://localhost:5173

## Relevant Files and What They Do

### Root frontend files

- index.html
	- HTML shell Vite uses to mount React.

- package.json
	- Dependencies and scripts (dev, build, lint, preview).

- vite.config.ts
	- Vite build/dev configuration.

- tsconfig.json, tsconfig.app.json, tsconfig.node.json
	- TypeScript compiler settings for app and tooling.

- eslint.config.js
	- Linting configuration.

- public/
	- Static assets served directly.

### src entry files

- src/main.tsx
	- React entry point. Mounts App into the root DOM node.

- src/App.tsx
	- Main router definition. Maps URL paths to page components.

- src/index.css
	- Global baseline styles.

- src/App.css
	- App-level styles.

### src/pages (route screens)

Each file is a full page used by routing:

- Login.tsx, SignUp.tsx
	- Authentication views.

- Home.tsx
	- Primary landing page after login.

- LeagueSelection.tsx
	- Shows/selects available leagues.

- CreateLeague.tsx, JoinLeague.tsx
	- League creation and joining flows.

- LeagueHome.tsx
	- Main dashboard for a specific league.

- LeagueMembers.tsx
	- League membership and member details.

- DraftSettings.tsx
	- Configure draft timing/order settings.

- Draft.tsx
	- Draft page/view.

- Players.tsx
	- Player browser with filters/table interactions.

- MyTeam.tsx
	- Team-specific roster view.

### src/components (reusable UI)

- Layout.tsx
	- Shared page shell/wrapper around routes.

- LeagueCard.tsx, LeagueInfoCard.tsx
	- League summary/info display components.

- LMNote.tsx
	- League manager/league note display.

- MyTeamCard.tsx
	- Team card UI for team pages.

- PlayerDataRow.tsx, PlayerDataTableCard.tsx
	- Player table row/container components.

- PlayerImage.tsx, UnknownPlayerIcon.tsx
	- Player avatar rendering/fallback visuals.

- PlayersFilterCard.tsx
	- Filter section wrapper for player search/filtering.

#### src/components/shared

Generic components meant to be reused across pages/features:

- Button.tsx
- Card.tsx
- Dropdown.tsx
- Toggle.tsx
- Tabs.tsx
- Calendar.tsx
- SearchInput.tsx
- StatQualifier.tsx

### src/services

- api.ts
	- Central API layer.
	- Defines TypeScript interfaces for backend data.
	- Exposes fetch/update helpers for players, teams, leagues, and draft settings.
	- Uses backend base URL: http://localhost:8000/api

### src/constants

- filterOptions.ts
	- Shared filter option values used in player/filter UI.

### src/styles

Styles are split by purpose:

- Top-level CSS files (for example Home.css, Players.css, Draft.css)
	- Page or feature-specific styling.

- styles/shared/
	- CSS for shared reusable components.
	- Includes Variables.css for common design variables.

- styles/filters/
	- Player filtering controls styles.

- styles/tables/
	- Table, pagination, and stat-grid styles.

## Route List (from App.tsx)

- /login
- /signup
- /home
- /join-league
- /create-league
- /league-selection
- /league/:leagueId
- /league/:leagueId/draft-settings
- /league/:leagueId/draft
- /league/:leagueId/members
- /league/:leagueId/my-team
- /league/:leagueId/team/:teamId
- /players
- / redirects to /login

## Backend Connection Notes

- Backend is expected at http://localhost:8000
- Frontend API calls are centralized in src/services/api.ts
- CORS must allow frontend origin for local development
