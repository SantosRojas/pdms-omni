import { type ReactNode } from "react"
import { Card } from "@/presentation/components/ui/card"
import { FlowIndicator } from "@/presentation/components/scada/flow-indicator"
import type { VariantProps } from "class-variance-authority"
import type { cardVariants } from "@/presentation/components/ui/card-variants"

interface FlowItem {
  key: string
  label: string
  color: string
  max: number
}

interface FlowPanelProps {
  title: string
  flows: FlowItem[]
  getValue: (key: string) => number
  getUnit: (key: string) => string
  variant?: VariantProps<typeof cardVariants>["variant"]
  children?: ReactNode
}

export function FlowPanel({
  title,
  flows,
  getValue,
  getUnit,
  variant = "glass",
  children,
}: FlowPanelProps) {
  return (
    <Card variant={variant} dense className="p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-scada-muted">
        {title}
      </h3>
      <div className="flex flex-col gap-3">
        {flows.map((g) => (
          <FlowIndicator
            key={g.key}
            value={getValue(g.key)}
            max={g.max}
            unit={getUnit(g.key) || (g.key === "c_net_rem_flow_act" ? "ml/h" : "ml/min")}
            label={g.label}
            color={g.color}
          />
        ))}
      </div>
      {children}
    </Card>
  )
}
