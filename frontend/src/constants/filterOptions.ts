// Filter options and constants used across the app

export const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F"];

export const FILTER_OPTIONS = [
    "All",
    "Available",
    "On Waivers",
    "Free Agents",
    "On Rosters",
];

export const HEALTH_OPTIONS = ["All", "IR-Eligible", "Healthy"];

export const WATCH_LIST_OPTIONS = ["All", "On Watch List", "Not On Watch List"];

export const PLAYING_OPTIONS = ["All", "Today's Games"];

export const STAT_QUALIFIER_OPTIONS = [
    "Off",
    "GP",
    "MPG",
    "PPG",
    "APG",
    "RPG",
    "SPG",
    "BPG",
    "TOPG",
];

export const NBA_TEAMS = [
    "All",
    "ATL",
    "BOS",
    "BRK",
    "CLE",
    "CHI",
    "DAL",
    "DEN",
    "DET",
    "GSW",
    "HOU",
    "LAC",
    "LAL",
    "MEM",
    "MIA",
    "MIL",
    "MIN",
    "NOP",
    "NYK",
    "OKC",
    "ORL",
    "PHI",
    "PHX",
    "POR",
    "SAC",
    "SAS",
    "TOR",
    "UTA",
    "WAS",
];

export const SEASON_OPTIONS = [
    { label: "2026 Season", value: "2025-26", period: "season" as const },
    { label: "Last 7", value: "2025-26", period: "last7" as const },
    { label: "Last 15", value: "2025-26", period: "last15" as const },
    { label: "Last 30", value: "2025-26", period: "last30" as const },
    { label: "2025 Season", value: "2024-25", period: "season" as const },
];
