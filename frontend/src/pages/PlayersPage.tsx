import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { ApiError } from "@/services/api"
import { listPlayers } from "@/services/players"
import type { PaginatedResponse, Player } from "@/types/league"

import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { TeamLogo } from "@/components/TeamLogo"
import { PositionChip } from "@/components/PositionChip"
import { StatusBadge } from "@/components/StatusBadge"
import { StatTable, type ColumnDef, type SortState } from "@/components/StatTable"
import { cn } from "@/lib/utils"

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"] as const
type Position = typeof POSITIONS[number]

const NBA_TEAMS = [
  "All", "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK", "OKC",
  "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]

type StatKey = "min" | "fg_pct" | "ft_pct" | "fg3_pct" | "fg3m" | "reb" | "ast" | "stl" | "blk" | "tov" | "pts" | "fppg" | "gp" | "ts_pct" | "efg_pct"

function trueShooting(s: { pts: number; fga: number; fta: number } | null | undefined): number | null {
  if (!s) return null
  const denom = 2 * (s.fga + 0.44 * s.fta)
  if (denom <= 0) return null
  return s.pts / denom
}

function effectiveFg(s: { fgm: number; fga: number; fg3m: number } | null | undefined): number | null {
  if (!s || s.fga <= 0) return null
  return (s.fgm + 0.5 * s.fg3m) / s.fga
}

const DEFAULT_SORT: SortState = { key: "fppg", dir: "desc" }

export function PlayersPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<PaginatedResponse<Player> | null>(null)
  const [position, setPosition] = useState<Position>("All")
  const [search, setSearch] = useState("")
  const [team, setTeam] = useState<string>("All")
  const [health, setHealth] = useState<"all" | "healthy" | "injured">("all")
  const [availability, setAvailability] = useState<"all" | "available">("all")
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [minFppg, setMinFppg] = useState("")
  const [minGp, setMinGp] = useState("")
  const [minMin, setMinMin] = useState("")
  const [loading, setLoading] = useState(false)

  const ordering = useMemo(() => `${sort.dir === "desc" ? "-" : ""}${sort.key}`, [sort])

  useEffect(() => {
    setLoading(true)
    listPlayers({
      position: position === "All" ? undefined : position,
      team: team === "All" ? undefined : team,
      search: search || undefined,
      health,
      page,
      ordering,
      min_fppg: minFppg ? Number(minFppg) : undefined,
      min_gp: minGp ? Number(minGp) : undefined,
      min_min: minMin ? Number(minMin) : undefined,
      available_in_league: availability === "available" && leagueId ? Number(leagueId) : undefined,
    })
      .then(setData)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load players."
        toast.error(message)
      })
      .finally(() => setLoading(false))
  }, [position, team, search, health, availability, page, leagueId, ordering, minFppg, minGp, minMin])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.count / 50))
  }, [data])

  const handleSortChange = (next: SortState | null) => {
    setSort(next ?? DEFAULT_SORT)
    setPage(1)
  }

  const columns = useMemo<ColumnDef<Player>[]>(() => [
    {
      key: "name",
      header: "Player",
      width: 280,
      accessor: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{p.full_name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PositionChip position={p.primary_position} />
              {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
              <span className="text-xs text-muted-foreground font-medium">{p.team_abbr || "FA"}</span>
              <StatusBadge status={p.injury_status} />
            </div>
          </div>
        </div>
      ),
      sortValue: (p) => p.full_name.toLowerCase(),
    },
    statCol("gp", "GP", (p) => p.current_season?.games_played, 0),
    statCol("min", "MIN", (p) => p.current_season?.minutes, 1),
    statCol("pts", "PTS", (p) => p.current_season?.pts, 1),
    statCol("reb", "REB", (p) => p.current_season?.reb, 1),
    statCol("ast", "AST", (p) => p.current_season?.ast, 1),
    statCol("stl", "STL", (p) => p.current_season?.stl, 1),
    statCol("blk", "BLK", (p) => p.current_season?.blk, 1),
    statCol("tov", "TO",  (p) => p.current_season?.tov, 1),
    statCol("fg3m", "3PM", (p) => p.current_season?.fg3m, 1),
    statCol("fg_pct", "FG%", (p) => p.current_season?.fg_pct, 3, true),
    statCol("ft_pct", "FT%", (p) => p.current_season?.ft_pct, 3, true),
    statCol("fg3_pct", "3P%", (p) => p.current_season?.fg3_pct, 3, true),
    statCol("ts_pct", "TS%", (p) => trueShooting(p.current_season), 3, true),
    statCol("efg_pct", "eFG%", (p) => effectiveFg(p.current_season), 3, true),
    {
      key: "fppg",
      header: "FPPG",
      isStat: true,
      width: 70,
      accessor: (p) => {
        const v = p.current_season?.fantasy_ppg
        return v != null ? <span className="font-bold text-primary">{v.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>
      },
      sortValue: (p) => p.current_season?.fantasy_ppg ?? -1,
    },
  ], [])

  const top3 = useMemo(() => {
    if (!data) return []
    return [...data.results]
      .filter(p => p.current_season?.fantasy_ppg != null)
      .sort((a, b) => (b.current_season!.fantasy_ppg) - (a.current_season!.fantasy_ppg))
      .slice(0, 3)
  }, [data])

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-display text-4xl md:text-5xl text-foreground leading-none">PLAYERS</div>
          <p className="text-sm text-muted-foreground mt-2">
            All current NBA players. Click a row to see season averages and game log.
          </p>
        </div>
      </header>

      {top3.length === 3 && page === 1 && (
        <div>
          <div className="text-eyebrow text-primary mb-2">Top 3 · FPPG</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3.map((p, i) => (
              <button
                key={p.id}
                onClick={() => leagueId && navigate(`/leagues/${leagueId}/players/${p.id}`)}
                className="group relative flex items-center gap-3 surface-elevated px-4 py-3 text-left hover:border-primary/50 transition-colors"
              >
                <div className="text-display text-3xl text-primary leading-none w-8 text-center">{i + 1}</div>
                <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{p.full_name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <PositionChip position={p.primary_position} />
                    {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
                    <span className="text-[11px] text-muted-foreground font-medium">{p.team_abbr || "FA"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="stat-display text-2xl text-primary leading-none">
                    {p.current_season!.fantasy_ppg.toFixed(1)}
                  </div>
                  <div className="text-eyebrow mt-1">FPPG</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {POSITIONS.map((p) => {
            const active = position === p
            return (
              <button
                key={p}
                onClick={() => { setPosition(p); setPage(1) }}
                className={cn(
                  "px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-md border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                )}
              >
                {p}
                {p === "All" && data?.count != null && (
                  <span className="ml-1.5 text-[10px] opacity-70">({data.count})</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search player name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={team} onValueChange={(v) => { setTeam(v); setPage(1) }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NBA_TEAMS.map((t) => <SelectItem key={t} value={t}>{t === "All" ? "All teams" : t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={health} onValueChange={(v) => { setHealth(v as typeof health); setPage(1) }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All health</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="injured">Injured</SelectItem>
            </SelectContent>
          </Select>
          {leagueId && (
            <ToggleGroup
              type="single"
              size="sm"
              value={availability}
              onValueChange={(v) => { if (v) { setAvailability(v as "all" | "available"); setPage(1) } }}
              variant="outline"
            >
              <ToggleGroupItem value="all" aria-label="All players" className="px-3">All</ToggleGroupItem>
              <ToggleGroupItem value="available" aria-label="Available" className="px-3">Free Agents</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-eyebrow text-muted-foreground">Thresholds</span>
          <ThresholdInput label="FPPG" value={minFppg} onChange={(v) => { setMinFppg(v); setPage(1) }} />
          <ThresholdInput label="MIN" value={minMin} onChange={(v) => { setMinMin(v); setPage(1) }} />
          <ThresholdInput label="GP" value={minGp} onChange={(v) => { setMinGp(v); setPage(1) }} />
          {(minFppg || minMin || minGp) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setMinFppg(""); setMinMin(""); setMinGp(""); setPage(1) }}
            >
              Reset thresholds
            </Button>
          )}
        </div>
      </div>

      {data === null ? (
        <Skeleton className="h-[600px]" />
      ) : (
        <div className={cn(loading && "opacity-60 transition-opacity")}>
          <StatTable
            columns={columns}
            rows={data.results}
            sort={sort}
            onSortChange={handleSortChange}
            rowKey={(p) => p.id}
            onRowClick={(p) => leagueId && navigate(`/leagues/${leagueId}/players/${p.id}`)}
            sticky
            emptyMessage="No players match those filters."
          />
        </div>
      )}

      {data && data.count > 50 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing <span className="text-foreground font-medium">{Math.min((page - 1) * 50 + 1, data.count)}–{Math.min(page * 50, data.count)}</span> of <span className="text-foreground font-medium">{data.count}</span>
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1.5 text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ThresholdInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="h-7 w-16 text-xs px-2"
      />
    </label>
  )
}

function statCol(key: StatKey, header: string, get: (p: Player) => number | null | undefined, decimals: number, isPct = false): ColumnDef<Player> {
  return {
    key,
    header,
    isStat: true,
    width: 64,
    accessor: (p) => {
      const v = get(p)
      if (v == null) return <span className="text-muted-foreground">—</span>
      return isPct ? (v * 100).toFixed(1) : v.toFixed(decimals)
    },
    sortValue: (p) => {
      const v = get(p)
      return v == null ? -Infinity : v
    },
  }
}
