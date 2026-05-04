import { cn } from "@/lib/utils"

type Result = "W" | "L" | "T"

interface Props {
  results: (Result | string)[]
  className?: string
}

const PIP_TONE: Record<string, string> = {
  W: "bg-emerald-500/80 ring-emerald-400/30",
  L: "bg-muted-foreground/30 ring-muted-foreground/20",
  T: "bg-amber-500/70 ring-amber-400/30",
}

export function Sparkline({ results, className }: Props) {
  // Normalize and pad to 5
  const padded: string[] = [...results].slice(-5)
  while (padded.length < 5) padded.unshift("-")
  return (
    <div className={cn("inline-flex items-center gap-1", className)} title={`Last 5: ${results.join(" ")}`}>
      {padded.map((r, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full ring-2",
            PIP_TONE[r] ?? "bg-secondary ring-border",
          )}
        />
      ))}
    </div>
  )
}
