import { useNavigate, useLocation, useParams, Link } from "react-router-dom"
import type { ReactNode } from "react"

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
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface LayoutProps {
  children: ReactNode
}

const PUBLIC_ROUTES = ["/login", "/signup"]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isStaff, logout } = useAuth()

  const isPublicPage = PUBLIC_ROUTES.includes(location.pathname)

  if (isPublicPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/leagues" className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">Fantasy Hoops</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">demo</Badge>
            </Link>
            <LeagueContextNav />
          </div>

          <div className="flex items-center gap-2">
            {isStaff && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="gap-1.5"
              >
                <span aria-hidden>⚙</span>
                Admin
              </Button>
            )}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
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
                    <div className="text-foreground">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/leagues")}>
                    My leagues
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      Admin panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout()
                      navigate("/login")
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}

function LeagueContextNav() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const location = useLocation()
  if (!leagueId) return null

  const links = [
    { path: `/leagues/${leagueId}`, label: "Home", exact: true },
    { path: `/leagues/${leagueId}/team`, label: "My Team" },
    { path: `/leagues/${leagueId}/standings`, label: "Standings" },
    { path: `/leagues/${leagueId}/bracket`, label: "Bracket" },
    { path: `/leagues/${leagueId}/draft`, label: "Draft" },
    { path: `/leagues/${leagueId}/trades`, label: "Trades" },
    { path: `/leagues/${leagueId}/players`, label: "Players" },
  ]

  return (
    <nav className="hidden md:flex items-center gap-1">
      {links.map((link) => {
        const active = link.exact
          ? location.pathname === link.path
          : location.pathname.startsWith(link.path)
        return (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {link.label}
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
