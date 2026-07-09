import { Card } from "@/presentation/components/ui/card"

interface AccumulatedInfoProps {
  therapyTime?: string
  netRemovalVol?: string
}

export function AccumulatedInfo({ therapyTime, netRemovalVol }: AccumulatedInfoProps) {
  return (
    <Card variant="glass" dense>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-scada-muted">
        Acumulado
      </h3>
      <div className="space-y-3">
        <div>
          <span className="text-xs text-scada-muted">Tiempo de Terapia</span>
          <p className="font-mono text-lg font-bold text-scada-text">
            {therapyTime || "--:--:--"}
          </p>
        </div>
        <div>
          <span className="text-xs text-scada-muted">Vol. Remoción Neta</span>
          <p className="font-mono text-lg font-bold text-scada-text">
            {netRemovalVol || "--- ml"}
          </p>
        </div>
      </div>
    </Card>
  )
}
