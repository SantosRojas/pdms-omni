import type { SignalRepository } from "@/domain/repositories/signal-repository"
import type { Signal, UpdateSignalRequest } from "@/domain/entities/signal"
import { apiClient } from "./client"

export const signalApi: SignalRepository = {
  async list(): Promise<Signal[]> {
    const { data } = await apiClient.get<Signal[]>("/api/signals")
    return data
  },

  async update(id: number, req: UpdateSignalRequest): Promise<Signal> {
    const { data } = await apiClient.put<Signal>(`/api/signals/${id}`, req)
    return data
  },
}
