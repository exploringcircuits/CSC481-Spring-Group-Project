import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Bot, ClipboardCopy, Crown, Mail, Share2, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { ApiError } from "@/services/api"
import { getLeague } from "@/services/leagues"
import type { LeagueDetail, LeagueMember, TeamLight } from "@/types/league"
import { TeamAvatar } from "@/components/TeamAvatar"
import { cn } from "@/lib/utils"

export function LeagueMembersPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)
  const [league, setLeague] = useState<LeagueDetail | null>(null)

  useEffect(() => {
    if (!id) return
    getLeague(id).then(setLeague).catch((err) => {
      const message = err instanceof ApiError ? err.message : "Could not load members."
      toast.error(message)
    })
  }, [id])

  if (!league) {
    return <Skeleton className="h-72" />
  }

  const teamByMember = new Map<number, TeamLight>()
  for (const t of league.teams) teamByMember.set(t.member.id, t)

  const filledSlots = league.members.length
  const openSlots = league.max_teams - filledSlots
  const humans = league.members.filter((m) => !m.is_bot).length
  const bots = league.members.filter((m) => m.is_bot).length

  const inviteUrl = `${window.location.origin}/?invite=${league.invite_code}`

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="surface-elevated p-7 relative overflow-hidden">
        <div className="absolute inset-0 court-stripe pointer-events-none" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-primary">Members</div>
            <h1 className="text-display text-5xl md:text-6xl mt-2 leading-[0.9]">{league.name.toUpperCase()}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {league.season_label} · Commissioner: <span className="text-foreground">{league.commissioner.display_name}</span>
            </p>
          </div>
          <div className="flex items-end gap-6 pb-1">
            <Stat label="Slots filled" value={`${filledSlots}/${league.max_teams}`} />
            <Stat label="Humans" value={String(humans)} />
            <Stat label="Bots"   value={String(bots)} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Members table */}
        <div className="surface-elevated overflow-hidden">
          <header className="border-b border-border px-5 py-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-eyebrow">Roster of managers</div>
              <div className="text-condensed text-xl uppercase tracking-wide">THE ROOM</div>
            </div>
            <span className="text-xs text-muted-foreground">{filledSlots} of {league.max_teams}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 text-eyebrow">#</th>
                  <th className="text-left px-4 py-2.5 text-eyebrow">Manager</th>
                  <th className="text-left px-4 py-2.5 text-eyebrow">Team</th>
                  <th className="text-left px-4 py-2.5 text-eyebrow">Record</th>
                  <th className="text-left px-4 py-2.5 text-eyebrow">PF</th>
                  <th className="text-right px-4 py-2.5 text-eyebrow">Status</th>
                </tr>
              </thead>
              <tbody>
                {league.members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    team={teamByMember.get(m.id) ?? null}
                    leagueId={id}
                  />
                ))}
                {Array.from({ length: openSlots }).map((_, i) => (
                  <tr key={`open-${i}`} className="border-t border-border/40">
                    <td className="px-4 py-3 text-muted-foreground stat-num">{filledSlots + i + 1}</td>
                    <td className="px-4 py-3" colSpan={5}>
                      <span className="text-sm text-muted-foreground italic">Open slot — share the invite code below</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: invite tools */}
        <aside className="space-y-4">
          <div className="surface-elevated overflow-hidden">
            <header className="border-b border-border px-5 py-3">
              <div className="text-eyebrow text-primary">Invite</div>
              <div className="text-condensed text-xl uppercase tracking-wide">SHARE THE LEAGUE</div>
            </header>
            <div className="px-5 py-5 space-y-4">
              <div>
                <div className="text-eyebrow mb-1.5">Invite code</div>
                <button
                  onClick={() => copy(league.invite_code, "Invite code")}
                  className="w-full flex items-center justify-between gap-2 border border-border bg-secondary/40 px-3 py-2.5 hover:border-primary/40 transition-colors group"
                >
                  <code className="font-mono text-base text-primary tracking-widest">{league.invite_code}</code>
                  <ClipboardCopy className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </button>
              </div>
              <div>
                <div className="text-eyebrow mb-1.5">Invite link</div>
                <button
                  onClick={() => copy(inviteUrl, "Invite link")}
                  className="w-full flex items-center justify-between gap-2 border border-border bg-secondary/40 px-3 py-2.5 hover:border-primary/40 transition-colors group"
                >
                  <span className="font-mono text-xs text-muted-foreground truncate">{inviteUrl}</span>
                  <Share2 className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>
              </div>
              <div className="pt-2">
                <Button variant="outline" className="w-full" onClick={() => copy(inviteUrl, "Invite link")}>
                  <Mail className="h-4 w-4 mr-2" /> Copy invite to share
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this code can claim an open slot. Bots automatically fill in
                if you'd rather draft now and add humans later.
              </p>
            </div>
          </div>

          <div className="surface-elevated px-5 py-4">
            <div className="text-eyebrow mb-2">Quick links</div>
            <div className="space-y-1">
              <Link to={`/leagues/${id}/standings`} className="block text-sm hover:text-primary transition-colors">→ Standings</Link>
              <Link to={`/leagues/${id}/draft/setup`} className="block text-sm hover:text-primary transition-colors">→ Draft setup</Link>
              <Link to={`/leagues/${id}/transactions`} className="block text-sm hover:text-primary transition-colors">→ Activity feed</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function MemberRow({
  member,
  team,
  leagueId,
}: {
  member: LeagueMember
  team: TeamLight | null
  leagueId: number
}) {
  const initials = (member.display_name || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()
  return (
    <tr className="border-t border-border/40 hover:bg-primary/5 transition-colors">
      <td className="px-4 py-3 stat-num text-muted-foreground">{member.slot}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className={cn(
              "text-[11px] font-bold",
              member.is_bot ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary",
            )}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-1.5 truncate">
              {member.display_name}
              {member.is_commissioner && (
                <Crown className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {member.is_bot ? "Bot manager" : member.user?.email || ""}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {team ? (
          <Link to={`/leagues/${leagueId}/team/${team.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
            <TeamAvatar name={team.name} size={24} />
            <span className="font-semibold truncate">{team.name}</span>
          </Link>
        ) : (
          <span className="text-muted-foreground italic text-xs">No team yet</span>
        )}
      </td>
      <td className="px-4 py-3 stat-display">{team?.record ?? "—"}</td>
      <td className="px-4 py-3 stat-num">{team?.points_for.toFixed(0) ?? "—"}</td>
      <td className="px-4 py-3 text-right">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 border text-eyebrow",
          member.is_bot
            ? "border-border bg-secondary text-muted-foreground"
            : member.is_commissioner
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-secondary/60 text-foreground",
        )}>
          {member.is_bot ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
          {member.is_bot ? "Bot" : member.is_commissioner ? "Commish" : "Manager"}
        </span>
      </td>
    </tr>
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
