import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Settings,
  Users,
  GitCompareArrows,
  Activity,
  LogOut,
  Menu,
  X,
  User,
  Waves,
  Sun,
  Moon,
  Monitor as MonitorIcon,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { useAuthStore } from "@/application/stores/auth-store"
import { useThemeStore } from "@/application/stores/theme-store"
import type { ThemeMode } from "@/domain/value-objects/theme"
import { cn } from "@/lib/utils"

const THEME_CYCLE: ThemeMode[] = ["system", "light", "dark"]

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Inicio" },
  { to: "/profile", icon: User, label: "Perfil" },
  { to: "/settings", icon: Settings, label: "Ajustes" },
]

const adminNavItems = [
  { to: "/admin", icon: Users, label: "Usuarios" },
  { to: "/equivalences", icon: GitCompareArrows, label: "Equivalencias" },
  { to: "/signals", icon: Waves, label: "Señales" },
]

function nextTheme(current: ThemeMode): ThemeMode {
  const idx = THEME_CYCLE.indexOf(current)
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
}

const themeIcon: Record<ThemeMode, typeof Sun> = {
  system: MonitorIcon,
  light: Sun,
  dark: Moon,
}

const themeLabel: Record<ThemeMode, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
}

export function Sidebar() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("omni-sidebar-collapsed") === "true")
  const { user, logout } = useAuthStore()
  const { mode, setMode } = useThemeStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === "admin"

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("omni-sidebar-collapsed", String(next))
      return next
    })
  }

  function cycleTheme() {
    setMode(nextTheme(mode))
  }

  async function handleLogout() {
    await logout()
    navigate("/login")
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none",
      collapsed ? "justify-center px-0" : "gap-3",
      isActive
        ? "glass text-primary font-medium shadow-sm"
        : "text-muted-foreground hover:glass-hover hover:text-accent-foreground",
    )

  const sidebarContent = (
    <div className="flex h-full flex-col gap-4">
      <div className={cn("flex items-center px-4 py-4", collapsed ? "justify-center px-0" : "gap-2")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Activity className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && <span className="font-semibold tracking-tight">PDMS-Omni</span>}
      </div>

      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass} onClick={() => setOpen(false)} title={collapsed ? item.label : undefined}>
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-glass-border" />
            {!collapsed && <p className="px-3 text-xs font-medium text-muted-foreground">Administración</p>}
            {adminNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setOpen(false)} title={collapsed ? item.label : undefined}>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-glass-border p-3">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-3")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary ring-2 ring-primary/20">
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{user?.full_name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="mb-2 mt-3 flex rounded-lg border border-glass-border bg-glass-bg p-0.5">
            {(["light", "dark", "system"] as ThemeMode[]).map((t) => {
              const Icon = themeIcon[t]
              const isActive = mode === t
              return (
                <button
                  key={t}
                  onClick={() => setMode(t)}
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-md px-2 py-1.5 text-xs transition-all",
                    isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  title={t === "light" ? "Claro" : t === "dark" ? "Oscuro" : "Sistema"}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>
        )}

        {collapsed && (
          <div className="mt-3 flex justify-center">
            <Button variant="ghost" size="icon" onClick={cycleTheme} title={themeLabel[mode]}>
              {(() => {
                const Icon = themeIcon[mode]
                return <Icon className="h-4 w-4" />
              })()}
            </Button>
          </div>
        )}

        <Button
          variant="glass"
          className={cn("mt-2", collapsed ? "flex w-full justify-center px-0" : "w-full justify-start gap-3")}
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Cerrar sesión"}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <button
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-glass-border bg-glass-bg backdrop-blur-md md:hidden"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <aside
        className={cn(
          "relative hidden shrink-0 border-r border-glass-border bg-glass-bg backdrop-blur-xl transition-all duration-200 md:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {sidebarContent}

        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-glass-border bg-glass-bg text-muted-foreground shadow-sm hover:text-foreground"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="fixed left-0 top-0 z-50 h-full w-72 border-r border-glass-border bg-glass-bg backdrop-blur-xl shadow-xl animate-slide-up">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
