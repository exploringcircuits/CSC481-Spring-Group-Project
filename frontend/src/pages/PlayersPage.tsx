import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import { listPlayers } from "@/services/players"
import type { PaginatedResponse, PlayerLight } from "@/types/league"

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"]

export function PlayersPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [data, setData] = useState<PaginatedResponse<PlayerLight> | null>(null)
  const [position, setPosition] = useState("All")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [availableOnly, setAvailableOnly] = useState(false)

  useEffect(() => {
    listPlayers({
      position: position === "All" ? undefined : position,
      search: search || undefined,
      page,
      available_in_league: availableOnly && leagueId ? Number(leagueId) : undefined,
    })
      .then(setData)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load players."
        toast.error(message)
      })
  }, [position, search, page, availableOnly, leagueId])

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.count / 50))
  }, [data])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted-foreground">
          All current NBA players. Sortable, searchable, and projected against this league&apos;s scoring.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Player name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position">Position</Label>
            <Select
              value={position}
              onValueChange={(v) => {
                setPosition(v)
                setPage(1)
              }}
            >
              <SelectTrigger id="position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {leagueId && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Button
                variant={availableOnly ? "default" : "outline"}
                onClick={() => {
                  setAvailableOnly((v) => !v)
                  setPage(1)
                }}
                className="w-full"
              >
                {availableOnly ? "Available only ✓" : "All players"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {data === null ? (
            <Skeleton className="h-64" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead className="text-right">FPPG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell>{p.team_abbr || "—"}</TableCell>
                    <TableCell>{p.primary_position || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.fantasy_ppg !== null ? p.fantasy_ppg.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.count > 50 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {Math.min((page - 1) * 50 + 1, data.count)}–{Math.min(page * 50, data.count)} of{" "}
            {data.count}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
