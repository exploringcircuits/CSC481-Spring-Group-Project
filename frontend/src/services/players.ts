import { apiFetch } from "@/services/api"
import type { PaginatedResponse, Player, PlayerLight } from "@/types/league"

export interface PlayerFilters {
  position?: string
  team?: string
  search?: string
  available_in_league?: number
  page?: number
}

export function listPlayers(filters: PlayerFilters = {}): Promise<PaginatedResponse<PlayerLight>> {
  const params = new URLSearchParams()
  if (filters.position && filters.position !== "All") params.set("position", filters.position)
  if (filters.team && filters.team !== "All") params.set("team", filters.team)
  if (filters.search) params.set("search", filters.search)
  if (filters.available_in_league) {
    params.set("available_in_league", String(filters.available_in_league))
  }
  if (filters.page) params.set("page", String(filters.page))
  const qs = params.toString()
  return apiFetch<PaginatedResponse<PlayerLight>>(`/api/players/${qs ? `?${qs}` : ""}`)
}

export function getPlayer(id: number): Promise<Player> {
  return apiFetch<Player>(`/api/players/${id}/`)
}
