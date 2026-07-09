import type { TelemetryReading, SerialStatusValue } from "@/domain/entities/telemetry-reading"

export interface WsAuthMessage {
  type: "auth"
  token: string
}

export interface WsTelemetryMessage {
  type: "telemetry"
  cycle: number
  readings: TelemetryReading[]
  therapy_active: boolean
  therapy_state_name: string
  therapy_start: string | null
  therapy_end: string | null
  persistence_enabled: boolean
  persistence_status: string
}

export interface WsSerialStatusMessage {
  type: "serial_status"
  status: SerialStatusValue
  consecutive_failures: number
  max_failures: number
  data_warnings: number
}

export interface WsAuthOkMessage {
  type: "auth_ok"
}

export interface WsAuthErrorMessage {
  type: "auth_error"
  error: string
}

export type WsIncomingMessage =
  | WsTelemetryMessage
  | WsSerialStatusMessage
  | WsAuthOkMessage
  | WsAuthErrorMessage

export type WsOutgoingMessage = WsAuthMessage
