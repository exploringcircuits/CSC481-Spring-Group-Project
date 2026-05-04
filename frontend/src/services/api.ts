// API service for fetching NBA player data from Django backend

import { getToken } from './auth';

// Returns headers with Authorization token attached for protected endpoints
const authHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
});

const API_BASE_URL = 'http://localhost:8000/api';

export interface PlayerStats {
    id: number;
    season: string;
    period_type: string;
    games_played: number;
    min_total: number;
    min_avg: number;
    fgm_total: number;
    fga_total: number;
    fg_pct: number;
    fgm_avg: number;
    fga_avg: number;
    ftm_total: number;
    fta_total: number;
    ft_pct: number;
    ftm_avg: number;
    fta_avg: number;
    fg3m_total: number;
    fg3a_total: number;
    fg3_pct: number;
    fg3m_avg: number;
    reb_total: number;
    reb_avg: number;
    oreb_total: number;
    dreb_total: number;
    ast_total: number;
    ast_avg: number;
    stl_total: number;
    stl_avg: number;
    blk_total: number;
    blk_avg: number;
    tov_total: number;
    tov_avg: number;
    pts_total: number;
    pts_avg: number;
    plus_minus_total: number;
    plus_minus_avg: number;
    fantasy_points_total: number;
    fantasy_points_avg: number;
}

export interface Player {
    id: number;
    player_id: number;
    full_name: string;
    team_abbreviation: string | null;
    position: string | null;
    roster_status: 'FA' | 'RW' | 'IL';
    is_healthy: boolean;
    injury_status: string | null;
    roster_percent: number;
    current_stats: PlayerStats | null;
}

export interface PlayersResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Player[];
}

export interface PlayerFilters {
    position?: string;
    team?: string;
    status?: string;
    health?: string;
    search?: string;
    ordering?: string;
    stat_period?: string;
    season?: string;
    page?: number;
}

export const fetchPlayers = async (filters: PlayerFilters = {}): Promise<PlayersResponse> => {
    const params = new URLSearchParams();
    
    // Add filters to query params
    if (filters.position && filters.position !== 'All Players' && filters.position !== 'All') {
        params.append('position', filters.position);
    }
    if (filters.team && filters.team !== 'All') {
        params.append('team', filters.team);
    }
    if (filters.status && filters.status !== 'All') {
        params.append('status', filters.status);
    }
    if (filters.health && filters.health !== 'All') {
        params.append('health', filters.health);
    }
    if (filters.search) {
        params.append('search', filters.search);
    }
    if (filters.ordering) {
        params.append('ordering', filters.ordering);
    }
    if (filters.stat_period) {
        params.append('stat_period', filters.stat_period);
    }
    if (filters.season) {
        params.append('season', filters.season);
    }
    if (filters.page) {
        params.append('page', filters.page.toString());
    }
    
    const url = `${API_BASE_URL}/players/?${params.toString()}`;
    console.log('Fetching from:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
};

export const fetchTeams = async (): Promise<{abbreviation: string, name: string}[]> => {
    const response = await fetch(`${API_BASE_URL}/players/teams/`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const teams: { abbreviation: string; name: string }[] = await response.json();
    const uniqueTeamMap = new Map<string, string>();

    for (const team of teams) {
        const abbreviation = team.abbreviation?.trim();
        if (!abbreviation || uniqueTeamMap.has(abbreviation)) {
            continue;
        }

        uniqueTeamMap.set(abbreviation, team.name || abbreviation);
    }

    return Array.from(uniqueTeamMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([abbreviation, name]) => ({ abbreviation, name }));
};

export interface DraftSettings {
    scheduled_date: string;
    time_per_pick: number;
    draft_order: 'RANDOM' | 'CUSTOM';
    draft_type: string;
}

export interface LeagueMember {
    id: number;
    email: string;
    display_name: string;
    slot: number;
    is_commissioner: boolean;
}

export interface LeagueTeam {
    id: number;
    name: string;
    member: LeagueMember;
}

export interface LeagueDraft {
    status: string;
    draft_type: string;
    scheduled_date: string | null;
    time_per_pick: number;
    draft_order: 'RANDOM' | 'CUSTOM';
}

export interface LeagueDetails {
    id: number;
    name: string;
    commissioner_email: string;
    max_players: number;
    status: string;
    members: LeagueMember[];
    teams: LeagueTeam[];
    draft: LeagueDraft | null;
}

export interface LeagueListItem {
    id: number;
    name: string;
    max_players: number;
    status: string;
}

export interface LeagueListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: LeagueListItem[];
}

export const fetchDraftSettings = async (leagueId: number): Promise<DraftSettings> => {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/draft-settings/`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
};

export const updateDraftSettings = async (
    leagueId: number,
    settings: DraftSettings,
): Promise<DraftSettings> => {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/draft-settings/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            scheduled_date: settings.scheduled_date,
            time_per_pick: settings.time_per_pick,
            draft_order: settings.draft_order,
        }),
    });

    if (!response.ok) {
        let detail = `HTTP error! status: ${response.status}`;
        try {
            const data = await response.json();
            detail = data?.error || data?.detail || JSON.stringify(data);
        } catch {
            // Keep fallback detail.
        }
        throw new Error(detail);
    }

    return await response.json();
};

export const fetchLeague = async (leagueId: number): Promise<LeagueDetails> => {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
};

export const resetDraftSettings = async (leagueId: number): Promise<DraftSettings> => {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/draft-settings/reset/`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
};

export const createExampleLeague = async (): Promise<LeagueDetails> => {
    const response = await fetch(`${API_BASE_URL}/leagues/seed-example/`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
};

export const fillLeagueWithBots = async (leagueId: number): Promise<{ added_count: number }> => {
    const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/fill-bots/`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
};

export const fetchLeagues = async (): Promise<LeagueListItem[]> => {
    const response = await fetch(`${API_BASE_URL}/leagues/`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: LeagueListResponse | LeagueListItem[] = await response.json();
    return Array.isArray(data) ? data : (data.results ?? []);
};
