import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Trophy } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import { listWeeks } from "@/services/leagues"
import type { Matchup, Week } from "@/types/league"

import { MatchupCard } from "@/components/MatchupCard"
import { TeamAvatar } from "@/components/TeamAvatar"
import { cn } from "@/lib/utils"

const ROUND_LABEL: Record<string, string> = {
  semifinal: "Semifinals",
  semis: "Semifinals",
  final: "Final",
  finals: "Final",
  championship: "Championship",
}

function roundLabel(week: Week): string {
  if (week.playoff_round && ROUND_LABEL[week.playoff_round.toLowerCase()]) {
    return ROUND_LABEL[week.playoff_round.toLowerCase()]
  }
  if (week.playoff_round) return capitalize(week.playoff_round)
  return `Week ${week.week_number}`
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function BracketPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const [weeks, setWeeks] = useState<Week[] | null>(null)

  useEffect(() => {
    if (!id) return
    listWeeks(id)
      .then(setWeeks)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load bracket."
        toast.error(message)
        setWeeks([])
      })
  }, [id])

  const playoffWeeks = useMemo(
    () => (weeks ?? []).filter((w) => w.is_playoff).sort((a, b) => a.week_number - b.week_number),
    [weeks],
  )

  const champion = useMemo<Matchup["winner"] | null>(() => {
    if (playoffWeeks.length === 0) return null
    const last = playoffWeeks[playoffWeeks.length - 1]
    if (!last.is_settled) return null
    if (last.matchups.length !== 1) return null
    return last.matchups[0].winner
  }, [playoffWeeks])

  return (
    <div className="space-y-8">
      <header>
        <div className="text-display text-4xl md:text-5xl text-foreground leading-none">PLAYOFFS</div>
        <p className="text-sm text-muted-foreground mt-2">
          Single-elimination, weekly H2H. Re-seeded after each round.
        </p>
      </header>

      {weeks === null ? (
        <Skeleton className="h-96" />
      ) : playoffWeeks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <div className="text-display text-2xl text-foreground">PLAYOFFS NOT STARTED</div>
          <p className="text-sm text-muted-foreground mt-2">
            The bracket appears once the commissioner kicks off the playoffs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex items-stretch gap-8 md:gap-12 min-w-max">
            {playoffWeeks.map((week, i) => (
              <BracketColumn
                key={week.id}
                week={week}
                isFinal={i === playoffWeeks.length - 1}
              />
            ))}
            {champion && (
              <ChampionColumn champion={champion} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BracketColumn({ week, isFinal }: { week: Week; isFinal: boolean }) {
  const label = roundLabel(week)
  return (
    <div className={cn("flex flex-col gap-4 min-w-[260px]", isFinal && "min-w-[280px]")}>
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Round</div>
        <div className="text-display text-2xl text-foreground leading-none">{label.toUpperCase()}</div>
        <div className="text-xs text-muted-foreground mt-1">Week {week.week_number}</div>
      </div>
      <div className="flex flex-col gap-6 justify-around flex-1">
        {week.matchups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/50 p-6 text-center text-xs text-muted-foreground">
            Awaiting previous round
          </div>
        ) : (
          week.matchups.map((m) => (
            <MatchupCard key={m.id} matchup={m} variant="bracket" />
          ))
        )}
      </div>
    </div>
  )
}

function ChampionColumn({ champion }: { champion: NonNullable<Matchup["winner"]> }) {
  return (
    <div className="flex flex-col items-center gap-4 min-w-[240px] justify-center">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Champion</div>
        <Trophy className="h-12 w-12 text-[var(--brand-legacy-tan)] mx-auto mt-2" />
      </div>
      <div className="rounded-xl gradient-brand p-6 text-center text-white shadow-2xl shadow-primary/20">
        <TeamAvatar name={champion.name} size={64} className="mx-auto" />
        <div className="text-display text-2xl mt-3 leading-tight">{champion.name}</div>
        <div className="text-xs uppercase tracking-wider opacity-90 mt-1">{champion.member.display_name}</div>
      </div>
    </div>
  )
}
