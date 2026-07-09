import { PageHeader } from "@/presentation/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card"
import { User } from "lucide-react"
import { useAuthStore } from "@/application/stores/auth-store"

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div>
      <PageHeader
        title="Perfil"
        description="Información de usuario"
        icon={<User className="h-6 w-6" />}
      />
      <Card variant="glass" className="max-w-md">
        <CardHeader>
          <CardTitle>{user?.full_name || "Usuario"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usuario</span>
            <span>{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rol</span>
            <span className="capitalize">{user?.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
