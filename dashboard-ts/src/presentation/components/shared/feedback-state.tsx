import { Loader2, Inbox } from "lucide-react"
import { Skeleton } from "@/presentation/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = "Cargando...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

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

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
