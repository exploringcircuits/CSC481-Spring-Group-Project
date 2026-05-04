import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import { listWeeks } from "@/services/leagues"
import type { Matchup, Week } from "@/types/league"
import { cn } from "@/lib/utils"

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Playoff bracket</h1>
        <p className="text-sm text-muted-foreground">
          Single-elimination, weekly H2H. Re-seeded after each round.
        </p>
      </header>

      {weeks === null ? (
        <Skeleton className="h-72" />
      ) : playoffWeeks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Playoffs haven&apos;t started yet. The bracket appears once the commissioner kicks them off.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {playoffWeeks.map((week) => (
            <BracketColumn key={week.id} week={week} />
          ))}
        </div>
      )}
    </div>
  )
}

function BracketColumn({ week }: { week: Week }) {
  const roundLabel =
    week.playoff_round.charAt(0).toUpperCase() + week.playoff_round.slice(1) || `Week ${week.week_number}`
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          {roundLabel}
          {week.is_settled ? (
            <Badge variant="secondary">settled</Badge>
          ) : week.matchups.length === 0 ? (
            <Badge variant="outline">awaiting</Badge>
          ) : (
            <Badge variant="outline">in progress</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {week.matchups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Matchups appear after the previous round settles.
          </p>
        ) : (
          week.matchups.map((m) => <BracketMatchup key={m.id} matchup={m} />)
        )}
      </CardContent>
    </Card>
  )
}

function BracketMatchup({ matchup }: { matchup: Matchup }) {
  const winnerId = matchup.winner?.id
  const TeamRow = ({ team, score, isWinner }: { team: typeof matchup.home_team; score: number; isWinner: boolean }) => (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border border-border px-3 py-2",
        isWinner && "border-foreground/40 bg-secondary",
      )}
    >
      <div className="font-medium truncate">{team.name}</div>
      <div className="text-sm tabular-nums">{matchup.is_settled ? score.toFixed(1) : "—"}</div>
    </div>
  )
  return (
    <div className="space-y-1">
      <TeamRow team={matchup.home_team} score={matchup.home_score} isWinner={winnerId === matchup.home_team.id} />
      <TeamRow team={matchup.away_team} score={matchup.away_score} isWinner={winnerId === matchup.away_team.id} />
    </div>
  )
}
