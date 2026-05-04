import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Search, Settings2, Zap, BarChart3, LayoutGrid, Pause, Play, Undo2, RotateCcw, Gauge } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ApiError } from "@/services/api"
import { adminRunDraft } from "@/services/admin"
import { getDraft, makePick, startDraft, draftControl, type DraftControlAction } from "@/services/draft"
import { getLeague } from "@/services/leagues"
import { getTeam } from "@/services/teams"
import { listPlayers } from "@/services/players"
import { useAuth } from "@/hooks/useAuth"
import type {
  Draft,
  LeagueDetail,
  PaginatedResponse,
  Player,
  RosterSlot,
  TeamDetail,
} from "@/types/league"

import { PickClock } from "@/components/PickClock"
import { DraftBoard } from "@/components/DraftBoard"
import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { TeamLogo } from "@/components/TeamLogo"
import { PositionChip } from "@/components/PositionChip"
import { StatusBadge } from "@/components/StatusBadge"
import { StatTable, type ColumnDef, type SortState } from "@/components/StatTable"
import { cn } from "@/lib/utils"

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"] as const
const DEFAULT_SORT: SortState = { key: "fppg", dir: "desc" }

export function DraftPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const id = Number(leagueId)
  const { user, isStaff } = useAuth()

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [players, setPlayers] = useState<PaginatedResponse<Player> | null>(null)
  const [myTeamDetail, setMyTeamDetail] = useState<TeamDetail | null>(null)
  const [position, setPosition] = useState<typeof POSITIONS[number]>("All")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [minFppg, setMinFppg] = useState("")
  const [confirming, setConfirming] = useState<Player | null>(null)
  const [picking, setPicking] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pollMs, setPollMs] = useState(3000)
  const [controlBusy, setControlBusy] = useState<DraftControlAction | "start" | null>(null)

  const ordering = useMemo(() => `${sort.dir === "desc" ? "-" : ""}${sort.key}`, [sort])

  useEffect(() => {
    if (!id) return
    refresh()
  }, [id])

  // Poll the draft state while in progress. Speed configurable.
  useEffect(() => {
    if (!id || draft?.status !== "in_progress") return
    const t = setInterval(() => {
      getDraft(id).then(setDraft).catch(() => {})
    }, pollMs)
    return () => clearInterval(t)
  }, [id, draft?.status, pollMs])

  useEffect(() => {
    if (!id) return
    listPlayers({
      position: position === "All" ? undefined : position,
      search: search || undefined,
      available_in_league: id,
      ordering,
      min_fppg: minFppg ? Number(minFppg) : undefined,
    })
      .then(setPlayers)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load players."
        toast.error(message)
      })
  }, [id, position, search, draft?.current_pick_index, ordering, minFppg])

  // Pull our roster (live, refreshed when picks tick) so the right rail can
  // show what's already drafted to us.
  useEffect(() => {
    if (!league?.my_team_id) return
    getTeam(league.my_team_id).then(setMyTeamDetail).catch(() => {})
  }, [league?.my_team_id, draft?.current_pick_index])

  async function refresh() {
    try {
      const [l, d] = await Promise.all([getLeague(id), getDraft(id)])
      setLeague(l)
      setDraft(d)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not load draft."
      toast.error(message)
    }
  }

  const onClockMember = useMemo(() => {
    if (!league || !draft || draft.on_the_clock === null) return null
    return league.members.find((m) => m.id === draft.on_the_clock) ?? null
  }, [league, draft])

  const myMember = useMemo(() => {
    if (!league || !user) return null
    return league.members.find((m) => m.user?.id === user.id) ?? null
  }, [league, user])

  const isMyPick = !!(onClockMember && myMember && onClockMember.id === myMember.id)
  const canPickAsAdmin = isStaff && draft?.status === "in_progress"

  async function handlePickConfirmed(playerId: number) {
    if (!id) return
    setPicking(true)
    try {
      const updated = await makePick(id, playerId)
      setDraft(updated)
      toast.success("Pick made.")
      setConfirming(null)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Pick failed."
      toast.error(message)
    } finally {
      setPicking(false)
    }
  }

  async function handleAutoFill() {
    if (!id || !isStaff) return
    setAutoFilling(true)
    try {
      await adminRunDraft(id)
      await refresh()
      toast.success("Bot picks auto-filled.")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Auto-fill failed."
      toast.error(message)
    } finally {
      setAutoFilling(false)
    }
  }

  async function handleStartDraft() {
    if (!id) return
    setStarting(true)
    setControlBusy("start")
    try {
      const updated = await startDraft(id)
      setDraft(updated)
      toast.success("Draft started.")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not start draft."
      toast.error(message)
    } finally {
      setStarting(false)
      setControlBusy(null)
    }
  }

  async function handleControl(action: DraftControlAction) {
    if (!id) return
    setControlBusy(action)
    try {
      const updated = await draftControl(id, action)
      setDraft(updated)
      const labels = { pause: "Paused.", resume: "Resumed.", undo: "Last pick undone.", reset: "Draft reset." }
      toast.success(labels[action])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : `Could not ${action}.`
      toast.error(message)
    } finally {
      setControlBusy(null)
    }
  }

  if (!league || !draft) {
    return <Skeleton className="h-72" />
  }

  const rounds = league.roster_template.length
  const totalPicks = draft.draft_order.length * rounds

  // Pre-draft hero
  if (draft.status === "not_started") {
    return (
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-primary">Draft room</div>
            <h1 className="text-display text-5xl md:text-6xl mt-2 leading-[0.9]">{league.name.toUpperCase()}</h1>
          </div>
          <DraftStatusPill status={draft.status} />
        </header>

        <div className="surface-elevated p-10 text-center gradient-spotlight">
          <div className="text-eyebrow text-primary">Pre-draft</div>
          <div className="text-display text-5xl md:text-6xl mt-3">
            Tip-off pending.
          </div>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            The draft hasn't kicked off yet. Configure the rules — type, time-per-pick,
            order — and pick a mode. Then come back here to draft live or watch the
            simulation roll.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Button size="lg" onClick={handleStartDraft} disabled={starting}>
              <Play className="h-4 w-4 mr-2" />
              {starting ? "Starting…" : "Start draft"}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`/leagues/${id}/draft/setup`}>
                <Settings2 className="h-4 w-4 mr-2" />
                Setup
              </Link>
            </Button>
            {isStaff && (
              <Button variant="outline" size="lg" onClick={handleAutoFill} disabled={autoFilling}>
                <Zap className="h-4 w-4 mr-2" />
                {autoFilling ? "Running…" : "Quick-sim entire draft"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4 max-w-md mx-auto">
            "Start draft" flips status to live and auto-fills bot picks until a human is on the clock.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <PreviewTile label="Teams"   value={`${league.teams.length}/${league.max_teams}`} />
          <PreviewTile label="Rounds"  value={String(rounds)} />
          <PreviewTile label="Total picks" value={String(totalPicks)} />
        </div>
      </div>
    )
  }

  const currentRound = Math.floor(draft.current_pick_index / draft.draft_order.length) + 1
  const overallPick = draft.current_pick_index + 1
  const onClockTeamId = onClockMember && league.teams.find((t) => t.member.id === onClockMember.id)?.id
  const onClockPicks = draft.selections.filter((s) => s.member.id === onClockMember?.id).length

  const handleSortChange = (next: SortState | null) => {
    setSort(next ?? DEFAULT_SORT)
  }

  const canPickNow = isMyPick || canPickAsAdmin
  const isCommish = !!league?.is_commissioner || isStaff

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-eyebrow text-primary">Draft room</div>
          <div className="text-display text-4xl md:text-5xl text-foreground leading-none mt-2">{league.name.toUpperCase()}</div>
          <p className="text-sm text-muted-foreground mt-2">
            <span className="text-condensed uppercase">Snake</span> · {draft.draft_order.length} teams · {rounds} rounds · {totalPicks} total picks
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && draft.status === "in_progress" && (
            <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={autoFilling}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {autoFilling ? "Filling…" : "Auto-fill rest"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/leagues/${id}/draft/setup`)}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Setup
          </Button>
          <DraftStatusPill status={draft.status} isPaused={draft.is_paused} />
        </div>
      </div>

      {/* Commissioner controls — visible during in_progress + complete (for reset) */}
      {isCommish && (draft.status === "in_progress" || draft.status === "complete") && (
        <div className="flex flex-wrap items-center gap-2 surface-elevated px-4 py-2.5">
          <span className="text-eyebrow text-primary mr-1">Commish controls</span>
          {draft.status === "in_progress" && (
            draft.is_paused ? (
              <Button size="sm" variant="outline" onClick={() => handleControl("resume")} disabled={controlBusy === "resume"}>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Resume
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleControl("pause")} disabled={controlBusy === "pause"}>
                <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleControl("undo")}
            disabled={controlBusy === "undo" || draft.selections.length === 0}
          >
            <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Undo last
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm("Reset the draft? This wipes every pick and rewinds to pre-draft.")) {
                handleControl("reset")
              }
            }}
            disabled={controlBusy === "reset"}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
          </Button>
          {draft.status === "in_progress" && (
            <div className="flex items-center gap-2 ml-auto">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={String(pollMs)} onValueChange={(v) => setPollMs(Number(v))}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">Fast (1s)</SelectItem>
                  <SelectItem value="3000">Normal (3s)</SelectItem>
                  <SelectItem value="6000">Slow (6s)</SelectItem>
                  <SelectItem value="15000">Lazy (15s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_300px]">
        {/* Left: pick clock + slot rules */}
        <div className="space-y-4">
          <PickClock
            onClockName={onClockMember?.display_name}
            round={currentRound}
            pick={overallPick}
            totalPicks={totalPicks}
            isMyPick={isMyPick}
            status={draft.status}
          />
          <SlotRules
            template={league.roster_template}
            picksTaken={onClockPicks}
            onClockTeamName={onClockMember?.display_name}
          />
        </div>

        {/* Center: tabs (Players default, Board) */}
        <div className="min-w-0">
          <Tabs defaultValue="players" className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="players">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Players
              </TabsTrigger>
              <TabsTrigger value="board">
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Board
              </TabsTrigger>
            </TabsList>
            <TabsContent value="players" className="mt-3 space-y-3">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                {POSITIONS.map((p) => {
                  const active = position === p
                  return (
                    <button
                      key={p}
                      onClick={() => setPosition(p)}
                      className={cn(
                        "px-3 py-1 text-xs font-bold uppercase tracking-wider border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search free agents…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <label className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Min FPPG</span>
                  <Input
                    type="number"
                    min={0}
                    value={minFppg}
                    onChange={(e) => setMinFppg(e.target.value)}
                    placeholder="—"
                    className="h-7 w-16 text-xs px-2"
                  />
                </label>
              </div>
              {!canPickNow && draft.status === "in_progress" && (
                <div className="border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                  Waiting for {onClockMember?.display_name ?? "..."} to pick
                  {isStaff && <> · use <span className="text-primary">Auto-fill rest</span> above</>}
                </div>
              )}
              {players === null ? (
                <Skeleton className="h-[600px]" />
              ) : (
                <DraftPlayerTable
                  players={players.results}
                  sort={sort}
                  onSortChange={handleSortChange}
                  canPick={canPickNow && draft.status === "in_progress"}
                  onPick={(p) => setConfirming(p)}
                />
              )}
            </TabsContent>
            <TabsContent value="board" className="mt-3">
              <DraftBoard draft={draft} members={league.members} rounds={rounds} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: my live roster */}
        <div>
          <MyDraftedCard team={myTeamDetail} />
        </div>
      </div>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm draft pick</DialogTitle>
            <DialogDescription>
              {onClockMember?.display_name} is on the clock at pick {overallPick} ({onClockTeamId ? "your team" : "..."}).
            </DialogDescription>
          </DialogHeader>
          {confirming && (
            <div className="flex items-center gap-3 p-3 bg-secondary/40 border border-border">
              <PlayerHeadshot nbaPlayerId={confirming.nba_player_id} fullName={confirming.full_name} size="md" />
              <div>
                <div className="font-bold text-base">{confirming.full_name}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <PositionChip position={confirming.primary_position} />
                  {confirming.team_abbr && <TeamLogo teamAbbr={confirming.team_abbr} size={24} />}
                  <span className="text-sm text-muted-foreground">{confirming.team_abbr}</span>
                </div>
                {confirming.current_season?.fantasy_ppg != null && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground stat-num">{confirming.current_season.fantasy_ppg.toFixed(1)}</span> FPPG · <span className="stat-num">{confirming.current_season.pts.toFixed(1)}</span> PTS · <span className="stat-num">{confirming.current_season.reb.toFixed(1)}</span> REB · <span className="stat-num">{confirming.current_season.ast.toFixed(1)}</span> AST
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={picking}>Cancel</Button>
            <Button
              onClick={() => confirming && handlePickConfirmed(confirming.id)}
              disabled={picking}
            >
              {picking ? "Drafting…" : "Confirm pick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DraftPlayerTable({
  players,
  sort,
  onSortChange,
  canPick,
  onPick,
}: {
  players: Player[]
  sort: SortState
  onSortChange: (s: SortState | null) => void
  canPick: boolean
  onPick: (p: Player) => void
}) {
  const columns = useMemo<ColumnDef<Player>[]>(() => {
    const stat = (key: string, header: string, get: (p: Player) => number | null | undefined, decimals: number, isPct = false): ColumnDef<Player> => ({
      key,
      header,
      isStat: true,
      width: 56,
      accessor: (p) => {
        const v = get(p)
        if (v == null) return <span className="text-muted-foreground">—</span>
        return isPct ? (v * 100).toFixed(1) : v.toFixed(decimals)
      },
      sortValue: (p) => {
        const v = get(p)
        return v == null ? -Infinity : v
      },
    })
    return [
      {
        key: "name",
        header: "Player",
        width: 240,
        accessor: (p) => (
          <div className="flex items-center gap-2 min-w-0">
            <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{p.full_name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <PositionChip position={p.primary_position} />
                {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
                <span className="text-[11px] text-muted-foreground">{p.team_abbr || "FA"}</span>
                <StatusBadge status={p.injury_status} />
              </div>
            </div>
          </div>
        ),
        sortValue: (p) => p.full_name.toLowerCase(),
      },
      {
        key: "fppg",
        header: "FPPG",
        isStat: true,
        width: 64,
        accessor: (p) => p.current_season?.fantasy_ppg != null
          ? <span className="font-bold text-primary">{p.current_season.fantasy_ppg.toFixed(1)}</span>
          : <span className="text-muted-foreground">—</span>,
        sortValue: (p) => p.current_season?.fantasy_ppg ?? -Infinity,
      },
      stat("gp",  "GP",  (p) => p.current_season?.games_played, 0),
      stat("min", "MIN", (p) => p.current_season?.minutes, 1),
      stat("pts", "PTS", (p) => p.current_season?.pts, 1),
      stat("reb", "REB", (p) => p.current_season?.reb, 1),
      stat("ast", "AST", (p) => p.current_season?.ast, 1),
      stat("stl", "STL", (p) => p.current_season?.stl, 1),
      stat("blk", "BLK", (p) => p.current_season?.blk, 1),
      stat("tov", "TO",  (p) => p.current_season?.tov, 1),
      stat("fg3m", "3PM", (p) => p.current_season?.fg3m, 1),
      stat("fg_pct", "FG%", (p) => p.current_season?.fg_pct, 3, true),
      stat("fg3_pct", "3P%", (p) => p.current_season?.fg3_pct, 3, true),
      stat("ft_pct", "FT%", (p) => p.current_season?.ft_pct, 3, true),
    ]
  }, [])

  return (
    <StatTable
      columns={columns}
      rows={players.slice(0, 80)}
      sort={sort}
      onSortChange={onSortChange}
      rowKey={(p) => p.id}
      onRowClick={canPick ? onPick : undefined}
      sticky
      dense
      emptyMessage="No free agents match those filters."
    />
  )
}

function MyDraftedCard({ team }: { team: TeamDetail | null }) {
  return (
    <div className="border border-border bg-card overflow-hidden flex flex-col h-[80vh]">
      <div className="px-4 py-3 border-b border-border bg-secondary/40">
        <div className="text-eyebrow text-primary">Your roster</div>
        <div className="text-condensed text-xl uppercase tracking-wide">{team?.name ?? "—"}</div>
      </div>
      {team === null ? (
        <Skeleton className="h-full m-3" />
      ) : team.roster_entries.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No picks yet — your selections will appear here.
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 divide-y divide-border/40">
          {team.roster_entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2 px-3 py-2">
              <div className="text-display text-lg w-6 text-center text-muted-foreground">{i + 1}</div>
              <PlayerHeadshot nbaPlayerId={entry.player.nba_player_id} fullName={entry.player.full_name} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{entry.player.full_name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <PositionChip position={entry.player.primary_position} />
                  <span className="text-[10px] text-muted-foreground">{entry.player.team_abbr}</span>
                </div>
              </div>
              {entry.player.fantasy_ppg != null && (
                <div className="text-right">
                  <div className="stat-display text-sm text-primary leading-none">{entry.player.fantasy_ppg.toFixed(1)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">FPPG</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-elevated px-5 py-4">
      <div className="text-eyebrow">{label}</div>
      <div className="stat-display text-3xl mt-1">{value}</div>
    </div>
  )
}

function DraftStatusPill({ status, isPaused = false }: { status: Draft["status"]; isPaused?: boolean }) {
  if (status === "in_progress" && isPaused) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 border text-eyebrow bg-amber-500/15 text-amber-400 border-amber-500/40">
        <Pause className="h-3 w-3" />
        Paused
      </span>
    )
  }
  const map: Record<Draft["status"], { label: string; tone: string }> = {
    not_started: { label: "Pre-draft", tone: "bg-secondary text-muted-foreground border-border" },
    in_progress: { label: "Live", tone: "bg-primary/15 text-primary border-primary/40" },
    complete:    { label: "Complete", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
  }
  const m = map[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 border text-eyebrow", m.tone)}>
      {status === "in_progress" && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
      {m.label}
    </span>
  )
}

function SlotRules({ template, picksTaken, onClockTeamName }: { template: RosterSlot[]; picksTaken: number; onClockTeamName?: string | null }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-eyebrow">Roster slots</div>
      <div className="text-sm font-semibold mt-1 truncate">{onClockTeamName ?? "—"}</div>
      <div className="mt-3 grid grid-cols-2 gap-1">
        {template.map((s) => (
          <div key={s.slot} className="flex items-center justify-between gap-2 px-2 py-1 bg-secondary/40 text-xs">
            <span className={cn("font-bold uppercase tracking-wider", s.starter ? "text-foreground" : "text-muted-foreground")}>
              {s.slot}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {s.allowed.join("/")}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <span className="font-semibold text-foreground stat-num">{picksTaken}</span> of {template.length} picks made
      </div>
    </div>
  )
}
