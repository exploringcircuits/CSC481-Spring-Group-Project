import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowRightLeft, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { ApiError } from "@/services/api"
import { getLeague } from "@/services/leagues"
import { getTeam } from "@/services/teams"
import { listTrades, proposeTrade, respondToTrade } from "@/services/trades"
import type {
  LeagueDetail,
  RosterEntry,
  TeamDetail,
  Trade,
} from "@/types/league"

import { TeamAvatar } from "@/components/TeamAvatar"
import { PlayerCard } from "@/components/PlayerCard"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<Trade["status"], string> = {
  proposed:  "bg-amber-500/15 text-amber-400 border-amber-500/40",
  accepted:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  rejected:  "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
  processed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
}

export function TradesPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [proposeOpen, setProposeOpen] = useState(false)

  useEffect(() => { if (id) refresh() }, [id])

  async function refresh() {
    try {
      const [l, t] = await Promise.all([getLeague(id), listTrades(id)])
      setLeague(l); setTrades(t)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not load trades."
      toast.error(message)
    }
  }

  if (!league) return <Skeleton className="h-64" />

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-display text-4xl md:text-5xl text-foreground leading-none">TRADES</div>
          <p className="text-sm text-muted-foreground mt-2">
            Propose a swap, accept incoming offers, or cancel pending ones. Trades auto-process on accept.
          </p>
        </div>
        {league.my_team_id !== null && (
          <ProposeTradeDialog
            open={proposeOpen}
            onOpenChange={setProposeOpen}
            league={league}
            onSuccess={() => { setProposeOpen(false); refresh() }}
          />
        )}
      </header>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
          <ArrowRightLeft className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <div className="text-display text-2xl text-foreground">NO TRADES YET</div>
          <p className="text-sm text-muted-foreground mt-2">
            Be the first to propose a deal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {trades.map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              myTeamId={league.my_team_id}
              onAction={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TradeCard({ trade, myTeamId, onAction }: { trade: Trade; myTeamId: number | null; onAction: () => void }) {
  const [busy, setBusy] = useState(false)
  const isProposer = trade.proposer.id === myTeamId
  const isRecipient = trade.recipient.id === myTeamId

  const proposerAssets = trade.assets.filter((a) => a.from_team.id === trade.proposer.id)
  const recipientAssets = trade.assets.filter((a) => a.from_team.id === trade.recipient.id)

  async function act(action: "accept" | "reject" | "cancel") {
    setBusy(true)
    try {
      await respondToTrade(trade.id, action)
      toast.success(`Trade ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "cancelled"}.`)
      onAction()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed."
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TeamAvatar name={trade.proposer.name} size={24} />
          <span className="font-semibold text-sm">{trade.proposer.name}</span>
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
          <TeamAvatar name={trade.recipient.name} size={24} />
          <span className="font-semibold text-sm">{trade.recipient.name}</span>
        </div>
        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider", STATUS_TONE[trade.status])}>
          {trade.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-stretch p-5">
        <TradeSide team={trade.proposer} assets={proposerAssets} highlight={isProposer} />
        <div className="hidden md:flex flex-col items-center justify-center text-muted-foreground">
          <ArrowRightLeft className="h-6 w-6" />
        </div>
        <TradeSide team={trade.recipient} assets={recipientAssets} highlight={isRecipient} />
      </div>

      {trade.note && (
        <div className="px-5 pb-3 text-sm italic text-muted-foreground">"{trade.note}"</div>
      )}

      {trade.status === "proposed" && (isProposer || isRecipient) && (
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          {isRecipient && (
            <>
              <Button size="sm" disabled={busy} onClick={() => act("accept")}>
                {busy ? "Accepting…" : "Accept"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act("reject")}>
                Reject
              </Button>
            </>
          )}
          {isProposer && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act("cancel")}>
              Cancel proposal
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function TradeSide({ team, assets, highlight }: { team: Trade["proposer"]; assets: Trade["assets"]; highlight: boolean }) {
  return (
    <div className={cn(
      "rounded-md border p-3",
      highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card",
    )}>
      <div className="flex items-center gap-2 mb-2">
        <TeamAvatar name={team.name} size={24} />
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{team.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">sends</div>
        </div>
      </div>
      <div className="space-y-1">
        {assets.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Nothing</div>
        ) : (
          assets.map((a) => (
            <PlayerCard key={a.id} player={a.player} variant="row" className="bg-muted/30" />
          ))
        )}
      </div>
    </div>
  )
}

interface ProposeTradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  league: LeagueDetail
  onSuccess: () => void
}

function ProposeTradeDialog({ open, onOpenChange, league, onSuccess }: ProposeTradeDialogProps) {
  const [recipientTeamId, setRecipientTeamId] = useState<number | null>(null)
  const [proposerPlayerIds, setProposerPlayers] = useState<number[]>([])
  const [recipientPlayerIds, setRecipientPlayers] = useState<number[]>([])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const [myTeam, setMyTeam] = useState<TeamDetail | null>(null)
  const [otherTeam, setOtherTeam] = useState<TeamDetail | null>(null)

  useEffect(() => {
    if (!open) {
      setRecipientTeamId(null); setProposerPlayers([]); setRecipientPlayers([]); setNote(""); setOtherTeam(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !league.my_team_id) return
    getTeam(league.my_team_id).then(setMyTeam).catch(() => {})
  }, [open, league.my_team_id])

  useEffect(() => {
    if (!recipientTeamId) { setOtherTeam(null); setRecipientPlayers([]); return }
    getTeam(recipientTeamId).then(setOtherTeam).catch(() => {})
  }, [recipientTeamId])

  const otherTeams = useMemo(
    () => league.teams.filter((t) => t.id !== league.my_team_id),
    [league],
  )

  async function submit() {
    if (!recipientTeamId || proposerPlayerIds.length === 0 || recipientPlayerIds.length === 0) {
      toast.error("Pick a partner and at least one player on each side.")
      return
    }
    setBusy(true)
    try {
      await proposeTrade(league.id, {
        recipient_team_id: recipientTeamId,
        proposer_player_ids: proposerPlayerIds,
        recipient_player_ids: recipientPlayerIds,
        note,
      })
      toast.success("Trade proposed.")
      onSuccess()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Proposal failed."
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Propose trade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propose a trade</DialogTitle>
          <DialogDescription>
            Pick a partner team and the players changing hands. Trades auto-process on accept.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trade with</Label>
            <Select
              value={recipientTeamId ? String(recipientTeamId) : undefined}
              onValueChange={(v) => setRecipientTeamId(Number(v))}
            >
              <SelectTrigger><SelectValue placeholder="Choose a team…" /></SelectTrigger>
              <SelectContent>
                {otherTeams.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} ({t.member.display_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <RosterPicker
              label="You send"
              roster={myTeam?.roster_entries ?? []}
              selectedIds={proposerPlayerIds}
              onChange={setProposerPlayers}
            />
            <RosterPicker
              label="They send"
              roster={otherTeam?.roster_entries ?? []}
              selectedIds={recipientPlayerIds}
              onChange={setRecipientPlayers}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trade_note">Note (optional)</Label>
            <Input
              id="trade_note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="One-line context the recipient sees"
              maxLength={400}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Proposing…" : "Propose"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RosterPicker({ label, roster, selectedIds, onChange }: {
  label: string
  roster: RosterEntry[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}) {
  const set = new Set(selectedIds)
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border/40">
        {roster.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground italic">Pick a partner team first.</p>
        ) : (
          roster.map((r) => {
            const selected = set.has(r.player.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  onChange(selected
                    ? selectedIds.filter((id) => id !== r.player.id)
                    : [...selectedIds, r.player.id])
                }
                className={cn(
                  "w-full text-left transition-colors",
                  selected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/50",
                )}
              >
                <PlayerCard player={r.player} variant="row" className="bg-transparent" />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
