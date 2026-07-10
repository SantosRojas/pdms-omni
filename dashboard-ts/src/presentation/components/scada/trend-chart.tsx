import { useMemo } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"
import type { TelemetryHistoryPoint } from "@/domain/entities/telemetry-reading"
import { ChartTooltip } from "@/presentation/components/shared/chart-tooltip"

interface SeriesConfig {
  key: string
  name: string
  color: string
  unit?: string
}

interface TrendChartProps {
  data: TelemetryHistoryPoint[]
  series: SeriesConfig[]
  height?: number | string
  showGrid?: boolean
  displayNameMap?: Record<string, string>
}

export function TrendChart({ data, series, height = "170px", showGrid = false, displayNameMap }: TrendChartProps) {
  const formattedData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      _time: point.timestamp ? point.timestamp.split(" ")[1]?.substring(0, 8) || point.timestamp : "",
    }))
  }, [data])

  return (
    <div style={{ width: "100%", height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-scada-border)" opacity={0.3} />
          )}
          <XAxis
            dataKey="_time"
            tick={{ fontSize: 9, fill: "var(--color-scada-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--color-scada-muted)" }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                {...props}
                unitMap={Object.fromEntries(series.map((s) => [s.key, s.unit]))}
                contentStyle={{
                  background: "var(--color-scada-card)",
                  border: "1px solid var(--color-scada-border)",
                  fontSize: "12px",
                  color: "var(--color-scada-text)",
                }}
              />
            )}
          />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              name={displayNameMap?.[s.key] ?? s.name}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: s.color }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
