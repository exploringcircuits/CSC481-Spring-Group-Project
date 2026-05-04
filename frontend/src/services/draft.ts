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

export function startDraft(leagueId: number): Promise<Draft> {
  return apiFetch<Draft>(`/api/leagues/${leagueId}/draft/start/`, {
    method: "POST",
    body: {},
  })
}

export type DraftControlAction = "pause" | "resume" | "undo" | "reset"

export function draftControl(leagueId: number, action: DraftControlAction): Promise<Draft> {
  return apiFetch<Draft>(`/api/leagues/${leagueId}/draft/control/`, {
    method: "POST",
    body: { action },
  })
}
