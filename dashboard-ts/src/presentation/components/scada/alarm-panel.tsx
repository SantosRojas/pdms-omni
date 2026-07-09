import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/presentation/components/ui/card"

export interface Alarm {
  id: string
  severity: "critical" | "warning" | "info"
  message: string
  timestamp: string
}

interface AlarmPanelProps {
  alarms: Alarm[]
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-scada-danger", bg: "bg-scada-danger/10" },
  warning: { icon: AlertTriangle, color: "text-scada-warning", bg: "bg-scada-warning/10" },
  info: { icon: Info, color: "text-scada-info", bg: "bg-scada-info/10" },
}

export function AlarmPanel({ alarms }: AlarmPanelProps) {
  if (alarms.length === 0) {
    return (
    <Card variant="glass" dense>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-scada-muted">Alarmas</h3>
        <p className="text-center text-xs text-scada-muted">Sin alarmas activas</p>
      </Card>
    )
  }

  return (
    <Card variant="surface" dense>
      <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-scada-muted">
        <span>Alarmas</span>
        <span className="rounded-full bg-scada-danger/20 px-2 py-0.5 text-[10px] text-scada-danger">
          {alarms.length}
        </span>
      </h3>
      <div className="space-y-1.5">
        {alarms.map((alarm) => {
          const cfg = severityConfig[alarm.severity]
          const Icon = cfg.icon
          return (
            <div
              key={alarm.id}
              className={cn("flex items-start gap-2 rounded-md p-2", cfg.bg)}
            >
              <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", cfg.color)} />
              <div className="flex-1">
                <p className={cn("text-xs font-medium", cfg.color)}>{alarm.message}</p>
                <p className="text-[10px] text-scada-muted">{alarm.timestamp}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
