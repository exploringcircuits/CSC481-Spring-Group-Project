import { apiFetch } from "@/services/api"
import type { PaginatedResponse, Player, PlayerGameStats } from "@/types/league"

export interface PlayerFilters {
  position?: string
  team?: string
  search?: string
  health?: "all" | "healthy" | "injured"
  available_in_league?: number
  page?: number
  ordering?: string
  min_fppg?: number
  min_pts?: number
  min_min?: number
  min_gp?: number
}

export function listPlayers(filters: PlayerFilters = {}): Promise<PaginatedResponse<Player>> {
  const params = new URLSearchParams()
  if (filters.position && filters.position !== "All") params.set("position", filters.position)
  if (filters.team && filters.team !== "All") params.set("team", filters.team)
  if (filters.search) params.set("search", filters.search)
  if (filters.health && filters.health !== "all") params.set("health", filters.health)
  if (filters.available_in_league) {
    params.set("available_in_league", String(filters.available_in_league))
  }
  if (filters.ordering) params.set("ordering", filters.ordering)
  if (filters.min_fppg != null) params.set("min_fppg", String(filters.min_fppg))
  if (filters.min_pts != null) params.set("min_pts", String(filters.min_pts))
  if (filters.min_min != null) params.set("min_min", String(filters.min_min))
  if (filters.min_gp != null) params.set("min_gp", String(filters.min_gp))
  if (filters.page) params.set("page", String(filters.page))
  const qs = params.toString()
  return apiFetch<PaginatedResponse<Player>>(`/api/players/${qs ? `?${qs}` : ""}`)
}

export function getPlayer(id: number): Promise<Player> {
  return apiFetch<Player>(`/api/players/${id}/`)
}

export function getPlayerGameLog(id: number, limit = 10): Promise<PlayerGameStats[]> {
  return apiFetch<PlayerGameStats[]>(`/api/players/${id}/game-log/?limit=${limit}`)
}
