import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { getStandings } from "@/services/leagues"
import type { TeamLight } from "@/types/league"

export function StandingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const [standings, setStandings] = useState<TeamLight[] | null>(null)

  useEffect(() => {
    if (!id) return
    getStandings(id)
      .then(setStandings)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load standings."
        toast.error(message)
        setStandings([])
      })
  }, [id])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Standings</h1>
        <p className="text-sm text-muted-foreground">
          Sorted by wins, then points-for, then points-against.
        </p>
      </header>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Regular season</CardTitle>
        </CardHeader>
        <CardContent>
          {standings === null ? (
            <Skeleton className="h-64" />
          ) : standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">W</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">T</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">PA</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((team, i) => (
                  <TableRow key={team.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {team.member.display_name}
                    </TableCell>
                    <TableCell className="text-right">{team.wins}</TableCell>
                    <TableCell className="text-right">{team.losses}</TableCell>
                    <TableCell className="text-right">{team.ties}</TableCell>
                    <TableCell className="text-right">{team.points_for.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{team.points_against.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      {(team.points_for - team.points_against).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
