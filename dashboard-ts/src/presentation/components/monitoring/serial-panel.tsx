import { useState } from "react"
import { useSerialStatus } from "@/application/hooks/use-serial-status"
import { useAuth } from "@/application/hooks/use-auth"
import { Button } from "@/presentation/components/ui/button"
import { Badge } from "@/presentation/components/ui/badge"
import { Card, CardContent } from "@/presentation/components/ui/card"
import { StopSerialModal } from "@/presentation/components/monitoring/stop-serial-modal"
import { Play, Square, RefreshCw, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface SerialPanelProps {
  hasOpenTherapies?: boolean
  onStop?: () => void
}

export function SerialPanel({ hasOpenTherapies = false, onStop }: SerialPanelProps) {
  const {
    status,
    consecutiveFailures,
    maxFailures,
    loading,
    start,
    stop,
    isRunning,
    isInitializing,
    isStopped,
    isFailed,
  } = useSerialStatus()

  const { canManageSerial } = useAuth()
  const [stopModalOpen, setStopModalOpen] = useState(false)

  const statusLabel = {
    Running: "Ejecutando",
    Initializing: "Inicializando",
    Stopped: "Detenido",
    FailedLimit: "Límite de fallos",
    Disconnected: "Desconectado",
  }[status]

  const badgeVariant = isRunning ? "success" : isInitializing ? "warning" : isFailed ? "destructive" : "secondary"

  function handleStartClick() {
    start(true)
  }

  function handleStopClick() {
    if (hasOpenTherapies) {
      setStopModalOpen(true)
    } else {
      stop(false)
      onStop?.()
    }
  }

  return (
    <>
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-3 w-3 rounded-full",
                isRunning ? "bg-green-500 shadow-[0_0_8px] shadow-green-500" :
                isInitializing ? "bg-amber-500 animate-pulse" :
                isFailed ? "bg-red-500" : "bg-gray-500",
              )} />
              <div>
                <p className="text-sm font-medium">Puerto Serial</p>
                <div className="flex items-center gap-2">
                  <Badge variant={badgeVariant}>{statusLabel}</Badge>
                  {isFailed && (
                    <span className="text-xs text-destructive">
                      {consecutiveFailures}/{maxFailures}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {canManageSerial && (isStopped || isFailed) && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleStartClick}
                  loading={loading}
                >
                  <Play className="h-4 w-4" />
                  Iniciar
                </Button>
              )}
              {canManageSerial && isRunning && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopClick}
                  loading={loading}
                >
                  <Square className="h-4 w-4" />
                  Detener
                </Button>
              )}
              {isInitializing && (
                <Button size="sm" variant="outline" disabled>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Inicializando...
                </Button>
              )}
            </div>
          </div>

          {isFailed && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                El dispositivo ha superado el límite de fallos consecutivos ({consecutiveFailures}/{maxFailures}).
                Verifique la conexión serial e intente nuevamente.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <StopSerialModal
        open={stopModalOpen}
        onClose={() => setStopModalOpen(false)}
        onStop={(closeTherapy) => {
          stop(closeTherapy)
          setStopModalOpen(false)
          onStop?.()
        }}
      />
    </>
  )
}
