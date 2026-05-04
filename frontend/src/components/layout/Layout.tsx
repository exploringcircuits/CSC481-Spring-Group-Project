import { useEffect, type ReactNode } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface LayoutProps {
  children: ReactNode
}

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/mock-draft"]

const PAGE_TITLES: Record<string, string> = {
  "/": "Fantasy Fanatics",
  "/login": "Sign in",
  "/signup": "Create account",
  "/leagues": "My Leagues",
  "/admin": "Admin",
  "/settings": "Settings",
}

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.includes("/draft/setup")) return "Draft Setup"
  if (pathname.includes("/draft")) return "Draft Room"
  if (pathname.includes("/players/")) return "Player"
  if (pathname.includes("/players")) return "Players"
  if (pathname.includes("/team")) return "My Team"
  if (pathname.includes("/standings")) return "Standings"
  if (pathname.includes("/bracket")) return "Playoffs"
  if (pathname.includes("/trades")) return "Trades"
  if (pathname.includes("/transactions")) return "Activity"
  if (pathname.includes("/members")) return "Members"
  if (pathname.includes("/settings")) return "Settings"
  if (pathname.startsWith("/leagues/")) return "League Home"
  return "Fantasy Fanatics"
}

function leagueIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/leagues\/([^/]+)/)
  return match ? match[1] : null
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isStaff, logout } = useAuth()

  useEffect(() => {
    const title = pageTitleFor(location.pathname)
    document.title = title === "Fantasy Fanatics" ? title : `Fantasy Fanatics — ${title}`
  }, [location.pathname])

  const isPublicPage = PUBLIC_ROUTES.includes(location.pathname)
  if (isPublicPage) return <>{children}</>

  const leagueId = leagueIdFromPath(location.pathname)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        {/* Primary row */}
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-8 min-w-0">
            <Link
              to={isAuthenticated ? "/leagues" : "/"}
              className="flex items-center group shrink-0"
            >
              <img
                src="/fantasy-fanatics-logo.svg"
                alt="Fantasy Fanatics"
                className="h-9 w-auto transition-transform group-hover:scale-[1.02]"
              />
            </Link>
            {isAuthenticated && <PrimaryNav />}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-2">
                    <Avatar className="h-7 w-7 ring-1 ring-primary/50">
                      <AvatarFallback className="text-[11px] bg-secondary text-primary font-bold">
                        {initials(user?.display_name || user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium">
                      {user?.display_name || user?.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Signed in as
                    <div className="text-foreground font-medium truncate">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/leagues")}>
                    My leagues
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    Settings
                  </DropdownMenuItem>
                  {isStaff && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        Admin panel
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout()
                      navigate("/")
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Secondary row: league context (only when in league) */}
        {leagueId && (
          <div className="border-t border-border/50 bg-secondary/25">
            <div className="mx-auto max-w-[1400px] px-6">
              <LeagueContextNav leagueId={leagueId} />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  )
}

function PrimaryNav() {
  const location = useLocation()
  const links = [
    {
      path: "/leagues",
      label: "My Leagues",
      match: (p: string) => p === "/leagues",
    },
  ]

  return (
    <nav className="hidden md:flex items-center gap-1">
      {links.map((link) => {
        const active = link.match(location.pathname)
        return (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              "relative px-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.10em] transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {link.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-2.5 h-0.5 bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function LeagueContextNav({ leagueId }: { leagueId: string }) {
  const location = useLocation()

  const links = [
    { path: `/leagues/${leagueId}`, label: "Home", exact: true },
    { path: `/leagues/${leagueId}/team`, label: "Team" },
    { path: `/leagues/${leagueId}/standings`, label: "Standings" },
    { path: `/leagues/${leagueId}/schedule`, label: "Schedule" },
    { path: `/leagues/${leagueId}/bracket`, label: "Playoffs" },
    { path: `/leagues/${leagueId}/draft`, label: "Draft" },
    { path: `/leagues/${leagueId}/trades`, label: "Trades" },
    { path: `/leagues/${leagueId}/transactions`, label: "Activity" },
    { path: `/leagues/${leagueId}/players`, label: "Players" },
    { path: `/leagues/${leagueId}/members`, label: "Members" },
  ]

  return (
    <nav className="hidden md:flex items-center min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map((link) => {
        const active = link.exact
          ? location.pathname === link.path
          : location.pathname.startsWith(link.path)
        return (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              "relative px-3 py-3 text-[13px] font-semibold uppercase tracking-[0.10em] transition-colors whitespace-nowrap",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {link.label}
            {active && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function initials(name: string | undefined): string {
  if (!name) return "?"
  const parts = name.split(/[\s@.]+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
