import { apiFetch } from "@/services/api"
import type { Trade } from "@/types/league"

export function listTrades(leagueId: number): Promise<Trade[]> {
  return apiFetch<{ results?: Trade[] } | Trade[]>(`/api/leagues/${leagueId}/trades/`).then(
    (data) => (Array.isArray(data) ? data : data.results ?? []),
  )
}

export interface ProposeTradePayload {
  recipient_team_id: number
  proposer_player_ids: number[]
  recipient_player_ids: number[]
  note?: string
}

export function proposeTrade(leagueId: number, payload: ProposeTradePayload): Promise<Trade> {
  return apiFetch<Trade>(`/api/leagues/${leagueId}/trades/propose/`, {
    method: "POST",
    body: payload,
  })
}

export function respondToTrade(tradeId: number, action: "accept" | "reject" | "cancel"): Promise<Trade> {
  return apiFetch<Trade>(`/api/trades/${tradeId}/respond/`, {
    method: "POST",
    body: { action },
  })
}
