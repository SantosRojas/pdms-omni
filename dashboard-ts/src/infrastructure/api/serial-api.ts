import type { SerialRepository } from "@/domain/repositories/serial-repository"
import type { SerialStatus, StartSerialRequest, StopSerialRequest } from "@/domain/entities/serial-status"
import { apiClient } from "./client"

export const serialApi: SerialRepository = {
  async getStatus(): Promise<SerialStatus> {
    const { data } = await apiClient.get<SerialStatus>("/api/serial/status")
    return data
  },

  async start(req: StartSerialRequest): Promise<void> {
    await apiClient.post("/api/serial/start", req)
  },

  async stop(req: StopSerialRequest): Promise<void> {
    await apiClient.post("/api/serial/stop", req)
  },
}
