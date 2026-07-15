import { useParams, useNavigate } from "react-router-dom"
import { useScadaViewModel } from "@/application/hooks/use-scada-view-model"
import { useSerialStatus } from "@/application/hooks/use-serial-status"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { Button } from "@/presentation/components/ui/button"
import { ScadaLayout } from "@/presentation/components/scada/scada-layout"
import { Activity, History, Wifi, WifiOff, Usb } from "lucide-react"
import { useTelemetry } from "@/application/hooks/use-telemetry"

export function TherapyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const vm = useScadaViewModel(Number(id))
  const telemetry = useTelemetry(true)
  const serial = useSerialStatus()
  const serialNumber = vm.device.serialNumber ?? "---"

  return (
    <div>
      <PageHeader
        title={vm.therapy.stateName || `Terapia #${id}`}
        description="Monitoreo en vivo"
        icon={<Activity className="h-6 w-6" />}
        backTo="/"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-scada-muted">OMNI-SN: {serialNumber}</span>
            {serial.isRunning || serial.isInitializing ? (
              <Usb className="h-4 w-4 text-green-500" />
            ) : (
              <Usb className="h-4 w-4 text-muted-foreground" />
            )}
            {telemetry.connected ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : (
              <WifiOff className="h-4 w-4 text-primary" />
            )}
            <Button variant="default" size="sm" onClick={() => navigate(`/history/${id}`)}>
              <History className="h-4 w-4" /> Historial
            </Button>
          </div>
        }
      />

      <div className="mt-3 flex gap-3">
        <ScadaLayout vm={vm} />
      </div>
    </div>
  )
}
