import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import { getLeague, getStandings } from "@/services/leagues"
import type { LeagueDetail, TeamLight } from "@/types/league"

import { TeamAvatar } from "@/components/TeamAvatar"
import { Sparkline } from "@/components/Sparkline"
import { cn } from "@/lib/utils"
import { Trophy } from "lucide-react"

export function StandingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const [standings, setStandings] = useState<TeamLight[] | null>(null)
  const [league, setLeague] = useState<LeagueDetail | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getStandings(id), getLeague(id)])
      .then(([s, l]) => { setStandings(s); setLeague(l) })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load standings."
        toast.error(message)
        setStandings([])
      })
  }, [id])

  const playoffSlots = league?.playoff_team_count ?? 4

  const max = useMemo(() => {
    if (!standings) return 1
    return standings.reduce((m, t) => Math.max(m, t.points_for), 1)
  }, [standings])

  return (
    <div className="space-y-6">
      <header>
        <div className="text-display text-4xl md:text-5xl text-foreground leading-none">STANDINGS</div>
        <p className="text-sm text-muted-foreground mt-2">
          Sorted by wins, then points for. Top {playoffSlots} qualify for playoffs.
        </p>
      </header>

      {standings === null ? (
        <Skeleton className="h-96" />
      ) : standings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No teams yet.
        </div>
      ) : (
        <div className="space-y-2">
          {standings.map((team, i) => {
            const rank = i + 1
            const inPlayoffs = rank <= playoffSlots
            const isMe = league?.my_team_id === team.id
            const pfPct = (team.points_for / max) * 100
            return (
              <Link
                key={team.id}
                to={league ? `/leagues/${league.id}/team/${team.id}` : "#"}
                className={cn(
                  "block rounded-lg border bg-card hover:border-primary/40 transition-colors overflow-hidden",
                  inPlayoffs ? "border-emerald-500/30" : "border-border",
                  isMe && "ring-1 ring-primary/40",
                )}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Rank */}
                  <div className={cn(
                    "text-display text-5xl leading-none w-16 text-center",
                    rank === 1 ? "text-[var(--brand-legacy-tan)]" : inPlayoffs ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {rank}
                  </div>

                  {/* Identity */}
                  <TeamAvatar name={team.name} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate">{team.name}</div>
                      {rank === 1 && <Trophy className="h-3.5 w-3.5 text-[var(--brand-legacy-tan)]" />}
                      {isMe && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/40">
                          You
                        </span>
                      )}
                      {inPlayoffs && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
                          Playoffs
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{team.member.display_name}</div>
                  </div>

                  {/* Record */}
                  <div className="text-center">
                    <div className="text-display text-3xl text-foreground leading-none">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Record</div>
                  </div>

                  {/* Sparkline */}
                  <div className="hidden md:flex flex-col items-center gap-1.5">
                    <Sparkline results={team.last_5 ?? []} />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 5</div>
                  </div>

                  {/* PF / PA */}
                  <div className="hidden lg:block text-right min-w-[80px]">
                    <div className="stat-num font-bold">{team.points_for.toFixed(0)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">PF</div>
                  </div>
                  <div className="hidden lg:block text-right min-w-[80px]">
                    <div className="stat-num font-bold">{team.points_against.toFixed(0)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">PA</div>
                  </div>
                  <div className="hidden xl:block text-right min-w-[80px]">
                    <div className={cn(
                      "stat-num font-bold",
                      team.points_for - team.points_against > 0 ? "text-emerald-400" : "text-muted-foreground",
                    )}>
                      {(team.points_for - team.points_against >= 0 ? "+" : "")}{(team.points_for - team.points_against).toFixed(0)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Diff</div>
                  </div>
                </div>
                {/* PF progress bar */}
                <div className="h-1 bg-muted/30">
                  <div
                    className={cn(
                      "h-full transition-all",
                      inPlayoffs ? "bg-emerald-500/60" : "bg-muted-foreground/40",
                    )}
                    style={{ width: `${pfPct}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
