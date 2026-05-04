import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { TeamLogo } from "@/components/TeamLogo"
import { PositionChip } from "@/components/PositionChip"
import { StatusBadge } from "@/components/StatusBadge"
import type { Player, PlayerLight } from "@/types/league"

type AnyPlayer = Player | PlayerLight

interface BaseProps {
  player: AnyPlayer
  variant?: "mini" | "row" | "card" | "hero"
  showStats?: boolean
  className?: string
  leagueId?: string | number
  onClick?: () => void
}

export function PlayerCard({ player, variant = "row", showStats = false, className, leagueId, onClick }: BaseProps) {
  if (variant === "mini") return <Mini player={player} className={className} />
  if (variant === "card") return <CardVariant player={player} showStats={showStats} className={className} leagueId={leagueId} onClick={onClick} />
  if (variant === "hero") return <Hero player={player} className={className} />
  return <Row player={player} className={className} onClick={onClick} />
}

function Row({ player, className, onClick }: { player: AnyPlayer; className?: string; onClick?: () => void }) {
  const fppg = "fantasy_ppg" in player ? player.fantasy_ppg : player.current_season?.fantasy_ppg ?? null
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <PlayerHeadshot nbaPlayerId={player.nba_player_id} fullName={player.full_name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-sm truncate">{player.full_name}</div>
          <StatusBadge status={player.injury_status} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PositionChip position={player.primary_position} />
          {player.team_abbr && <TeamLogo teamAbbr={player.team_abbr} size={16} />}
          <span className="font-medium">{player.team_abbr || "FA"}</span>
        </div>
      </div>
      {fppg != null && (
        <div className="text-right">
          <div className="stat-num font-bold text-sm">{fppg.toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">FPPG</div>
        </div>
      )}
    </div>
  )
}

function Mini({ player, className }: { player: AnyPlayer; className?: string }) {
  const lastName = ("last_name" in player && player.last_name) || player.full_name.split(" ").slice(-1)[0] || player.full_name
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <PlayerHeadshot nbaPlayerId={player.nba_player_id} fullName={player.full_name} size="xs" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate leading-tight">{lastName}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <PositionChip position={player.primary_position} />
          <span className="text-[10px] text-muted-foreground">{player.team_abbr}</span>
        </div>
      </div>
    </div>
  )
}

function CardVariant({ player, showStats, className, leagueId, onClick }: { player: AnyPlayer; showStats?: boolean; className?: string; leagueId?: string | number; onClick?: () => void }) {
  const fppg = "fantasy_ppg" in player ? player.fantasy_ppg : player.current_season?.fantasy_ppg ?? null
  const inner = (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <PlayerHeadshot nbaPlayerId={player.nba_player_id} fullName={player.full_name} size="md" rounded={false} />
      <div className="text-center w-full">
        <div className="font-semibold text-sm leading-tight truncate">{player.full_name}</div>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <PositionChip position={player.primary_position} />
          {player.team_abbr && <TeamLogo teamAbbr={player.team_abbr} size={16} />}
          <span className="text-xs text-muted-foreground">{player.team_abbr || "FA"}</span>
          <StatusBadge status={player.injury_status} />
        </div>
      </div>
      {showStats && fppg != null && (
        <div className="border-t border-border pt-2 w-full text-center">
          <div className="text-display text-2xl text-primary">{fppg.toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">FPPG</div>
        </div>
      )}
    </div>
  )
  if (leagueId) {
    return <Link to={`/leagues/${leagueId}/players/${player.id}`} className="block">{inner}</Link>
  }
  return inner
}

function Hero({ player, className }: { player: AnyPlayer; className?: string }) {
  const isFull = "height_inches" in player
  const heightStr = isFull && player.height_inches ? formatHeight(player.height_inches) : null
  const weightStr = isFull && player.weight_lbs ? `${player.weight_lbs} lb` : null
  const jersey = isFull && player.jersey_number ? player.jersey_number : null

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <PlayerHeadshot nbaPlayerId={player.nba_player_id} fullName={player.full_name} size="lg" rounded={false} className="ring-4 ring-primary/20 shadow-2xl shadow-primary/10" />
      <div>
        <div className="text-display text-4xl md:text-6xl text-foreground leading-none">{player.full_name}</div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {player.team_abbr && <TeamLogo teamAbbr={player.team_abbr} size={48} />}
          <span className="text-xl font-semibold">{player.team_abbr || "Free Agent"}</span>
          <PositionChip position={player.primary_position} size="md" />
          <StatusBadge status={player.injury_status} />
        </div>
        {(heightStr || weightStr || jersey) && (
          <div className="flex items-center gap-x-5 gap-y-1 mt-3 flex-wrap text-sm">
            {jersey && (
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-eyebrow text-muted-foreground">No.</span>
                <span className="stat-num text-base font-bold text-foreground">{jersey}</span>
              </span>
            )}
            {heightStr && (
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-eyebrow text-muted-foreground">HT</span>
                <span className="stat-num text-base font-bold text-foreground">{heightStr}</span>
              </span>
            )}
            {weightStr && (
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-eyebrow text-muted-foreground">WT</span>
                <span className="stat-num text-base font-bold text-foreground">{weightStr}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12)
  const inch = inches % 12
  return `${ft}-${inch}`
}
