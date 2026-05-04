import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { getDraft, makePick } from "@/services/draft"
import { getLeague } from "@/services/leagues"
import { listPlayers } from "@/services/players"
import { useAuth } from "@/hooks/useAuth"
import type {
  Draft,
  LeagueDetail,
  PaginatedResponse,
  PlayerLight,
} from "@/types/league"

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"]

export function DraftPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const { user, isStaff } = useAuth()

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [players, setPlayers] = useState<PaginatedResponse<PlayerLight> | null>(null)
  const [position, setPosition] = useState("All")
  const [search, setSearch] = useState("")
  const [picking, setPicking] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    refresh()
  }, [id])

  useEffect(() => {
    if (!id) return
    listPlayers({
      position: position === "All" ? undefined : position,
      search: search || undefined,
      available_in_league: id,
    }).then(setPlayers).catch((err) => {
      const message = err instanceof ApiError ? err.message : "Could not load players."
      toast.error(message)
    })
  }, [id, position, search, draft?.current_pick_index])

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

  async function handlePick(playerId: number) {
    if (!id) return
    setPicking(playerId)
    try {
      const updated = await makePick(id, playerId)
      setDraft(updated)
      toast.success("Pick made.")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Pick failed."
      toast.error(message)
    } finally {
      setPicking(null)
    }
  }

  if (!league || !draft) {
    return <Skeleton className="h-72" />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Draft</h1>
          <p className="text-sm text-muted-foreground">
            Snake draft · {draft.draft_order.length} teams · {league.roster_template.length} rounds
          </p>
        </div>
        <DraftStatusBadge status={draft.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">On the clock</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.status === "not_started" ? (
              <p className="text-sm text-muted-foreground">
                The commissioner hasn&apos;t started the draft yet.
              </p>
            ) : draft.status === "complete" ? (
              <p className="text-sm">Draft complete — rosters set.</p>
            ) : onClockMember ? (
              <div>
                <div className="text-lg font-semibold">{onClockMember.display_name}</div>
                <div className="text-sm text-muted-foreground">
                  Pick #{draft.current_pick_index + 1}, round {Math.floor(draft.current_pick_index / draft.draft_order.length) + 1}
                </div>
                {isMyPick && (
                  <Badge className="mt-2">You&apos;re up</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent picks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {draft.selections.length === 0 ? (
              <p className="text-muted-foreground">No picks yet.</p>
            ) : (
              <div className="space-y-1">
                {draft.selections.slice(-6).reverse().map((sel) => (
                  <div key={sel.id} className="flex items-baseline justify-between border-b border-border/50 py-1">
                    <span>
                      <span className="text-muted-foreground">#{sel.pick_number}</span>{" "}
                      <span className="font-medium">{sel.player.full_name}</span>{" "}
                      <span className="text-muted-foreground">→ {sel.member.display_name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {sel.player.team_abbr} · {sel.player.primary_position}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(isMyPick || canPickAsAdmin) && draft.status === "in_progress" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available players</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {players === null ? (
              <Skeleton className="h-64" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead className="text-right">FPPG</TableHead>
                    <TableHead className="text-right w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.results.slice(0, 25).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>{p.team_abbr}</TableCell>
                      <TableCell>{p.primary_position}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.fantasy_ppg !== null ? p.fantasy_ppg.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handlePick(p.id)}
                          disabled={picking !== null}
                        >
                          {picking === p.id ? "Picking…" : "Pick"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DraftStatusBadge({ status }: { status: Draft["status"] }) {
  if (status === "not_started") return <Badge variant="outline">Not started</Badge>
  if (status === "complete") return <Badge variant="secondary">Complete</Badge>
  return <Badge>In progress</Badge>
}
