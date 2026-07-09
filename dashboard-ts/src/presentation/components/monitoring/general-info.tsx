import { StatCard } from "./stat-card"
import { Activity, Droplets, HeartPulse, Clock, Weight, Zap } from "lucide-react"
import type { TelemetryReading } from "@/domain/entities/telemetry-reading"

interface GeneralInfoProps {
  info: Record<string, TelemetryReading>
  therapyActive: boolean
}

export function GeneralInfo({ info, therapyActive }: GeneralInfoProps) {
  const reading = (key: string) => info[key]

  const r = (key: string) => {
    const v = reading(key)
    if (!v) return null
    return {
      value: v.display_value ?? String(v.physical_value),
      unit: v.unit,
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={<Activity className="h-5 w-5 text-rose-500" />}
        label="Paciente"
        value={r("g_patient_id_str")?.value || "---"}
        color="#f43f5e"
      />
      <StatCard
        icon={<Weight className="h-5 w-5 text-blue-500" />}
        label="Peso"
        value={r("g_patient_data_weight_set")?.value || "---"}
        unit={r("g_patient_data_weight_set")?.unit}
        color="#3b82f6"
      />
      <StatCard
        icon={<HeartPulse className="h-5 w-5 text-purple-500" />}
        label="Modo Terapia"
        value={r("g_therapy_mode_set")?.value || "---"}
        color="#8b5cf6"
      />
      <StatCard
        icon={<Droplets className="h-5 w-5 text-cyan-500" />}
        label="Anticoagulante"
        value={r("g_anticoag_mode_set")?.value || "---"}
        color="#06b6d4"
      />
      {therapyActive && (
        <>
          <StatCard
            icon={<Zap className="h-5 w-5 text-amber-500" />}
            label="Dosis Renal"
            value={r("d_renal_dose_act")?.value || "---"}
            unit={r("d_renal_dose_act")?.unit}
            color="#f59e0b"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-emerald-500" />}
            label="Tiempo Terapia"
            value={reading("c_acc_therapy_time_act")?.display_value || reading("c_acc_therapy_time_act")?.physical_value?.toString() + " min" || "---"}
            color="#22c55e"
          />
        </>
      )}
    </div>
  )
}
