import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { TeamLogo } from "@/components/TeamLogo"
import { PositionChip } from "@/components/PositionChip"
import { StatusBadge } from "@/components/StatusBadge"
import type { PlayerLight, RosterEntry, RosterSlot } from "@/types/league"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: RosterSlot | null
  roster: RosterEntry[]
  currentPlayer: PlayerLight | null
  /** Map of slot → player_id currently used by other slots — disables those rows. */
  usedElsewhere: Set<number>
  onAssign: (playerId: number | null) => void | Promise<void>
}

export function LineupEditorModal({ open, onOpenChange, slot, roster, currentPlayer, usedElsewhere, onAssign }: Props) {
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)

  const eligible = useMemo(() => {
    if (!slot) return []
    const allowed = new Set(slot.allowed)
    return roster
      .filter((r) => allowed.has(r.player.primary_position))
      .filter((r) => !search || r.player.full_name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.player.fantasy_ppg ?? -1) - (a.player.fantasy_ppg ?? -1))
  }, [roster, slot, search])

  async function handlePick(playerId: number | null) {
    setBusy(true)
    try {
      await onAssign(playerId)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Set lineup
            {slot && <PositionChip position={slot.slot} size="md" />}
          </DialogTitle>
          <DialogDescription>
            {slot ? <>Eligible positions: <span className="font-semibold">{slot.allowed.join(" / ")}</span></> : "Pick a player for this slot."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder="Search your roster…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border divide-y divide-border/40">
            {eligible.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No eligible players on your roster.
              </div>
            ) : (
              eligible.map((r) => {
                const p = r.player
                const isCurrent = currentPlayer?.id === p.id
                const isUsed = usedElsewhere.has(p.id) && !isCurrent
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={isUsed || busy}
                    onClick={() => handlePick(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      "hover:bg-primary/5",
                      isCurrent && "bg-primary/10",
                      isUsed && "opacity-40 cursor-not-allowed hover:bg-transparent",
                    )}
                  >
                    <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{p.full_name}</span>
                        <StatusBadge status={p.injury_status} />
                        {isCurrent && (
                          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-primary/20 text-primary">
                            Current
                          </span>
                        )}
                        {isUsed && (
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            In another slot
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <PositionChip position={p.primary_position} />
                        {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
                        <span className="text-xs text-muted-foreground">{p.team_abbr}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-display text-base text-primary leading-none">{p.fantasy_ppg?.toFixed(1) ?? "—"}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">FPPG</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {currentPlayer ? (
            <Button variant="outline" disabled={busy} onClick={() => handlePick(null)}>
              Clear slot
            </Button>
          ) : <span />}
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
