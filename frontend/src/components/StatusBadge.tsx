import { cn } from "@/lib/utils"

type Status = "O" | "DTD" | "Q" | "D" | "IR" | "NA" | "" | string

interface Props {
  status: Status | null | undefined
  className?: string
}

const STATUS_LABELS: Record<string, { label: string; tone: string; title: string }> = {
  O:   { label: "O",   tone: "bg-[var(--status-out)]/15 text-[var(--status-out)] border-[var(--status-out)]/40",   title: "Out" },
  DTD: { label: "DTD", tone: "bg-[var(--status-dtd)]/15 text-[var(--status-dtd)] border-[var(--status-dtd)]/40", title: "Day-to-day" },
  Q:   { label: "Q",   tone: "bg-[var(--status-q)]/15 text-[var(--status-q)] border-[var(--status-q)]/40",       title: "Questionable" },
  D:   { label: "D",   tone: "bg-[var(--status-d)]/15 text-[var(--status-d)] border-[var(--status-d)]/40",       title: "Doubtful" },
  IR:  { label: "IR",  tone: "bg-[var(--status-ir)]/15 text-[var(--status-ir)] border-[var(--status-ir)]/40",     title: "Injured reserve" },
  NA:  { label: "NA",  tone: "bg-[var(--status-na)]/15 text-[var(--status-na)] border-[var(--status-na)]/40",     title: "Not available" },
}

export function StatusBadge({ status, className }: Props) {
  if (!status) return null
  const s = STATUS_LABELS[status.toUpperCase()] ?? { label: status, tone: "bg-muted text-muted-foreground border-border", title: status }
  return (
    <span
      title={s.title}
      className={cn(
        "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
        s.tone,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
