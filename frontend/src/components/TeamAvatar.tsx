import { cn } from "@/lib/utils"

interface Props {
  name: string | null | undefined
  size?: 16 | 24 | 32 | 48 | 64 | 96
  className?: string
}

// Stable color for a team based on its name. Hashes the name to one of a curated
// set of saturated dark-friendly tones so each team feels distinct.
const PALETTE = [
  "linear-gradient(135deg, oklch(0.55 0.22 27),  oklch(0.40 0.12 18))",   // ESPN red → burgundy
  "linear-gradient(135deg, oklch(0.60 0.18 252), oklch(0.40 0.14 240))",  // Blue
  "linear-gradient(135deg, oklch(0.62 0.16 145), oklch(0.45 0.12 165))",  // Emerald
  "linear-gradient(135deg, oklch(0.68 0.18 50),  oklch(0.50 0.16 45))",   // Orange
  "linear-gradient(135deg, oklch(0.55 0.22 320), oklch(0.42 0.18 310))",  // Magenta
  "linear-gradient(135deg, oklch(0.62 0.18 200), oklch(0.45 0.14 215))",  // Cyan
  "linear-gradient(135deg, oklch(0.70 0.16 75),  oklch(0.55 0.16 65))",   // Tan/gold
  "linear-gradient(135deg, oklch(0.55 0.18 290), oklch(0.40 0.14 280))",  // Violet
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function TeamAvatar({ name, size = 32, className }: Props) {
  const safe = name || "?"
  const bg = PALETTE[hashString(safe) % PALETTE.length]
  const fontSize = size <= 24 ? 9 : size <= 32 ? 11 : size <= 48 ? 14 : size <= 64 ? 18 : 24
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size, background: bg, fontSize }}
      title={safe}
    >
      <span style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
        {initials(safe)}
      </span>
    </span>
  )
}
