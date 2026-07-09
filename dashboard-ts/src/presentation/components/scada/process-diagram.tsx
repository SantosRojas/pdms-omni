import type { TelemetryReading } from "@/domain/entities/telemetry-reading"
import { Card } from "@/presentation/components/ui/card"

interface ProcessDiagramProps {
  pressures: Record<string, TelemetryReading>
  flows: Record<string, TelemetryReading>
}

export function ProcessDiagram({ pressures, flows }: ProcessDiagramProps) {
  const ap = pressures["c_press_ap_act"]
  const vp = pressures["c_press_vp_act"]
  const fp = pressures["c_press_fp_act"]
  const tmp = pressures["c_press_tmp_act"]
  const bf = flows["c_pump_bs_bl_flow_act"]
  const df = flows["c_pump_fs_mid_flow_act"]
  const nr = flows["c_net_rem_flow_act"]

  const fmt = (r: TelemetryReading | undefined, unit?: string) =>
    r ? `${r.physical_value} ${r.unit || unit}` : "---"

  return (
    <Card variant="glass" dense className="relative overflow-hidden">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-scada-muted">
        Circuito de Diálisis
      </h3>

      <div className="flex items-center justify-center gap-8">
        {/* Patient */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-scada-border bg-scada-card">
            <svg viewBox="0 0 48 48" className="h-10 w-10 text-scada-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="24" cy="12" r="6" />
              <path d="M10 44c0-8 6-16 14-16s14 8 14 16" />
            </svg>
          </div>
          <span className="text-[10px] text-scada-muted">Paciente</span>
        </div>

        {/* Arterial Line */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-12 bg-gradient-to-r from-scada-press-ap/50 to-scada-press-ap" />
            <div className="h-2 w-2 rotate-45 border-b-2 border-r-2 border-scada-press-ap" />
          </div>
          <span className="font-mono text-xs text-scada-press-ap">{fmt(ap, "mmHg")}</span>
          <span className="text-[10px] text-scada-muted">Arterial</span>
        </div>

        {/* Dialyzer */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-scada-border bg-scada-card">
            <svg viewBox="0 0 40 60" className="h-14 w-10 text-scada-muted" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="5" y="2" width="30" height="56" rx="3" />
              <line x1="5" y1="12" x2="35" y2="12" strokeDasharray="2 2" />
              <line x1="5" y1="22" x2="35" y2="22" strokeDasharray="2 2" />
              <line x1="5" y1="32" x2="35" y2="32" strokeDasharray="2 2" />
              <line x1="5" y1="42" x2="35" y2="42" strokeDasharray="2 2" />
              <line x1="5" y1="52" x2="35" y2="52" strokeDasharray="2 2" />
            </svg>
          </div>
          <span className="text-[10px] text-scada-muted">Dializador</span>
          <div className="flex gap-3 text-[10px] text-scada-muted">
            <span>FP: <span className="text-scada-press-fp">{fmt(fp, "mmHg")}</span></span>
            <span>TMP: <span className="text-scada-press-tmp">{fmt(tmp, "mmHg")}</span></span>
          </div>
        </div>

        {/* Venous Line */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-12 bg-gradient-to-l from-scada-press-vp/50 to-scada-press-vp" />
            <div className="h-2 w-2 rotate-45 border-t-2 border-l-2 border-scada-press-vp" />
          </div>
          <span className="font-mono text-xs text-scada-press-vp">{fmt(vp, "mmHg")}</span>
          <span className="text-[10px] text-scada-muted">Venoso</span>
        </div>
      </div>

      {/* Flows */}
      <div className="mt-3 flex justify-between gap-4 border-t border-scada-border pt-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-scada-flow-bf" />
          <div className="flex-1">
            <div className="flex justify-start gap-1 text-[10px]">
              <span className="text-scada-muted">Flujo Sangre</span>
              <span className="font-mono text-scada-flow-bf">{fmt(bf, "ml/min")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-scada-flow-df" />
          <div className="flex-1">
            <div className="flex justify-start gap-1 text-[10px]">
              <span className="text-scada-muted">Flujo Diálisis</span>
              <span className="font-mono text-scada-flow-df">{fmt(df, "ml/min")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-scada-flow-nr" />
          <div className="flex-1">
            <div className="flex justify-start gap-1 text-[10px]">
              <span className="text-scada-muted">Remoción Neta</span>
              <span className="font-mono text-scada-flow-nr">{fmt(nr, "ml/min")}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
