import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  backTo?: string
  className?: string
}

export function PageHeader({ title, description, icon, action, backTo, className }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className={cn("mb-6 flex items-start justify-between", className)}>
      <div className="flex items-center gap-3">
        {backTo && (
          <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {icon && <div className="text-primary">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
