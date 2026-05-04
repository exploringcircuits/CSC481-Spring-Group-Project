import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import {
  getLeague,
  getStandings,
  listTransactions,
  listWeeks,
} from "@/services/leagues"
import type {
  LeagueDetail,
  Matchup,
  TeamLight,
  Transaction,
  Week,
} from "@/types/league"

const STATUS_STYLES: Record<string, { label: string; tone: "default" | "secondary" | "outline" }> = {
  setup: { label: "Setup", tone: "outline" },
  drafting: { label: "Drafting", tone: "secondary" },
  regular: { label: "Regular Season", tone: "default" },
  playoffs: { label: "Playoffs", tone: "default" },
  complete: { label: "Complete", tone: "secondary" },
}

export function LeagueHomePage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [standings, setStandings] = useState<TeamLight[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getLeague(id),
      getStandings(id),
      listWeeks(id),
      listTransactions(id),
    ])
      .then(([l, s, w, t]) => {
        if (cancelled) return
        setLeague(l)
        setStandings(s)
        setWeeks(w)
        setTransactions(t)
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load league."
        if (!cancelled) toast.error(message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const myTeam = useMemo(
    () => (league ? league.teams.find((t) => t.id === league.my_team_id) ?? null : null),
    [league],
  )

  const currentWeek = useMemo(() => {
    if (!league) return null
    return weeks.find((w) => w.week_number === league.current_week_number) ?? weeks[0] ?? null
  }, [league, weeks])

  const myMatchup: Matchup | null = useMemo(() => {
    if (!currentWeek || !myTeam) return null
    return (
      currentWeek.matchups.find(
        (m) => m.home_team.id === myTeam.id || m.away_team.id === myTeam.id,
      ) ?? null
    )
  }, [currentWeek, myTeam])

  if (!league) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    )
  }

  const status = STATUS_STYLES[league.status] ?? { label: league.status, tone: "secondary" as const }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{league.name}</h1>
            <Badge variant={status.tone}>{status.label}</Badge>
            {league.is_commissioner && <Badge variant="outline">Commissioner</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {league.season_label} · {league.teams.length}/{league.max_teams} teams ·
            {" "}{league.regular_season_weeks}-week regular season
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Invite code:</span>
          <code className="rounded bg-muted px-2 py-1 font-mono text-foreground">
            {league.invite_code}
          </code>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>My team</CardDescription>
            <CardTitle className="text-xl">{myTeam?.name ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Record</span>
              <span className="font-medium">{myTeam?.record ?? "—"}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Points for</span>
              <span className="font-medium">{myTeam?.points_for.toFixed(1) ?? "—"}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Points against</span>
              <span className="font-medium">{myTeam?.points_against.toFixed(1) ?? "—"}</span>
            </div>
            <Separator className="my-3" />
            {myTeam ? (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/leagues/${league.id}/team/${myTeam.id}`}>Open roster</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Your team will appear once the league fills up.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {currentWeek?.is_playoff
                ? `${capitalize(currentWeek.playoff_round || "Playoffs")} · Week ${currentWeek.week_number}`
                : currentWeek
                  ? `Week ${currentWeek.week_number} matchup`
                  : "No active week"}
            </CardDescription>
            <CardTitle className="text-xl">
              {myMatchup ? matchupLine(myMatchup, myTeam?.id ?? null) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {currentWeek ? (
              <p>
                {formatDate(currentWeek.start_date)} → {formatDate(currentWeek.end_date)}
                {currentWeek.is_settled ? " · settled" : " · in progress"}
              </p>
            ) : (
              <p>The schedule is set after the draft completes.</p>
            )}
            {myMatchup && (
              <ScoreLine matchup={myMatchup} myTeamId={myTeam?.id ?? null} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quick actions</CardDescription>
            <CardTitle className="text-xl">Manage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to={`/leagues/${league.id}/draft`}>Draft board</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to={`/leagues/${league.id}/standings`}>Standings</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to={`/leagues/${league.id}/bracket`}>Playoff bracket</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to={`/leagues/${league.id}/trades`}>Trades</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top of standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {standings.length === 0 ? (
              <p className="text-muted-foreground">No standings yet — play some games.</p>
            ) : (
              standings.slice(0, 4).map((team, i) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {team.member.display_name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{team.record}</div>
                    <div className="text-xs text-muted-foreground">
                      {team.points_for.toFixed(0)} PF
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {transactions.length === 0 ? (
              <p className="text-muted-foreground">No activity yet.</p>
            ) : (
              transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="text-sm">
                  <div>{tx.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelative(tx.created_at)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ScoreLine({ matchup, myTeamId }: { matchup: Matchup; myTeamId: number | null }) {
  if (!matchup.is_settled && matchup.home_score === 0 && matchup.away_score === 0) {
    return null
  }
  const myIsHome = matchup.home_team.id === myTeamId
  const myScore = myIsHome ? matchup.home_score : matchup.away_score
  const oppScore = myIsHome ? matchup.away_score : matchup.home_score
  return (
    <p className="mt-2 text-foreground">
      Score: <strong>{myScore.toFixed(1)}</strong> — {oppScore.toFixed(1)}
      {matchup.is_settled && matchup.winner && (
        <span className="ml-2 text-xs text-muted-foreground">
          {matchup.winner.id === myTeamId ? "(W)" : "(L)"}
        </span>
      )}
    </p>
  )
}

function matchupLine(m: Matchup, myTeamId: number | null): string {
  if (myTeamId && m.home_team.id === myTeamId) return `${m.home_team.name} vs ${m.away_team.name}`
  if (myTeamId && m.away_team.id === myTeamId) return `${m.away_team.name} @ ${m.home_team.name}`
  return `${m.home_team.name} vs ${m.away_team.name}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
