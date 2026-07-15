import { useState, useEffect, useMemo } from "react"
import { useTelemetry } from "@/application/hooks/use-telemetry"
import { signalApi } from "@/infrastructure/api/signal-api"
import { getAccumTherapyTime, getAccumNetRemoval } from "@/application/utils/signal-configs"
import type { ScadaViewModel } from "@/domain/view-models/scada-view-model"

export function useScadaViewModel(therapyId?: number): ScadaViewModel {
  const telemetry = useTelemetry(true)
  const { pressures, flows, info } = telemetry.data
  const [signals, setSignals] = useState<{ internal_name: string; display_name: string | null }[]>([])

  useEffect(() => {
    signalApi.list().then(setSignals).catch(() => {})
  }, [])

  const displayNameMap = useMemo(
    () =>
      Object.fromEntries(
        signals.map((s) => [s.internal_name, s.display_name ?? s.internal_name]),
      ),
    [signals],
  )

  const serialNumber = useMemo(() => {
    const raw = info["d_serial_number_to_odi"]?.physical_value
    return raw !== undefined && raw !== null ? String(raw) : undefined
  }, [info])

  return {
    telemetry: {
      info,
      pressures,
      flows,
      history: telemetry.data.history,
    },
    therapy: {
      active: telemetry.therapyActive,
      stateName: telemetry.therapyStateName,
      start: telemetry.therapyStart,
      id: therapyId,
    },
    presentation: {
      displayNameMap,
      therapyTimeDisplay: getAccumTherapyTime(info),
      netRemovalDisplay: getAccumNetRemoval(info),
    },
    device: {
      serialNumber,
    },
  }
}
