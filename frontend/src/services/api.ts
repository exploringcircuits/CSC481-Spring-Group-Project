// API service for fetching NBA player data from Django backend

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
    return await response.json();
};
