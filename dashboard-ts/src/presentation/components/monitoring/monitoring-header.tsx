import { useNavigate } from "react-router-dom"
import { Button } from "@/presentation/components/ui/button"
import { Badge } from "@/presentation/components/ui/badge"
import { Card, CardContent } from "@/presentation/components/ui/card"
import { ArrowLeft, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface MonitoringHeaderProps {
  title?: string
  subtitle?: string
  connected: boolean
  therapyActive: boolean
  therapyStateName?: string
  backTo?: string
}

export function MonitoringHeader({
  title,
  subtitle,
  connected,
  therapyActive,
  therapyStateName,
  backTo,
}: MonitoringHeaderProps) {
  const navigate = useNavigate()

  return (
    <Card variant="glass" className="mb-4">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
        <div className="flex items-center gap-3">
          {backTo && (
            <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold">{title || "Monitoreo en Vivo"}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {therapyActive && therapyStateName && (
            <Badge variant="success">{therapyStateName}</Badge>
          )}

          <div className="flex items-center gap-2 text-sm">
            <div className={cn(
              "h-2 w-2 rounded-full",
              connected ? "bg-green-500" : "bg-gray-400",
            )} />
            <span className={cn(
              "text-xs",
              connected ? "text-green-500" : "text-muted-foreground",
            )}>
              {connected ? (
                <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> Conectado</span>
              ) : (
                <span className="flex items-center gap-1"><WifiOff className="h-3 w-3" /> Desconectado</span>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
