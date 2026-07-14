import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTelemetry } from "@/application/hooks/use-telemetry"
import { useSerialStatus } from "@/application/hooks/use-serial-status"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { Button } from "@/presentation/components/ui/button"
import { ScadaLayout } from "@/presentation/components/scada/scada-layout"
import { Activity, History, Wifi, WifiOff } from "lucide-react"
import { signalApi } from "@/infrastructure/api/signal-api"

export function TherapyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const telemetry = useTelemetry(true)
  useSerialStatus()
  const { pressures, flows, info } = telemetry.data
  const [signals, setSignals] = useState<{ internal_name: string; display_name: string | null }[]>([])

  useEffect(() => {
    signalApi.list().then(setSignals).catch(() => {})
  }, [])

  const displayNameMap = useMemo(() =>
    Object.fromEntries(
      signals.map(s => [s.internal_name, s.display_name ?? s.internal_name])
    ),
    [signals]
  )

  const serialNumber = info["d_serial_number_to_odi"]?.physical_value ?? "---"

  return (
    <div>
      <PageHeader
        title={telemetry.therapyStateName || `Terapia #${id}`}
        description="Monitoreo en vivo"
        icon={<Activity className="h-6 w-6" />}
        backTo="/"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-scada-muted">OMNI-SN: {serialNumber}</span>
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
        <ScadaLayout
          info={info}
          pressures={pressures}
          flows={flows}
          history={telemetry.data.history}
          therapyActive={telemetry.therapyActive}
          therapyStateName={telemetry.therapyStateName}
          therapyStart={telemetry.therapyStart}
          therapyId={Number(id)}
          displayNameMap={displayNameMap}
        />
      </div>
    </div>
  )
}
