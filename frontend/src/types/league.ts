import type { User } from "@/types/auth"

export interface PlayerSeasonAverage {
  season: string
  games_played: number
  minutes: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgm: number
  fga: number
  ftm: number
  fta: number
  fg3m: number
  fg3a: number
  fg_pct: number
  ft_pct: number
  fg3_pct: number
  fantasy_ppg: number
}

export interface Player {
  id: number
  slug: string
  full_name: string
  first_name: string
  last_name: string
  team_abbr: string
  primary_position: string
  eligible_positions: string[]
  is_active: boolean
  is_injured: boolean
  injury_status: string
  height_inches: number | null
  weight_lbs: number | null
  jersey_number: string
  nba_player_id: number | null
  current_season: PlayerSeasonAverage | null
  season_averages: PlayerSeasonAverage[]
}

export interface PlayerLight {
  id: number
  full_name: string
  team_abbr: string
  primary_position: string
  is_active: boolean
  is_injured: boolean
  injury_status: string
  nba_player_id: number | null
  fantasy_ppg: number | null
}

export interface PlayerGameStats {
  id: number
  game_date: string
  minutes: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgm: number
  fga: number
  ftm: number
  fta: number
  fg3m: number
  did_play: boolean
}

export interface LeagueMember {
  id: number
  slot: number
  is_bot: boolean
  is_commissioner: boolean
  bot_name: string
  user: User | null
  display_name: string
}

export interface TeamLight {
  id: number
  name: string
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  record: string
  member: LeagueMember
  /** Optional, only populated by the standings endpoint. */
  last_5?: ("W" | "L" | "T")[]
}

export interface RosterEntry {
  id: number
  player: PlayerLight
  acquired_at: string
  acquired_via: "draft" | "trade" | "free_agent"
}

export interface TeamDetail extends TeamLight {
  roster_entries: RosterEntry[]
}

export interface RosterSlot {
  slot: string
  allowed: string[]
  starter: boolean
}

export interface LeagueListItem {
  id: number
  name: string
  season_label: string
  status: string
  max_teams: number
  regular_season_weeks: number
  playoff_team_count: number
  current_week_number: number
  invite_code: string
  member_count: number
  is_commissioner: boolean
}

export interface LeagueDetail {
  id: number
  name: string
  season_label: string
  status: "setup" | "drafting" | "regular" | "playoffs" | "complete"
  max_teams: number
  regular_season_weeks: number
  playoff_team_count: number
  current_week_number: number
  scoring_weights: Record<string, number>
  roster_template: RosterSlot[]
  lineup_lock_mode: "weekly" | "daily"
  trade_review_mode: "auto" | "commissioner" | "league_vote"
  invite_code: string
  commissioner: User
  members: LeagueMember[]
  teams: TeamLight[]
  is_commissioner: boolean
  my_team_id: number | null
  created_at: string
}

export interface Matchup {
  id: number
  home_team: TeamLight
  away_team: TeamLight
  home_score: number
  away_score: number
  winner: TeamLight | null
  is_settled: boolean
}

export interface Week {
  id: number
  week_number: number
  start_date: string
  end_date: string
  is_playoff: boolean
  playoff_round: string
  is_settled: boolean
  matchups: Matchup[]
}

export interface DraftSelection {
  id: number
  pick_number: number
  round_number: number
  selected_at: string
  player: PlayerLight
  member: LeagueMember
}

export interface Draft {
  id: number
  status: "not_started" | "in_progress" | "complete"
  draft_order: number[]
  current_pick_index: number
  started_at: string | null
  completed_at: string | null
  is_paused: boolean
  on_the_clock: number | null
  selections: DraftSelection[]
}

export interface TradeAsset {
  id: number
  player: PlayerLight
  from_team: TeamLight
  to_team: TeamLight
}

export interface Trade {
  id: number
  status: "proposed" | "accepted" | "rejected" | "cancelled" | "processed"
  proposer: TeamLight
  recipient: TeamLight
  proposed_at: string
  responded_at: string | null
  processed_at: string | null
  note: string
  assets: TradeAsset[]
}

export interface LineupEntry {
  id: number
  game_date: string
  slot: string
  player: PlayerLight
}

export interface Transaction {
  id: number
  type: string
  summary: string
  payload: Record<string, unknown>
  team: TeamLight | null
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
