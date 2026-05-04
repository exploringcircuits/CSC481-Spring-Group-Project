import { Link } from "react-router-dom"
import {
  Activity,
  Award,
  ChartBar,
  Flame,
  Gavel,
  ListChecks,
  Sparkles,
  Trophy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

export function LandingPage() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center">
            <img
              src="/fantasy-fanatics-logo.svg"
              alt="Fantasy Fanatics"
              className="h-9 w-auto"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-condensed text-sm uppercase tracking-wider text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#draft" className="hover:text-foreground transition-colors">Draft</a>
            <a href="#standings" className="hover:text-foreground transition-colors">Standings</a>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  Signed in as <span className="text-foreground font-medium">{user?.display_name || user?.email}</span>
                </span>
                <Button asChild size="sm">
                  <Link to="/leagues">My leagues</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero-dark">
        <div className="court-stripe absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-[1400px] px-6 py-24 md:py-32">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 py-1 text-eyebrow text-primary">
                <Flame className="h-3 w-3" /> 2025–26 NBA SEASON LIVE
              </div>
              <h1 className="text-display text-6xl md:text-7xl lg:text-8xl text-foreground leading-[0.85]">
                Run the league.<br />
                <span className="text-primary">Own the season.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                A stat-rich, basketball-first fantasy platform. Draft live against bots,
                manage your bench, scout matchups, and chase the trophy — all in one
                purpose-built room.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {isAuthenticated ? (
                  <Button asChild size="lg" className="text-base px-8">
                    <Link to="/leagues">My leagues</Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="text-base px-8">
                    <Link to="/signup">Create your league</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="lg" className="text-base px-8 border-primary/40 hover:bg-primary/5">
                  <Link to="/mock-draft">Try a mock draft</Link>
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {isAuthenticated
                  ? "Welcome back — jump back into your league or run a quick mock against bots."
                  : "No account needed for the mock — drafts against bots, nothing saves."}
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 pt-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Live snake draft</span>
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> 12 stat columns</span>
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Playoff brackets</span>
              </div>
            </div>

            {/* Stat panel */}
            <div className="surface-elevated p-6 relative">
              <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-eyebrow px-2 py-1">
                LIVE BOX
              </div>
              <div className="text-eyebrow mb-3">Tonight's spotlight</div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="text-display text-5xl text-primary leading-none">42.7</div>
                  <div className="text-eyebrow mt-2">FPPG · LEAGUE TOP</div>
                </div>
                <div className="text-right">
                  <div className="stat-display text-3xl">28-12</div>
                  <div className="text-eyebrow mt-2">TEAM RECORD</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Points",   value: "31.2", trend: "+4.1" },
                  { label: "Rebounds", value: "11.4", trend: "+1.2" },
                  { label: "Assists",  value: "8.6",  trend: "−0.3" },
                  { label: "Steals",   value: "1.9",  trend: "+0.4" },
                  { label: "Blocks",   value: "1.1",  trend: "+0.1" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-t border-border/60 pt-2">
                    <span className="text-condensed uppercase text-sm text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="stat-num text-foreground font-semibold">{row.value}</span>
                      <span className={
                        "stat-num text-xs " +
                        (row.trend.startsWith("+") ? "text-emerald-400" : "text-destructive")
                      }>{row.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60">
        <div className="mx-auto max-w-[1400px] px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <div className="text-eyebrow text-primary">Why Fantasy Fanatics</div>
            <h2 className="text-display text-5xl md:text-6xl mt-3 leading-[0.9]">
              Built for the box score.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Every screen is wired for the numbers basketball managers actually care about —
              no marketing fluff, no padding.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Gavel,      title: "Live Draft Room",     body: "Snake or auto-pick, with a per-pick clock and 11 bots that draft against you in practice mode." },
              { icon: ChartBar,   title: "Spreadsheet Players", body: "Sortable table with 12 stat columns, position chips, injury status, and team logos." },
              { icon: ListChecks, title: "Lineup Editor",       body: "Click any roster slot to swap in eligible players. Saves on every change." },
              { icon: Trophy,     title: "Playoff Bracket",     body: "Visual horizontal bracket with seeding, semifinals, finals, and a champion column." },
              { icon: Activity,   title: "Activity Feed",       body: "Filterable transaction log: picks, trades, lineup changes, and weekly settlements." },
              { icon: Award,      title: "Standings + Sparklines", body: "Last-5 form charts, playoff badges, and points-for progress bars." },
            ].map((f) => (
              <div
                key={f.title}
                className="surface-elevated p-6 hover:border-primary/40 transition-colors group"
              >
                <div className="h-10 w-10 flex items-center justify-center bg-primary/10 border border-primary/30 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="text-condensed text-xl uppercase tracking-wide mb-2">{f.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Draft / Mock */}
      <section id="draft" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-[1400px] px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="text-eyebrow text-primary">Draft modes</div>
              <h2 className="text-display text-5xl md:text-6xl leading-[0.9]">
                Mock against bots,<br />or simulate the room.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Choose how you want to draft. Take a seat at pick number one and let the
                bots fill the other eleven, or watch the whole thing simulate at speed
                with full transparency on every choice.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "Configure draft type, time-per-pick, and order before kickoff",
                  "Per-pick clock with on-the-clock highlighting",
                  "Position rules + injury status visible during every pick",
                  "Bot logic respects roster slots — no all-PG nonsense",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 bg-primary shrink-0" />
                    <span className="text-foreground">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Button asChild size="lg">
                  <Link to="/signup">Start a mock draft</Link>
                </Button>
              </div>
            </div>

            <div className="surface-elevated overflow-hidden">
              <div className="border-b border-border bg-background/40 px-5 py-3 flex items-center justify-between">
                <div className="text-eyebrow text-primary">ON THE CLOCK · 0:42</div>
                <div className="stat-display text-sm text-muted-foreground">PICK 14 · ROUND 2</div>
              </div>
              <div className="p-5 space-y-2">
                {[
                  { name: "L. Dončić",      pos: "PG", team: "DAL", fppg: "53.4", taken: false, hot: true },
                  { name: "G. Antetokounmpo", pos: "PF", team: "MIL", fppg: "52.1", taken: true,  hot: false },
                  { name: "N. Jokić",       pos: "C",  team: "DEN", fppg: "55.8", taken: true,  hot: false },
                  { name: "S. Curry",       pos: "PG", team: "GSW", fppg: "44.0", taken: false, hot: true },
                  { name: "J. Tatum",       pos: "SF", team: "BOS", fppg: "47.2", taken: false, hot: false },
                ].map((p) => (
                  <div
                    key={p.name}
                    className={
                      "flex items-center gap-3 px-3 py-2 border " +
                      (p.taken
                        ? "border-border bg-muted/40 opacity-50 line-through"
                        : "border-border bg-card hover:border-primary/40")
                    }
                  >
                    <span className="text-condensed text-xs text-primary w-9 text-center bg-primary/10 border border-primary/30 py-0.5">{p.pos}</span>
                    <span className="font-semibold flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground stat-num w-10 text-right">{p.team}</span>
                    <span className="stat-display text-primary text-base w-12 text-right">{p.fppg}</span>
                    {p.hot && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Standings strip */}
      <section id="standings" className="border-t border-border/60">
        <div className="mx-auto max-w-[1400px] px-6 py-20">
          <div className="text-eyebrow text-primary">Standings · trophies · brackets</div>
          <h2 className="text-display text-5xl md:text-6xl mt-3 leading-[0.9]">
            From tip-off to title.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
            Track every win, every points-for tick, every playoff seed. The numbers are
            tabular, the rankings are live, and the bracket fills in as the season closes.
          </p>

          <div className="mt-12 grid gap-3">
            {[
              { rank: 1, team: "Hardwood Heroes",   record: "11-2", pf: 1342, badge: "1 SEED" },
              { rank: 2, team: "Court Generals",    record: "10-3", pf: 1298, badge: "2 SEED" },
              { rank: 3, team: "Triple-Double Co.", record: "9-4",  pf: 1255, badge: "3 SEED" },
            ].map((row) => (
              <div
                key={row.rank}
                className="flex items-center gap-4 surface-elevated px-4 py-3 hover:border-primary/40 transition-colors"
              >
                <div className="text-display text-3xl text-primary w-10 text-center">{row.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{row.team}</div>
                  <div className="text-xs text-muted-foreground">{row.pf} PF</div>
                </div>
                <div className="stat-display text-2xl">{row.record}</div>
                {row.badge && (
                  <span className="text-eyebrow border border-primary/40 bg-primary/10 text-primary px-2 py-1">
                    {row.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 gradient-spotlight">
        <div className="mx-auto max-w-[1400px] px-6 py-24 text-center">
          <h2 className="text-display text-5xl md:text-7xl leading-[0.9]">
            <span className="text-primary">Tip-off</span> is now.
          </h2>
          <p className="text-muted-foreground mt-5 text-lg max-w-xl mx-auto">
            Spin up a league, invite your group with a code, and run the season your way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {isAuthenticated ? (
              <Button asChild size="lg" className="text-base px-8">
                <Link to="/leagues">My leagues</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="text-base px-8">
                <Link to="/signup">Create a league</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="text-base px-8 border-primary/40">
              <Link to="/mock-draft">Run a mock</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto max-w-[1400px] px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            <span className="text-condensed uppercase tracking-wider">Fantasy Fanatics</span>
          </div>
          <div className="flex gap-5 text-xs">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
