import type { SerialStatus, StartSerialRequest, StopSerialRequest } from "../entities/serial-status"

export interface SerialRepository {
  getStatus(): Promise<SerialStatus>
  start(data: StartSerialRequest): Promise<void>
  stop(data: StopSerialRequest): Promise<void>
}
