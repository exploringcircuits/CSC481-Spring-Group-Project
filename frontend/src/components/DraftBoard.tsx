import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { TeamAvatar } from "@/components/TeamAvatar"
import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { PositionChip } from "@/components/PositionChip"
import type { Draft, LeagueMember } from "@/types/league"

interface Props {
  draft: Draft
  members: LeagueMember[]
  rounds: number
  className?: string
}

type ViewMode = "round" | "position"

const POSITION_TONES: Record<string, string> = {
  PG: "border-l-2 border-l-sky-400/60",
  SG: "border-l-2 border-l-emerald-400/60",
  SF: "border-l-2 border-l-amber-400/60",
  PF: "border-l-2 border-l-orange-400/60",
  C:  "border-l-2 border-l-violet-400/60",
}

const POSITION_ORDER = ["PG", "SG", "SF", "PF", "C"]

export function DraftBoard({ draft, members, rounds, className }: Props) {
  const [view, setView] = useState<ViewMode>("round")
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const teamCount = draft.draft_order.length
  const totalPicks = teamCount * rounds

  // Latest selection — used to highlight the freshly-made pick with a slide-in
  const latestPickNumber = draft.selections.length > 0
    ? Math.max(...draft.selections.map(s => s.pick_number))
    : 0

  // Auto-scroll the active row into view when current_pick_index advances.
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const activeRowRef = useRef<HTMLTableRowElement | null>(null)
  useEffect(() => {
    if (draft.status !== "in_progress" || !activeRowRef.current) return
    activeRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [draft.current_pick_index, draft.status, view])

  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/40">
        <div>
          <div className="text-eyebrow text-primary">Draft board</div>
          <div className="text-condensed text-base uppercase tracking-wide">
            {view === "round" ? "BY ROUND" : "BY POSITION"}
          </div>
        </div>
        <div className="inline-flex border border-border bg-card overflow-hidden text-xs">
          <button
            onClick={() => setView("round")}
            className={cn(
              "px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors",
              view === "round"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Round
          </button>
          <button
            onClick={() => setView("position")}
            className={cn(
              "px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors border-l border-border",
              view === "position"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Position
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="overflow-x-auto overflow-y-auto max-h-[70vh] scroll-smooth">
        {view === "round" ? (
          <RoundView
            draft={draft}
            memberById={memberById}
            teamCount={teamCount}
            rounds={rounds}
            latestPickNumber={latestPickNumber}
            activeRowRef={activeRowRef}
          />
        ) : (
          <PositionView
            draft={draft}
            memberById={memberById}
            teamCount={teamCount}
            latestPickNumber={latestPickNumber}
          />
        )}
      </div>

      <div className="px-4 py-2 bg-muted/30 border-t border-border text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-3">
        <span>{draft.selections.length} of {totalPicks} picks complete</span>
        <span className="opacity-50">·</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary animate-pulse" /> on the clock
        </span>
      </div>
    </div>
  )
}

function RoundView({
  draft,
  memberById,
  teamCount,
  rounds,
  latestPickNumber,
  activeRowRef,
}: {
  draft: Draft
  memberById: Map<number, LeagueMember>
  teamCount: number
  rounds: number
  latestPickNumber: number
  activeRowRef: React.RefObject<HTMLTableRowElement | null>
}) {
  const grid: { memberId: number; pickNumber: number }[][] = []
  for (let r = 0; r < rounds; r++) {
    const row: { memberId: number; pickNumber: number }[] = []
    const reverse = r % 2 === 1
    for (let c = 0; c < teamCount; c++) {
      const orderIdx = reverse ? teamCount - 1 - c : c
      const memberId = draft.draft_order[orderIdx]
      const pickNumber = r * teamCount + c + 1
      row.push({ memberId, pickNumber })
    }
    grid.push(row)
  }

  const byPick = new Map<number, Draft["selections"][number]>()
  for (const sel of draft.selections) byPick.set(sel.pick_number, sel)

  const activeRound = Math.floor(draft.current_pick_index / teamCount)

  return (
    <table className="text-xs border-collapse min-w-full">
      <thead className="sticky top-0 z-20">
        <tr className="bg-muted/60 backdrop-blur">
          <th className="sticky left-0 z-30 bg-muted/80 backdrop-blur px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            Round
          </th>
          {Array.from({ length: teamCount }, (_, i) => {
            const memberId = draft.draft_order[i]
            const m = memberById.get(memberId)
            return (
              <th key={i} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border min-w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  <TeamAvatar name={m?.display_name ?? `Team ${i + 1}`} size={24} />
                  <span className="truncate max-w-[110px]">{m?.display_name ?? `Team ${i + 1}`}</span>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {grid.map((row, r) => (
          <tr
            key={r}
            ref={r === activeRound ? activeRowRef : undefined}
            className="border-b border-border/50 last:border-0"
          >
            <td className="sticky left-0 z-10 bg-muted/40 backdrop-blur px-3 py-2 text-display text-base text-muted-foreground font-bold">
              R{r + 1}
            </td>
            {row.map((cell) => {
              const sel = byPick.get(cell.pickNumber)
              const isCurrent = !sel && cell.pickNumber === draft.current_pick_index + 1 && draft.status === "in_progress"
              return (
                <DraftCell
                  key={cell.pickNumber}
                  pickNumber={cell.pickNumber}
                  selection={sel ?? null}
                  isCurrent={isCurrent}
                  isLatest={!!sel && sel.pick_number === latestPickNumber}
                />
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PositionView({
  draft,
  memberById,
  teamCount,
  latestPickNumber,
}: {
  draft: Draft
  memberById: Map<number, LeagueMember>
  teamCount: number
  latestPickNumber: number
}) {
  // Group selections by team (member id), then index by primary position.
  const byTeam = new Map<number, Map<string, Draft["selections"][number][]>>()
  for (const sel of draft.selections) {
    const teamMap = byTeam.get(sel.member.id) ?? new Map<string, Draft["selections"][number][]>()
    const pos = sel.player.primary_position || "—"
    const arr = teamMap.get(pos) ?? []
    arr.push(sel)
    teamMap.set(pos, arr)
    byTeam.set(sel.member.id, teamMap)
  }

  const positionsPresent = new Set<string>()
  for (const sel of draft.selections) {
    positionsPresent.add(sel.player.primary_position || "—")
  }
  const positions = POSITION_ORDER.filter(p => positionsPresent.has(p))
  if (positionsPresent.has("—")) positions.push("—")

  return (
    <table className="text-xs border-collapse min-w-full">
      <thead className="sticky top-0 z-20">
        <tr className="bg-muted/60 backdrop-blur">
          <th className="sticky left-0 z-30 bg-muted/80 backdrop-blur px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            Position
          </th>
          {Array.from({ length: teamCount }, (_, i) => {
            const memberId = draft.draft_order[i]
            const m = memberById.get(memberId)
            return (
              <th key={i} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border min-w-[140px]">
                <div className="flex flex-col items-center gap-1">
                  <TeamAvatar name={m?.display_name ?? `Team ${i + 1}`} size={24} />
                  <span className="truncate max-w-[130px]">{m?.display_name ?? `Team ${i + 1}`}</span>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {positions.length === 0 ? (
          <tr>
            <td colSpan={teamCount + 1} className="px-4 py-12 text-center text-sm text-muted-foreground">
              No picks yet — switch back to Round view to see the on-the-clock pick.
            </td>
          </tr>
        ) : (
          positions.map((pos) => (
            <tr key={pos} className="border-b border-border/50 last:border-0 align-top">
              <td className="sticky left-0 z-10 bg-muted/40 backdrop-blur px-3 py-2 text-display text-base text-muted-foreground font-bold">
                {pos}
              </td>
              {Array.from({ length: teamCount }, (_, i) => {
                const memberId = draft.draft_order[i]
                const sels = byTeam.get(memberId)?.get(pos) ?? []
                return (
                  <td key={i} className="border-l border-border/30 p-1.5 align-top">
                    <div className="space-y-1.5">
                      {sels.length === 0 ? (
                        <div className="h-6 text-[10px] text-muted-foreground/40 stat-num">—</div>
                      ) : (
                        sels.map((sel) => (
                          <PositionPickCard
                            key={sel.id}
                            selection={sel}
                            isLatest={sel.pick_number === latestPickNumber}
                          />
                        ))
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

function DraftCell({
  pickNumber,
  selection,
  isCurrent,
  isLatest,
}: {
  pickNumber: number
  selection: Draft["selections"][number] | null
  isCurrent: boolean
  isLatest: boolean
}) {
  if (selection) {
    const p = selection.player
    const tone = POSITION_TONES[p.primary_position] ?? ""
    return (
      <td className="border-l border-border/30 p-1.5 align-top">
        <div className={cn(
          "flex items-start gap-2 rounded bg-muted/30 p-1.5 transition-shadow",
          tone,
          isLatest && "animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-[0_0_0_1px_var(--color-primary)] bg-primary/5",
        )}>
          <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="xs" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-muted-foreground stat-num">#{pickNumber}</div>
            <div className="text-xs font-semibold truncate leading-tight">{p.full_name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <PositionChip position={p.primary_position} />
              <span className="text-[10px] text-muted-foreground">{p.team_abbr}</span>
            </div>
          </div>
        </div>
      </td>
    )
  }
  return (
    <td className={cn(
      "border-l border-border/30 p-1.5 align-top",
      isCurrent && "bg-primary/10 ring-2 ring-primary ring-inset",
    )}>
      <div className="flex items-center justify-center h-14 text-muted-foreground text-[10px] uppercase tracking-wider">
        {isCurrent ? (
          <span className="text-primary font-bold animate-pulse">PICK #{pickNumber}</span>
        ) : (
          <span className="opacity-40 stat-num">#{pickNumber}</span>
        )}
      </div>
    </td>
  )
}

function PositionPickCard({
  selection,
  isLatest,
}: {
  selection: Draft["selections"][number]
  isLatest: boolean
}) {
  const p = selection.player
  const tone = POSITION_TONES[p.primary_position] ?? ""
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded bg-muted/30 px-1.5 py-1",
      tone,
      isLatest && "animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-[0_0_0_1px_var(--color-primary)] bg-primary/5",
    )}>
      <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="xs" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold truncate leading-tight">{p.full_name}</div>
        <div className="text-[9px] text-muted-foreground stat-num">#{selection.pick_number} · {p.team_abbr}</div>
      </div>
    </div>
  )
}
