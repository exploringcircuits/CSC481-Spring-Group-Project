/**
 * NBA CDN URL helpers.
 *
 * Headshots: NBA's official stats CDN, keyed by stats.nba.com PERSON_ID.
 * Logos: NBA's official CDN, keyed by team ID. Backend stores 3-letter
 * abbreviations (BBR-style), so we map them through TEAM_ID_BY_ABBR.
 */

export type HeadshotSize = "sm" | "lg"

const PLAYER_FALLBACK = "/fallbacks/player-silhouette.svg"
const TEAM_FALLBACK = "/fallbacks/team-fallback.svg"

const TEAM_ID_BY_ABBR: Record<string, string> = {
  ATL: "1610612737",
  BOS: "1610612738",
  BKN: "1610612751",
  BRK: "1610612751",
  NJN: "1610612751",
  CHA: "1610612766",
  CHO: "1610612766",
  CHH: "1610612766",
  CHI: "1610612741",
  CLE: "1610612739",
  DAL: "1610612742",
  DEN: "1610612743",
  DET: "1610612765",
  GSW: "1610612744",
  HOU: "1610612745",
  IND: "1610612754",
  LAC: "1610612746",
  SDC: "1610612746",
  LAL: "1610612747",
  MEM: "1610612763",
  MIA: "1610612748",
  MIL: "1610612749",
  MIN: "1610612750",
  NOP: "1610612740",
  NOH: "1610612740",
  NOK: "1610612740",
  NYK: "1610612752",
  OKC: "1610612760",
  SEA: "1610612760",
  ORL: "1610612753",
  PHI: "1610612755",
  PHX: "1610612756",
  PHO: "1610612756",
  POR: "1610612757",
  SAC: "1610612758",
  KCK: "1610612758",
  SAS: "1610612759",
  TOR: "1610612761",
  UTA: "1610612762",
  WAS: "1610612764",
  WSB: "1610612764",
}

export function playerHeadshotUrl(
  nbaPlayerId: number | null | undefined,
  size: HeadshotSize = "sm",
): string {
  if (!nbaPlayerId) return PLAYER_FALLBACK
  const dim = size === "lg" ? "1040x760" : "260x190"
  return `https://cdn.nba.com/headshots/nba/latest/${dim}/${nbaPlayerId}.png`
}

export function teamLogoUrl(teamAbbr: string | null | undefined): string {
  if (!teamAbbr) return TEAM_FALLBACK
  const teamId = TEAM_ID_BY_ABBR[teamAbbr.toUpperCase()]
  if (!teamId) return TEAM_FALLBACK
  return `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`
}

export const PLAYER_HEADSHOT_FALLBACK = PLAYER_FALLBACK
export const TEAM_LOGO_FALLBACK = TEAM_FALLBACK
