import { cn } from "@/lib/utils"
import { Clock, Wifi, WifiOff } from "lucide-react"

interface StatusBarProps {
  therapyActive: boolean
  therapyStateName: string
  therapyStart: string | null
  connected: boolean
  serialStatus: string
  machineInfo?: string
  patientInfo?: string
}

export function StatusBar({
  therapyActive,
  therapyStateName,
  therapyStart,
  connected,
  serialStatus,
  machineInfo,
  patientInfo,
}: StatusBarProps) {
  const isRunning = serialStatus === "Running" || serialStatus === "Initializing"
  const isLive = isRunning && connected

  return (
    <div className="flex h-12 items-center justify-between border-b border-glass-border glass px-4 text-xs rounded-lg">
      <div className="flex items-center gap-4">
        <div className="relative flex items-center gap-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isLive ? "bg-scada-success" : "bg-scada-muted",
          )}>
            {isLive && (
              <span className="absolute inset-0 animate-ping rounded-full bg-scada-success opacity-75" />
            )}
          </div>
          <span className={cn("font-semibold", isLive ? "text-scada-success" : "text-scada-muted")}>
            {isLive ? "EN VIVO" : "DESCONECTADO"}
          </span>
        </div>

        <Separator />

        {therapyActive && (
          <>
            <span className="text-scada-text">{therapyStateName}</span>
            <Separator />
          </>
        )}

        {therapyStart && (
          <span className="flex items-center gap-1 text-scada-muted">
            <Clock className="h-3 w-3" />
            {therapyStart}
          </span>
        )}

        {machineInfo && (
          <>
            <Separator />
            <span className="text-scada-muted">{machineInfo}</span>
          </>
        )}

        {patientInfo && (
          <>
            <Separator />
            <span className="text-scada-muted">{patientInfo}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {connected ? (
          <Wifi className="h-3 w-3 text-scada-success" />
        ) : (
          <WifiOff className="h-3 w-3 text-scada-muted" />
        )}
        <span className="text-scada-muted">
          {serialStatus === "Running" ? "Conectado" :
            serialStatus === "Initializing" ? "Inicializando" :
              serialStatus === "Stopped" ? "Detenido" : "Error"}
        </span>
      </div>
    </div>
  )
}

function Separator() {
  return <div className="h-4 w-px bg-scada-border" />
}
