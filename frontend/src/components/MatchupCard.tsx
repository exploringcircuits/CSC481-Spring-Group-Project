import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { TeamAvatar } from "@/components/TeamAvatar"
import type { Matchup } from "@/types/league"

type Variant = "compact" | "full" | "bracket"

interface Props {
  matchup: Matchup
  variant?: Variant
  leagueId?: string | number
  className?: string
}

export function MatchupCard({ matchup, variant = "compact", leagueId, className }: Props) {
  const { home_team, away_team, home_score, away_score, is_settled, winner } = matchup
  const homeWon = winner?.id === home_team?.id
  const awayWon = winner?.id === away_team?.id

  if (variant === "bracket") {
    return (
      <div className={cn("rounded-md border border-border bg-card overflow-hidden min-w-[220px]", className)}>
        <TeamRow team={away_team} score={away_score} won={awayWon} settled={is_settled} compact />
        <div className="border-t border-border" />
        <TeamRow team={home_team} score={home_score} won={homeWon} settled={is_settled} compact />
      </div>
    )
  }

  if (variant === "full") {
    return (
      <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
        <div className="bg-muted/50 px-4 py-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span>{is_settled ? "Final" : "In progress"}</span>
          {!is_settled && <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />Live</span>}
        </div>
        <TeamRow team={away_team} score={away_score} won={awayWon} settled={is_settled} />
        <div className="border-t border-border" />
        <TeamRow team={home_team} score={home_score} won={homeWon} settled={is_settled} />
      </div>
    )
  }

  // compact
  const inner = (
    <div className={cn("rounded-md border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors", className)}>
      <TeamRow team={away_team} score={away_score} won={awayWon} settled={is_settled} compact />
      <TeamRow team={home_team} score={home_score} won={homeWon} settled={is_settled} compact />
    </div>
  )
  if (leagueId) {
    return <Link to={`/leagues/${leagueId}`} className="block">{inner}</Link>
  }
  return inner
}

interface TeamRowProps {
  team: Matchup["home_team"]
  score: number
  won: boolean
  settled: boolean
  compact?: boolean
}

function TeamRow({ team, score, won, settled, compact }: TeamRowProps) {
  const padding = compact ? "px-3 py-2" : "px-4 py-3"
  const showWinner = settled && won
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 transition-colors",
        padding,
        showWinner && "bg-primary/5",
        !won && settled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <TeamAvatar name={team?.name} size={compact ? 24 : 32} />
        <div className="min-w-0">
          <div className={cn("font-semibold truncate", compact ? "text-sm" : "text-base", showWinner && "text-primary")}>
            {team?.name ?? "TBD"}
          </div>
          {!compact && team?.record && (
            <div className="text-xs text-muted-foreground">{team.record}</div>
          )}
        </div>
      </div>
      <div className={cn("stat-num font-bold tabular-nums", compact ? "text-base" : "text-2xl")}>
        {settled || score > 0 ? score.toFixed(1) : "—"}
      </div>
    </div>
  )
}
