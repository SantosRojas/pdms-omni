export interface Signal {
  id: number
  internal_name: string
  display_name: string | null
  unit: string | null
}

export interface UpdateSignalRequest {
  display_name?: string
  unit?: string
}
