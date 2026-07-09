import { memo, type ReactNode } from "react"
import { Wifi, WifiOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConnectionStatusProps {
  connected: boolean
  loading?: boolean
  label?: string
  className?: string
  size?: "sm" | "md"
}

const ConnectionStatus = memo(function ConnectionStatus({
  connected,
  loading = false,
  label,
  className,
  size = "sm",
}: ConnectionStatusProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-3 w-3"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4"

  if (loading) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
        <Loader2 className={cn(iconSize, "animate-spin text-muted-foreground")} />
        {label && <span className="text-muted-foreground">{label}</span>}
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="relative inline-flex">
        <span className={cn(dotSize, "rounded-full", connected ? "bg-green-500" : "bg-gray-400")} />
        {connected && (
          <span className={cn("absolute inset-0 animate-ping rounded-full bg-green-500 opacity-75")} />
        )}
      </span>
      {connected ? (
        <Wifi className={cn(iconSize, "text-green-500")} />
      ) : (
        <WifiOff className={cn(iconSize, "text-muted-foreground")} />
      )}
      {label && (
        <span className={connected ? "text-green-500" : "text-muted-foreground"}>{label}</span>
      )}
    </span>
  )
})

export { ConnectionStatus }

interface StatusDotProps {
  status: "success" | "warning" | "danger" | "inactive"
  label?: string
  className?: string
  children?: ReactNode
}

const statusConfig = {
  success: { bg: "bg-green-500", ping: "bg-green-500" },
  warning: { bg: "bg-amber-500", ping: "bg-amber-500" },
  danger: { bg: "bg-red-500", ping: "bg-red-500" },
  inactive: { bg: "bg-gray-400", ping: undefined },
}

const StatusDot = memo(function StatusDot({ status, label, className, children }: StatusDotProps) {
  const cfg = statusConfig[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="relative inline-flex">
        <span className={cn("h-2 w-2 rounded-full", cfg.bg)} />
        {cfg.ping && (
          <span className={cn("absolute inset-0 animate-ping rounded-full opacity-75", cfg.ping)} />
        )}
      </span>
      {label && <span>{label}</span>}
      {children}
    </span>
  )
})

export { StatusDot }
