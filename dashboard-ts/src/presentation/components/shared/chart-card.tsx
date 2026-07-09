import { type ReactNode } from "react"
import { Card } from "@/presentation/components/ui/card"
import { TrendChart } from "@/presentation/components/scada/trend-chart"
import type { VariantProps } from "class-variance-authority"
import type { cardVariants } from "@/presentation/components/ui/card-variants"
import type { TelemetryHistoryPoint } from "@/domain/entities/telemetry-reading"

interface SeriesConfig {
  key: string
  name: string
  color: string
}

interface ChartCardProps {
  title: string
  data: TelemetryHistoryPoint[]
  series: SeriesConfig[]
  height?: number
  variant?: VariantProps<typeof cardVariants>["variant"]
  children?: ReactNode
}

export function ChartCard({
  title,
  data,
  series,
  height = 120,
  variant = "glass",
  children,
}: ChartCardProps) {
  return (
    <Card variant={variant} dense className="p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-scada-muted">
        {title}
      </h3>
      <TrendChart data={data} series={series} height={height} />
      {children}
    </Card>
  )
}
