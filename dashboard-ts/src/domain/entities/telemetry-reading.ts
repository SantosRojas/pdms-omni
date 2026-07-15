export interface TelemetryReading {
  id?: number
  timestamp: string
  therapy_id?: number
  serial_session_id?: number
  signal_id: number
  internal_name: string
  raw_value: number
  physical_value: number | string
  unit: string
  display_value?: string | null
  phase?: string | null
}

export interface TelemetryHistoryPoint {
  timestamp: string
  [key: string]: number | string
}

export type SerialStatusValue =
  | "Running"
  | "Initializing"
  | "Stopped"
  | "FailedLimit"
  | "Disconnected"

export const SIGNAL_NAMES = {
  PRESSURES: [
    "c_press_ap_act",
    "c_press_vp_act",
    "c_press_fp_act",
    "c_press_tmp_act",
    "c_press_ep_act",
  ] as const,
  FLOWS: [
    "c_pump_bs_bl_flow_act",
    "c_pump_fs_mid_flow_act",
    "c_net_rem_flow_act",
  ] as const,
  INFO: [
    "g_patient_id_str",
    "g_patient_data_weight_set",
    "g_therapy_mode_set",
    "g_anticoag_mode_set",
    "g_trmt_main_state_set",
    "g_trmt_sub_state_set",
    "c_trmt_main_state",
    "c_trmt_sub_state",
    "d_serial_number_to_odi",
    "d_kit_type_str",
    "d_renal_dose_act",
    "c_acc_therapy_time_act",
    "c_acc_net_rem_vol_act",
    "g_substitution_mode_set",
  ] as const,
} as const

const ALL_PRESSURE: readonly string[] = SIGNAL_NAMES.PRESSURES
const ALL_FLOWS: readonly string[] = SIGNAL_NAMES.FLOWS

export function isPressureSignal(name: string): boolean {
  return ALL_PRESSURE.includes(name as never)
}

export function isFlowSignal(name: string): boolean {
  return ALL_FLOWS.includes(name as never)
}
