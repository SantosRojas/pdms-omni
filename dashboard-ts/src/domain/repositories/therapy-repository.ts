import type {
  Therapy,
  TherapiesResponse,
  HistoryRow,
  TherapyComment,
  CreateCommentRequest,
} from "../entities/therapy"

export interface TherapyRepository {
  list(page: number, pageSize: number, search?: string, status?: string, dateFrom?: string, dateTo?: string): Promise<TherapiesResponse>
  getById(id: number): Promise<Therapy>
  close(id: number): Promise<void>
  getHistory(therapyId: number, limit?: number): Promise<HistoryRow[]>
  getComments(therapyId: number): Promise<TherapyComment[]>
  createComment(therapyId: number, data: CreateCommentRequest): Promise<TherapyComment>
  deleteComment(commentId: number, reason: string): Promise<void>
  getPatientHistory(patientId: string, limit?: number): Promise<HistoryRow[]>
  downloadReport(patientId: string, limit?: number): Promise<Blob>
  downloadTherapyReport(therapyId: number, limit?: number): Promise<Blob>
}
