import type { TherapyRepository } from "@/domain/repositories/therapy-repository"
import type {
  Therapy,
  TherapiesResponse,
  HistoryRow,
  TherapyComment,
  CreateCommentRequest,
} from "@/domain/entities/therapy"
import { apiClient } from "./client"

export const therapyApi: TherapyRepository = {
  async list(page: number, pageSize: number, search?: string, status?: string, dateFrom?: string, dateTo?: string): Promise<TherapiesResponse> {
    const { data } = await apiClient.get<TherapiesResponse>("/api/therapies", {
      params: { page, page_size: pageSize, search, status, date_from: dateFrom, date_to: dateTo },
    })
    return data
  },

  async getById(id: number): Promise<Therapy> {
    void id
    throw new Error("getById not available — use list() instead")
  },

  async close(id: number): Promise<void> {
    await apiClient.post(`/api/therapies/${id}/close`)
  },

  async getHistory(therapyId: number, limit?: number): Promise<HistoryRow[]> {
    const { data } = await apiClient.get<HistoryRow[]>("/api/therapy-history", {
      params: { therapy_id: therapyId, limit },
    })
    return data
  },

  async getComments(therapyId: number): Promise<TherapyComment[]> {
    const { data } = await apiClient.get<TherapyComment[]>(`/api/therapies/${therapyId}/comments`)
    return data
  },

  async createComment(therapyId: number, req: CreateCommentRequest): Promise<TherapyComment> {
    const { data } = await apiClient.post<TherapyComment>(`/api/therapies/${therapyId}/comments`, {
      author_name: req.author_name,
      comment: req.comment,
    })
    return data
  },

  async deleteComment(commentId: number, reason: string): Promise<void> {
    await apiClient.delete(`/api/therapies/comments/${commentId}`, {
      data: { reason },
    })
  },

  async getPatientHistory(patientId: string, limit?: number): Promise<HistoryRow[]> {
    const { data } = await apiClient.get<HistoryRow[]>("/api/history", {
      params: { patient: patientId, limit },
    })
    return data
  },

  async downloadReport(patientId: string, limit?: number): Promise<Blob> {
    const { data } = await apiClient.get<Blob>("/api/export", {
      params: { patient: patientId, limit },
      responseType: "blob",
    })
    return data
  },

  async downloadTherapyReport(therapyId: number, limit?: number): Promise<Blob> {
    const { data } = await apiClient.get<Blob>("/api/therapy-export", {
      params: { therapy_id: therapyId, limit },
      responseType: "blob",
    })
    return data
  },
}
