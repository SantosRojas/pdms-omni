import { useEffect } from "react"
import { useSerialStore } from "@/application/stores/serial-store"
import { socketService } from "@/infrastructure/ws/socket-service"

export function useSerialStatus() {
  const store = useSerialStore()

  useEffect(() => {
    useSerialStore.getState().fetchStatus()

    const key = "serialStatus"
    socketService.connect(key, {
      onSerialStatus: (msg) => {
        useSerialStore.getState().updateFromEvent(
          msg.status,
          msg.consecutive_failures,
          msg.max_failures,
          msg.data_warnings,
        )
      },
    })

    return () => {
      socketService.disconnect(key)
    }
  }, [])

  return {
    status: store.status,
    consecutiveFailures: store.consecutiveFailures,
    maxFailures: store.maxFailures,
    dataWarnings: store.dataWarnings,
    loading: store.loading,
    start: store.start,
    stop: store.stop,
    isRunning: store.status === "Running",
    isInitializing: store.status === "Initializing",
    isStopped: store.status === "Stopped",
    isFailed: store.status === "FailedLimit",
  }
}
