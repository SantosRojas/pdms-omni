import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  message?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title = "Sin datos",
  message = "No hay información disponible",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}>
      {icon || <Inbox className="h-12 w-12 text-muted-foreground" />}
      <div className="text-center">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {action}
    </div>
  )
}


