import { useState, type SyntheticEvent } from "react"
import { cn } from "@/lib/utils"
import { teamLogoUrl, TEAM_LOGO_FALLBACK } from "@/lib/nba"

interface Props {
  teamAbbr: string | null | undefined
  size?: 16 | 24 | 32 | 48 | 96
  className?: string
}

export function TeamLogo({ teamAbbr, size = 32, className }: Props) {
  const [errored, setErrored] = useState(false)
  const src = errored ? TEAM_LOGO_FALLBACK : teamLogoUrl(teamAbbr)
  const padding = size <= 24 ? 1 : size <= 48 ? 2 : 4

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center bg-white rounded-full shrink-0",
        className,
      )}
      style={{ width: size, height: size, padding }}
      title={teamAbbr ?? undefined}
    >
      <img
        src={src}
        alt={teamAbbr ? `${teamAbbr} logo` : "Team logo unavailable"}
        loading="lazy"
        decoding="async"
        onError={(e: SyntheticEvent<HTMLImageElement>) => {
          if (!errored) {
            setErrored(true)
            e.currentTarget.src = TEAM_LOGO_FALLBACK
          }
        }}
        className="block w-full h-full object-contain"
      />
    </span>
  )
}
