import { cn } from "@/lib/utils"
import { Card } from "@/presentation/components/ui/card"

interface TherapyStateMachineProps {
  currentState: string
  therapyActive: boolean
}

const states = [
  { key: "preparation", label: "Preparación" },
  { key: "connect", label: "Conectar" },
  { key: "therapy", label: "Terapia" },
  { key: "end", label: "Finalizar" },
]

export function TherapyStateMachine({ currentState, therapyActive }: TherapyStateMachineProps) {
  const stateLower = currentState.toLowerCase()
  const activeIdx = stateLower.includes("terapia") ? 2
    : stateLower.includes("prepara") ? 0
    : stateLower.includes("conectar") ? 1
    : stateLower.includes("fin") || stateLower.includes("final") ? 3
    : -1

  return (
    <Card variant="glass" dense>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-scada-muted">
        Estado de Terapia
      </h3>

      <div className="relative">
        <div className="absolute left-3 top-0 h-full w-0.5 bg-scada-border" />

        <div className="space-y-4">
          {states.map((s, i) => {
            const isActive = i === activeIdx
            const isPast = i < activeIdx

            return (
              <div key={s.key} className="relative flex items-center gap-3 pl-8">
                <div
                  className={cn(
                    "absolute left-[9px] h-3 w-3 -translate-x-1/2 rounded-full border-2",
                    isActive
                      ? "border-scada-accent bg-scada-accent shadow-[0_0_8px] shadow-scada-accent"
                      : isPast
                      ? "border-scada-success bg-scada-success"
                      : "border-scada-border bg-scada-surface",
                  )}
                />
                <span
                  className={cn(
                    "text-sm",
                    isActive ? "font-semibold text-scada-accent" : isPast ? "text-scada-success" : "text-scada-muted",
                  )}
                >
                  {s.label}
                  {isActive && therapyActive && <span className="ml-2 text-[10px] text-scada-accent">◉ EN CURSO</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
