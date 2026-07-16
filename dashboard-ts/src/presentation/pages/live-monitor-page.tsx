import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useScadaViewModel } from "@/application/hooks/use-scada-view-model"
import { useSerialStatus } from "@/application/hooks/use-serial-status"
import { useTelemetry } from "@/application/hooks/use-telemetry"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { SerialPanel } from "@/presentation/components/monitoring/serial-panel"

import { ScadaLayout } from "@/presentation/components/scada/scada-layout"
import { therapyApi } from "@/infrastructure/api/therapy-api"
import { Activity, Wifi, WifiOff, Usb } from "lucide-react"

export function LiveMonitorPage() {
  const navigate = useNavigate()
  const vm = useScadaViewModel()
  const serial = useSerialStatus()
  const telemetry = useTelemetry(true)
  const wasTherapyActive = useRef(false)

  const serialIsLive = serial.isRunning || serial.isInitializing
  const serialNumber = vm.device.serialNumber ?? "---"

  useEffect(() => {
    if (!vm.therapy.active) {
      wasTherapyActive.current = false
      return
    }
    if (wasTherapyActive.current) return
    wasTherapyActive.current = true

    let cancelled = false

    const tryNavigate = async () => {
      while (!cancelled) {
        try {
          const res = await therapyApi.list(1, 50)
          const open = res.therapies.filter(t => !t.ended_at && t.status !== "completed")
          if (open.length > 0) {
            const latest = open.sort((a, b) =>
              String(b.started_at).localeCompare(String(a.started_at))
            )[0]
            navigate(`/therapy/${latest.id}`)
            return
          }
        } catch {
          /* network error, retry */
        }
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    tryNavigate()
    return () => { cancelled = true }
  }, [vm.therapy.active, navigate])

  return (
    <div>
      <PageHeader
        title="Monitor en Vivo"
        description={serialIsLive ? "Recibiendo datos del dispositivo..." : "Esperando conexión serial"}
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
          </div>
        }
      />

      <SerialPanel onStop={() => navigate("/")} />

      <div className="mt-3 flex gap-3">
        <ScadaLayout vm={vm} />
      </div>
    </div>
  )
}
