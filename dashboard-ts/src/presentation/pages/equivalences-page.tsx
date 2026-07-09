import { useState, useEffect } from "react"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { useAuth } from "@/application/hooks/use-auth"
import { Button } from "@/presentation/components/ui/button"
import { Input } from "@/presentation/components/ui/input"
import { Label } from "@/presentation/components/ui/label"
import { DataTable, type Column } from "@/presentation/components/shared/data-table"
import { ConfirmModal } from "@/presentation/components/shared/confirm-modal"
import { GitCompareArrows, Plus, Pencil, Trash2 } from "lucide-react"
import { equivalenceApi } from "@/infrastructure/api/equivalence-api"
import type { Equivalence, CreateEquivalenceRequest } from "@/domain/entities/equivalence"

export function EquivalencesPage() {
  const { canEdit, canAdmin } = useAuth()
  const [items, setItems] = useState<Equivalence[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Equivalence | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [modal, setModal] = useState<"create" | "edit" | "delete" | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ internal_name: "", numeric_value: "", display_name: "" })

  useEffect(() => {
    (async () => {
      try {
        setItems(await equivalenceApi.list())
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setItems(await equivalenceApi.list())
    } catch { /* ignore */ }
    setLoading(false)
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const req: CreateEquivalenceRequest = {
        internal_name: form.internal_name,
        numeric_value: Number.parseFloat(form.numeric_value),
        display_name: form.display_name,
      }
      await equivalenceApi.create(req)
      setModal(null)
      setForm({ internal_name: "", numeric_value: "", display_name: "" })
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  function openEdit(e: Equivalence) {
    setSelected(e)
    setForm({ internal_name: e.internal_name, numeric_value: String(e.numeric_value), display_name: e.display_name })
    setModal("edit")
  }

  async function handleUpdate() {
    if (!selected) return
    setSaving(true)
    try {
      await equivalenceApi.update({
        signal_id: selected.signal_id,
        numeric_value: selected.numeric_value,
        display_name: form.display_name,
      })
      setModal(null)
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected) return
    setSaving(true)
    try {
      await equivalenceApi.remove({
        signal_id: selected.signal_id,
        numeric_value: selected.numeric_value,
        deleted_by: "admin",
        deletion_reason: deleteReason || "Eliminado desde dashboard",
      })
      setModal(null)
      setDeleteReason("")
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const columns: Column<Equivalence>[] = [
    { key: "internal_name", header: "Señal", sortable: true },
    {
      key: "numeric_value",
      header: "Valor Numérico",
      sortable: true,
      render: (e) => e.numeric_value,
    },
    { key: "display_name", header: "Nombre Display", sortable: true },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (e) => (
        <div className="flex gap-1">
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canAdmin && (
            <Button variant="ghost" size="icon" onClick={() => { setSelected(e); setModal("delete") }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Equivalencias"
        description="Mapeo de valores numéricos a nombres descriptivos"
        icon={<GitCompareArrows className="h-6 w-6" />}
        action={
          canEdit && (
            <Button onClick={() => setModal("create")}>
              <Plus className="h-4 w-4" /> Nueva
            </Button>
          )
        }
      />

      <DataTable columns={columns} data={items} keyExtractor={(e) => `${e.signal_id}-${e.numeric_value}`} loading={loading} filterableColumns={["internal_name", "display_name"]} />

      <ConfirmModal
        open={modal === "create"}
        onClose={() => setModal(null)}
        onConfirm={handleCreate}
        title="Nueva Equivalencia"
        confirmLabel="Crear"
        loading={saving}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre Interno (internal_name)</Label>
            <Input value={form.internal_name} onChange={(e) => setForm({ ...form, internal_name: e.target.value })} placeholder="c_trmt_main_state" />
          </div>
          <div className="space-y-1.5">
            <Label>Valor Numérico</Label>
            <Input type="number" value={form.numeric_value} onChange={(e) => setForm({ ...form, numeric_value: e.target.value })} placeholder="2" />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre Display</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Terapia" />
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={modal === "edit"}
        onClose={() => setModal(null)}
        onConfirm={handleUpdate}
        title="Editar Equivalencia"
        confirmLabel="Guardar"
        loading={saving}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre Interno</Label>
            <Input value={form.internal_name} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Valor Numérico</Label>
            <Input value={form.numeric_value} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre Display</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Terapia" />
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        onConfirm={handleDelete}
        title="Eliminar Equivalencia"
        description={`¿Eliminar "${selected?.display_name}" (${selected?.internal_name} = ${selected?.numeric_value})?`}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        loading={saving}
      >
        <div className="space-y-1.5">
          <Label>Motivo (opcional)</Label>
          <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Razón de eliminación..." />
        </div>
      </ConfirmModal>
    </div>
  )
}
