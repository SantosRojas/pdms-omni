import { useRef, useState } from "react"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { useAuth } from "@/application/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card"
import { Input } from "@/presentation/components/ui/input"
import { Button } from "@/presentation/components/ui/button"
import { Separator } from "@/presentation/components/ui/separator"
import { Settings, Sun, Moon, Monitor, Palette, Paintbrush, Gauge } from "lucide-react"
import { useThemeStore } from "@/application/stores/theme-store"
import { useCylinderConfigs } from "@/application/hooks/use-cylinder-config"
import type { CylinderPressureType } from "@/domain/value-objects/cylinder-config"
import type { CylinderConfig } from "@/domain/value-objects/cylinder-config"
import { ACCENT_PRESETS } from "@/domain/value-objects/theme"
import type { ThemeMode } from "@/domain/value-objects/theme"
import { cn } from "@/lib/utils"

const PRESSURE_LABELS: Record<CylinderPressureType, string> = {
  arterial: "Arterial",
  venous: "Venoso",
  tmp: "TMP",
  filter: "Filtro",
}

const PRESSURE_TYPES = Object.keys(PRESSURE_LABELS) as CylinderPressureType[]

const PRESSURE_FIELDS: (keyof CylinderConfig)[] = ["min", "max", "step"]
const FIELD_LABELS: Record<string, string> = { min: "Mín", max: "Máx", step: "Paso" }

export function SettingsPage() {
  const { canEdit } = useAuth()
  const { mode, accentColor, density, setMode, setAccentColor, setDensity } = useThemeStore()
  const { configs, updateConfig, resetConfigs } = useCylinderConfigs()
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  const themes: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
    { key: "light", label: "Claro", icon: Sun },
    { key: "dark", label: "Oscuro", icon: Moon },
    { key: "system", label: "Sistema", icon: Monitor },
  ]

  function handlePressureChange(type: CylinderPressureType, field: keyof CylinderConfig, raw: string) {
    const key = `${type}.${field}`
    setLocalValues((prev) => ({ ...prev, [key]: raw }))
    const num = Number.parseFloat(raw)
    if (Number.isFinite(num)) {
      updateConfig(type, field, num)
    }
  }

  function handlePressureBlur(type: CylinderPressureType, field: keyof CylinderConfig) {
    const key = `${type}.${field}`
    const raw = localValues[key]
    if (raw !== undefined) {
      const num = Number.parseFloat(raw)
      if (!Number.isFinite(num)) {
        setLocalValues((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    }
  }

  function handleReset() {
    resetConfigs()
    setLocalValues({})
  }

  return (
    <div>
      <PageHeader
        title="Ajustes"
        description="Personalización de la aplicación"
        icon={<Settings className="h-6 w-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Tema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Modo</p>
              <Card variant="surface" dense className="border-white/15">
                <div className="flex">
                  {themes.map(({ key, label, icon: Icon }) => {
                    const isActive = mode === key
                    return (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                          isActive
                            ? "bg-background text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </Card>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Color de acento</p>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      accentColor === c ? "border-foreground scale-110 ring-2 ring-offset-2 ring-[var(--color-primary)]" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setAccentColor(c)}
                  />
                ))}
                <button
                  onClick={() => colorInputRef.current?.click()}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground transition-all hover:border-foreground hover:text-foreground",
                    !(ACCENT_PRESETS as readonly string[]).includes(accentColor) && "border-foreground scale-110",
                  )}
                  title="Personalizar"
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="sr-only"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Densidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["compact", "normal", "large"] as const).map((d) => (
              <Button
                key={d}
                variant={density === d ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setDensity(d)}
              >
                {d === "compact" ? "Compacto" : d === "normal" ? "Normal" : "Grande"}
              </Button>
            ))}
          </CardContent>
        </Card>

        {canEdit && (
          <Card variant="glass" className="sm:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Límites de presión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Configurar los límites mínimo, máximo y paso de escala para cada tipo de presión
                (utilizado en la vista de cilindro graduado).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PRESSURE_TYPES.map((type) => {
                  const cfg = configs[type]
                  return (
                    <Card key={type} variant="surface" dense className="border-white/15">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-scada-muted">
                        {PRESSURE_LABELS[type]}
                      </p>

                      <div className="space-y-1.5">
                        {PRESSURE_FIELDS.map((field) => {
                          const inputKey = `${type}.${field}`
                          const displayValue = inputKey in localValues ? localValues[inputKey] : String(cfg[field])
                          return (
                            <div key={field}>
                              <label className="text-[10px] uppercase text-muted-foreground">{FIELD_LABELS[field]}</label>
                              <Input
                                value={displayValue}
                                onChange={(e) => handlePressureChange(type, field, e.target.value)}
                                onBlur={() => handlePressureBlur(type, field)}
                                className="h-7 text-xs tabular-nums"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  )
                })}
              </div>

              <Separator className="my-4" />

              <Button variant="outline" size="sm" onClick={handleReset}>
                Restablecer valores predeterminados
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
