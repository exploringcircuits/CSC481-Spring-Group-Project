import { apiFetch } from "@/services/api"
import type { LineupEntry, TeamDetail } from "@/types/league"

export function getTeam(id: number): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/api/teams/${id}/`)
}

export function getLineup(teamId: number, weekId?: number): Promise<LineupEntry[]> {
  const qs = weekId ? `?week_id=${weekId}` : ""
  return apiFetch<LineupEntry[]>(`/api/teams/${teamId}/lineup/${qs}`)
}

export function setLineup(
  teamId: number,
  weekId: number,
  assignments: Record<string, number>,
): Promise<LineupEntry[]> {
  return apiFetch<LineupEntry[]>(`/api/teams/${teamId}/lineup/`, {
    method: "POST",
    body: { week_id: weekId, assignments },
  })
}
