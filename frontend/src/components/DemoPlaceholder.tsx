import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles } from "lucide-react"

export function DemoPlaceholder({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: string
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-eyebrow text-primary">Demo Placeholder</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {hint ?? "This action isn't wired up in the demo build. Hook it up in production to make it real."}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
