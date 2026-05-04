import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Activity, ArrowRight, ChevronRight, FastForward, Gavel, RefreshCw, Sparkles, Trophy, Users, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { ApiError } from "@/services/api"
import * as admin from "@/services/admin"
import type { AdminLeagueSummary, AdminStatus } from "@/services/admin"
import { cn } from "@/lib/utils"

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
      {/* Hero header */}
      <header className="surface-elevated p-7 relative overflow-hidden">
        <div className="absolute inset-0 court-stripe pointer-events-none" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-eyebrow text-primary">Admin</span>
              <Badge variant="outline" className="text-eyebrow border-primary/40 text-primary">site admin</Badge>
            </div>
            <h1 className="text-display text-5xl md:text-6xl mt-2 leading-[0.9]">
              Demo control room
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Presenter shortcuts: reset state, spin up the demo league, run the draft,
              simulate weeks, kick off playoffs, propose a sample trade.
            </p>
          </div>
          {primaryLeague && (
            <div className="text-right">
              <div className="text-eyebrow">Current league</div>
              <div className="text-condensed text-xl uppercase tracking-wide truncate">{primaryLeague.name}</div>
              <Link to={`/leagues/${primaryLeague.id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                Open league <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Snapshot strip */}
      {status === null ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 surface-elevated divide-x divide-border">
          <SnapshotStat label="Leagues"  value={status.totals.leagues} />
          <SnapshotStat label="Teams"    value={status.totals.teams} />
          <SnapshotStat label="Matchups" value={status.totals.matchups} />
          <SnapshotStat label="Trades"   value={status.totals.trades} />
          <SnapshotStat label="Players"  value={status.totals.players} />
        </div>
      )}

      {/* League list */}
      {status && (
        <section className="surface-elevated overflow-hidden">
          <header className="border-b border-border px-5 py-3">
            <div className="text-eyebrow">League roster</div>
            <div className="text-condensed text-xl uppercase tracking-wide">ALL LEAGUES</div>
          </header>
          <div className="divide-y divide-border/40">
            {status.leagues.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No leagues yet. Use <strong className="text-primary">Seed demo league</strong> below to begin.
              </div>
            ) : (
              status.leagues.map((l) => (
                <LeagueRow key={l.id} league={l} onOpen={() => navigate(`/leagues/${l.id}`)} />
              ))
            )}
          </div>
        </section>
      )}

      {/* Action board */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ActionPanel
          step="01"
          icon={RefreshCw}
          title="Setup"
          description="Wipe state, then seed a fresh demo league with bots."
        >
          <Action
            label="Reset everything"
            variant="outline"
            busy={busy}
            loading={activeAction === "reset"}
            onClick={() => run("reset", admin.adminReset)}
          />
          <Action
            label="Seed demo league"
            busy={busy}
            loading={activeAction === "seed"}
            onClick={() => run("seed", admin.adminSeedDemo, "Demo league seeded.")}
          />
        </ActionPanel>

        <ActionPanel
          step="02"
          icon={Gavel}
          title="Draft + schedule"
          description="Run the draft, lay down weekly matchups, set lineups."
        >
          <Action
            label="Run draft (autopick)"
            busy={busy}
            loading={activeAction === "draft"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("draft", () => admin.adminRunDraft(primaryLeague.id))
            }
          />
          <Action
            label="Build schedule"
            busy={busy}
            loading={activeAction === "schedule"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("schedule", () => admin.adminBuildSchedule(primaryLeague.id))
            }
          />
          <Action
            label="Set default lineups"
            variant="outline"
            busy={busy}
            loading={activeAction === "lineups"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("lineups", () => admin.adminSetDefaultLineups(primaryLeague.id))
            }
          />
        </ActionPanel>

        <ActionPanel
          step="03"
          icon={FastForward}
          title="Game flow"
          description="Advance time, simulate weeks, kick off and roll playoffs."
        >
          <Action
            label="Advance one week"
            variant="outline"
            busy={busy}
            loading={activeAction === "advance"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("advance", () => admin.adminAdvanceWeek(primaryLeague.id))
            }
          />
          <Action
            label="Simulate to playoffs"
            busy={busy}
            loading={activeAction === "to-playoffs"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("to-playoffs", () => admin.adminSimulateToPlayoffs(primaryLeague.id))
            }
          />
          <Action
            label="Start playoffs"
            busy={busy}
            loading={activeAction === "start-playoffs"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("start-playoffs", () => admin.adminStartPlayoffs(primaryLeague.id))
            }
          />
          <Action
            label="Simulate next round"
            variant="outline"
            busy={busy}
            loading={activeAction === "next"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague && run("next", () => admin.adminSimulateNext(primaryLeague.id))
            }
          />
        </ActionPanel>
      </div>

      {/* Showcase */}
      <section className="surface-elevated overflow-hidden">
        <header className="border-b border-border px-5 py-3 flex items-center gap-3">
          <div className="h-8 w-8 flex items-center justify-center bg-primary/10 border border-primary/30 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-eyebrow">Live moments</div>
            <div className="text-condensed text-xl uppercase tracking-wide">DEMO SHOWCASE</div>
          </div>
        </header>
        <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ShowcaseLink to={primaryLeague ? `/leagues/${primaryLeague.id}/draft` : "#"} icon={Gavel} label="Draft board" disabled={!primaryLeague} />
          <ShowcaseLink to={primaryLeague ? `/leagues/${primaryLeague.id}/draft/setup` : "#"} icon={Zap} label="Draft setup" disabled={!primaryLeague} />
          <ShowcaseLink to={primaryLeague ? `/leagues/${primaryLeague.id}/standings` : "#"} icon={Trophy} label="Standings" disabled={!primaryLeague} />
          <ShowcaseLink to={primaryLeague ? `/leagues/${primaryLeague.id}/bracket` : "#"} icon={Trophy} label="Playoff bracket" disabled={!primaryLeague} />
          <ShowcaseLink to={primaryLeague ? `/leagues/${primaryLeague.id}/trades` : "#"} icon={Activity} label="Trades" disabled={!primaryLeague} />
          <ShowcaseLink to={primaryLeague ? `/leagues/${primaryLeague.id}/members` : "#"} icon={Users} label="Members" disabled={!primaryLeague} />
        </div>
        <div className="border-t border-border px-5 py-4 bg-secondary/40">
          <Action
            label="Propose example trade"
            busy={busy}
            loading={activeAction === "trade"}
            disabled={!primaryLeague}
            onClick={() =>
              primaryLeague &&
              run("trade", () => admin.adminExampleTrade(primaryLeague.id), "Example trade proposed.")
            }
          />
        </div>
      </section>
    </div>
  )
}

function SnapshotStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <div className="text-eyebrow">{label}</div>
      <div className="stat-display text-3xl text-foreground mt-1 leading-none">{value}</div>
    </div>
  )
}

function LeagueRow({ league, onOpen }: { league: AdminLeagueSummary; onOpen: () => void }) {
  const status =
    league.status === "complete"
      ? { tone: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10", label: "Complete" }
      : league.status === "playoffs"
        ? { tone: "border-amber-500/40 text-amber-400 bg-amber-500/10", label: "Playoffs" }
        : league.status === "regular"
          ? { tone: "border-primary/40 text-primary bg-primary/10", label: "Regular Season" }
          : league.status === "drafting"
            ? { tone: "border-primary/30 text-primary bg-secondary", label: "Drafting" }
            : { tone: "border-border text-muted-foreground bg-secondary", label: "Setup" }

  return (
    <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-primary/5 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold truncate">{league.name}</span>
          <span className={cn("text-eyebrow border px-2 py-0.5", status.tone)}>{status.label}</span>
        </div>
        <div className="text-xs text-muted-foreground stat-num">
          {league.team_count} teams · {league.draft_picks} picks · Week {league.current_week_number || "—"} · Reg {league.regular_weeks_settled}/{league.regular_weeks_total} · PO {league.playoff_weeks_settled}/{league.playoff_weeks_total}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        Open <ArrowRight className="h-3 w-3 ml-1.5" />
      </Button>
    </div>
  )
}

function ActionPanel({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="surface-elevated overflow-hidden">
      <header className="border-b border-border px-5 py-4 flex items-start gap-3">
        <div className="text-display text-2xl text-primary leading-none w-7">{step}</div>
        <div className="h-9 w-9 flex items-center justify-center bg-primary/10 border border-primary/30 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-condensed text-lg uppercase tracking-wide">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
      </header>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  )
}

interface ActionProps {
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: "default" | "outline"
  busy?: boolean
}

function Action({ label, onClick, loading, disabled, variant = "default", busy }: ActionProps) {
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

function ShowcaseLink({
  to, icon: Icon, label, disabled,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div className="border border-border bg-secondary/30 px-4 py-3 flex items-center gap-3 opacity-50 cursor-not-allowed">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
    )
  }
  return (
    <Link
      to={to}
      className="border border-border bg-secondary/30 px-4 py-3 flex items-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-semibold flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  )
}
