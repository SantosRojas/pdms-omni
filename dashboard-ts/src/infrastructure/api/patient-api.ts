import type { PatientRepository } from "@/domain/repositories/patient-repository"
import type { Patient } from "@/domain/entities/patient"
import type { HistoryRow } from "@/domain/entities/therapy"
import { apiClient } from "./client"

export const patientApi: PatientRepository = {
  async list(): Promise<Patient[]> {
    const { data } = await apiClient.get<Patient[]>("/api/patients")
    return data
  },

  async getHistory(patientId: string, limit?: number): Promise<HistoryRow[]> {
    const { data } = await apiClient.get<HistoryRow[]>("/api/history", {
      params: { patient: patientId, limit },
    })
    return data
  },
}
