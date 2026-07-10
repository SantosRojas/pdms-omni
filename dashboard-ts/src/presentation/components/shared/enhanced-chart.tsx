import { useState, useEffect, useRef } from "react"
import { RefreshCw, Maximize, Minimize, BarChart3, ZoomOut } from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { EmptyState } from "@/presentation/components/shared/feedback-state"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from "recharts"
import type { SeriesConfig } from "@/application/utils/signal-configs"
import { ChartTooltip } from "@/presentation/components/shared/chart-tooltip"

interface EnhancedChartProps {
  title: string
  data: Record<string, unknown>[]
  series: SeriesConfig[]
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  onRefresh?: () => void
  xAxisKey?: string
  displayNameMap?: Record<string, string>
}

const brushRange = (len: number) => ({ start: 0, end: Math.max(0, len - 1) })

export function EnhancedChart({
  title,
  data,
  series,
  loading = false,
  error = null,
  emptyMessage = "Sin datos disponibles",
  onRefresh,
  xAxisKey = "_time",
  displayNameMap,
}: EnhancedChartProps) {
  const [brushIdx, setBrushIdx] = useState(() => brushRange(data.length))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrushIdx(brushRange(data.length))
  }, [data.length])

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number } | undefined) => {
    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
      setBrushIdx({ start: range.startIndex, end: range.endIndex })
    }
  }

  const resetZoom = () => {
    setBrushIdx(brushRange(data.length))
  }

  const toggleFullscreen = async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch { /* ignore */ }
  }

  const hasData = data.length >= 1 && series.length > 0
  const isZoomed = hasData && brushIdx.end - brushIdx.start < data.length - 1

  return (
    <div
      ref={containerRef}
      className="flex flex-col rounded-xl border border-white/10 bg-[var(--color-surface)] p-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" />
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {isZoomed && (
            <Button variant="ghost" size="sm" onClick={resetZoom}>
              <ZoomOut className="mr-1 h-3.5 w-3.5" />
              Reset Zoom
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}
              className={loading ? "pointer-events-none opacity-60" : ""}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !hasData && (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <RefreshCw className="mb-3 h-6 w-6 animate-spin" />
          Cargando datos...
        </div>
      )}

      {!loading && !hasData && !error && (
        <EmptyState icon={<BarChart3 />} message={emptyMessage} />
      )}

      {hasData && (
        <div style={{ width: "100%", height: isFullscreen ? "100%" : "280px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    unitMap={Object.fromEntries(series.map((s) => [s.key, s.unit]))}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "var(--color-surface)",
                    }}
                    labelClassName="font-bold"
                  />
                )}
              />
              <Legend />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} name={displayNameMap?.[s.key] ?? s.name} dot={false} strokeWidth={2} />
              ))}
              <Brush
                dataKey={xAxisKey}
                height={30}
                stroke="var(--color-primary)"
                fill="var(--color-muted)"
                travellerWidth={12}
                startIndex={brushIdx.start}
                endIndex={brushIdx.end}
                onChange={handleBrushChange}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
