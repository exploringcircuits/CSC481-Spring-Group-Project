import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import { getLeague, listWeeks } from "@/services/leagues"
import { getLineup, getTeam, setLineup } from "@/services/teams"
import type {
  LeagueDetail,
  RosterEntry,
  TeamDetail,
  Week,
} from "@/types/league"

export function MyTeamPage() {
  const { leagueId, teamId } = useParams<{ leagueId: string; teamId?: string }>()
  const navigate = useNavigate()
  const lid = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null)
  const [pendingAssignments, setPending] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  // Resolve which team to load: explicit URL param, otherwise the user's own team.
  useEffect(() => {
    if (!lid) return
    let cancelled = false
    getLeague(lid)
      .then(async (l) => {
        if (cancelled) return
        setLeague(l)
        const targetId = teamId ? Number(teamId) : l.my_team_id
        if (!targetId) {
          if (!cancelled) setTeam(null)
          return
        }
        const t = await getTeam(targetId)
        if (cancelled) return
        setTeam(t)
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load team."
        if (!cancelled) toast.error(message)
      })
    return () => { cancelled = true }
  }, [lid, teamId])

  // Load weeks once we know the league.
  useEffect(() => {
    if (!lid) return
    listWeeks(lid).then((ws) => {
      setWeeks(ws)
      // Default the lineup picker to the league's current week.
      const current = ws.find((w) => w.week_number === (league?.current_week_number ?? 1))
      if (current) setActiveWeekId(current.id)
      else if (ws[0]) setActiveWeekId(ws[0].id)
    }).catch(() => {})
  }, [lid, league?.current_week_number])

  // Load lineup when team + week are known.
  useEffect(() => {
    if (!team || !activeWeekId) return
    getLineup(team.id, activeWeekId)
      .then((entries) => {
        // Initialise pending assignments from the first day's snapshot.
        const seen = new Set<string>()
        const draft: Record<string, number> = {}
        for (const e of entries) {
          if (seen.has(e.slot)) continue
          seen.add(e.slot)
          draft[e.slot] = e.player.id
        }
        setPending(draft)
      })
      .catch(() => {})
  }, [team?.id, activeWeekId])

  const isOwner = useMemo(() => {
    if (!team || !league) return false
    return team.id === league.my_team_id
  }, [team, league])

  const rosterByPosition = useMemo(() => {
    if (!team) return new Map<string, RosterEntry[]>()
    const map = new Map<string, RosterEntry[]>()
    for (const r of team.roster_entries) {
      const pos = r.player.primary_position || "?"
      if (!map.has(pos)) map.set(pos, [])
      map.get(pos)!.push(r)
    }
    return map
  }, [team])

  if (!league || !team) {
    return <Skeleton className="h-72" />
  }

  const playerById = new Map(team.roster_entries.map((r) => [r.player.id, r.player]))
  const totalProjected = sumProjected(pendingAssignments, league, playerById)

  async function handleSave() {
    if (!team || !activeWeekId) return
    setSaving(true)
    try {
      await setLineup(team.id, activeWeekId, pendingAssignments)
      toast.success("Lineup saved.")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save lineup."
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.member.display_name} · {team.record} · {team.points_for.toFixed(1)} PF
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && <Badge variant="outline">My team</Badge>}
          <Button variant="outline" onClick={() => navigate(`/leagues/${lid}`)}>
            ← League home
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Lineup</CardTitle>
              <CardDescription>
                Bench players score 0. Slots accept any eligible position.
              </CardDescription>
            </div>
            {weeks.length > 0 && (
              <Select
                value={activeWeekId ? String(activeWeekId) : undefined}
                onValueChange={(v) => setActiveWeekId(Number(v))}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Week…" />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      Week {w.week_number}
                      {w.is_playoff ? " (playoffs)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Slot</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Pos</TableHead>
                  <TableHead className="text-right">FPPG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {league.roster_template.map((slot) => {
                  const playerId = pendingAssignments[slot.slot]
                  const eligible = team.roster_entries.filter((r) =>
                    slot.allowed.includes(r.player.primary_position),
                  )
                  return (
                    <TableRow key={slot.slot} className={slot.starter ? "" : "text-muted-foreground"}>
                      <TableCell>
                        <span className="font-mono text-xs">{slot.slot}</span>
                        {!slot.starter && <span className="ml-1 text-[10px]">(BN)</span>}
                      </TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Select
                            value={playerId ? String(playerId) : ""}
                            onValueChange={(v) =>
                              setPending((prev) => {
                                const next = { ...prev }
                                if (!v) delete next[slot.slot]
                                else next[slot.slot] = Number(v)
                                return next
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-full max-w-xs">
                              <SelectValue placeholder="Empty" />
                            </SelectTrigger>
                            <SelectContent>
                              {eligible.map((r) => (
                                <SelectItem key={r.player.id} value={String(r.player.id)}>
                                  {r.player.full_name} ({r.player.team_abbr})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : playerId ? (
                          <span className="font-medium">
                            {playerById.get(playerId)?.full_name ?? "—"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Empty</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {playerId ? playerById.get(playerId)?.primary_position : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {playerId
                          ? playerById.get(playerId)?.fantasy_ppg?.toFixed(1) ?? "—"
                          : ""}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {isOwner && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Projected FPPG (starters): <strong className="text-foreground">{totalProjected.toFixed(1)}</strong>
                </div>
                <Button onClick={handleSave} disabled={saving || !activeWeekId}>
                  {saving ? "Saving…" : "Save lineup"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Roster by position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(rosterByPosition.entries()).map(([pos, entries]) => (
              <div key={pos}>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{pos}</div>
                {entries.map((r) => (
                  <div key={r.id} className="flex items-baseline justify-between text-sm">
                    <span>{r.player.full_name}</span>
                    <span className="text-muted-foreground">
                      {r.player.fantasy_ppg !== null ? r.player.fantasy_ppg.toFixed(1) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {team.roster_entries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No roster yet — finish the draft to populate this team.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function sumProjected(
  assignments: Record<string, number>,
  league: LeagueDetail,
  playersById: Map<number, RosterEntry["player"]>,
): number {
  const starterSlots = new Set(
    league.roster_template.filter((s) => s.starter).map((s) => s.slot),
  )
  let total = 0
  for (const [slot, playerId] of Object.entries(assignments)) {
    if (!starterSlots.has(slot)) continue
    const player = playersById.get(playerId)
    if (player?.fantasy_ppg) total += player.fantasy_ppg
  }
  return total
}
