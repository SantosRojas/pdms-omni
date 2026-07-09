import type { Patient } from "../entities/patient"
import type { HistoryRow } from "../entities/therapy"

export interface PatientRepository {
  list(): Promise<Patient[]>
  getHistory(patientId: string, limit?: number): Promise<HistoryRow[]>
}
