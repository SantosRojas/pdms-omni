export interface Equivalence {
  signal_id: number
  internal_name: string
  numeric_value: number
  display_name: string
}

export interface CreateEquivalenceRequest {
  internal_name: string
  numeric_value: number
  display_name: string
}

export interface UpdateEquivalenceRequest {
  signal_id: number
  numeric_value: number
  display_name: string
}

export interface DeleteEquivalenceRequest {
  signal_id: number
  numeric_value: number
  deleted_by: string
  deletion_reason: string
}
