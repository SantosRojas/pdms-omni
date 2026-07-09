interface FlowIndicatorProps {
  value: number
  max: number
  unit: string
  label: string
  color?: string
  animated?: boolean
  decimals?: number
}

import { memo } from "react"

export const FlowIndicator = memo(function FlowIndicator({
  value,
  max,
  unit,
  label,
  color = "#a78bfa",
  animated = true,
  decimals = 0,
}: FlowIndicatorProps) {
  const clamped = Math.max(0, Math.min(max, value))
  const pct = max > 0 ? (clamped / max) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-scada-muted">{label}</span>
        <span className="font-mono text-sm font-semibold text-scada-text">
          {value.toFixed(decimals)} <span className="text-xs text-scada-muted">{unit}</span>
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-scada-border">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
        {animated && (
          <div
            className="absolute inset-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-flow"
            style={{ filter: "blur(4px)" }}
          />
        )}
      </div>
    </div>
  )
})
