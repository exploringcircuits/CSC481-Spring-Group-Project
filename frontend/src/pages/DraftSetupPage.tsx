import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Calendar, Clock, Gavel, Settings2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ApiError } from "@/services/api"
import { adminRunDraft } from "@/services/admin"
import { getLeague } from "@/services/leagues"
import { getDraft } from "@/services/draft"
import { useAuth } from "@/hooks/useAuth"
import type { Draft, LeagueDetail } from "@/types/league"
import { TeamAvatar } from "@/components/TeamAvatar"
import { cn } from "@/lib/utils"

type DraftPreset = {
  mode: "live" | "auto"
  type: "snake" | "linear"
  timePerPick: number
  scheduleAt: string
  orderRule: "random" | "manual"
  manualOrder: number[]
}

const DEFAULT_PRESET: DraftPreset = {
  mode: "live",
  type: "snake",
  timePerPick: 60,
  scheduleAt: "",
  orderRule: "random",
  manualOrder: [],
}

function presetKey(leagueId: number) {
  return `ff_draft_preset_${leagueId}`
}

function loadPreset(leagueId: number): DraftPreset {
  try {
    const raw = localStorage.getItem(presetKey(leagueId))
    if (!raw) return DEFAULT_PRESET
    return { ...DEFAULT_PRESET, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PRESET
  }
}

function savePreset(leagueId: number, preset: DraftPreset) {
  localStorage.setItem(presetKey(leagueId), JSON.stringify(preset))
}

export function DraftSetupPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const id = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preset, setPreset] = useState<DraftPreset>(DEFAULT_PRESET)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!id) return
    setPreset(loadPreset(id))
    Promise.all([getLeague(id), getDraft(id)])
      .then(([l, d]) => { setLeague(l); setDraft(d) })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : "Could not load draft."
        toast.error(message)
      })
  }, [id])

  function patch<K extends keyof DraftPreset>(key: K, value: DraftPreset[K]) {
    const next = { ...preset, [key]: value }
    setPreset(next)
    savePreset(id, next)
  }

  const orderedTeams = useMemo(() => {
    if (!league) return []
    if (preset.orderRule === "manual" && preset.manualOrder.length === league.teams.length) {
      const map = new Map(league.teams.map((t) => [t.id, t]))
      return preset.manualOrder.map((tid) => map.get(tid)).filter(Boolean) as typeof league.teams
    }
    return league.teams
  }, [league, preset])

  if (!league || !draft) {
    return <Skeleton className="h-72" />
  }

  const draftStarted = draft.status !== "not_started"

  async function handleStart() {
    if (preset.mode === "auto") {
      if (!isStaff) {
        toast.error("Auto-simulate requires commissioner privileges.")
        return
      }
      setRunning(true)
      try {
        await adminRunDraft(id)
        toast.success("Draft simulation complete.")
        navigate(`/leagues/${id}/draft`)
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Simulation failed."
        toast.error(message)
      } finally {
        setRunning(false)
      }
    } else {
      // Live mode: jump to the draft room
      navigate(`/leagues/${id}/draft`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <header className="surface-elevated p-7 relative overflow-hidden">
        <div className="absolute inset-0 court-stripe pointer-events-none" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-primary">Draft setup</div>
            <h1 className="text-display text-5xl md:text-6xl mt-2 leading-[0.9]">
              {league.name.toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              Lock the rules, schedule the kickoff, and pick your draft mode. Settings save
              automatically to this device.
            </p>
          </div>
          <div className="flex items-end gap-6 pb-1">
            <Stat label="Teams"  value={`${league.teams.length}/${league.max_teams}`} />
            <Stat label="Rounds" value={String(league.roster_template.length)} />
            <Stat label="Total picks" value={String(league.roster_template.length * league.teams.length)} />
          </div>
        </div>
      </header>

      {draftStarted && (
        <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>The draft is already <strong>{draft.status === "in_progress" ? "live" : "complete"}</strong> for this league. Changes here only affect the next draft.</span>
        </div>
      )}

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="order">Draft order</TabsTrigger>
        </TabsList>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <TabsContent value="rules" className="space-y-6 mt-0">
              <SetupCard icon={Gavel} title="Draft mode" description="How picks happen during the draft.">
                <RadioGroup
                  value={preset.mode}
                  onValueChange={(v) => patch("mode", v as DraftPreset["mode"])}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <ModeOption
                    value="live"
                    selected={preset.mode === "live"}
                    title="Live vs bots"
                    body="You sit at one team and pick when on the clock. Other teams auto-pick on a timer."
                    chip="Recommended"
                  />
                  <ModeOption
                    value="auto"
                    selected={preset.mode === "auto"}
                    title="Auto-simulate"
                    body="All 12 teams draft automatically. Watch the room fill in pick by pick."
                    chip={isStaff ? undefined : "Commissioner only"}
                    disabled={!isStaff}
                  />
                </RadioGroup>
              </SetupCard>

              <SetupCard icon={Settings2} title="Type & clock" description="Snake order and per-pick time budget.">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label>Draft type</Label>
                    <Select value={preset.type} onValueChange={(v) => patch("type", v as DraftPreset["type"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="snake">Snake (1→12, 12→1)</SelectItem>
                        <SelectItem value="linear">Linear (1→12 every round)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Snake balances pick value across rounds.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time per pick</Label>
                    <Select value={String(preset.timePerPick)} onValueChange={(v) => patch("timePerPick", Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                        <SelectItem value="90">90 seconds</SelectItem>
                        <SelectItem value="120">2 minutes</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                        <SelectItem value="600">10 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Auto-pick fires when the clock hits zero.</p>
                  </div>
                </div>
              </SetupCard>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-6 mt-0">
              <SetupCard icon={Calendar} title="Kickoff" description="When the draft room opens.">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule_at">Date & time</Label>
                    <Input
                      id="schedule_at"
                      type="datetime-local"
                      value={preset.scheduleAt}
                      onChange={(e) => patch("scheduleAt", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank to start immediately when you hit Go.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Send invites?</Label>
                    <div className="flex items-center gap-3 border border-border bg-secondary/40 px-3 py-2.5">
                      <Switch defaultChecked />
                      <span className="text-sm">Email everyone the kickoff time</span>
                    </div>
                  </div>
                </div>
              </SetupCard>

              <SetupCard icon={Clock} title="Cheatsheet visibility" description="What managers can see during the draft.">
                <div className="space-y-3">
                  <RowToggle label="Show fantasy projections" hint="Per-game FPPG visible alongside each player." defaultChecked />
                  <RowToggle label="Show injury status"        hint="OUT / DTD / Q badges appear in player rows." defaultChecked />
                  <RowToggle label="Show ADP / pick history"   hint="Average draft position from prior seasons." />
                </div>
              </SetupCard>
            </TabsContent>

            <TabsContent value="order" className="space-y-6 mt-0">
              <SetupCard icon={Gavel} title="Pick order" description="Who's on the clock first.">
                <RadioGroup
                  value={preset.orderRule}
                  onValueChange={(v) => patch("orderRule", v as DraftPreset["orderRule"])}
                  className="grid gap-3 md:grid-cols-2 mb-4"
                >
                  <ModeOption
                    value="random"
                    selected={preset.orderRule === "random"}
                    title="Randomize"
                    body="Order rolls when the draft starts. Fair, classic."
                  />
                  <ModeOption
                    value="manual"
                    selected={preset.orderRule === "manual"}
                    title="Set manually"
                    body="Drag teams into the order you want."
                  />
                </RadioGroup>
                <ManualOrderList
                  teams={league.teams}
                  order={preset.manualOrder.length === league.teams.length ? preset.manualOrder : league.teams.map((t) => t.id)}
                  disabled={preset.orderRule !== "manual"}
                  onChange={(next) => patch("manualOrder", next)}
                />
              </SetupCard>
            </TabsContent>
          </div>

          {/* Right rail: kickoff preview + CTA */}
          <aside className="space-y-4">
            <div className="surface-elevated overflow-hidden sticky top-24">
              <div className="border-b border-border px-5 py-4">
                <div className="text-eyebrow text-primary">Kickoff card</div>
                <div className="text-condensed text-xl mt-1">PREVIEW</div>
              </div>
              <div className="px-5 py-5 space-y-3 text-sm">
                <PreviewRow label="Mode"     value={preset.mode === "live" ? "Live vs bots" : "Auto-simulate"} />
                <PreviewRow label="Type"     value={preset.type === "snake" ? "Snake" : "Linear"} />
                <PreviewRow label="Clock"    value={`${preset.timePerPick}s per pick`} />
                <PreviewRow label="Schedule" value={preset.scheduleAt ? new Date(preset.scheduleAt).toLocaleString() : "Right now"} />
                <PreviewRow label="Order"    value={preset.orderRule === "random" ? "Randomized" : "Manual"} />
                <PreviewRow label="Total picks" value={String(league.roster_template.length * league.teams.length)} />
              </div>
              <div className="border-t border-border bg-secondary/40 px-5 py-4 space-y-2">
                <Button className="w-full" size="lg" onClick={handleStart} disabled={running}>
                  {running ? "Simulating…" : preset.mode === "live" ? "Enter draft room" : "Run simulation"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  {preset.mode === "live"
                    ? "You'll land on the draft board. Pick when your team is on the clock."
                    : "Watch the entire room auto-fill, then review picks in the draft room."}
                </p>
              </div>
            </div>

            <div className="surface-elevated px-5 py-4">
              <div className="text-eyebrow mb-2">First-round preview</div>
              <ol className="space-y-1.5">
                {orderedTeams.slice(0, 6).map((t, i) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="text-display text-base text-primary w-6 text-center">{i + 1}</span>
                    <TeamAvatar name={t.name} size={24} />
                    <span className="truncate">{t.name}</span>
                  </li>
                ))}
                {orderedTeams.length > 6 && (
                  <li className="text-xs text-muted-foreground pl-7">
                    + {orderedTeams.length - 6} more
                  </li>
                )}
              </ol>
            </div>
          </aside>
        </div>
      </Tabs>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-display text-3xl text-foreground leading-none">{value}</div>
      <div className="text-eyebrow mt-1">{label}</div>
    </div>
  )
}

function SetupCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="surface-elevated overflow-hidden">
      <header className="border-b border-border px-5 py-4 flex items-start gap-3">
        <div className="h-9 w-9 flex items-center justify-center bg-primary/10 border border-primary/30 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-condensed text-lg uppercase tracking-wide">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function ModeOption({
  value, selected, title, body, chip, disabled,
}: {
  value: string; selected: boolean; title: string; body: string; chip?: string; disabled?: boolean
}) {
  return (
    <label
      className={cn(
        "border px-4 py-4 cursor-pointer transition-colors flex flex-col gap-2 relative",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-secondary/30",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <RadioGroupItem value={value} className="sr-only" disabled={disabled} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-condensed text-base uppercase tracking-wide">{title}</span>
        <span className={cn("h-3.5 w-3.5 border", selected ? "bg-primary border-primary" : "border-border")} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      {chip && (
        <span className={cn(
          "absolute top-2 right-2 text-eyebrow px-2 py-0.5 border",
          selected ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground bg-card",
        )}>
          {chip}
        </span>
      )}
    </label>
  )
}

function RowToggle({ label, hint, defaultChecked }: { label: string; hint: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border first:border-t-0 pt-3 first:pt-0">
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}

function ManualOrderList({
  teams, order, disabled, onChange,
}: {
  teams: LeagueDetail["teams"]
  order: number[]
  disabled: boolean
  onChange: (next: number[]) => void
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]))

  function move(idx: number, dir: -1 | 1) {
    const next = [...order]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <ol className={cn("space-y-2", disabled && "opacity-50 pointer-events-none")}>
      {order.map((tid, i) => {
        const t = teamMap.get(tid)
        if (!t) return null
        return (
          <li key={tid} className="flex items-center gap-3 border border-border bg-secondary/30 px-3 py-2">
            <span className="text-display text-2xl text-primary w-8 text-center">{i + 1}</span>
            <TeamAvatar name={t.name} size={32} />
            <span className="flex-1 truncate font-semibold">{t.name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline truncate">{t.member.display_name}</span>
            <div className="flex flex-col gap-px">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="px-2 text-xs text-muted-foreground hover:text-primary disabled:opacity-30"
                aria-label="Move up"
              >▲</button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="px-2 text-xs text-muted-foreground hover:text-primary disabled:opacity-30"
                aria-label="Move down"
              >▼</button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
      <span className="text-eyebrow">{label}</span>
      <span className="font-semibold truncate text-right">{value}</span>
    </div>
  )
}
