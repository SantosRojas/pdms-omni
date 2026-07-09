export interface SerialStatus {
  status: string
  consecutive_failures: number
  max_failures: number
  data_warnings: number
  close_therapy_on_stop: boolean
}

export interface StartSerialRequest {
  new_therapy?: boolean
}

export interface StopSerialRequest {
  close_therapy?: boolean
}
