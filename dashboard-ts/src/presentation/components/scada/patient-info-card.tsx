import type { TelemetryReading } from "@/domain/entities/telemetry-reading"
import { Card } from "@/presentation/components/ui/card"
import { Play } from "lucide-react"

interface PatientInfoCardProps {
  info: Record<string, TelemetryReading>
  therapyStart?: string | null
  therapyTime?: string
  netRemovalVol?: string
}

export function PatientInfoCard({ info, therapyStart, therapyTime, netRemovalVol }: PatientInfoCardProps) {
  const fields = [
    { key: "g_patient_id_str", label: "Paciente", format: (v: string) => v },
    { key: "g_patient_data_weight_set", label: "Peso", unit: "kg" },
    { key: "g_therapy_mode_set", label: "Modo Terapia", format: (v: string) => v },
    { key: "g_anticoag_mode_set", label: "Anticoagulante", format: (v: string) => v },
    { key: "g_substitution_mode_set", label: "Sustitución", format: (v: string) => v },
    { key: "d_renal_dose_act", label: "Dosis Renal", unit: "ml/kg/h" },
    { key: "d_kit_type_str", label: "Kit", format: (v: string) => v },
  ]

  return (
    <Card variant="glass" dense>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-scada-muted">
        Información
      </h3>
      <div className="space-y-2">
        {fields.map(({ key, label, unit, format }) => {
          const reading = info[key]
          if (!reading) return null
          const value = format
            ? format(reading.display_value || String(reading.physical_value))
            : `${reading.physical_value}${unit ? ` ${unit}` : ""}`
          return (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-scada-muted">{label}</span>
              <span className="font-mono text-scada-text">{value}</span>
            </div>
          )
        })}
        <div className="flex justify-between text-xs">
          <span className="text-scada-muted">Tiempo Terapia</span>
          <span className="font-mono text-scada-text">{therapyTime || "--:--:--"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-scada-muted">Vol. Remoción Neta</span>
          <span className="font-mono text-scada-text">{netRemovalVol || "--- ml"}</span>
        </div>
        {therapyStart && (
          <div className="flex justify-between text-xs border-t border-scada-border pt-2 mt-2">
            <span className="flex items-center gap-1 text-scada-muted">
              <Play className="h-3 w-3 text-primary" />
              Inicio Terapia
            </span>
            <span className="font-mono text-scada-text">{therapyStart}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
