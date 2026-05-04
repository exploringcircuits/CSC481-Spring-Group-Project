import { cn } from "@/lib/utils"
import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { TeamLogo } from "@/components/TeamLogo"
import { PositionChip } from "@/components/PositionChip"
import { StatusBadge } from "@/components/StatusBadge"
import type { PlayerLight, RosterSlot } from "@/types/league"
import { Plus } from "lucide-react"

interface Props {
  template: RosterSlot[]
  assignments: Record<string, PlayerLight | null>
  onSlotClick?: (slot: RosterSlot) => void
  className?: string
}

export function RosterSlotGrid({ template, assignments, onSlotClick, className }: Props) {
  const starters = template.filter((s) => s.starter)
  const bench = template.filter((s) => !s.starter)

  return (
    <div className={cn("space-y-4", className)}>
      <Section title="Starters" slots={starters} assignments={assignments} onSlotClick={onSlotClick} />
      {bench.length > 0 && (
        <Section title="Bench" slots={bench} assignments={assignments} onSlotClick={onSlotClick} muted />
      )}
    </div>
  )
}

function Section({
  title, slots, assignments, onSlotClick, muted,
}: {
  title: string
  slots: RosterSlot[]
  assignments: Record<string, PlayerLight | null>
  onSlotClick?: (slot: RosterSlot) => void
  muted?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="grid gap-2 md:grid-cols-2">
        {slots.map((slot) => {
          const player = assignments[slot.slot]
          return (
            <button
              key={slot.slot}
              type="button"
              onClick={onSlotClick ? () => onSlotClick(slot) : undefined}
              disabled={!onSlotClick}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all",
                onSlotClick && "hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
                muted && "opacity-80",
              )}
            >
              {/* Slot label */}
              <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
                <PositionChip position={slot.slot} size="md" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {slot.allowed.join("/")}
                </span>
              </div>

              {/* Player */}
              {player ? (
                <>
                  <PlayerHeadshot nbaPlayerId={player.nba_player_id} fullName={player.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{player.full_name}</span>
                      <StatusBadge status={player.injury_status} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PositionChip position={player.primary_position} />
                      {player.team_abbr && <TeamLogo teamAbbr={player.team_abbr} size={16} />}
                      <span className="text-xs text-muted-foreground">{player.team_abbr}</span>
                    </div>
                  </div>
                  {player.fantasy_ppg != null && (
                    <div className="text-right">
                      <div className="text-display text-xl text-primary leading-none">{player.fantasy_ppg.toFixed(1)}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">FPPG</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 flex-1 text-muted-foreground">
                  {onSlotClick ? (
                    <>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border group-hover:border-primary/60">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm italic">Empty — click to assign</span>
                    </>
                  ) : (
                    <span className="text-sm italic">Empty</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
