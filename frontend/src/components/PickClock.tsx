import { cn } from "@/lib/utils"
import { TeamAvatar } from "@/components/TeamAvatar"

interface Props {
  onClockName: string | null | undefined
  round: number
  pick: number
  totalPicks: number
  isMyPick?: boolean
  status: "not_started" | "in_progress" | "complete"
  className?: string
}

export function PickClock({ onClockName, round, pick, totalPicks, isMyPick, status, className }: Props) {
  if (status === "complete") {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5 text-center", className)}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
        <div className="text-display text-3xl text-foreground mt-1">DRAFT COMPLETE</div>
        <div className="text-sm text-muted-foreground mt-2">Rosters set · move on to your lineup.</div>
      </div>
    )
  }
  if (status === "not_started") {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5 text-center", className)}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
        <div className="text-display text-3xl text-foreground mt-1">NOT STARTED</div>
        <div className="text-sm text-muted-foreground mt-2">Waiting on commissioner to start the draft.</div>
      </div>
    )
  }
  return (
    <div className={cn(
      "rounded-lg overflow-hidden border transition-shadow",
      isMyPick
        ? "border-primary shadow-[0_0_0_1px_var(--color-primary),0_0_24px_-4px_var(--color-primary)]"
        : "border-border",
      className,
    )}>
      <div className="gradient-brand px-5 py-6 text-white relative">
        <div className="text-[10px] uppercase tracking-wider opacity-80">On the clock</div>
        <div className="flex items-center gap-3 mt-2">
          <TeamAvatar name={onClockName} size={48} />
          <div className="min-w-0">
            <div className="text-xl font-bold truncate">{onClockName ?? "—"}</div>
            <div className="text-xs opacity-90">Round {round} · Pick {pick} of {totalPicks}</div>
          </div>
        </div>
        {isMyPick && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/25 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider animate-in fade-in zoom-in-95 duration-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            You're up
          </div>
        )}
      </div>
      <div className="bg-card px-5 py-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall progress</span>
          <span className="font-bold stat-num">{pick - 1} / {totalPicks}</span>
        </div>
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, ((pick - 1) / totalPicks) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
