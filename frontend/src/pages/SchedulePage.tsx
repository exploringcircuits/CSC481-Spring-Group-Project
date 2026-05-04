import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Calendar, Clock, Trophy, Check } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError } from "@/services/api"
import { listWeeks } from "@/services/leagues"
import type { Week } from "@/types/league"
import { MatchupCard } from "@/components/MatchupCard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function SchedulePage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const [weeks, setWeeks] = useState<Week[] | null>(null)

  useEffect(() => {
    if (!id) return
    listWeeks(id)
      .then(setWeeks)
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "Could not load schedule."
        toast.error(msg)
      })
  }, [id])

  const partitioned = useMemo(() => {
    if (!weeks) return { past: [], current: [], upcoming: [], playoffs: [] }
    const past: Week[] = []
    const current: Week[] = []
    const upcoming: Week[] = []
    const playoffs: Week[] = []
    for (const w of weeks) {
      if (w.is_playoff) {
        playoffs.push(w)
      } else if (w.is_settled) {
        past.push(w)
      } else {
        const start = new Date(w.start_date).getTime()
        const end = new Date(w.end_date).getTime()
        const now = Date.now()
        if (start <= now && now <= end) current.push(w)
        else if (start > now) upcoming.push(w)
        else past.push(w)
      }
    }
    return { past, current, upcoming, playoffs }
  }, [weeks])

  if (!weeks) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-eyebrow text-primary inline-flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Schedule
        </div>
        <h1 className="text-display text-5xl md:text-6xl text-foreground leading-[0.9]">
          MATCHUP HISTORY
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Every regular-season and playoff week, settled or upcoming. Click any matchup
          to see lineup totals.
        </p>
      </header>

      <Tabs defaultValue={partitioned.past.length > 0 ? "past" : "current"}>
        <TabsList>
          <TabsTrigger value="past">
            <Check className="h-3.5 w-3.5 mr-1.5" /> Past ({partitioned.past.length})
          </TabsTrigger>
          <TabsTrigger value="current">
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Current ({partitioned.current.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Upcoming ({partitioned.upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="playoffs">
            <Trophy className="h-3.5 w-3.5 mr-1.5" /> Playoffs ({partitioned.playoffs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="past" className="space-y-6 mt-4">
          {partitioned.past.length === 0 ? (
            <EmptyState message="No settled weeks yet — check back after the first week wraps." />
          ) : (
            partitioned.past.map((w) => <WeekBlock key={w.id} week={w} leagueId={id} />)
          )}
        </TabsContent>

        <TabsContent value="current" className="space-y-6 mt-4">
          {partitioned.current.length === 0 ? (
            <EmptyState message="No live matchups right now." />
          ) : (
            partitioned.current.map((w) => <WeekBlock key={w.id} week={w} leagueId={id} live />)
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-6 mt-4">
          {partitioned.upcoming.length === 0 ? (
            <EmptyState message="No upcoming weeks scheduled." />
          ) : (
            partitioned.upcoming.map((w) => <WeekBlock key={w.id} week={w} leagueId={id} />)
          )}
        </TabsContent>

        <TabsContent value="playoffs" className="space-y-6 mt-4">
          {partitioned.playoffs.length === 0 ? (
            <EmptyState message="Playoffs haven't been seeded yet." />
          ) : (
            partitioned.playoffs.map((w) => <WeekBlock key={w.id} week={w} leagueId={id} playoff />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WeekBlock({ week, leagueId, live = false, playoff = false }: { week: Week; leagueId: number; live?: boolean; playoff?: boolean }) {
  const dateRange = `${formatDate(week.start_date)} – ${formatDate(week.end_date)}`
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between border-b border-border/60 pb-2">
        <div>
          <div className="text-eyebrow text-primary">
            {playoff ? `${week.playoff_round || "Playoff"} · Week ${week.week_number}` : `Week ${week.week_number}`}
          </div>
          <div className="text-condensed text-2xl uppercase tracking-wide">{dateRange}</div>
        </div>
        <div className={cn(
          "text-eyebrow",
          week.is_settled ? "text-emerald-400" : live ? "text-primary" : "text-muted-foreground",
        )}>
          {week.is_settled ? "Settled" : live ? "Live" : "Upcoming"}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {week.matchups.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No matchups for this week.</div>
        ) : (
          week.matchups.map((m) => (
            <MatchupCard key={m.id} matchup={m} variant="full" leagueId={leagueId} />
          ))
        )}
      </div>
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
