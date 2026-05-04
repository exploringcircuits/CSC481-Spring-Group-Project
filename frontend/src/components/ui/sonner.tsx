import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon, Flame } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info:    <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error:   <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "ff-toast",
          title: "ff-toast-title",
          description: "ff-toast-desc",
          actionButton: "ff-toast-action",
          cancelButton: "ff-toast-cancel",
          success: "ff-toast-success",
          info: "ff-toast-info",
          warning: "ff-toast-warning",
          error: "ff-toast-error",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, Flame }
