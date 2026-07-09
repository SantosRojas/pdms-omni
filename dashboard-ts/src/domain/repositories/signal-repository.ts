import type { Signal, UpdateSignalRequest } from "../entities/signal"

export interface SignalRepository {
  list(): Promise<Signal[]>
  update(id: number, data: UpdateSignalRequest): Promise<Signal>
}
