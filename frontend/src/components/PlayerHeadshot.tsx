import { useState, type SyntheticEvent } from "react"
import { cn } from "@/lib/utils"
import { playerHeadshotUrl, PLAYER_HEADSHOT_FALLBACK, type HeadshotSize } from "@/lib/nba"

type Size = "xs" | "sm" | "md" | "lg"

const SIZE_PX: Record<Size, number> = {
  xs: 24,
  sm: 32,
  md: 64,
  lg: 192,
}

const SIZE_TO_CDN: Record<Size, HeadshotSize> = {
  xs: "sm",
  sm: "sm",
  md: "sm",
  lg: "lg",
}

interface Props {
  nbaPlayerId: number | null | undefined
  fullName?: string
  size?: Size
  rounded?: boolean
  className?: string
}

export function PlayerHeadshot({
  nbaPlayerId,
  fullName,
  size = "sm",
  rounded = true,
  className,
}: Props) {
  const [errored, setErrored] = useState(false)
  const px = SIZE_PX[size]
  const src = errored ? PLAYER_HEADSHOT_FALLBACK : playerHeadshotUrl(nbaPlayerId, SIZE_TO_CDN[size])

  return (
    <img
      src={src}
      alt={fullName ?? "Player photo"}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onError={(e: SyntheticEvent<HTMLImageElement>) => {
        if (!errored) {
          setErrored(true)
          e.currentTarget.src = PLAYER_HEADSHOT_FALLBACK
        }
      }}
      className={cn(
        "object-cover bg-secondary shrink-0",
        rounded ? "rounded-full" : "rounded-md",
        className,
      )}
      style={{ width: px, height: px }}
    />
  )
}
