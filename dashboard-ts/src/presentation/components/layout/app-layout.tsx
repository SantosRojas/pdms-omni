import { useEffect, type ReactNode } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Sidebar } from "./sidebar"
import { useAuthStore } from "@/application/stores/auth-store"

interface AppLayoutProps {
  children?: ReactNode
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center gradient-bg">
      <div className="flex flex-col items-center gap-4 glass rounded-2xl px-8 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Conectando...</p>
      </div>
    </div>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const { initialized, loading, user } = useAuthStore()
  const isAuthenticated = !!user

  useEffect(() => {
    function handleExpired() {
      useAuthStore.setState({ user: null, token: null })
    }
    window.addEventListener("auth:expired", handleExpired)
    return () => window.removeEventListener("auth:expired", handleExpired)
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (!loading && !isAuthenticated) {
      navigate("/login", { replace: true })
    }
  }, [initialized, loading, isAuthenticated, navigate])

  if (!initialized || loading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6 page-enter">
        {children || <Outlet />}
      </main>
    </div>
  )
}
