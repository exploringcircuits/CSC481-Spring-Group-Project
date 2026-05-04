# Demo script — Fantasy Hoops

Click-by-click guide for presenting. Total runtime when rehearsed is about
5 minutes. Each beat below is one concrete action.

## Before you start

1. Run `start-app.ps1`. Wait for the browser to open `localhost:5173` and
   see the **Sign in** card.
2. The admin credentials are `admin@demo.local` / `demoadmin`.

## 1. Sign in (10s)

Sign in as the admin. You land on the empty **Your leagues** screen — no
leagues yet. The top-right shows the **Admin** button (since this user is
staff).

> Talking point: three-tier role model. Right now we're a site admin; when a
> regular user signs up they'll be a league member only.

## 2. Open the admin demo panel (5s)

Click **Admin** in the top right.

> Talking point: this panel is the presenter's control surface. Everything
> in the app can be reached from here in one click.

## 3. Reset + seed a fresh league (15s)

Click **Reset everything**. Toast confirms the wipe.

Click **Seed demo league**. Toast confirms — the snapshot card now lists
"Demo Showcase" with 8 teams and 0 picks.

> Talking point: 7 bot teams plus the admin = 8-team league. Ready to draft.

## 4. Run the draft (15s)

Click **Run draft**. Behind the scenes: 104 picks (8 teams × 13 roster slots)
auto-completed using projected fantasy PPG to rank every available player.

> Talking point: in a real league, members take turns picking on a clock.
> The autopick lets us show what a completed draft looks like instantly.

Click **Open draft board** in the showcase row. Scroll the recent picks —
real NBA names, real team abbreviations.

## 5. Build the schedule (5s)

Back to **Admin**. Click **Build schedule**.

> Talking point: round-robin via the circle method. 6 weeks, every team
> plays every other team roughly twice. Default lineups auto-populated.

Click **Open standings** to verify the league is set up but no games settled
yet (everyone 0-0-0).

## 6. Simulate the regular season (10s)

Back to **Admin**. Click **Simulate to playoffs**. All 6 weeks settle.

Click **Open standings**. Scroll the table — 8 teams sorted by W-L, with
realistic point totals (single-week scores typically ~1500-2200 for a full
13-slot lineup).

> Talking point: the scoring engine is Yahoo's H2H Points formula —
> PTS×1 + REB×1.2 + AST×1.5 + STL×3 + BLK×3 + TO×−1 — applied to per-day
> stat lines that we generated from each player's actual season averages.

## 7. Start playoffs (5s)

Back to **Admin**. Click **Start playoffs**.

Click **Open bracket**. Two semifinal matchups appear — top seed vs lowest
remaining seed each round. Final round shows "awaiting" since the previous
round hasn't settled yet.

## 8. Simulate the bracket (15s)

Back to **Admin**. Click **Simulate next round** — semifinals settle.

Click **Open bracket** again — semifinal scores filled, winners highlighted,
final round now has its matchup populated.

Back to **Admin**. Click **Simulate next round** — the championship game
settles. Snapshot card shows the league as "Complete" with the champion at
the top of the standings.

> Talking point: bracket re-seeded between rounds (Yahoo convention). The
> championship is single-elimination just like every other H2H matchup.

## 9. Trade flow (30s)

Back to **Admin**. Click **Propose example trade**.

> Talking point: by default the example trade has a bot offering its
> highest-FPPG player for the admin's lowest-FPPG starter — a clearly
> lopsided trade we can demonstrate accepting.

Click **Open trades** in the showcase row. The proposed trade card appears
with both sides shown side-by-side. Click **Accept**. Toast confirms; the
card switches to "processed".

Click **My Team** in the league nav. The new player is on the roster.

## 10. Wrap

> Talking point: that's the whole loop — register, draft, schedule, weekly
> simulation, playoffs, trades. Real NBA players, real season averages,
> deterministic per-day variance, all reachable through the admin panel
> for a demo, and through the normal user UI for a real league.

## If anything goes sideways

- **Pages look unstyled** → the Vite dev server fell over. `Ctrl+C` and re-run
  `start-app.ps1 -SkipInstall`.
- **Login fails** → run `python manage.py seed_admin_user` from the backend
  dir to recreate the admin user with the known password.
- **Stats look wrong** → run `start-app.ps1 -SeedFreshDemo` to regenerate
  the per-day stat lines from a fresh seed.
- **Want to start over mid-demo** → just click **Reset everything** then
  **Seed demo league**. Total reset takes 2 seconds.
