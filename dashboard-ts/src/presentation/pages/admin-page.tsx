import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { useAuth } from "@/application/hooks/use-auth"
import { Button } from "@/presentation/components/ui/button"
import { Input } from "@/presentation/components/ui/input"
import { Label } from "@/presentation/components/ui/label"
import { Select, SelectItem } from "@/presentation/components/ui/select"
import { DataTable, type Column } from "@/presentation/components/shared/data-table"
import { ConfirmModal } from "@/presentation/components/shared/confirm-modal"
import { Badge } from "@/presentation/components/ui/badge"
import { Users, Plus, Pencil, Trash2 } from "lucide-react"
import { userApi } from "@/infrastructure/api/user-api"
import type { User, CreateUserRequest, UpdateUserRequest } from "@/domain/entities/user"

export function AdminPage() {
  const { canAdmin, initialized } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (initialized && !canAdmin) {
      navigate("/", { replace: true })
    }
  }, [initialized, canAdmin, navigate])

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<"create" | "edit" | "delete" | null>(null)
  const [selected, setSelected] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ username: "", password: "", full_name: "", email: "", role: "viewer" })

  useEffect(() => {
    (async () => {
      try {
        setUsers(await userApi.list())
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setUsers(await userApi.list())
    } catch { /* ignore */ }
    setLoading(false)
  }

  function openEdit(u: User) {
    setSelected(u)
    setForm({ username: u.username, password: "", full_name: u.full_name, email: u.email, role: u.role })
    setModal("edit")
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (modal === "create") {
        const req: CreateUserRequest = {
          username: form.username,
          password: form.password,
          full_name: form.full_name || undefined,
          email: form.email || undefined,
          role: form.role,
        }
        await userApi.create(req)
      } else if (modal === "edit" && selected) {
        const req: UpdateUserRequest = {}
        if (form.password) req.password = form.password
        if (form.full_name !== selected.full_name) req.full_name = form.full_name
        if (form.email !== selected.email) req.email = form.email
        if (form.role !== selected.role) req.role = form.role
        await userApi.update(selected.id, req)
      }
      setModal(null)
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected) return
    setSaving(true)
    try {
      await userApi.remove(selected.id)
      setModal(null)
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const columns: Column<User>[] = [
    { key: "username", header: "Usuario", sortable: true },
    {
      key: "full_name",
      header: "Nombre",
      sortable: true,
      render: (u) => u.full_name || "—",
    },
    { key: "email", header: "Email", sortable: true, render: (u) => u.email || "—" },
    {
      key: "role",
      header: "Rol",
      sortable: true,
      render: (u) => <span className="capitalize">{u.role}</span>,
    },
    {
      key: "active",
      header: "Estado",
      render: (u) => (
        <Badge variant={u.active ? "success" : "secondary"}>
          {u.active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (u) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSelected(u); setModal("delete") }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Administración de usuarios del sistema"
        icon={<Users className="h-6 w-6" />}
        action={
          <Button onClick={() => { setForm({ username: "", password: "", full_name: "", email: "", role: "viewer" }); setModal("create") }}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      <DataTable columns={columns} data={users} keyExtractor={(u) => u.id} loading={loading} pageSize={15} filterableColumns={["username", "full_name", "email"]} />

      <ConfirmModal
        open={modal === "create" || modal === "edit"}
        onClose={() => setModal(null)}
        onConfirm={handleSave}
        title={modal === "create" ? "Crear Usuario" : "Editar Usuario"}
        confirmLabel="Guardar"
        loading={saving}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Usuario</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={modal === "edit"} />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña {modal === "edit" && "(dejar vacío para no cambiar)"}</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre Completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="operator">Operator</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </Select>
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        onConfirm={handleDelete}
        title="Eliminar Usuario"
        description={`¿Eliminar a ${selected?.username}?`}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        loading={saving}
      />
    </div>
  )
}
