import { cn } from "@/lib/utils"
import { ScrollArea } from "@/presentation/components/ui/scroll-area"
import { Card } from "@/presentation/components/ui/card"

export interface EventEntry {
  timestamp: string
  message: string
  type: "info" | "success" | "warning" | "error"
}

interface EventLogProps {
  events: EventEntry[]
}

const typeColors: Record<string, string> = {
  info: "text-scada-info",
  success: "text-scada-success",
  warning: "text-scada-warning",
  error: "text-scada-danger",
}

const typeDots: Record<string, string> = {
  info: "bg-scada-info",
  success: "bg-scada-success",
  warning: "bg-scada-warning",
  error: "bg-scada-danger",
}

export function EventLog({ events }: EventLogProps) {
  return (
    <Card variant="glass" dense>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-scada-muted">
        Log de Eventos
      </h3>
      <ScrollArea className="h-28">
        <div className="space-y-1">
          {events.length === 0 && (
            <p className="text-xs text-scada-muted">Sin eventos recientes</p>
          )}
          {events.map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="shrink-0 font-mono text-[10px] text-scada-muted">{ev.timestamp}</span>
              <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", typeDots[ev.type])} />
              <span className={cn(typeColors[ev.type])}>{ev.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
