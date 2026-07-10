import type { CSSProperties, ReactNode } from "react"

interface TooltipPayloadItem {
    dataKey?: unknown
    name?: unknown
    value?: ReactNode
    color?: string
}

interface ChartTooltipProps {
    active?: boolean
    label?: ReactNode
    payload?: readonly TooltipPayloadItem[]
    unitMap?: Record<string, string | undefined>
    contentStyle?: CSSProperties
    labelClassName?: string
}

export function ChartTooltip({ active, label, payload, unitMap, contentStyle, labelClassName }: ChartTooltipProps) {
    if (!active || !payload?.length) return null

    return (
        <div
            style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.75rem",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
                ...contentStyle,
            }}
        >
            {label !== undefined && (
                <div className={labelClassName} style={{ marginBottom: "0.35rem" }}>
                    {label}
                </div>
            )}
            <div style={{ display: "grid", gap: "0.25rem" }}>
                {payload.map((item, index) => {
                    const key = String(item.dataKey ?? item.name ?? index)
                    const unit = unitMap?.[key]
                    const value = item.value ?? "—"
                    const name = String(item.name ?? key)

                    return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: item.color ?? "inherit" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: item.color ?? "currentColor", flexShrink: 0 }} />
                            <span>{`${name}: ${String(value)}${unit ? ` ${unit}` : ""}`}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}