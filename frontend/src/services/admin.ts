import { apiFetch } from "@/services/api"

export interface AdminLeagueSummary {
  id: number
  name: string
  status: string
  current_week_number: number
  team_count: number
  draft_status: string
  draft_picks: number
  regular_weeks_total: number
  regular_weeks_settled: number
  playoff_weeks_total: number
  playoff_weeks_settled: number
  standings_top: Array<{ name: string; record: string; points_for: number }>
}

export interface AdminStatus {
  leagues: AdminLeagueSummary[]
  totals: {
    leagues: number
    members: number
    teams: number
    roster_entries: number
    weeks: number
    matchups: number
    trades: number
    transactions: number
    players: number
  }
}

export function getAdminStatus(): Promise<AdminStatus> {
  return apiFetch<AdminStatus>("/api/admin/status/")
}

export function adminReset(): Promise<{ detail: string }> {
  return apiFetch("/api/admin/reset/", { method: "POST" })
}

export function adminSeedDemo(): Promise<unknown> {
  return apiFetch("/api/admin/seed-demo/", { method: "POST" })
}

export function adminRunDraft(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/run-draft/`, { method: "POST" })
}

export function adminBuildSchedule(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/build-schedule/`, { method: "POST" })
}

export function adminSetDefaultLineups(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/set-default-lineups/`, { method: "POST" })
}

export function adminAdvanceWeek(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/advance-week/`, { method: "POST" })
}

export function adminSimulateToPlayoffs(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/simulate-to-playoffs/`, { method: "POST" })
}

export function adminStartPlayoffs(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/start-playoffs/`, { method: "POST" })
}

export function adminSimulateNext(leagueId: number): Promise<{ detail: string }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/simulate-next/`, { method: "POST" })
}

export function adminExampleTrade(leagueId: number): Promise<{ detail: string; trade_id?: number }> {
  return apiFetch(`/api/admin/leagues/${leagueId}/example-trade/`, { method: "POST" })
}
