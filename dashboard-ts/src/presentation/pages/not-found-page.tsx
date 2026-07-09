import { useNavigate } from "react-router-dom"
import { Button } from "@/presentation/components/ui/button"
import { Activity, ArrowLeft } from "lucide-react"

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <div className="glass rounded-2xl px-10 py-12 text-center animate-slide-up max-w-sm w-full">
        <Activity className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="mt-4 text-5xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página no encontrada</p>
        <Button variant="glass" className="mt-6" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    </div>
  )
}
