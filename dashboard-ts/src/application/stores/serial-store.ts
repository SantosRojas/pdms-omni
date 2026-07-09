import { create } from "zustand"
import { serialApi } from "@/infrastructure/api/serial-api"
import { useTelemetryStore } from "@/application/stores/telemetry-store"

interface SerialState {
  status: string
  consecutiveFailures: number
  maxFailures: number
  dataWarnings: number
  loading: boolean

  fetchStatus: () => Promise<void>
  updateFromEvent: (status: string, consecutiveFailures: number, maxFailures: number, dataWarnings: number) => void
  start: (newTherapy: boolean) => Promise<void>
  stop: (closeTherapy: boolean) => Promise<void>
}

export const useSerialStore = create<SerialState>((set) => ({
  status: "Stopped",
  consecutiveFailures: 0,
  maxFailures: 5,
  dataWarnings: 0,
  loading: false,

  fetchStatus: async () => {
    set({ loading: true })
    try {
      const s = await serialApi.getStatus()
      set({
        status: s.status,
        consecutiveFailures: s.consecutive_failures,
        maxFailures: s.max_failures,
        dataWarnings: s.data_warnings,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  updateFromEvent: (status, consecutiveFailures, maxFailures, dataWarnings) => {
    set({ status, consecutiveFailures, maxFailures, dataWarnings })
  },

  start: async (newTherapy) => {
    await serialApi.start({ new_therapy: newTherapy })
    set({ status: "Initializing" })
  },

  stop: async (closeTherapy) => {
    await serialApi.stop({ close_therapy: closeTherapy })
    set({ status: "Stopped" })
    useTelemetryStore.setState({ therapyActive: false, therapyStateName: "", therapyStart: null })
  },
}))
