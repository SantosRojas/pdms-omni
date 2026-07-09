import { useNavigate } from "react-router-dom"
import { useAuth } from "@/application/hooks/use-auth"
import { Button } from "@/presentation/components/ui/button"
import { Badge } from "@/presentation/components/ui/badge"
import { Clock, User, Activity, Timer, MonitorOff } from "lucide-react"
import type { Therapy } from "@/domain/entities/therapy"

interface TherapyCardProps {
  therapy: Therapy
  onClose?: (id: number) => void
}

const statusConfig: Record<string, { badge: "success" | "warning" | "secondary" | "closed"; dot: string; label: string }> = {
  active: { badge: "success", dot: "bg-emerald-500", label: "Activo" },
  open: { badge: "warning", dot: "bg-amber-500", label: "Abierta" },
  completed: { badge: "secondary", dot: "bg-primary", label: "Completada" },
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} día${days > 1 ? "s" : ""}`
  return new Date(dateStr).toLocaleDateString("es-ES")
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "En curso"
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins} min`
}

export function TherapyCard({ therapy, onClose }: TherapyCardProps) {
  const navigate = useNavigate()
  const { canEdit } = useAuth()
  const isOpen = !therapy.ended_at && therapy.status !== "completed"
  const savedSerial = typeof window !== "undefined" ? localStorage.getItem("machine_serial") : null
  const isFromCurrentMachine = savedSerial ? therapy.serial_number === savedSerial : false
  const config = statusConfig[therapy.status] || { badge: "secondary", dot: "bg-gray-500", label: therapy.status }

  return (
    <div
      className="group relative flex cursor-pointer items-center gap-3 rounded-xl glass p-4 glass-hover hover:border-(--color-primary) transition-all duration-200"
      onClick={() => navigate(isOpen && isFromCurrentMachine ? `/therapy/${therapy.id}` : `/history/${therapy.id}`)}
    >
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${config.dot} ${isOpen ? "animate-pulse" : ""}`} />
          <span className="text-sm font-semibold truncate">
            {therapy.serial_number || `Terapia #${therapy.id}`}
          </span>
          <Badge variant={config.badge}>{config.label}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {therapy.patient_id_str || `Paciente #${therapy.patient_id}`}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {relativeTime(therapy.started_at)}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {formatDuration(therapy.started_at, therapy.ended_at)}
          </span>
        </div>
      </div>

      {/* <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {isOpen && onClose && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onClose(therapy.id)}
          >
            <Square className="mr-1 h-3 w-3" />
            Cerrar
          </Button>
        )}
        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
          {isOpen ? (
            <ArrowRight className="h-4 w-4" />
          ) : (
            <Activity className="h-4 w-4 text-primary" />
          )}
        </Button>
      </div> */}

      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {isOpen && isFromCurrentMachine && canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            onClick={() => onClose?.(therapy.id)}
            title="Cerrar terapia"
          >
            <MonitorOff className="mr-1 h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Activity className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>
    </div>
  )
}
