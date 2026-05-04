# Fantasy Hoops — frontend

React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui. Single-page app,
JWT auth, ten routes, all backed by the Django API at `/api/*` (proxied
through Vite in dev).

```
frontend/
├── package.json              React 19, Vite 7, Tailwind 4, shadcn deps
├── vite.config.ts            Tailwind plugin + @/ alias + /api proxy
├── tsconfig.json             references app + node configs
├── tsconfig.app.json         app TS settings (strict + path alias)
├── tsconfig.node.json        Node-side build tooling
├── eslint.config.js
├── components.json           shadcn/ui config
├── index.html                Vite mount point
├── public/                   static assets served at /
└── src/
    ├── main.tsx              React entry point (StrictMode + App)
    ├── App.tsx               BrowserRouter + AuthProvider + Toaster + Routes
    ├── index.css             Tailwind import + shadcn theme variables
    ├── components/
    │   ├── ProtectedRoute.tsx        auth gate (redirects to /login)
    │   ├── layout/
    │   │   └── Layout.tsx            top nav + league context tabs + user menu
    │   └── ui/                       shadcn primitives (button, card, dialog…)
    ├── pages/                Route components — one file per page
    │   ├── LoginPage.tsx
    │   ├── SignUpPage.tsx
    │   ├── LeagueSelectionPage.tsx
    │   ├── LeagueHomePage.tsx
    │   ├── DraftPage.tsx
    │   ├── MyTeamPage.tsx
    │   ├── StandingsPage.tsx
    │   ├── BracketPage.tsx
    │   ├── TradesPage.tsx
    │   ├── PlayersPage.tsx
    │   └── AdminPanelPage.tsx
    ├── services/             API client per domain
    │   ├── api.ts            apiFetch wrapper + ApiError class
    │   ├── auth.ts           login / register / logout / fetchMe / refresh
    │   ├── leagues.ts        list / get / create / join / standings / weeks / transactions
    │   ├── teams.ts          getTeam / getLineup / setLineup
    │   ├── draft.ts          getDraft / makePick
    │   ├── trades.ts         listTrades / proposeTrade / respondToTrade
    │   ├── players.ts        listPlayers / getPlayer
    │   └── admin.ts          all the demo control-panel endpoints
    ├── contexts/
    │   └── AuthContext.tsx   provider holding {user, isAuthenticated, isStaff, login, register, logout, refresh}
    ├── hooks/
    │   └── useAuth.ts        thin wrapper around useContext(AuthContext)
    ├── lib/
    │   ├── storage.ts        typed localStorage helpers (tokens + user)
    │   └── utils.ts          cn() helper for Tailwind class merging (from shadcn)
    └── types/
        ├── auth.ts           User, LoginResponse, RegisterPayload, LoginPayload
        └── league.ts         Player, League, Team, Week, Matchup, Draft, Trade, …
```

## Running

```bash
npm install     # one-time
npm run dev     # dev server on http://localhost:5173
```

Vite dev-proxies `/api/*` to `http://127.0.0.1:8000` (the Django backend), so
make sure that's running too. From the project root, the standard workflow is
two terminals — see the top-level [`README.md`](../README.md) for full setup.

```bash
npm run build   # tsc -b && vite build
npm run preview # serve the production build locally
npm run lint    # ESLint
```

## Routes

| Path | Component | Auth | Purpose |
|---|---|---|---|
| `/login` | `LoginPage` | public | Sign in |
| `/signup` | `SignUpPage` | public | Create account; auto-logs in on success |
| `/leagues` | `LeagueSelectionPage` | required | List user's leagues + create / join dialogs |
| `/leagues/:leagueId` | `LeagueHomePage` | required | League dashboard |
| `/leagues/:leagueId/draft` | `DraftPage` | required | Draft board, picks, on-the-clock |
| `/leagues/:leagueId/team` | `MyTeamPage` | required | Your team — roster + lineup |
| `/leagues/:leagueId/team/:teamId` | `MyTeamPage` | required | Any team (read-only when not yours) |
| `/leagues/:leagueId/standings` | `StandingsPage` | required | W-L-T + PF/PA table |
| `/leagues/:leagueId/bracket` | `BracketPage` | required | Playoff bracket visual |
| `/leagues/:leagueId/trades` | `TradesPage` | required | Trade list + propose / accept / reject |
| `/leagues/:leagueId/players` | `PlayersPage` | required | All NBA players (filterable) |
| `/admin` | `AdminPanelPage` | site admin | One-click demo presenter shortcuts |
| `/`, `/*` | redirect | — | Fallback → `/leagues` |

## Auth flow

1. User submits the **Sign in** form → `services/auth.login(...)` posts to
   `/api/auth/login/`, gets back `{access, refresh, user}`, stores tokens +
   user in `localStorage` via `lib/storage.ts`.
2. `AuthContext` exposes the user via the `useAuth()` hook to every component.
3. Every API call goes through `services/api.apiFetch(path, options)`, which
   automatically attaches `Authorization: Bearer <access>` when a token is
   present (unless the call is marked `anonymous`).
4. `ProtectedRoute` (an `Outlet` wrapper) reads `isAuthenticated` from
   `AuthContext` and redirects to `/login` if missing, preserving the original
   path for post-login return.
5. On mount, `AuthContext` calls `/api/auth/me/` to refresh the cached user
   if a token exists. If `me` fails (e.g. expired token), tokens are cleared
   and the user lands on `/login`.

`isStaff` derives from `User.is_staff` and gates the **Admin** button in the
top nav and the entire `/admin` route.

## Styling

- **Tailwind v4** via `@tailwindcss/vite`. CSS-only config — `src/index.css`
  is a single `@import "tailwindcss";` plus shadcn's theme variables.
- **shadcn/ui** primitives live in `src/components/ui/` (copy-paste components
  styled with Tailwind, built on Radix primitives). Add more with
  `npx shadcn@latest add <name>` — they land in this directory.
- The `cn()` helper at `src/lib/utils.ts` is the conditional-class pattern.
- Geist Variable font via `@fontsource-variable/geist`.
- Toast notifications via `sonner` — mounted once in `App.tsx`, dispatched
  with `import { toast } from "sonner"`.
- Dark-mode plumbing is in place (`.dark` class triggers OKLCH variables in
  `index.css`) but not wired to a toggle — desktop demo defaults to light.

## API client conventions

`services/api.ts` exposes:

- `apiFetch<T>(path, options)` — single entry point for every backend call.
  Prepends `API_BASE` (empty in dev — Vite proxy handles `/api/*`), attaches
  auth headers, JSON-encodes object bodies, parses non-2xx responses into a
  typed `ApiError` (`status`, `message`, `body`).
- `ApiError extends Error` — thrown for any non-2xx response. Carries the
  parsed payload (DRF field errors, `{detail}` strings, etc) so call sites
  can render friendly messages.

Per-domain modules (`leagues.ts`, `teams.ts`, etc.) are thin wrappers — each
function is a one-liner that calls `apiFetch` with the right URL and shape.

## Build & type-check

```bash
npm run build
```

Runs `tsc -b` (strict mode + `noUnusedLocals` + `noUnusedParameters`) then
`vite build`. Recent build: 1,904 modules, 463 KB JS (143 KB gzip), 64 KB CSS
(11 KB gzip), in ~6s.

## Backend connection

| Env | URL |
|---|---|
| Dev (Vite proxy) | `http://localhost:5173/api/*` → `http://127.0.0.1:8000/api/*` |
| Prod | Set `VITE_API_URL` to the deployed backend's origin at build time. |

In dev the proxy means CORS isn't on the path; same-origin all the way. The
backend's `CORS_ALLOWED_ORIGINS` setting is a fallback for clients that bypass
the proxy.
