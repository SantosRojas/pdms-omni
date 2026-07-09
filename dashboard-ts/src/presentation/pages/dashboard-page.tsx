import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card"
import { Button } from "@/presentation/components/ui/button"
import { SerialPanel } from "@/presentation/components/monitoring/serial-panel"
import { SearchField } from "@/presentation/components/shared/search-field"
import { ConfirmModal } from "@/presentation/components/shared/confirm-modal"
import { TherapyCard } from "@/presentation/components/therapies/therapy-card"
import { Loader2, ListChecks } from "lucide-react"
import { useTherapies } from "@/application/hooks/use-therapies"
import { useSerialStore } from "@/application/stores/serial-store"

export function DashboardPage() {
  const navigate = useNavigate()
  const { therapies, total, loading, search, setSearch, dateFrom, dateTo, setDateFrom, setDateTo, clearFilters, loadMore, reload, closeTherapy } = useTherapies(15)
  const [closingId, setClosingId] = useState<number | null>(null)
  const [closingLoading, setClosingLoading] = useState(false)

  const initialRef = useRef(true)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const unsub = useSerialStore.subscribe((state, prev) => {
      if (initialRef.current) {
        initialRef.current = false
        return
      }
      if (prev.status !== "Running" && state.status === "Running") {
        navigate("/live")
      }
      if (prev.status === "Running" && state.status !== "Running") {
        clearTimeout(reloadTimerRef.current)
        reloadTimerRef.current = setTimeout(() => reload(), 2000)
      }
    })
    return () => {
      unsub()
      clearTimeout(reloadTimerRef.current)
    }
  }, [navigate, reload])

  const savedSerial = localStorage.getItem("machine_serial")
  const openTherapies = therapies.filter(t => !t.ended_at && t.status !== "completed")
  const hasOpenTherapies = savedSerial
    ? openTherapies.some(t => t.serial_number === savedSerial)
    : false

  async function handleCloseTherapy() {
    if (closingId === null) return
    setClosingLoading(true)
    try {
      await closeTherapy(closingId)
    } catch { /* ignore */ }
    setClosingLoading(false)
    setClosingId(null)
    const serialStatus = useSerialStore.getState().status
    if (serialStatus === "Running") {
      navigate("/live")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inicio</h1>
        <p className="text-sm text-muted-foreground">Monitoreo y control del sistema OMNI-ODI</p>
      </div>

      <SerialPanel hasOpenTherapies={hasOpenTherapies} />

      {/* Quick access */}
      {/* <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="glass" className="glass-hover cursor-pointer" onClick={() => {
          const active = therapies.find(t => !t.ended_at && t.status !== "completed")
          navigate(active ? `/therapy/${active.id}` : "/")
        }}>
          <CardHeader>
            <Activity className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>Monitoreo en Vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              SCADA/HMI del circuito de diálisis con presiones, caudales y tendencias
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="glass-hover cursor-pointer" onClick={() => navigate("/settings")}>
          <CardHeader>
            <Settings className="mb-2 h-8 w-8 text-muted-foreground" />
            <CardTitle>Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Personalice tema, densidad y rangos de indicadores
            </p>
            <Button variant="link" className="mt-2 px-0" onClick={() => navigate("/settings")}>
              Ajustes <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div> */}

      {/* Therapy list */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-lg">Terapias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar por paciente o máquina..."
              className="flex-1 min-w-[200px]"
            />
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="outline" size="sm" className="mt-auto h-9 px-2.5 text-xs" onClick={() => { setDateFrom(""); setDateTo("") }}>
                  ✕ Limpiar
                </Button>
              )}
            </div>
          </div>

          {loading && therapies.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
            </div>
          ) : therapies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="rounded-full bg-muted/50 p-4">
                <ListChecks className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Sin terapias encontradas</p>
              {(search || dateFrom || dateTo) && (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {therapies.map((t, i) => (
                  <div key={t.id} style={{ animationDelay: `${(i % 15) * 30}ms` }} className="animate-[slide-up_0.25s_ease-out_both]">
                    <TherapyCard therapy={t} onClose={setClosingId} />
                  </div>
                ))}
              </div>

              {therapies.length < total && (
                <div className="flex flex-col items-center gap-2 pt-2 pb-1">
                  <div className="h-1 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(therapies.length / total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {therapies.length} de {total} terapias
                  </span>
                  <Button variant="outline" onClick={loadMore} loading={loading} disabled={loading}>
                    Cargar más
                  </Button>
                </div>
              )}

              {!loading && therapies.length >= total && therapies.length > 0 && (
                <p className="text-center text-xs text-muted-foreground pt-1">
                  Mostrando todas las {total} terapias
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={closingId !== null}
        onClose={() => setClosingId(null)}
        onConfirm={handleCloseTherapy}
        title="Cerrar Terapia"
        description={closingId ? `¿Cerrar terapia #${closingId}? La terapia se marcará como finalizada.` : ""}
        confirmLabel="Cerrar"
        confirmVariant="destructive"
        loading={closingLoading}
      />
    </div>
  )
}
