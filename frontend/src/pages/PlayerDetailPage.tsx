import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { ApiError } from "@/services/api"
import { getPlayer, getPlayerGameLog } from "@/services/players"
import type { Player, PlayerGameStats, PlayerSeasonAverage } from "@/types/league"

import { PlayerCard } from "@/components/PlayerCard"
import { StatTable, type ColumnDef } from "@/components/StatTable"

export function PlayerDetailPage() {
  const { leagueId, playerId } = useParams<{ leagueId: string; playerId: string }>()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Player | null>(null)
  const [gameLog, setGameLog] = useState<PlayerGameStats[] | null>(null)

  useEffect(() => {
    if (!playerId) return
    const id = Number(playerId)
    getPlayer(id).then(setPlayer).catch((err) => {
      const msg = err instanceof ApiError ? err.message : "Could not load player."
      toast.error(msg)
    })
    getPlayerGameLog(id, 10).then(setGameLog).catch(() => {
      // game log is optional — just leave null
    })
  }, [playerId])

  const gameLogColumns = useMemo<ColumnDef<PlayerGameStats>[]>(() => [
    {
      key: "game_date",
      header: "Date",
      width: 100,
      accessor: (g) => new Date(g.game_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      sortValue: (g) => g.game_date,
    },
    statCol("min", "MIN", (g) => g.minutes, 0),
    statCol("pts", "PTS", (g) => g.pts, 0),
    statCol("reb", "REB", (g) => g.reb, 0),
    statCol("ast", "AST", (g) => g.ast, 0),
    statCol("stl", "STL", (g) => g.stl, 0),
    statCol("blk", "BLK", (g) => g.blk, 0),
    statCol("tov", "TO",  (g) => g.tov, 0),
    statCol("fgm", "FGM", (g) => g.fgm, 0),
    statCol("fga", "FGA", (g) => g.fga, 0),
    statCol("ftm", "FTM", (g) => g.ftm, 0),
    statCol("fg3m", "3PM", (g) => g.fg3m, 0),
  ], [])

  const careerColumns = useMemo<ColumnDef<PlayerSeasonAverage>[]>(() => [
    {
      key: "season",
      header: "Season",
      width: 100,
      accessor: (s) => <span className="font-bold">{s.season}</span>,
      sortValue: (s) => s.season,
    },
    statCol("gp",  "GP",  (s) => s.games_played, 0),
    statCol("min", "MIN", (s) => s.minutes, 1),
    statCol("pts", "PTS", (s) => s.pts, 1),
    statCol("reb", "REB", (s) => s.reb, 1),
    statCol("ast", "AST", (s) => s.ast, 1),
    statCol("stl", "STL", (s) => s.stl, 1),
    statCol("blk", "BLK", (s) => s.blk, 1),
    statCol("tov", "TO",  (s) => s.tov, 1),
    statColPct("fg_pct",  "FG%", (s) => s.fg_pct),
    statColPct("fg3_pct", "3P%", (s) => s.fg3_pct),
    statColPct("ft_pct",  "FT%", (s) => s.ft_pct),
    {
      key: "fppg",
      header: "FPPG",
      isStat: true,
      accessor: (s) => <span className="font-bold text-primary">{s.fantasy_ppg?.toFixed(1) ?? "—"}</span>,
      sortValue: (s) => s.fantasy_ppg ?? -Infinity,
    },
  ], [])

  if (!player) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const seasonAvg: PlayerSeasonAverage | null = player.current_season
  const careerSeasons = player.season_averages ?? []

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(leagueId ? `/leagues/${leagueId}/players` : "/leagues")}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All players
      </Button>

      {/* Hero */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="gradient-hero-dark px-6 md:px-10 py-8">
          <PlayerCard player={player} variant="hero" />
        </div>
      </div>

      {/* Season averages stat strip */}
      {seasonAvg && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 pt-3 pb-1 flex items-end justify-between border-b border-border/50">
            <div>
              <div className="text-eyebrow text-primary">{seasonAvg.season} season averages</div>
              <div className="text-display text-2xl">PER GAME</div>
            </div>
            <div className="text-right">
              <div className="text-eyebrow text-muted-foreground">Games</div>
              <div className="stat-display text-2xl">{seasonAvg.games_played}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 divide-x divide-border/50">
            <StripStat label="MIN" value={seasonAvg.minutes.toFixed(1)} />
            <StripStat label="PTS" value={seasonAvg.pts.toFixed(1)} highlight />
            <StripStat label="REB" value={seasonAvg.reb.toFixed(1)} />
            <StripStat label="AST" value={seasonAvg.ast.toFixed(1)} />
            <StripStat label="STL" value={seasonAvg.stl.toFixed(1)} />
            <StripStat label="BLK" value={seasonAvg.blk.toFixed(1)} />
            <StripStat label="TO" value={seasonAvg.tov.toFixed(1)} />
            <StripStat label="3PM" value={seasonAvg.fg3m.toFixed(1)} />
            <StripStat label="FG%" value={`${(seasonAvg.fg_pct * 100).toFixed(1)}`} />
            <StripStat label="3P%" value={`${(seasonAvg.fg3_pct * 100).toFixed(1)}`} />
            <StripStat label="FT%" value={`${(seasonAvg.ft_pct * 100).toFixed(1)}`} />
            <StripStat label="FPPG" value={seasonAvg.fantasy_ppg?.toFixed(1) ?? "—"} highlight />
          </div>
        </div>
      )}

      {/* Shooting detail */}
      {seasonAvg && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 pt-3 pb-1 border-b border-border/50">
            <div className="text-eyebrow text-primary">Shooting detail</div>
            <div className="text-display text-2xl">VOLUME &amp; EFFICIENCY</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-y md:divide-y-0 divide-border/50">
            <ShootingCell label="Field goals" made={seasonAvg.fgm} attempts={seasonAvg.fga} pct={seasonAvg.fg_pct} />
            <ShootingCell label="3-pointers"  made={seasonAvg.fg3m} attempts={seasonAvg.fg3a} pct={seasonAvg.fg3_pct} />
            <ShootingCell label="Free throws" made={seasonAvg.ftm} attempts={seasonAvg.fta} pct={seasonAvg.ft_pct} />
            <DerivedCell label="True shooting" tooltip="PTS / (2 × (FGA + 0.44 × FTA))" value={trueShootingPct(seasonAvg)} />
            <DerivedCell label="Effective FG"  tooltip="(FGM + 0.5 × 3PM) / FGA"      value={effectiveFgPct(seasonAvg)} />
          </div>
        </div>
      )}

      {/* Career table — when more than one season is on file */}
      {careerSeasons.length > 1 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div>
              <div className="text-eyebrow text-primary">Career</div>
              <div className="text-display text-2xl">SEASON BY SEASON</div>
            </div>
          </div>
          <StatTable
            columns={careerColumns}
            rows={careerSeasons}
            rowKey={(s) => s.season}
            dense
            sticky={false}
            className="border-0 rounded-none"
          />
        </div>
      )}

      {/* Recent game log */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <div className="text-eyebrow text-primary">Last 10 games</div>
            <div className="text-display text-2xl">GAME LOG</div>
          </div>
        </div>
        {gameLog === null ? (
          <Skeleton className="h-48 m-4" />
        ) : gameLog.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground text-center">No games on record.</div>
        ) : (
          <StatTable
            columns={gameLogColumns}
            rows={gameLog}
            rowKey={(g) => g.id}
            dense
            sticky={false}
            className="border-0 rounded-none"
          />
        )}
      </div>
    </div>
  )
}

function trueShootingPct(s: PlayerSeasonAverage): string {
  const denom = 2 * (s.fga + 0.44 * s.fta)
  if (denom <= 0) return "—"
  return `${((s.pts / denom) * 100).toFixed(1)}`
}

function effectiveFgPct(s: PlayerSeasonAverage): string {
  if (s.fga <= 0) return "—"
  return `${(((s.fgm + 0.5 * s.fg3m) / s.fga) * 100).toFixed(1)}`
}

function ShootingCell({ label, made, attempts, pct }: { label: string; made: number; attempts: number; pct: number }) {
  return (
    <div className="px-4 py-4 text-center">
      <div className="stat-display text-2xl text-foreground leading-none">
        {made.toFixed(1)} <span className="text-muted-foreground text-base">/</span> {attempts.toFixed(1)}
      </div>
      <div className="text-eyebrow mt-1.5">{label}</div>
      <div className="stat-num text-xs text-primary mt-1">{(pct * 100).toFixed(1)}%</div>
    </div>
  )
}

function DerivedCell({ label, tooltip, value }: { label: string; tooltip: string; value: string }) {
  return (
    <div className="px-4 py-4 text-center" title={tooltip}>
      <div className="stat-display text-2xl text-primary leading-none">{value}</div>
      <div className="text-eyebrow mt-1.5">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-1">advanced</div>
    </div>
  )
}

function StripStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="px-3 py-3 text-center">
      <div className={highlight
        ? "stat-display text-2xl text-primary leading-none"
        : "stat-display text-2xl text-foreground leading-none"}>
        {value}
      </div>
      <div className="text-eyebrow mt-1">{label}</div>
    </div>
  )
}

function statCol<T>(key: string, header: string, get: (g: T) => number | null | undefined, decimals: number): ColumnDef<T> {
  return {
    key,
    header,
    isStat: true,
    accessor: (g) => {
      const v = get(g)
      if (v == null) return "—"
      return v.toFixed(decimals)
    },
    sortValue: (g) => get(g) ?? -Infinity,
  }
}

function statColPct<T>(key: string, header: string, get: (g: T) => number | null | undefined): ColumnDef<T> {
  return {
    key,
    header,
    isStat: true,
    accessor: (g) => {
      const v = get(g)
      if (v == null) return "—"
      return (v * 100).toFixed(1)
    },
    sortValue: (g) => get(g) ?? -Infinity,
  }
}
