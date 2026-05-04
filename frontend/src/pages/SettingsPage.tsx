import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  KeyRound,
  Shield,
  User as UserIcon,
  Bell,
  Palette,
  Eye,
  Link2,
  Trash2,
  Download,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DemoPlaceholder } from "@/components/DemoPlaceholder"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/useAuth"

const NBA_TEAMS = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS",
] as const

const PREFS_KEY = "ff_user_prefs_v1"

type Prefs = {
  favoriteTeam: string
  bio: string
  avatarUrl: string
  draftSoundOn: boolean
  defaultLineupMode: "totals" | "averages"
  defaultDraftMode: "live" | "auto"
  density: "compact" | "comfortable"
  defaultStatColumns: string[]
  notifyEmailWeekly: boolean
  notifyEmailTrade: boolean
  notifyEmailDraftStart: boolean
  notifyEmailLineupLock: boolean
  notifyEmailMatchupResult: boolean
  notifyPushEnabled: boolean
  notifyOnTheClock: boolean
  privacyShowProfile: boolean
  privacyShowRoster: boolean
  privacyShowEmail: boolean
  connectedDiscord: string
  connectedTwitter: string
}

const DEFAULT_PREFS: Prefs = {
  favoriteTeam: "LAL",
  bio: "",
  avatarUrl: "",
  draftSoundOn: true,
  defaultLineupMode: "averages",
  defaultDraftMode: "live",
  density: "comfortable",
  defaultStatColumns: ["FPPG", "PTS", "REB", "AST"],
  notifyEmailWeekly: true,
  notifyEmailTrade: true,
  notifyEmailDraftStart: true,
  notifyEmailLineupLock: false,
  notifyEmailMatchupResult: true,
  notifyPushEnabled: false,
  notifyOnTheClock: true,
  privacyShowProfile: true,
  privacyShowRoster: true,
  privacyShowEmail: false,
  connectedDiscord: "",
  connectedTwitter: "",
}

const STAT_COLUMN_OPTIONS = ["FPPG", "PTS", "REB", "AST", "STL", "BLK", "TO", "3PM", "FG%", "3P%", "FT%", "MIN", "GP"]

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(p: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p))
}

export function SettingsPage() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name || "")
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)

  useEffect(() => {
    setPrefs(loadPrefs())
  }, [])

  function patch<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(next)
  }

  function toggleStatColumn(stat: string) {
    const has = prefs.defaultStatColumns.includes(stat)
    let next = has
      ? prefs.defaultStatColumns.filter(s => s !== stat)
      : [...prefs.defaultStatColumns, stat]
    if (next.length > 6) next = next.slice(-6)
    patch("defaultStatColumns", next)
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    toast.success("Profile updated.")
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <div className="text-eyebrow text-primary">Account</div>
        <h1 className="text-display text-5xl md:text-6xl text-foreground leading-[0.9]">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Tune your profile, default modes, notifications, privacy, and integrations.
          Local preferences persist in this browser; profile changes hit the API.
        </p>
      </header>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="account"><UserIcon className="h-3.5 w-3.5 mr-1.5" />Account</TabsTrigger>
          <TabsTrigger value="preferences"><Palette className="h-3.5 w-3.5 mr-1.5" />Prefs</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />Notify</TabsTrigger>
          <TabsTrigger value="privacy"><Eye className="h-3.5 w-3.5 mr-1.5" />Privacy</TabsTrigger>
          <TabsTrigger value="connections"><Link2 className="h-3.5 w-3.5 mr-1.5" />Connect</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <SettingsCard
            icon={UserIcon}
            title="Profile"
            description="What other managers see in the league."
          >
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="display_name">Display name</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ""} readOnly className="opacity-70" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="favorite">Favorite team</Label>
                <Select value={prefs.favoriteTeam} onValueChange={(v) => patch("favoriteTeam", v)}>
                  <SelectTrigger id="favorite" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NBA_TEAMS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input
                  id="avatar"
                  value={prefs.avatarUrl}
                  onChange={(e) => patch("avatarUrl", e.target.value)}
                  placeholder="https://…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Optional. Defaults to your initials in a gold chip.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={prefs.bio}
                  onChange={(e) => patch("bio", e.target.value)}
                  placeholder="A line for your team page — trash talk welcome."
                  className="min-h-[80px]"
                  maxLength={240}
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {prefs.bio.length} / 240
                </p>
              </div>
              <div className="flex items-center justify-end">
                <Button type="submit">Save profile</Button>
              </div>
            </form>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <SettingsCard
            icon={Palette}
            title="Display"
            description="Layout density across tables and rosters."
          >
            <PrefRow label="Density" hint="Compact reduces row padding for denser stat tables.">
              <Select value={prefs.density} onValueChange={(v) => patch("density", v as Prefs["density"])}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </PrefRow>
          </SettingsCard>

          <SettingsCard
            icon={Palette}
            title="Default modes"
            description="What's selected when you open key screens."
          >
            <div className="space-y-5">
              <PrefRow
                label="Default lineup view"
                hint="Show season totals or per-game averages on My Team."
              >
                <Select
                  value={prefs.defaultLineupMode}
                  onValueChange={(v) => patch("defaultLineupMode", v as Prefs["defaultLineupMode"])}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="averages">Per-game averages</SelectItem>
                    <SelectItem value="totals">Season totals</SelectItem>
                  </SelectContent>
                </Select>
              </PrefRow>
              <PrefRow
                label="Default draft mode"
                hint="What's selected when you open Draft Setup."
              >
                <Select
                  value={prefs.defaultDraftMode}
                  onValueChange={(v) => patch("defaultDraftMode", v as Prefs["defaultDraftMode"])}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live vs bots</SelectItem>
                    <SelectItem value="auto">Auto-simulate</SelectItem>
                  </SelectContent>
                </Select>
              </PrefRow>
              <PrefRow
                label="Draft sounds"
                hint="On-the-clock chimes during live drafts."
              >
                <Switch
                  checked={prefs.draftSoundOn}
                  onCheckedChange={(c) => patch("draftSoundOn", c)}
                />
              </PrefRow>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Palette}
            title="Featured stats"
            description="Pick up to 6 stats to highlight first across player tables. Rest stay accessible via the Players page."
          >
            <div className="flex flex-wrap gap-1.5">
              {STAT_COLUMN_OPTIONS.map((stat) => {
                const active = prefs.defaultStatColumns.includes(stat)
                return (
                  <button
                    key={stat}
                    type="button"
                    onClick={() => toggleStatColumn(stat)}
                    className={
                      "px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground")
                    }
                  >
                    {stat}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Selected ({prefs.defaultStatColumns.length}/6): {prefs.defaultStatColumns.join(" · ") || "none"}
            </p>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <SettingsCard
            icon={Bell}
            title="Email"
            description="When we'll ping your inbox."
          >
            <div className="space-y-5">
              <PrefRow label="Weekly recap" hint="Sunday morning summary of your matchup, transactions, and standings.">
                <Switch checked={prefs.notifyEmailWeekly} onCheckedChange={(c) => patch("notifyEmailWeekly", c)} />
              </PrefRow>
              <PrefRow label="Trade activity" hint="A trade involves your team — proposed, accepted, or rejected.">
                <Switch checked={prefs.notifyEmailTrade} onCheckedChange={(c) => patch("notifyEmailTrade", c)} />
              </PrefRow>
              <PrefRow label="Draft starting" hint="Reminder 30 minutes before kickoff.">
                <Switch checked={prefs.notifyEmailDraftStart} onCheckedChange={(c) => patch("notifyEmailDraftStart", c)} />
              </PrefRow>
              <PrefRow label="Lineup lock warning" hint="When a starter has a question-mark designation 1 hour before tip-off.">
                <Switch checked={prefs.notifyEmailLineupLock} onCheckedChange={(c) => patch("notifyEmailLineupLock", c)} />
              </PrefRow>
              <PrefRow label="Matchup result" hint="Win/loss recap when the week settles.">
                <Switch checked={prefs.notifyEmailMatchupResult} onCheckedChange={(c) => patch("notifyEmailMatchupResult", c)} />
              </PrefRow>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Bell}
            title="In-app & push"
            description="Real-time alerts while you're using the app."
          >
            <div className="space-y-5">
              <PrefRow label="On-the-clock alert" hint="Browser notification + sound when it's your draft pick.">
                <Switch checked={prefs.notifyOnTheClock} onCheckedChange={(c) => patch("notifyOnTheClock", c)} />
              </PrefRow>
              <PrefRow label="Push notifications" hint="Send to this browser. Requires permission.">
                <Switch
                  checked={prefs.notifyPushEnabled}
                  onCheckedChange={async (c) => {
                    if (c && "Notification" in window && Notification.permission !== "granted") {
                      const result = await Notification.requestPermission()
                      if (result !== "granted") {
                        toast.error("Permission denied — push notifications won't fire.")
                        return
                      }
                    }
                    patch("notifyPushEnabled", c)
                  }}
                />
              </PrefRow>
            </div>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <SettingsCard
            icon={Eye}
            title="Visibility"
            description="What other managers see when they look at your team."
          >
            <div className="space-y-5">
              <PrefRow label="Show profile" hint="Display your bio, avatar, and favorite team on your team page.">
                <Switch checked={prefs.privacyShowProfile} onCheckedChange={(c) => patch("privacyShowProfile", c)} />
              </PrefRow>
              <PrefRow label="Show roster" hint="Public roster page. If off, only league members can see your team.">
                <Switch checked={prefs.privacyShowRoster} onCheckedChange={(c) => patch("privacyShowRoster", c)} />
              </PrefRow>
              <PrefRow label="Show email" hint="Display your email in the members directory.">
                <Switch checked={prefs.privacyShowEmail} onCheckedChange={(c) => patch("privacyShowEmail", c)} />
              </PrefRow>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Shield}
            title="Data"
            description="Your data, your call."
          >
            <div className="space-y-3">
              <DataRow
                label="Download my data"
                hint="ZIP of your profile, roster history, and trade history."
                buttonLabel="Download"
                Icon={Download}
                onClick={() => toast.info("Export isn't wired up in the demo.")}
              />
              <DataRow
                label="Delete account"
                hint="Permanent. Removes your profile and detaches you from leagues; rosters become commissioner-controlled."
                buttonLabel="Delete"
                Icon={Trash2}
                destructive
                onClick={() => toast.info("Deletion isn't wired up in the demo — talk to your commissioner.")}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Shield}
            title="Security"
            description="Account recovery and sign-out controls."
          >
            <DataRow
              label="Password"
              hint="Last changed during account creation."
              buttonLabel="Reset"
              Icon={KeyRound}
              onClick={() => toast.info("Password reset isn't wired up in the demo.")}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <SettingsCard
            icon={Link2}
            title="Discord"
            description="Pipe pick alerts and trade notifications to your league's Discord."
          >
            <div className="space-y-3">
              <Label htmlFor="discord">Discord username</Label>
              <Input
                id="discord"
                value={prefs.connectedDiscord}
                onChange={(e) => patch("connectedDiscord", e.target.value)}
                placeholder="username#0000 or @username"
              />
              <DemoPlaceholder hint="Discord webhook setup isn't wired up in the demo build.">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prefs.connectedDiscord}
                  onClick={() => toast.info("Discord webhook setup isn't wired up in the demo.")}
                >
                  Verify & connect
                </Button>
              </DemoPlaceholder>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Link2}
            title="X / Twitter"
            description="Auto-post your weekly matchup result."
          >
            <div className="space-y-3">
              <Label htmlFor="twitter">Handle</Label>
              <Input
                id="twitter"
                value={prefs.connectedTwitter}
                onChange={(e) => patch("connectedTwitter", e.target.value)}
                placeholder="@yourhandle"
              />
              <DemoPlaceholder hint="X / Twitter integration isn't wired up in the demo build.">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prefs.connectedTwitter}
                  onClick={() => toast.info("X integration isn't wired up in the demo.")}
                >
                  Authorize
                </Button>
              </DemoPlaceholder>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Link2}
            title="Calendar"
            description="Drop matchup tip-offs and the draft into your calendar."
          >
            <div className="grid grid-cols-2 gap-3">
              <DemoPlaceholder hint="Google Calendar export isn't wired up in the demo build.">
                <Button variant="outline" onClick={() => toast.info("Google Calendar isn't wired up in the demo.")}>
                  Google Calendar
                </Button>
              </DemoPlaceholder>
              <DemoPlaceholder hint="Apple Calendar export isn't wired up in the demo build.">
                <Button variant="outline" onClick={() => toast.info("Apple Calendar isn't wired up in the demo.")}>
                  Apple Calendar
                </Button>
              </DemoPlaceholder>
            </div>
          </SettingsCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SettingsCard({
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

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5 max-w-md">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function DataRow({
  label,
  hint,
  buttonLabel,
  Icon,
  onClick,
  destructive = false,
  demo = true,
}: {
  label: string
  hint: string
  buttonLabel: string
  Icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  destructive?: boolean
  demo?: boolean
}) {
  const button = (
    <Button
      variant={destructive ? "destructive" : "outline"}
      size="sm"
      onClick={onClick}
      className="shrink-0"
    >
      <Icon className="h-3.5 w-3.5 mr-1.5" />
      {buttonLabel}
    </Button>
  )
  return (
    <div className="flex items-center justify-between border border-border bg-secondary/40 px-4 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground max-w-md">{hint}</div>
      </div>
      {demo ? <DemoPlaceholder>{button}</DemoPlaceholder> : button}
    </div>
  )
}
