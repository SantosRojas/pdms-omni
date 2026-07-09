import { memo, type ReactNode } from "react"
import { Card } from "@/presentation/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  icon?: ReactNode
  label: string
  value: string | number
  unit?: string
  color?: string
  className?: string
}

const StatCard = memo(function StatCard({ icon, label, value, unit, color, className }: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <div className="flex items-start justify-between p-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
        </div>
        {icon && (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: color ? `${color}20` : undefined }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
})

export { StatCard }
