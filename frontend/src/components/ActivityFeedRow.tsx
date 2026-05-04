import { cn } from "@/lib/utils"
import type { Transaction } from "@/types/league"
import { ArrowRightLeft, UserPlus, Trophy, Pencil, Activity, X, ChevronsRight, Calendar } from "lucide-react"

const ICON_FOR: Record<string, typeof Activity> = {
  trade: ArrowRightLeft,
  trade_proposed: ChevronsRight,
  trade_rejected: X,
  trade_cancelled: X,
  draft_pick: UserPlus,
  draft: UserPlus,
  matchup_settled: Trophy,
  week_advanced: Calendar,
  lineup_set: Pencil,
}

const COLOR_FOR: Record<string, string> = {
  trade: "text-emerald-400",
  trade_proposed: "text-primary",
  trade_rejected: "text-amber-400",
  trade_cancelled: "text-muted-foreground",
  draft_pick: "text-primary",
  matchup_settled: "text-primary",
}

interface Props {
  transaction: Transaction
  className?: string
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ActivityFeedRow({ transaction, className }: Props) {
  const Icon = ICON_FOR[transaction.type] ?? Activity
  const tone = COLOR_FOR[transaction.type] ?? "text-secondary-foreground"
  return (
    <div className={cn("flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0", className)}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground leading-tight">
          {transaction.summary}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {transaction.team?.name && <span className="font-medium">{transaction.team.name}</span>}
          <span>·</span>
          <span>{relativeTime(transaction.created_at)}</span>
        </div>
      </div>
    </div>
  )
}
