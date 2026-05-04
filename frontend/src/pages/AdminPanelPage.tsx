import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
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
import { useAuth } from "@/hooks/useAuth"
import { ApiError } from "@/services/api"
import * as admin from "@/services/admin"
import type { AdminLeagueSummary, AdminStatus } from "@/services/admin"

type ActionFn = () => Promise<unknown>

export function AdminPanelPage() {
  const { isStaff, isLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [activeAction, setActiveAction] = useState<string | null>(null)

  async function refresh() {
    try {
      const s = await admin.getAdminStatus()
      setStatus(s)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not load status."
      toast.error(message)
    }
  }

  useEffect(() => {
    if (isStaff) refresh()
  }, [isStaff])

  if (isLoading) return null
  if (!isStaff) return <Navigate to="/leagues" replace />

  async function run(name: string, fn: ActionFn, successMessage?: string) {
    setActiveAction(name)
    try {
      const result = await fn()
      const detail =
        result && typeof result === "object" && "detail" in result
          ? String((result as { detail: unknown }).detail)
          : null
      toast.success(successMessage ?? detail ?? "Done.")
      await refresh()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed."
      toast.error(message)
    } finally {
      setActiveAction(null)
    }
  }

  const primaryLeague = status?.leagues[0] ?? null
  const busy = activeAction !== null

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Admin demo panel</h1>
          <Badge variant="outline">site admin</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Presenter shortcuts: reset state, spin up the demo league, run the draft, simulate
          weeks, start playoffs, propose a sample trade.
        </p>
      </header>

      {status === null ? (
        <Skeleton className="h-44" />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Snapshot</CardTitle>
            <CardDescription>
              Players: {status.totals.players} · Leagues: {status.totals.leagues} · Teams:{" "}
              {status.totals.teams} · Matchups: {status.totals.matchups} · Trades:{" "}
              {status.totals.trades}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status.leagues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No leagues yet. Click <strong>Seed demo league</strong> to begin.
              </p>
            ) : (
              <div className="space-y-3">
                {status.leagues.map((l) => (
                  <LeagueRow
                    key={l.id}
                    league={l}
                    onOpen={() => navigate(`/leagues/${l.id}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Setup</CardTitle>
            <CardDescription>Wipe state, then seed a fresh demo league.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ActionButton
              label="Reset everything"
              variant="outline"
              busy={busy}
              loading={activeAction === "reset"}
              onClick={() => run("reset", admin.adminReset)}
            />
            <ActionButton
              label="Seed demo league"
              busy={busy}
              loading={activeAction === "seed"}
              onClick={() => run("seed", admin.adminSeedDemo, "Demo league seeded.")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Draft + schedule</CardTitle>
            <CardDescription>Run the draft and lay down weekly matchups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ActionButton
              label="Run draft (autopick)"
              busy={busy}
              loading={activeAction === "draft"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague && run("draft", () => admin.adminRunDraft(primaryLeague.id))
              }
            />
            <ActionButton
              label="Build schedule"
              busy={busy}
              loading={activeAction === "schedule"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague && run("schedule", () => admin.adminBuildSchedule(primaryLeague.id))
              }
            />
            <ActionButton
              label="Set default lineups"
              variant="outline"
              busy={busy}
              loading={activeAction === "lineups"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague &&
                run("lineups", () => admin.adminSetDefaultLineups(primaryLeague.id))
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Game flow</CardTitle>
            <CardDescription>
              Advance time, simulate weeks, start playoffs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ActionButton
              label="Advance one week"
              variant="outline"
              busy={busy}
              loading={activeAction === "advance"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague && run("advance", () => admin.adminAdvanceWeek(primaryLeague.id))
              }
            />
            <ActionButton
              label="Simulate to playoffs"
              busy={busy}
              loading={activeAction === "to-playoffs"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague &&
                run("to-playoffs", () => admin.adminSimulateToPlayoffs(primaryLeague.id))
              }
            />
            <ActionButton
              label="Start playoffs"
              busy={busy}
              loading={activeAction === "start-playoffs"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague &&
                run("start-playoffs", () => admin.adminStartPlayoffs(primaryLeague.id))
              }
            />
            <ActionButton
              label="Simulate next round"
              variant="outline"
              busy={busy}
              loading={activeAction === "next"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague && run("next", () => admin.adminSimulateNext(primaryLeague.id))
              }
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Showcase actions</CardTitle>
            <CardDescription>
              Interactive moments worth demoing live.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <ActionButton
              label="Propose example trade"
              busy={busy}
              loading={activeAction === "trade"}
              disabled={!primaryLeague}
              onClick={() =>
                primaryLeague &&
                run("trade", () => admin.adminExampleTrade(primaryLeague.id), "Example trade proposed.")
              }
            />
            <Button asChild variant="outline" disabled={!primaryLeague}>
              <Link to={primaryLeague ? `/leagues/${primaryLeague.id}/draft` : "#"}>
                Open draft board
              </Link>
            </Button>
            <Button asChild variant="outline" disabled={!primaryLeague}>
              <Link to={primaryLeague ? `/leagues/${primaryLeague.id}/standings` : "#"}>
                Open standings
              </Link>
            </Button>
            <Button asChild variant="outline" disabled={!primaryLeague}>
              <Link to={primaryLeague ? `/leagues/${primaryLeague.id}/bracket` : "#"}>
                Open bracket
              </Link>
            </Button>
            <Button asChild variant="outline" disabled={!primaryLeague}>
              <Link to={primaryLeague ? `/leagues/${primaryLeague.id}/trades` : "#"}>
                Open trades
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LeagueRow({
  league,
  onOpen,
}: {
  league: AdminLeagueSummary
  onOpen: () => void
}) {
  const status =
    league.status === "complete"
      ? { tone: "secondary" as const, label: "Complete" }
      : league.status === "playoffs"
        ? { tone: "default" as const, label: "Playoffs" }
        : league.status === "regular"
          ? { tone: "default" as const, label: "Regular Season" }
          : league.status === "drafting"
            ? { tone: "secondary" as const, label: "Drafting" }
            : { tone: "outline" as const, label: "Setup" }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{league.name}</span>
            <Badge variant={status.tone}>{status.label}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {league.team_count} teams · {league.draft_picks} picks · Week{" "}
            {league.current_week_number || "—"} · Regular {league.regular_weeks_settled}/
            {league.regular_weeks_total} · Playoffs{" "}
            {league.playoff_weeks_settled}/{league.playoff_weeks_total}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onOpen}>
          Open
        </Button>
      </div>
      {league.standings_top.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            {league.standings_top.map((t, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {i + 1}. {t.name}
                </span>
                <span>
                  {t.record} · {t.points_for.toFixed(0)} PF
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface ActionButtonProps {
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: "default" | "outline"
  busy?: boolean
}

function ActionButton({
  label,
  onClick,
  loading,
  disabled,
  variant = "default",
  busy,
}: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled || (busy && !loading)}
      className="w-full justify-start"
    >
      {loading ? "Running…" : label}
    </Button>
  )
}
