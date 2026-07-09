import { useEffect, useRef } from "react"
import { useTelemetryStore } from "@/application/stores/telemetry-store"
import { socketService } from "@/infrastructure/ws/socket-service"
import type { WsTelemetryMessage } from "@/infrastructure/ws/socket-protocol"
import { useSerialStore } from "@/application/stores/serial-store"

export function useTelemetry(connect = true) {
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<WsTelemetryMessage | null>(null)

  function scheduleFlush() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const msg = pendingRef.current
      if (!msg) return
      pendingRef.current = null
      useTelemetryStore.getState().updateReadings(
        msg.readings,
        msg.cycle,
        msg.therapy_active,
        msg.therapy_state_name,
        msg.therapy_start,
      )
    })
  }

  useEffect(() => {
    if (!connect) return

    const key = "telemetry"

    const unsubConnection = socketService.onConnectionChange((connected) => {
      useTelemetryStore.getState().setConnected(connected)
    })
    useTelemetryStore.getState().setConnected(socketService.connected)

    socketService.connect(key, {
      onTelemetry: (msg) => {
        const serialStatus = useSerialStore.getState().status
        if (serialStatus !== "Running" && serialStatus !== "Initializing") return
        pendingRef.current = msg
        scheduleFlush()
      },
    })

    return () => {
      unsubConnection()
      socketService.disconnect(key)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [connect])

  const store = useTelemetryStore()

  return {
    data: {
      pressures: store.pressures,
      flows: store.flows,
      info: store.info,
      history: store.history,
    },
    therapyActive: store.therapyActive,
    therapyStateName: store.therapyStateName,
    therapyStart: store.therapyStart,
    connected: store.connected,
    cycle: store.cycle,
  }
}
