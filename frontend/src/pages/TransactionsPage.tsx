import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/services/api"
import { listTransactions } from "@/services/leagues"
import type { Transaction } from "@/types/league"

import { ActivityFeedRow } from "@/components/ActivityFeedRow"
import { cn } from "@/lib/utils"

const FILTERS = [
  { key: "all",      label: "All",       hint: "Every event in the league." },
  { key: "trade",    label: "Trades",    hint: "Proposals, accepts, rejects, cancels." },
  { key: "draft",    label: "Draft",     hint: "Each pick made during the draft." },
  { key: "lineup",   label: "Lineups",   hint: "When a manager sets their starting roster." },
  { key: "weeks",    label: "Week recaps", hint: "When a week ends and matchup scores are finalized." },
] as const

type FilterKey = typeof FILTERS[number]["key"]

function matchesFilter(tx: Transaction, key: FilterKey): boolean {
  if (key === "all") return true
  if (key === "trade") return tx.type.startsWith("trade")
  if (key === "draft") return tx.type.startsWith("draft")
  if (key === "lineup") return tx.type.startsWith("lineup")
  if (key === "weeks") return tx.type === "week_advanced" || tx.type.startsWith("matchup")
  return false
}

export function TransactionsPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const [transactions, setTransactions] = useState<Transaction[] | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")

  useEffect(() => {
    if (!id) return
    listTransactions(id)
      .then(setTransactions)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load activity."
        toast.error(message)
        setTransactions([])
      })
  }, [id])

  const filtered = useMemo(() => {
    if (!transactions) return []
    return transactions.filter((tx) => matchesFilter(tx, filter))
  }, [transactions, filter])

  return (
    <div className="space-y-6">
      <header>
        <div className="text-display text-4xl md:text-5xl text-foreground leading-none">ACTIVITY</div>
        <p className="text-sm text-muted-foreground mt-2">
          Every trade, draft pick, lineup change, and end-of-week recap.
        </p>
      </header>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              title={f.hint}
              className={cn(
                "px-3 py-1.5 text-sm font-bold uppercase tracking-wider rounded-md border transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {FILTERS.find((f) => f.key === filter)?.hint}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {transactions === null ? (
          <Skeleton className="h-96" />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No activity to show{filter !== "all" ? " in this category" : ""}.
          </div>
        ) : (
          <div className="px-4">
            {filtered.map((tx) => <ActivityFeedRow key={tx.id} transaction={tx} />)}
          </div>
        )}
      </div>
    </div>
  )
}
