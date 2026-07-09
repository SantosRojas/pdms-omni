import { useTelemetry } from "@/application/hooks/use-telemetry"
import { useSerialStatus } from "@/application/hooks/use-serial-status"
import { StatusBar } from "@/presentation/components/scada/status-bar"
import { ScadaLayout } from "@/presentation/components/scada/scada-layout"

export function ScadaPage() {
  const telemetry = useTelemetry(true)
  const serial = useSerialStatus()
  const { pressures, flows, info } = telemetry.data

  return (
    <div className="flex h-screen flex-col gradient-bg">
      <StatusBar
        therapyActive={telemetry.therapyActive}
        therapyStateName={telemetry.therapyStateName}
        therapyStart={telemetry.therapyStart}
        connected={telemetry.connected}
        serialStatus={serial.status}
      />

      <div className="flex flex-1 gap-3 overflow-auto p-3">
        <ScadaLayout
          info={info}
          pressures={pressures}
          flows={flows}
          history={telemetry.data.history}
          therapyActive={telemetry.therapyActive}
          therapyStateName={telemetry.therapyStateName}
        />
      </div>
    </div>
  )
}
