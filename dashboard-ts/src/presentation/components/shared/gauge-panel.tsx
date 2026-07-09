import { type ReactNode } from "react"
import { Card } from "@/presentation/components/ui/card"
import { RadialGauge } from "@/presentation/components/scada/radial-gauge"
import type { VariantProps } from "class-variance-authority"
import type { cardVariants } from "@/presentation/components/ui/card-variants"

interface GaugeItem {
  key: string
  label: string
  color: string
  config: { min: number; max: number }
}

interface GaugePanelProps {
  title: string
  gauges: GaugeItem[]
  getValue: (key: string) => number
  unit?: string
  variant?: VariantProps<typeof cardVariants>["variant"]
  columns?: number
  children?: ReactNode
}

export function GaugePanel({
  title,
  gauges,
  getValue,
  unit = "",
  variant = "glass",
  columns = 4,
  children,
}: GaugePanelProps) {
  return (
    <Card variant={variant} dense className="p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-scada-muted">
        {title}
      </h3>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(columns, gauges.length)}, 1fr)`,
        }}
      >
        {gauges.map((g) => (
          <RadialGauge
            key={g.key}
            value={getValue(g.key)}
            min={g.config.min}
            max={g.config.max}
            unit={unit}
            label={g.label}
            color={g.color}
            size="sm"
            warning={Math.abs(g.config.max) * 0.7}
            critical={Math.abs(g.config.max) * 0.85}
          />
        ))}
      </div>
      {children}
    </Card>
  )
}
