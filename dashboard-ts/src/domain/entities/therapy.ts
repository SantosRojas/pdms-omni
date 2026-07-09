export interface Therapy {
  id: number
  started_at: string
  ended_at: string | null
  status: string
  patient_id: number
  patient_id_str: string
  machine_id: number
  serial_number: string
  software_version: string
  serial_session_id: number | null
}

export interface TherapiesResponse {
  therapies: Therapy[]
  total: number
  page: number
  page_size: number
}

export interface TherapyComment {
  id: number
  therapy_id: number
  author_name: string
  comment: string
  created_at: string
  deleted_at: string | null
  deletion_reason: string | null
}

export interface CreateCommentRequest {
  author_name: string
  comment: string
}

export interface DeleteCommentRequest {
  reason: string
}

export interface HistoryRow {
  id: number
  timestamp: string
  internal_name: string
  physical_value: number | string
  display_value: string | null
  unit: string
}

export interface SessionReading {
  id: number
  timestamp: string
  internal_name: string
  raw_value: number
  physical_value: number | string
  unit: string
  display_value: string | null
  phase: string | null
}


