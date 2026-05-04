import { apiFetch } from "@/services/api"
import type {
  LeagueDetail,
  LeagueListItem,
  TeamLight,
  Transaction,
  Week,
} from "@/types/league"

export interface CreateLeaguePayload {
  name: string
  season_label?: string
  max_teams?: number
  regular_season_weeks?: number
  playoff_team_count?: number
  team_name?: string
}

export function listLeagues(): Promise<LeagueListItem[]> {
  return apiFetch<{ results?: LeagueListItem[] } | LeagueListItem[]>("/api/leagues/").then(
    (data) => (Array.isArray(data) ? data : data.results ?? []),
  )
}

export function getLeague(id: number): Promise<LeagueDetail> {
  return apiFetch<LeagueDetail>(`/api/leagues/${id}/`)
}

export function createLeague(payload: CreateLeaguePayload): Promise<LeagueDetail> {
  return apiFetch<LeagueDetail>("/api/leagues/", { method: "POST", body: payload })
}

export function joinLeague(invite_code: string, team_name?: string): Promise<LeagueDetail> {
  return apiFetch<LeagueDetail>("/api/leagues/join/", {
    method: "POST",
    body: { invite_code, team_name },
  })
}

export function getStandings(leagueId: number): Promise<TeamLight[]> {
  return apiFetch<TeamLight[]>(`/api/leagues/${leagueId}/standings/`)
}

export function listWeeks(leagueId: number): Promise<Week[]> {
  return apiFetch<{ results?: Week[] } | Week[]>(`/api/leagues/${leagueId}/weeks/`).then(
    (data) => (Array.isArray(data) ? data : data.results ?? []),
  )
}

export function getWeek(leagueId: number, weekNumber: number): Promise<Week> {
  return apiFetch<Week>(`/api/leagues/${leagueId}/weeks/${weekNumber}/`)
}

export function listTransactions(leagueId: number): Promise<Transaction[]> {
  return apiFetch<{ results?: Transaction[] } | Transaction[]>(
    `/api/leagues/${leagueId}/transactions/`,
  ).then((data) => (Array.isArray(data) ? data : data.results ?? []))
}
