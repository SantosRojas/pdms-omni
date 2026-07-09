import { create } from "zustand"
import type { TelemetryReading, TelemetryHistoryPoint } from "@/domain/entities/telemetry-reading"
import { isPressureSignal, isFlowSignal } from "@/domain/entities/telemetry-reading"

const MAX_HISTORY = 50

interface TelemetryState {
  pressures: Record<string, TelemetryReading>
  flows: Record<string, TelemetryReading>
  info: Record<string, TelemetryReading>
  history: TelemetryHistoryPoint[]
  therapyActive: boolean
  therapyStateName: string
  therapyStart: string | null
  connected: boolean
  cycle: number

  updateReadings: (readings: TelemetryReading[], cycle: number, therapyActive: boolean, therapyStateName: string, therapyStart: string | null) => void
  setConnected: (connected: boolean) => void
  reset: () => void
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  pressures: {},
  flows: {},
  info: {},
  history: [],
  therapyActive: false,
  therapyStateName: "",
  therapyStart: null,
  connected: false,
  cycle: 0,

  updateReadings: (readings, cycle, therapyActive, therapyStateName, therapyStart) => {
    const pressures: Record<string, TelemetryReading> = {}
    const flows: Record<string, TelemetryReading> = {}
    const info: Record<string, TelemetryReading> = {}

    const historyPoint: TelemetryHistoryPoint = { timestamp: "" }

    for (const r of readings) {
      if (isPressureSignal(r.internal_name)) {
        pressures[r.internal_name] = r
      } else if (isFlowSignal(r.internal_name)) {
        flows[r.internal_name] = r
      } else {
        info[r.internal_name] = r
      }

      if (r.internal_name === "d_serial_number_to_odi") {
        const serial = r.display_value
          ? String(r.display_value)
          : typeof r.physical_value === "string"
            ? r.physical_value
            : String(r.physical_value ?? "")
        if (serial) localStorage.setItem("machine_serial", serial)
      }

      if (!historyPoint.timestamp && r.timestamp) {
        historyPoint.timestamp = r.timestamp
      }
      if (isPressureSignal(r.internal_name) || isFlowSignal(r.internal_name)) {
        historyPoint[r.internal_name] = typeof r.physical_value === "number" ? r.physical_value : 0
      }
    }

    const prev = get()
    const history = historyPoint.timestamp
      ? [...prev.history, historyPoint].slice(-MAX_HISTORY)
      : prev.history

    set({
      pressures,
      flows,
      info,
      history,
      cycle,
      therapyActive,
      therapyStateName,
      therapyStart,
    })
  },

  setConnected: (connected) => set({ connected }),

  reset: () =>
    set({
      pressures: {},
      flows: {},
      info: {},
      history: [],
      therapyActive: false,
      therapyStateName: "",
      therapyStart: null,
      connected: false,
      cycle: 0,
    }),
}))
