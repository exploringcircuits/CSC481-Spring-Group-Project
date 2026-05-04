import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ApiError } from "@/services/api"
import { getLeague, getStandings, listWeeks } from "@/services/leagues"
import { getLineup, getTeam, setLineup } from "@/services/teams"
import { getPlayer } from "@/services/players"
import type {
  LeagueDetail,
  Player,
  PlayerLight,
  RosterSlot,
  TeamDetail,
  TeamLight,
  Week,
} from "@/types/league"

import { TeamAvatar } from "@/components/TeamAvatar"
import { RosterSlotGrid } from "@/components/RosterSlotGrid"
import { LineupEditorModal } from "@/components/LineupEditorModal"
import { MatchupCard } from "@/components/MatchupCard"
import { StatTable, type ColumnDef } from "@/components/StatTable"
import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { PositionChip } from "@/components/PositionChip"
import { StatusBadge } from "@/components/StatusBadge"
import { TeamLogo } from "@/components/TeamLogo"
import { cn } from "@/lib/utils"

export function MyTeamPage() {
  const { leagueId, teamId } = useParams<{ leagueId: string; teamId?: string }>()
  const navigate = useNavigate()
  const lid = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [fullPlayers, setFullPlayers] = useState<Player[]>([])
  const [standings, setStandings] = useState<TeamLight[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null)
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [editingSlot, setEditingSlot] = useState<RosterSlot | null>(null)

  useEffect(() => {
    if (!lid) return
    let cancelled = false
    getLeague(lid)
      .then(async (l) => {
        if (cancelled) return
        setLeague(l)
        const targetId = teamId ? Number(teamId) : l.my_team_id
        if (!targetId) { if (!cancelled) setTeam(null); return }
        const t = await getTeam(targetId)
        if (cancelled) return
        setTeam(t)
        // Eager-fetch full Player data for the roster (gives us full stat columns)
        const players = await Promise.all(
          t.roster_entries.map((r) => getPlayer(r.player.id).catch(() => null)),
        )
        if (cancelled) return
        setFullPlayers(players.filter((p): p is Player => p !== null))
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load team."
        if (!cancelled) toast.error(message)
      })
    getStandings(lid).then((s) => { if (!cancelled) setStandings(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [lid, teamId])

  useEffect(() => {
    if (!lid) return
    listWeeks(lid).then((ws) => {
      setWeeks(ws)
      const current = ws.find((w) => w.week_number === (league?.current_week_number ?? 1))
      if (current) setActiveWeekId(current.id)
      else if (ws[0]) setActiveWeekId(ws[0].id)
    }).catch(() => {})
  }, [lid, league?.current_week_number])

  useEffect(() => {
    if (!team || !activeWeekId) return
    getLineup(team.id, activeWeekId)
      .then((entries) => {
        const seen = new Set<string>()
        const draft: Record<string, number> = {}
        for (const e of entries) {
          if (seen.has(e.slot)) continue
          seen.add(e.slot)
          draft[e.slot] = e.player.id
        }
        setAssignments(draft)
      })
      .catch(() => {})
  }, [team?.id, activeWeekId])

  const isOwner = useMemo(() => !!team && !!league && team.id === league.my_team_id, [team, league])

  const playerById = useMemo(() => {
    if (!team) return new Map<number, PlayerLight>()
    return new Map(team.roster_entries.map((r) => [r.player.id, r.player]))
  }, [team])

  const slotAssignments = useMemo(() => {
    const out: Record<string, PlayerLight | null> = {}
    if (!league) return out
    for (const s of league.roster_template) {
      const pid = assignments[s.slot]
      out[s.slot] = pid ? playerById.get(pid) ?? null : null
    }
    return out
  }, [league, assignments, playerById])

  const usedPlayerIds = useMemo(() => new Set(Object.values(assignments)), [assignments])

  const projectedFppg = useMemo(() => {
    if (!league) return 0
    const starters = new Set(league.roster_template.filter((s) => s.starter).map((s) => s.slot))
    let sum = 0
    for (const [slot, pid] of Object.entries(assignments)) {
      if (!starters.has(slot)) continue
      const p = playerById.get(pid)
      if (p?.fantasy_ppg) sum += p.fantasy_ppg
    }
    return sum
  }, [league, assignments, playerById])

  const myRank = useMemo(() => {
    if (!team || !standings.length) return null
    const idx = standings.findIndex((t) => t.id === team.id)
    return idx >= 0 ? idx + 1 : null
  }, [team, standings])

  const teamMatchups = useMemo(() => {
    if (!team) return []
    return weeks.flatMap((w) => w.matchups.filter((m) => m.home_team.id === team.id || m.away_team.id === team.id).map((m) => ({ week: w, matchup: m })))
  }, [weeks, team])

  async function handleAssign(slotName: string, playerId: number | null) {
    if (!team || !activeWeekId) return
    const next: Record<string, number> = { ...assignments }
    if (playerId == null) {
      delete next[slotName]
    } else {
      for (const s of Object.keys(next)) {
        if (next[s] === playerId && s !== slotName) delete next[s]
      }
      next[slotName] = playerId
    }
    setAssignments(next)
    try {
      await setLineup(team.id, activeWeekId, next)
      toast.success("Lineup saved.")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save lineup."
      toast.error(message)
    }
  }

  if (!league || !team) {
    return <Skeleton className="h-72" />
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="surface-elevated overflow-hidden">
        <div className="gradient-brand px-6 md:px-8 py-7 flex items-center gap-5 text-foreground relative overflow-hidden">
          <div className="court-stripe absolute inset-0 pointer-events-none" aria-hidden />
          <TeamAvatar name={team.name} size={64} />
          <div className="min-w-0 flex-1 relative">
            <div className="text-eyebrow text-primary">{isOwner ? "Your team" : "Viewing team"}</div>
            <div className="text-display text-4xl md:text-5xl leading-none truncate mt-1">{team.name.toUpperCase()}</div>
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
              <span>{team.member.display_name}</span>
              {myRank && <><span className="opacity-50">·</span><span>Rank <span className="stat-num font-bold text-primary">#{myRank}</span></span></>}
              {team.member.is_commissioner && <><span className="opacity-50">·</span><span className="text-primary">Commissioner</span></>}
            </div>
          </div>
          {!isOwner && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/leagues/${lid}`)} className="bg-card/40 border-primary/40 text-primary hover:bg-primary/10 relative">
              ← League
            </Button>
          )}
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border border-t border-border">
          <StatBlock label="Record"        value={team.record}                       accent />
          <StatBlock label="Points for"    value={team.points_for.toFixed(1)} />
          <StatBlock label="Points against" value={team.points_against.toFixed(1)} />
          <StatBlock label="Differential" value={(team.points_for - team.points_against >= 0 ? "+" : "") + (team.points_for - team.points_against).toFixed(1)} />
          <StatBlock label="Projected FPPG" value={projectedFppg.toFixed(1)} accent />
        </div>
      </div>

      <Tabs defaultValue="lineup" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="lineup">Lineup</TabsTrigger>
            <TabsTrigger value="roster">Roster stats</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
          {weeks.length > 0 && (
            <Select
              value={activeWeekId ? String(activeWeekId) : undefined}
              onValueChange={(v) => setActiveWeekId(Number(v))}
            >
              <SelectTrigger className="w-44"><SelectValue placeholder="Week…" /></SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    Week {w.week_number}{w.is_playoff ? " (playoffs)" : ""}{w.is_settled ? " · final" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="lineup" className="space-y-4">
          <div className="surface-elevated p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-eyebrow">Lineup</div>
                <div className="text-condensed text-2xl uppercase tracking-wide mt-1">SET YOUR ROSTER</div>
              </div>
              <div className="text-right">
                <div className="stat-display text-4xl text-primary leading-none">{projectedFppg.toFixed(1)}</div>
                <div className="text-eyebrow mt-1">Projected FPPG</div>
              </div>
            </div>
            <RosterSlotGrid
              template={league.roster_template}
              assignments={slotAssignments}
              onSlotClick={isOwner ? setEditingSlot : undefined}
            />
            {!isOwner && (
              <div className="mt-3 text-xs text-muted-foreground">
                You can view this team's lineup, but only the owner can change it.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roster">
          <RosterStatsTable players={fullPlayers} loading={fullPlayers.length === 0 && team.roster_entries.length > 0} leagueId={lid} />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-3">
          <div className="text-eyebrow">All weeks</div>
          {teamMatchups.length === 0 ? (
            <div className="surface-elevated p-12 text-center text-sm text-muted-foreground">
              The schedule appears once the regular season starts.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {teamMatchups.map(({ week, matchup }) => (
                <div key={matchup.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-eyebrow">Week {week.week_number}{week.is_playoff ? ` · ${week.playoff_round || "Playoffs"}` : ""}</span>
                    <span>{week.is_settled ? "Final" : "Upcoming"}</span>
                  </div>
                  <MatchupCard matchup={matchup} variant="compact" />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LineupEditorModal
        open={editingSlot !== null}
        onOpenChange={(o) => { if (!o) setEditingSlot(null) }}
        slot={editingSlot}
        roster={team.roster_entries}
        currentPlayer={editingSlot ? slotAssignments[editingSlot.slot] : null}
        usedElsewhere={usedPlayerIds}
        onAssign={async (playerId) => {
          if (editingSlot) await handleAssign(editingSlot.slot, playerId)
          setEditingSlot(null)
        }}
      />
    </div>
  )
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="text-eyebrow">{label}</div>
      <div className={cn("stat-display text-3xl mt-1 leading-none", accent ? "text-primary" : "text-foreground")}>{value}</div>
    </div>
  )
}

function RosterStatsTable({
  players,
  loading,
  leagueId,
}: {
  players: Player[]
  loading: boolean
  leagueId: number
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>({ key: "fppg", dir: "desc" })

  const columns = useMemo<ColumnDef<Player>[]>(() => {
    const stat = (label: string, getter: (p: Player) => number | null, key: string, format: (n: number) => string = (n) => n.toFixed(1)): ColumnDef<Player> => ({
      key,
      header: label,
      isStat: true,
      width: 60,
      accessor: (p) => {
        const v = getter(p)
        return v == null ? "—" : <span className="stat-num">{format(v)}</span>
      },
      sortValue: (p) => getter(p) ?? -Infinity,
    })

    return [
      {
        key: "name",
        header: "Player",
        width: 260,
        accessor: (p) => (
          <Link to={`/leagues/${leagueId}/players/${p.id}`} className="flex items-center gap-2.5 min-w-0 group">
            <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.full_name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <PositionChip position={p.primary_position} />
                {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
                <span className="text-xs text-muted-foreground">{p.team_abbr}</span>
                <StatusBadge status={p.injury_status} />
              </div>
            </div>
          </Link>
        ),
        sortValue: (p) => p.full_name.toLowerCase(),
      },
      {
        key: "fppg",
        header: "FPPG",
        isStat: true,
        width: 76,
        accessor: (p) => p.current_season?.fantasy_ppg != null
          ? <span className="stat-num font-bold text-primary">{p.current_season.fantasy_ppg.toFixed(1)}</span>
          : "—",
        sortValue: (p) => p.current_season?.fantasy_ppg ?? -Infinity,
      },
      stat("GP",  (p) => p.current_season?.games_played ?? null, "gp",  (n) => n.toFixed(0)),
      stat("MIN", (p) => p.current_season?.minutes ?? null,      "min"),
      stat("PTS", (p) => p.current_season?.pts ?? null,          "pts"),
      stat("REB", (p) => p.current_season?.reb ?? null,          "reb"),
      stat("AST", (p) => p.current_season?.ast ?? null,          "ast"),
      stat("STL", (p) => p.current_season?.stl ?? null,          "stl"),
      stat("BLK", (p) => p.current_season?.blk ?? null,          "blk"),
      stat("TOV", (p) => p.current_season?.tov ?? null,          "tov"),
      stat("FG%", (p) => p.current_season ? p.current_season.fg_pct * 100 : null, "fg_pct", (n) => n.toFixed(1)),
      stat("3P%", (p) => p.current_season ? p.current_season.fg3_pct * 100 : null, "fg3_pct", (n) => n.toFixed(1)),
      stat("FT%", (p) => p.current_season ? p.current_season.ft_pct * 100 : null, "ft_pct", (n) => n.toFixed(1)),
    ]
  }, [leagueId])

  if (loading) {
    return <Skeleton className="h-96" />
  }
  return (
    <StatTable
      columns={columns}
      rows={players}
      rowKey={(p) => p.id}
      sort={sort}
      onSortChange={setSort}
      emptyMessage="No roster yet — finish the draft first."
    />
  )
}
