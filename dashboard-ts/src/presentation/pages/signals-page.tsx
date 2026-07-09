import { useState, useEffect } from "react"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { useAuth } from "@/application/hooks/use-auth"
import { Button } from "@/presentation/components/ui/button"
import { Input } from "@/presentation/components/ui/input"
import { Label } from "@/presentation/components/ui/label"
import { DataTable, type Column } from "@/presentation/components/shared/data-table"
import { ConfirmModal } from "@/presentation/components/shared/confirm-modal"
import { Waves, Pencil } from "lucide-react"
import { signalApi } from "@/infrastructure/api/signal-api"
import type { Signal } from "@/domain/entities/signal"

export function SignalsPage() {
  const { canAdmin } = useAuth()
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Signal | null>(null)
  const [editForm, setEditForm] = useState({ display_name: "", unit: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        setSignals(await signalApi.list())
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  function openEdit(s: Signal) {
    setSelected(s)
    setEditForm({
      display_name: s.display_name ?? "",
      unit: s.unit ?? "",
    })
  }

  async function handleUpdate() {
    if (!selected) return
    setSaving(true)
    try {
      await signalApi.update(selected.id, {
        display_name: editForm.display_name || undefined,
        unit: editForm.unit || undefined,
      })
      setSignals((prev) =>
        prev.map((s) =>
          s.id === selected.id
            ? { ...s, display_name: editForm.display_name || null, unit: editForm.unit || null }
            : s,
        ),
      )
      setSelected(null)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const columns: Column<Signal>[] = [
    { key: "id", header: "ID", sortable: true, className: "w-16 text-muted-foreground" },
    { key: "internal_name", header: "Nombre Interno", sortable: true, className: "font-mono text-xs" },
    {
      key: "display_name",
      header: "Nombre Display",
      sortable: true,
      render: (s) => s.display_name || <span className="text-muted-foreground italic">—</span>,
    },
    {
      key: "unit",
      header: "Unidad",
      render: (s) => s.unit || <span className="text-muted-foreground italic">—</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (s) => (
        canAdmin && (
          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Señales"
        description="Configuración de nombres y unidades de señales"
        icon={<Waves className="h-6 w-6" />}
      />

      <DataTable columns={columns} data={signals} keyExtractor={(s) => s.id} loading={loading} filterableColumns={["internal_name", "display_name"]} />

      <ConfirmModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        onConfirm={handleUpdate}
        title="Editar Señal"
        confirmLabel="Guardar"
        loading={saving}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre Interno</Label>
            <Input value={selected?.internal_name ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre Display</Label>
            <Input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} placeholder="Nombre visible" />
          </div>
          <div className="space-y-1.5">
            <Label>Unidad</Label>
            <Input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} placeholder="mmHg, mL/h, ..." />
          </div>
        </div>
      </ConfirmModal>
    </div>
  )
}
