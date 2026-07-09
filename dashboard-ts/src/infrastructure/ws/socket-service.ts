import { getWsToken } from "@/infrastructure/api/client"
import type { WsIncomingMessage, WsOutgoingMessage } from "./socket-protocol"

export type WsConnectorKey = string
export type TelemetryCallback = (readings: WsIncomingMessage & { type: "telemetry" }) => void
export type SerialStatusCallback = (status: WsIncomingMessage & { type: "serial_status" }) => void

interface ConnectorEntry {
  key: WsConnectorKey
  onTelemetry?: TelemetryCallback
  onSerialStatus?: SerialStatusCallback
}

class SocketService {
  private ws: WebSocket | null = null
  private connectors = new Map<WsConnectorKey, ConnectorEntry>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isConnecting = false
  private authenticated = false
  private connectionListeners = new Set<(connected: boolean) => void>()

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener)
    return () => this.connectionListeners.delete(listener)
  }

  private get url(): string {
    return import.meta.env.VITE_WS_URL || "/ws"
  }

  connect(key: WsConnectorKey, callbacks: { onTelemetry?: TelemetryCallback; onSerialStatus?: SerialStatusCallback }): void {
    this.connectors.set(key, { key, ...callbacks })
    if (!this.ws && !this.isConnecting) {
      this.connectWs()
    }
  }

  disconnect(key: WsConnectorKey): void {
    this.connectors.delete(key)
    if (this.connectors.size === 0) {
      this.close()
    }
  }

  private connectWs(): void {
    this.isConnecting = true
    this.authenticated = false

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.isConnecting = false
      const token = getWsToken()
      if (token) {
        this.send({ type: "auth", token })
      }
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsIncomingMessage = JSON.parse(event.data)
        this.handleMessage(msg)
      } catch {
        // ignore parse errors
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.isConnecting = false
      this.authenticated = false
      this.notifyConnection(false)
      if (this.connectors.size > 0) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // WebSocket auto-closes after error; onclose will fire next
    }
  }

  private notifyConnection(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected))
  }

  private handleMessage(msg: WsIncomingMessage): void {
    switch (msg.type) {
      case "auth_ok":
        this.authenticated = true
        this.notifyConnection(true)
        break
      case "auth_error":
        this.close()
        break
      case "telemetry":
        this.connectors.forEach((c) => c.onTelemetry?.(msg))
        break
      case "serial_status":
        this.connectors.forEach((c) => c.onSerialStatus?.(msg))
        break
    }
  }

  private send(msg: WsOutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectWs()
    }, 3000)
  }

  private close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close(1000, "client disconnect")
    }
    this.ws = null
    this.authenticated = false
    this.isConnecting = false
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated
  }
}

export const socketService = new SocketService()
