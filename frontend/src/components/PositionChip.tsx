import { cn } from "@/lib/utils"

interface Props {
  position: string | null | undefined
  size?: "sm" | "md"
  className?: string
}

const POSITION_TONE: Record<string, string> = {
  PG: "bg-[var(--pos-pg)]/20 text-[var(--pos-pg)] border-[var(--pos-pg)]/40",
  SG: "bg-[var(--pos-sg)]/20 text-[var(--pos-sg)] border-[var(--pos-sg)]/40",
  SF: "bg-[var(--pos-sf)]/20 text-[var(--pos-sf)] border-[var(--pos-sf)]/40",
  PF: "bg-[var(--pos-pf)]/20 text-[var(--pos-pf)] border-[var(--pos-pf)]/40",
  C:  "bg-[var(--pos-c)]/20  text-[var(--pos-c)]  border-[var(--pos-c)]/40",
  G:  "bg-[var(--pos-pg)]/15 text-[var(--pos-sg)] border-[var(--pos-sg)]/40",
  F:  "bg-[var(--pos-sf)]/15 text-[var(--pos-pf)] border-[var(--pos-pf)]/40",
  UTIL: "bg-muted text-muted-foreground border-border",
  BN: "bg-muted text-muted-foreground border-border",
}

export function PositionChip({ position, size = "sm", className }: Props) {
  if (!position) return null
  const key = position.replace(/\d+$/, "").toUpperCase()
  const tone = POSITION_TONE[key] ?? "bg-muted text-muted-foreground border-border"
  const sizeClasses = size === "md"
    ? "px-2 py-0.5 text-xs"
    : "px-1.5 py-0.5 text-[10px]"
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border font-bold uppercase tracking-wider leading-none",
        sizeClasses,
        tone,
        className,
      )}
    >
      {position}
    </span>
  )
}
