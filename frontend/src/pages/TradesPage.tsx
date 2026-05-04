import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
import { cn } from "@/lib/utils"

export function TradesPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const id = Number(leagueId)

  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [proposeOpen, setProposeOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    refresh()
  }, [id])

  async function refresh() {
    try {
      const [l, t] = await Promise.all([getLeague(id), listTrades(id)])
      setLeague(l)
      setTrades(t)
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
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">
            Propose a swap, accept incoming offers, or cancel pending ones.
            Auto-process on accept.
          </p>
        </div>
        {league.my_team_id !== null && (
          <ProposeTradeDialog
            open={proposeOpen}
            onOpenChange={setProposeOpen}
            league={league}
            onSuccess={() => {
              setProposeOpen(false)
              refresh()
            }}
          />
        )}
      </header>

      {trades.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No trades yet.
          </CardContent>
        </Card>
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

function TradeCard({
  trade,
  myTeamId,
  onAction,
}: {
  trade: Trade
  myTeamId: number | null
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)
  const isProposer = trade.proposer.id === myTeamId
  const isRecipient = trade.recipient.id === myTeamId

  async function act(action: "accept" | "reject" | "cancel") {
    setBusy(true)
    try {
      await respondToTrade(trade.id, action)
      toast.success(`Trade ${action}ed.`)
      onAction()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed."
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const proposerAssets = trade.assets.filter((a) => a.from_team.id === trade.proposer.id)
  const recipientAssets = trade.assets.filter((a) => a.from_team.id === trade.recipient.id)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {trade.proposer.name} ↔ {trade.recipient.name}
          </CardTitle>
          <StatusBadge status={trade.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TradeSide label={`${trade.proposer.name} sends`} assets={proposerAssets} />
          <TradeSide label={`${trade.recipient.name} sends`} assets={recipientAssets} />
        </div>
        {trade.note && (
          <>
            <Separator />
            <p className="text-sm italic text-muted-foreground">&ldquo;{trade.note}&rdquo;</p>
          </>
        )}
        {trade.status === "proposed" && (isProposer || isRecipient) && (
          <div className="flex gap-2">
            {isRecipient && (
              <>
                <Button size="sm" disabled={busy} onClick={() => act("accept")}>
                  Accept
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
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: Trade["status"] }) {
  const tone =
    status === "processed"
      ? "default"
      : status === "rejected" || status === "cancelled"
        ? "outline"
        : "secondary"
  return <Badge variant={tone}>{status}</Badge>
}

function TradeSide({ label, assets }: { label: string; assets: Trade["assets"] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <ul className="space-y-1 text-sm">
        {assets.map((a) => (
          <li key={a.id} className="flex justify-between">
            <span>{a.player.full_name}</span>
            <span className="text-muted-foreground">
              {a.player.team_abbr} · {a.player.primary_position}
            </span>
          </li>
        ))}
        {assets.length === 0 && <li className="text-muted-foreground">—</li>}
      </ul>
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

  // Reset state when opened
  useEffect(() => {
    if (!open) {
      setRecipientTeamId(null)
      setProposerPlayers([])
      setRecipientPlayers([])
      setNote("")
      setOtherTeam(null)
    }
  }, [open])

  // Load my team once
  useEffect(() => {
    if (!open || !league.my_team_id) return
    getTeam(league.my_team_id).then(setMyTeam).catch(() => {})
  }, [open, league.my_team_id])

  // Load the recipient team when picked
  useEffect(() => {
    if (!recipientTeamId) {
      setOtherTeam(null)
      setRecipientPlayers([])
      return
    }
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
        <Button>Propose trade</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
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
              <SelectTrigger>
                <SelectValue placeholder="Choose a team…" />
              </SelectTrigger>
              <SelectContent>
                {otherTeams.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} ({t.member.display_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
            <input
              id="trade_note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="One-line context the recipient sees"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              maxLength={400}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Proposing…" : "Propose"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RosterPicker({
  label,
  roster,
  selectedIds,
  onChange,
}: {
  label: string
  roster: RosterEntry[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}) {
  const set = new Set(selectedIds)
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-border">
        {roster.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No roster loaded.</p>
        ) : (
          roster.map((r) => {
            const selected = set.has(r.player.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  onChange(
                    selected
                      ? selectedIds.filter((id) => id !== r.player.id)
                      : [...selectedIds, r.player.id],
                  )
                }
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-muted",
                  selected && "bg-secondary text-foreground",
                )}
              >
                <span>{r.player.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.player.team_abbr} · {r.player.primary_position} ·{" "}
                  {r.player.fantasy_ppg !== null ? r.player.fantasy_ppg.toFixed(1) : "—"}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
