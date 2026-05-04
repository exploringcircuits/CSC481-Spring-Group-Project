import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Sparkles, RotateCcw, Trophy, ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { listPlayers } from "@/services/players"
import type { Player } from "@/types/league"

import { PlayerHeadshot } from "@/components/PlayerHeadshot"
import { TeamLogo } from "@/components/TeamLogo"
import { PositionChip } from "@/components/PositionChip"
import { cn } from "@/lib/utils"

const TEAM_COUNT = 12
const ROUNDS = 6
const TOTAL_PICKS = TEAM_COUNT * ROUNDS

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"] as const

const BOT_NAMES = [
  "—", "The Boards", "Iso Joe", "Pick & Pop", "Glass Cleaners",
  "Triple-Doubles", "Splash Squad", "Trail Mix", "Hardwood Heroes",
  "Court Generals", "Rim Rockers", "Pick-Six",
]

type Selection = {
  pickNumber: number
  round: number
  slot: number
  playerId: number
  player: Player
  isUser: boolean
}

function pickToSlot(pickNumber: number): number {
  const round = Math.ceil(pickNumber / TEAM_COUNT)
  const indexInRound = ((pickNumber - 1) % TEAM_COUNT) + 1
  return round % 2 === 1 ? indexInRound : TEAM_COUNT - indexInRound + 1
}

export function MockDraftPage() {
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [userSlot, setUserSlot] = useState(1)
  const [phase, setPhase] = useState<"setup" | "drafting" | "complete">("setup")
  const [selections, setSelections] = useState<Selection[]>([])
  const [position, setPosition] = useState<typeof POSITIONS[number]>("All")
  const [search, setSearch] = useState("")

  useEffect(() => {
    listPlayers({ ordering: "-fppg", min_gp: 10, page: 1 })
      .then((res) => setPlayers(res.results))
      .catch(() => {
        toast.error("Could not load player pool. Try again.")
      })
  }, [])

  const draftedIds = useMemo(() => new Set(selections.map(s => s.playerId)), [selections])

  const available = useMemo(() => {
    if (!players) return []
    return players.filter((p) => {
      if (draftedIds.has(p.id)) return false
      if (position !== "All" && p.primary_position !== position) return false
      if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [players, draftedIds, position, search])

  const currentPick = selections.length + 1
  const currentRound = Math.ceil(currentPick / TEAM_COUNT)
  const onClockSlot = phase === "drafting" ? pickToSlot(currentPick) : null
  const isUserTurn = onClockSlot === userSlot

  function makePick(player: Player, isUser: boolean) {
    if (!players) return
    const slot = pickToSlot(currentPick)
    setSelections((prev) => [
      ...prev,
      {
        pickNumber: currentPick,
        round: currentRound,
        slot,
        playerId: player.id,
        player,
        isUser,
      },
    ])
  }

  // Bot picks: pick highest-FPPG available with a small dash of randomness.
  function botSelect(): Player | null {
    if (!players) return null
    const remaining = players.filter((p) => !draftedIds.has(p.id))
    if (remaining.length === 0) return null
    const top = remaining.slice(0, 5)
    const idx = Math.floor(Math.random() * Math.min(3, top.length))
    return top[idx]
  }

  // Drive the bots: any time it's not the user's turn (and we're drafting), auto-pick.
  useEffect(() => {
    if (phase !== "drafting") return
    if (currentPick > TOTAL_PICKS) {
      setPhase("complete")
      return
    }
    if (isUserTurn) return

    // Small delay so the user sees the picks tick by.
    const t = setTimeout(() => {
      const pick = botSelect()
      if (pick) makePick(pick, false)
    }, 220)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selections.length])

  function start() {
    setPhase("drafting")
    setSelections([])
  }

  function reset() {
    setPhase("setup")
    setSelections([])
  }

  const userRoster = selections.filter((s) => s.isUser)

  if (!players) {
    return (
      <div className="min-h-screen gradient-spotlight">
        <MockDraftHeader />
        <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-6">
          <Skeleton className="h-20" />
          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            <Skeleton className="h-[600px]" />
            <Skeleton className="h-[600px]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-spotlight">
      <MockDraftHeader />
      <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        {phase === "setup" && (
          <SetupView
            userSlot={userSlot}
            setUserSlot={setUserSlot}
            playerCount={players.length}
            onStart={start}
          />
        )}

        {phase !== "setup" && (
          <>
            <DraftStatusBar
              phase={phase}
              currentPick={currentPick}
              currentRound={currentRound}
              onClockSlot={onClockSlot}
              userSlot={userSlot}
              onReset={reset}
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <UserRosterCard roster={userRoster} userSlot={userSlot} />
                <PickHistory selections={selections} userSlot={userSlot} />
              </div>

              <AvailablePlayersCard
                available={available}
                position={position}
                setPosition={setPosition}
                search={search}
                setSearch={setSearch}
                isUserTurn={isUserTurn}
                phase={phase}
                onPick={(p) => makePick(p, true)}
              />
            </div>
          </>
        )}

        {phase === "complete" && (
          <CompleteView userRoster={userRoster} onReset={reset} />
        )}
      </div>
    </div>
  )
}

function MockDraftHeader() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3 group">
          <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <img
            src="/fantasy-fanatics-logo.svg"
            alt="Fantasy Fanatics"
            className="h-8 w-auto"
          />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-eyebrow text-primary hidden sm:inline">Mock draft · No account needed</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/signup">Save your league</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function SetupView({
  userSlot,
  setUserSlot,
  playerCount,
  onStart,
}: {
  userSlot: number
  setUserSlot: (n: number) => void
  playerCount: number
  onStart: () => void
}) {
  return (
    <div className="surface-elevated p-8 md:p-12 text-center">
      <div className="text-eyebrow text-primary">Mock draft</div>
      <h1 className="text-display text-5xl md:text-7xl mt-3 leading-[0.9]">
        Pick your seat.
      </h1>
      <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-lg leading-relaxed">
        12-team snake, {ROUNDS} rounds, pulled from the top {playerCount} active NBA players
        by fantasy FPPG. Bots draft against you in real time. Nothing saves —
        when you reload, the draft is gone.
      </p>

      <div className="mt-8 max-w-xl mx-auto">
        <div className="text-eyebrow text-muted-foreground mb-3">Your draft slot</div>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-1.5">
          {Array.from({ length: TEAM_COUNT }, (_, i) => i + 1).map((slot) => {
            const active = slot === userSlot
            return (
              <button
                key={slot}
                onClick={() => setUserSlot(slot)}
                className={cn(
                  "h-12 text-display text-2xl border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                )}
              >
                {slot}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Slot {userSlot} picks {pickNumbersForSlot(userSlot).slice(0, 3).join(", ")}…
        </p>
      </div>

      <div className="mt-8">
        <Button size="lg" onClick={onStart} className="text-base px-10">
          <Sparkles className="h-4 w-4 mr-2" />
          Start mock draft
        </Button>
      </div>
    </div>
  )
}

function pickNumbersForSlot(slot: number): number[] {
  const out: number[] = []
  for (let r = 1; r <= ROUNDS; r++) {
    const slotInRound = r % 2 === 1 ? slot : TEAM_COUNT - slot + 1
    out.push((r - 1) * TEAM_COUNT + slotInRound)
  }
  return out
}

function DraftStatusBar({
  phase,
  currentPick,
  currentRound,
  onClockSlot,
  userSlot,
  onReset,
}: {
  phase: "drafting" | "complete"
  currentPick: number
  currentRound: number
  onClockSlot: number | null
  userSlot: number
  onReset: () => void
}) {
  if (phase === "complete") {
    return (
      <div className="surface-elevated px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <div className="text-eyebrow text-primary">Draft complete</div>
            <div className="text-condensed text-xl uppercase tracking-wide">All {TOTAL_PICKS} picks made</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>
      </div>
    )
  }

  const isUserTurn = onClockSlot === userSlot
  return (
    <div className={cn(
      "surface-elevated px-6 py-4 flex items-center justify-between gap-4 transition-shadow",
      isUserTurn && "shadow-[0_0_0_1px_var(--color-primary),0_0_24px_-6px_var(--color-primary)] border-primary/60",
    )}>
      <div className="flex items-center gap-6">
        <div>
          <div className="text-eyebrow">Round</div>
          <div className="text-display text-3xl text-primary">R{currentRound}</div>
        </div>
        <div>
          <div className="text-eyebrow">Pick</div>
          <div className="text-display text-3xl">#{currentPick} / {TOTAL_PICKS}</div>
        </div>
        <div>
          <div className="text-eyebrow">On the clock</div>
          <div className={cn(
            "text-condensed text-lg uppercase tracking-wide",
            isUserTurn ? "text-primary" : "text-foreground",
          )}>
            {isUserTurn ? "YOU" : `Slot ${onClockSlot} · ${BOT_NAMES[onClockSlot ?? 0] ?? "Bot"}`}
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        Reset
      </Button>
    </div>
  )
}

function UserRosterCard({ roster, userSlot }: { roster: Selection[]; userSlot: number }) {
  return (
    <div className="surface-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-secondary/40 flex items-center justify-between">
        <div>
          <div className="text-eyebrow text-primary">Your roster</div>
          <div className="text-condensed text-lg uppercase tracking-wide">SLOT {userSlot}</div>
        </div>
        <div className="text-right">
          <div className="text-eyebrow">Picks</div>
          <div className="stat-display text-2xl">{roster.length}</div>
        </div>
      </div>
      {roster.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          No picks yet — wait for your turn or click a player on the right.
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {roster.map((s) => (
            <div key={s.pickNumber} className="flex items-center gap-3 px-4 py-2.5">
              <div className="text-display text-2xl text-primary leading-none w-12 text-center">
                R{s.round}
              </div>
              <PlayerHeadshot nbaPlayerId={s.player.nba_player_id} fullName={s.player.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{s.player.full_name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PositionChip position={s.player.primary_position} />
                  {s.player.team_abbr && <TeamLogo teamAbbr={s.player.team_abbr} size={16} />}
                  <span className="text-[11px] text-muted-foreground">{s.player.team_abbr}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="stat-display text-base text-primary leading-none">
                  {s.player.current_season?.fantasy_ppg?.toFixed(1) ?? "—"}
                </div>
                <div className="text-eyebrow mt-1">FPPG</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PickHistory({ selections, userSlot }: { selections: Selection[]; userSlot: number }) {
  if (selections.length === 0) return null
  const recent = [...selections].slice(-12).reverse()
  return (
    <div className="surface-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-secondary/40">
        <div className="text-eyebrow text-primary">Recent picks</div>
        <div className="text-condensed text-lg uppercase tracking-wide">LAST 12</div>
      </div>
      <div className="divide-y divide-border/40">
        {recent.map((s) => (
          <div key={s.pickNumber} className={cn(
            "flex items-center gap-3 px-4 py-2 text-sm",
            s.slot === userSlot && "bg-primary/5",
          )}>
            <div className="text-[11px] stat-num text-muted-foreground w-10">#{s.pickNumber}</div>
            <PlayerHeadshot nbaPlayerId={s.player.nba_player_id} fullName={s.player.full_name} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{s.player.full_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {s.isUser ? "YOU" : `${BOT_NAMES[s.slot] ?? "Bot"}`} · slot {s.slot}
              </div>
            </div>
            <PositionChip position={s.player.primary_position} />
          </div>
        ))}
      </div>
    </div>
  )
}

function AvailablePlayersCard({
  available,
  position,
  setPosition,
  search,
  setSearch,
  isUserTurn,
  phase,
  onPick,
}: {
  available: Player[]
  position: typeof POSITIONS[number]
  setPosition: (p: typeof POSITIONS[number]) => void
  search: string
  setSearch: (s: string) => void
  isUserTurn: boolean
  phase: "drafting" | "complete"
  onPick: (p: Player) => void
}) {
  return (
    <div className="surface-elevated overflow-hidden flex flex-col h-[calc(100vh-220px)] sticky top-24">
      <div className="px-5 py-3 border-b border-border bg-secondary/40">
        <div className="text-eyebrow text-primary">Best available</div>
        <div className="text-condensed text-lg uppercase tracking-wide">FPPG LEADERS</div>
      </div>
      <div className="px-3 py-3 border-b border-border space-y-2">
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPosition(p)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border transition-colors",
                position === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {available.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No players match.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {available.slice(0, 80).map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                disabled={!isUserTurn || phase === "complete"}
                className={cn(
                  "w-full text-left flex items-center gap-2.5 px-3 py-2 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                <PlayerHeadshot nbaPlayerId={p.nba_player_id} fullName={p.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{p.full_name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <PositionChip position={p.primary_position} />
                    {p.team_abbr && <TeamLogo teamAbbr={p.team_abbr} size={16} />}
                    <span className="text-[11px] text-muted-foreground">{p.team_abbr}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="stat-display text-base text-primary leading-none">
                    {p.current_season?.fantasy_ppg?.toFixed(1) ?? "—"}
                  </div>
                  <div className="text-eyebrow mt-1">FPPG</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground text-center">
        {phase === "complete"
          ? "Draft complete"
          : isUserTurn
            ? "Click a player to draft"
            : "Bot is drafting…"}
      </div>
    </div>
  )
}

function CompleteView({ userRoster, onReset }: { userRoster: Selection[]; onReset: () => void }) {
  const totalFppg = userRoster.reduce(
    (sum, s) => sum + (s.player.current_season?.fantasy_ppg ?? 0),
    0,
  )
  return (
    <div className="surface-elevated p-8 text-center">
      <Trophy className="h-12 w-12 text-primary mx-auto" />
      <div className="text-eyebrow text-primary mt-3">Mock complete</div>
      <h2 className="text-display text-4xl md:text-5xl mt-2">YOUR TEAM PROJECTS AT</h2>
      <div className="stat-display text-7xl text-primary mt-3">{totalFppg.toFixed(1)}</div>
      <p className="text-muted-foreground mt-2 text-sm">total fantasy points per game</p>
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        <Button onClick={onReset} variant="outline" size="lg">
          <RotateCcw className="h-4 w-4 mr-2" />
          Run another mock
        </Button>
        <Button asChild size="lg">
          <Link to="/signup">Save your league</Link>
        </Button>
      </div>
    </div>
  )
}
