# Fantasy Basketball Frontend

React + TypeScript + Vite frontend for the Fantasy Basketball application.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

App available at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
npm run preview  # Preview the build
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── shared/          # Reusable components
│   │   │   ├── Button, Card, Dropdown, Tabs, Toggle, Calendar, StatQualifier
│   │   ├── pages/           # Page components
│   │   │   ├── Home, Login, SignUp, Players, LeagueHome, LeagueSelection, etc.
│   │   └── [Other components]
│   ├── styles/
│   │   ├── shared/          # Reusable component styles
│   │   ├── filters/         # Filter UI styles
│   │   ├── tables/          # Table & grid styles
│   │   └── [Page styles]
│   ├── services/            # api.ts (Django REST client)
│   ├── constants/           # filterOptions.ts (data lists)
│   ├── App.tsx, main.tsx, index.css
│   └── [Other files]
├── public/                  # Static assets
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## Shared Components

7 reusable components for common UI patterns:

- **Button** - Button with variants
- **Dropdown** - Select menu with click-outside detection
- **Toggle** - Toggle switch
- **Tabs** - Tab navigation
- **Calendar** - Date picker
- **Card** - Card wrapper with title
- **StatQualifier** - Stat filter with range slider

## Pages

- **Home** - League navigation and stats overview
- **Players** - Advanced player browser with filtering, sorting, compare mode
- **Login / SignUp** - Authentication
- **LeagueSelection** - List of user's leagues
- **LeagueHome** - League dashboard and standings
- **CreateLeague / JoinLeague** - League management

## Key Features

- Real-time player filtering (position, team, health, stats)
- Sortable stats table with compare mode
- Stat mode toggle (totals vs per-game averages)
- Date range filtering
- Responsive design

## Architecture

- **Vite 7.3.1** - Build tool with HMR
- **React 19.2.0** - UI framework
- **TypeScript 5.6** - Type safety
- **CSS Variables** - Consistent theming (in `styles/shared/Variables.css`)
- **API Client** - Centralized requests in `services/api.ts`

## Notes

- Connects to Django backend at `http://localhost:8000`
- All API requests use `services/api.ts`
- CORS must be enabled in Django settings
- Components follow single-responsibility principle
- Full TypeScript coverage throughout
