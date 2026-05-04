import { apiFetch } from "@/services/api"
import type { Draft } from "@/types/league"

export function getDraft(leagueId: number): Promise<Draft> {
  return apiFetch<Draft>(`/api/leagues/${leagueId}/draft/`)
}

export function makePick(leagueId: number, playerId: number): Promise<Draft> {
  return apiFetch<Draft>(`/api/leagues/${leagueId}/draft/pick/`, {
    method: "POST",
    body: { player_id: playerId },
  })
}
