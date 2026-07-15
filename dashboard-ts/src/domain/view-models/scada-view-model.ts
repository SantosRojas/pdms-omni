import type { TelemetryReading, TelemetryHistoryPoint } from "@/domain/entities/telemetry-reading"

export interface ScadaViewModel {
  telemetry: {
    info: Record<string, TelemetryReading>
    pressures: Record<string, TelemetryReading>
    flows: Record<string, TelemetryReading>
    history: TelemetryHistoryPoint[]
  }
  therapy: {
    active: boolean
    stateName: string
    start: string | null
    id: number | undefined
  }
  presentation: {
    displayNameMap: Record<string, string>
    therapyTimeDisplay: string | undefined
    netRemovalDisplay: string | undefined
  }
  device: {
    serialNumber: string | undefined
  }
}
