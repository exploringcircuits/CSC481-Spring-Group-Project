import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import {
  createLeague,
  joinLeague,
  listLeagues,
} from "@/services/leagues"
import type { LeagueListItem } from "@/types/league"

const LEAGUE_STATUS: Record<string, { label: string; tone: string }> = {
  setup:    { label: "Setup",    tone: "bg-muted text-muted-foreground border-border" },
  drafting: { label: "Drafting", tone: "bg-secondary text-primary border-primary/40" },
  regular:  { label: "Regular",  tone: "bg-primary/15 text-primary border-primary/40" },
  playoffs: { label: "Playoffs", tone: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
  complete: { label: "Complete", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
}

export function LeagueSelectionPage() {
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueListItem[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      const data = await listLeagues()
      setLeagues(data)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not load leagues."
      toast.error(message)
      setLeagues([])
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-display text-4xl md:text-5xl text-foreground leading-none">MY LEAGUES</div>
          <p className="text-sm text-muted-foreground mt-2">
            Pick a league to manage, or start something new.
          </p>
        </div>
        <div className="flex gap-2">
          <JoinLeagueDialog
            open={joinOpen}
            onOpenChange={setJoinOpen}
            onSuccess={(league) => {
              setJoinOpen(false)
              navigate(`/leagues/${league.id}`)
            }}
          />
          <CreateLeagueDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSuccess={(league) => {
              setCreateOpen(false)
              navigate(`/leagues/${league.id}`)
            }}
          />
        </div>
      </header>

      {leagues === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : leagues.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No leagues yet. Create one to start drafting, or join with an invite code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => {
            const status = LEAGUE_STATUS[league.status] ?? { label: league.status, tone: "bg-muted text-muted-foreground border-border" }
            return (
              <div
                key={league.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/leagues/${league.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(`/leagues/${league.id}`)
                }}
                className="group rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/40 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="gradient-court px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-display text-2xl text-foreground leading-tight truncate">{league.name.toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground mt-1">{league.season_label} Season</div>
                    </div>
                    <span className={`inline-flex shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
                <div className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Teams</span>
                    <span className="font-bold">{league.member_count} / {league.max_teams}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Week</span>
                    <span className="font-bold stat-num">{league.current_week_number || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Invite</span>
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{league.invite_code}</code>
                  </div>
                  {league.is_commissioner && (
                    <div className="pt-2 border-t border-border/40">
                      <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                        Commissioner
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface CreateProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (league: LeagueListItem) => void
}

function CreateLeagueDialog({ open, onOpenChange, onSuccess }: CreateProps) {
  const [name, setName] = useState("")
  const [maxTeams, setMaxTeams] = useState(8)
  const [weeks, setWeeks] = useState(6)
  const [teamName, setTeamName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("League name required.")
      return
    }
    setSubmitting(true)
    try {
      const league = await createLeague({
        name: name.trim(),
        max_teams: maxTeams,
        regular_season_weeks: weeks,
        team_name: teamName.trim() || undefined,
      })
      toast.success(`League "${league.name}" created.`)
      onSuccess({
        id: league.id,
        name: league.name,
        season_label: league.season_label,
        status: league.status,
        max_teams: league.max_teams,
        regular_season_weeks: league.regular_season_weeks,
        playoff_team_count: league.playoff_team_count,
        current_week_number: league.current_week_number,
        invite_code: league.invite_code,
        member_count: league.members.length,
        is_commissioner: true,
      })
      setName("")
      setTeamName("")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create league."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Create league</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New league</DialogTitle>
            <DialogDescription>
              You become the commissioner. Members join with the invite code generated after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="league_name">League name</Label>
              <Input
                id="league_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Showcase League"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="max_teams">Teams</Label>
                <Input
                  id="max_teams"
                  type="number"
                  min={2}
                  max={20}
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeks">Regular season weeks</Label>
                <Input
                  id="weeks"
                  type="number"
                  min={2}
                  max={20}
                  value={weeks}
                  onChange={(e) => setWeeks(parseInt(e.target.value || "0", 10))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team_name">Your team name (optional)</Label>
              <Input
                id="team_name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="My Team"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create league"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface JoinProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (league: { id: number }) => void
}

function JoinLeagueDialog({ open, onOpenChange, onSuccess }: JoinProps) {
  const [code, setCode] = useState("")
  const [teamName, setTeamName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      toast.error("Invite code required.")
      return
    }
    setSubmitting(true)
    try {
      const league = await joinLeague(code.trim(), teamName.trim() || undefined)
      toast.success(`Joined "${league.name}".`)
      onSuccess({ id: league.id })
      setCode("")
      setTeamName("")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not join league."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Join with code</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Join a league</DialogTitle>
            <DialogDescription>
              Paste the invite code your commissioner shared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite_code">Invite code</Label>
              <Input
                id="invite_code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC1DEF2"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join_team_name">Your team name (optional)</Label>
              <Input
                id="join_team_name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="My Team"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Joining…" : "Join league"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
