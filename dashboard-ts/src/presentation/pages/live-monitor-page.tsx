import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useScadaViewModel } from "@/application/hooks/use-scada-view-model"
import { useSerialStatus } from "@/application/hooks/use-serial-status"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { SerialPanel } from "@/presentation/components/monitoring/serial-panel"

import { ScadaLayout } from "@/presentation/components/scada/scada-layout"
import { therapyApi } from "@/infrastructure/api/therapy-api"
import { Activity, Database } from "lucide-react"
import type { Therapy } from "@/domain/entities/therapy"

export function LiveMonitorPage() {
  const navigate = useNavigate()
  const vm = useScadaViewModel()
  const serial = useSerialStatus()
  const [therapies, setTherapies] = useState<Therapy[]>([])
  const knownIds = useRef<Set<string> | null>(null)

  const serialIsLive = serial.isRunning || serial.isInitializing

  useEffect(() => {
    if (!serialIsLive) return

    const fetchTherapies = async () => {
      try {
        const res = await therapyApi.list(1, 50)
        setTherapies(res.therapies)
      } catch { /* ignore */ }
    }

    fetchTherapies()
    const interval = setInterval(fetchTherapies, 5000)
    return () => clearInterval(interval)
  }, [serialIsLive])

  useEffect(() => {
    if (therapies.length > 0 && knownIds.current === null) {
      knownIds.current = new Set(therapies.map(t => String(t.id)))
    }
  }, [therapies])

  useEffect(() => {
    if (knownIds.current === null) return
    const newOpen = therapies.filter(
      t => !t.ended_at && t.status !== "completed" && !knownIds.current!.has(String(t.id))
    )
    if (newOpen.length > 0) {
      const latest = newOpen.sort((a, b) =>
        String(b.started_at).localeCompare(String(a.started_at))
      )[0]
      navigate(`/therapy/${latest.id}`)
    }
  }, [therapies, navigate])

  return (
    <div>
      <PageHeader
        title="Monitor en Vivo"
        description={serialIsLive ? "Recibiendo datos del dispositivo..." : "Esperando conexión serial"}
        icon={<Activity className="h-6 w-6" />}
        backTo="/"
      />

      <SerialPanel onStop={() => navigate("/")} />

      {vm.telemetry.info && Object.keys(vm.telemetry.info).length > 0 && serialIsLive ? (
        <div className="mt-3 flex gap-3">
          <ScadaLayout vm={vm} />
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Database className="h-12 w-12" />
          <p className="text-sm">Esperando datos del dispositivo...</p>
        </div>
      )}
    </div>
  )
}
