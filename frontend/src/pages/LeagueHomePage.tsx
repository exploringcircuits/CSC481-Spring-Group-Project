import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Calendar, ChevronRight, ClipboardCopy, Flame, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import {
  getLeague,
  getStandings,
  listTransactions,
  listWeeks,
} from "@/services/leagues"
import { getTeam } from "@/services/teams"
import { getPlayer } from "@/services/players"
import type {
  LeagueDetail,
  Matchup,
  Player,
  TeamLight,
  Transaction,
  Week,
} from "@/types/league"

import { MatchupCard } from "@/components/MatchupCard"
import { TeamAvatar } from "@/components/TeamAvatar"
import { ActivityFeedRow } from "@/components/ActivityFeedRow"
import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { PositionChip } from "@/components/PositionChip"
import { TeamLogo } from "@/components/TeamLogo"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<string, string> = {
  setup:    "bg-secondary text-muted-foreground border-border",
  drafting: "bg-secondary border-primary/40 text-primary",
  regular:  "bg-primary/15 text-primary border-primary/40",
  playoffs: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  complete: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
}
const STATUS_LABEL: Record<string, string> = {
  setup: "Setup", drafting: "Drafting", regular: "Regular Season", playoffs: "Playoffs", complete: "Complete",
}

export function LeagueHomePage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [standings, setStandings] = useState<TeamLight[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [topPerformers, setTopPerformers] = useState<Player[]>([])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getLeague(id),
      getStandings(id),
      listWeeks(id),
      listTransactions(id),
    ])
      .then(async ([l, s, w, t]) => {
        if (cancelled) return
        setLeague(l); setStandings(s); setWeeks(w); setTransactions(t)
        // Pull the user's roster and find their top performers
        if (l.my_team_id) {
          const team = await getTeam(l.my_team_id).catch(() => null)
          if (cancelled || !team) return
          const ids = team.roster_entries
            .slice()
            .sort((a, b) => (b.player.fantasy_ppg ?? 0) - (a.player.fantasy_ppg ?? 0))
            .slice(0, 3)
            .map((r) => r.player.id)
          const players = await Promise.all(ids.map((pid) => getPlayer(pid).catch(() => null)))
          if (cancelled) return
          setTopPerformers(players.filter((p): p is Player => p !== null))
        }
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load league."
        if (!cancelled) toast.error(message)
      })
    return () => { cancelled = true }
  }, [id])

  const myTeam = useMemo(
    () => (league ? league.teams.find((t) => t.id === league.my_team_id) ?? null : null),
    [league],
  )
  const myRank = useMemo(() => {
    if (!myTeam || standings.length === 0) return null
    const idx = standings.findIndex((t) => t.id === myTeam.id)
    return idx >= 0 ? idx + 1 : null
  }, [myTeam, standings])

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
        <Skeleton className="h-44" />
      </div>
    )
  }

  const tone = STATUS_TONE[league.status] ?? STATUS_TONE.setup
  const label = STATUS_LABEL[league.status] ?? league.status

  const totalGames = (myTeam?.wins ?? 0) + (myTeam?.losses ?? 0) + (myTeam?.ties ?? 0)
  const winPct = totalGames > 0 ? (((myTeam?.wins ?? 0) + (myTeam?.ties ?? 0) * 0.5) / totalGames * 100) : 0
  const avgPF = totalGames > 0 ? (myTeam?.points_for ?? 0) / totalGames : 0

  return (
    <div className="space-y-6">
      {/* League header */}
      <header className="surface-elevated p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 court-stripe pointer-events-none" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn("inline-flex items-center px-1.5 py-0.5 border text-eyebrow leading-none", tone)}>
                {label}
              </span>
              <span className="text-eyebrow text-muted-foreground leading-none">
                {league.season_label} · {league.teams.length}/{league.max_teams} teams · {league.regular_season_weeks}-week season
              </span>
            </div>
            <div className="text-display text-5xl md:text-7xl text-foreground leading-[0.9]">
              {league.name.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-eyebrow">Invite</span>
            <button
              onClick={() => { navigator.clipboard.writeText(league.invite_code); toast.success("Invite code copied.") }}
              className="inline-flex items-center gap-1.5 border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-sm hover:border-primary/40 hover:text-primary transition-colors"
            >
              <code>{league.invite_code}</code>
              <ClipboardCopy className="h-3 w-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero stat strip */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Record"
          value={myTeam?.record ?? "—"}
          secondary={myTeam?.name ?? "Your team"}
          accent
        />
        <StatTile
          label="Win %"
          value={totalGames > 0 ? `${winPct.toFixed(1)}%` : "—"}
          secondary={totalGames > 0 ? `${totalGames} games played` : "Pre-season"}
        />
        <StatTile
          label="Standing"
          value={myRank ? `#${myRank}` : "—"}
          secondary={`of ${league.teams.length}`}
          link={`/leagues/${league.id}/standings`}
        />
        <StatTile
          label="Points for"
          value={myTeam?.points_for.toFixed(0) ?? "—"}
          secondary={totalGames > 0 ? `${avgPF.toFixed(1)} per week` : ""}
        />
        <StatTile
          label="Differential"
          value={myTeam ? (myTeam.points_for - myTeam.points_against >= 0 ? "+" : "") + (myTeam.points_for - myTeam.points_against).toFixed(0) : "—"}
          secondary={myTeam ? `${myTeam.points_against.toFixed(0)} against` : ""}
        />
      </div>

      {/* Current matchup + activity */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-eyebrow">
                {currentWeek
                  ? currentWeek.is_playoff
                    ? `${capitalize(currentWeek.playoff_round || "Playoffs")} · Week ${currentWeek.week_number}`
                    : `Week ${currentWeek.week_number}`
                  : "—"}
              </div>
              <div className="text-condensed text-2xl uppercase tracking-wide text-foreground">CURRENT MATCHUP</div>
            </div>
            {currentWeek && (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {formatDate(currentWeek.start_date)} → {formatDate(currentWeek.end_date)}
              </div>
            )}
          </div>
          {myMatchup ? (
            <MatchupCard matchup={myMatchup} variant="full" />
          ) : (
            <div className="surface-elevated border-dashed p-8 text-center text-sm text-muted-foreground">
              No matchup scheduled. The schedule is set after the draft completes.
            </div>
          )}

          {currentWeek && currentWeek.matchups.length > 1 && (
            <div className="space-y-2 pt-4">
              <div className="text-eyebrow">Around the league</div>
              <div className="grid gap-2 md:grid-cols-2">
                {currentWeek.matchups.filter((m) => m.id !== myMatchup?.id).map((m) => (
                  <MatchupCard key={m.id} matchup={m} variant="compact" leagueId={league.id} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="surface-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/40 flex items-center justify-between">
            <div>
              <div className="text-eyebrow">Activity</div>
              <div className="text-condensed text-lg uppercase tracking-wide">RECENT</div>
            </div>
            <Link
              to={`/leagues/${league.id}/transactions`}
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5 transition-colors"
            >
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-4 max-h-[460px] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              transactions.slice(0, 12).map((tx) => <ActivityFeedRow key={tx.id} transaction={tx} />)
            )}
          </div>
        </div>
      </div>

      {/* Top performers + Top of standings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top performers */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-eyebrow text-primary inline-flex items-center gap-1.5">
                <Flame className="h-3 w-3" /> Hot hands
              </div>
              <div className="text-condensed text-2xl uppercase tracking-wide">YOUR TOP PERFORMERS</div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/leagues/${league.id}/team`}>View roster</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {topPerformers.length === 0 ? (
              <div className="surface-elevated border-dashed p-8 text-center text-sm text-muted-foreground">
                Roster fills in after the draft.
              </div>
            ) : (
              topPerformers.map((p, i) => (
                <Link
                  key={p.id}
                  to={`/leagues/${league.id}/players/${p.id}`}
                  className="flex items-center gap-3 surface-elevated px-4 py-3 hover:border-primary/40 transition-colors group"
                >
                  <div className="text-display text-3xl text-primary w-8 text-center">{i + 1}</div>
                  <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate group-hover:text-primary transition-colors">{p.full_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PositionChip position={p.primary_position} />
                      {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
                      <span className="text-xs text-muted-foreground">{p.team_abbr}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-display text-2xl text-primary leading-none">
                      {p.current_season?.fantasy_ppg?.toFixed(1) ?? "—"}
                    </div>
                    <div className="text-eyebrow mt-1">FPPG</div>
                  </div>
                  {p.current_season && (
                    <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground border-l border-border pl-3 ml-1 stat-num">
                      <span><span className="text-foreground">{p.current_season.pts.toFixed(1)}</span> PTS</span>
                      <span><span className="text-foreground">{p.current_season.reb.toFixed(1)}</span> REB</span>
                      <span><span className="text-foreground">{p.current_season.ast.toFixed(1)}</span> AST</span>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Top of standings */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-eyebrow text-primary inline-flex items-center gap-1.5">
                <Trophy className="h-3 w-3" /> Standings
              </div>
              <div className="text-condensed text-2xl uppercase tracking-wide">TOP OF THE TABLE</div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/leagues/${league.id}/standings`}>Full standings</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {standings.slice(0, 3).map((team, i) => {
              const isMe = team.id === league.my_team_id
              return (
                <Link
                  key={team.id}
                  to={`/leagues/${league.id}/team/${team.id}`}
                  className={cn(
                    "flex items-center gap-4 surface-elevated px-4 py-3 hover:border-primary/40 transition-colors",
                    isMe && "border-primary/50",
                  )}
                >
                  <div className="text-display text-3xl w-8 text-center text-primary">{i + 1}</div>
                  <TeamAvatar name={team.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{team.name}{isMe && <span className="ml-2 text-eyebrow text-primary">YOU</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">{team.member.display_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="stat-display text-2xl">{team.wins}-{team.losses}</div>
                    <div className="text-eyebrow mt-1">{team.points_for.toFixed(0)} PF</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatTile({ label, value, secondary, link, accent }: { label: string; value: string; secondary?: string; link?: string; accent?: boolean }) {
  const inner = (
    <div className={cn(
      "surface-elevated px-5 py-4 transition-colors h-full",
      accent && "border-primary/50",
      link && "hover:border-primary/40 cursor-pointer",
    )}>
      <div className="text-eyebrow">{label}</div>
      <div className={cn(
        "stat-display leading-none mt-2",
        accent ? "text-4xl text-primary" : "text-3xl text-foreground",
      )}>{value}</div>
      {secondary && <div className="text-xs text-muted-foreground mt-2 truncate">{secondary}</div>}
    </div>
  )
  if (link) return <Link to={link} className="block h-full">{inner}</Link>
  return inner
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatDate(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }
