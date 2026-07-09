import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/application/stores/auth-store"
import { Button } from "@/presentation/components/ui/button"
import { Input } from "@/presentation/components/ui/input"
import { Label } from "@/presentation/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/presentation/components/ui/card"
import { Activity, Eye, EyeOff } from "lucide-react"

export function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!username.trim() || !password.trim()) {
      setError("Usuario y contraseña requeridos")
      return
    }

    try {
      await login({ username: username.trim(), password })
      navigate("/", { replace: true })
    } catch {
      setError("Credenciales inválidas")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <Card variant="glass" className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">PDMS-Omni</CardTitle>
            <CardDescription>Ingrese sus credenciales</CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </div>
  )
}
