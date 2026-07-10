import type { ThemeMode, Density } from "@/domain/value-objects/theme"
import type { CylinderConfig, CylinderPressureType } from "@/domain/value-objects/cylinder-config"

const PREFIX = "omni-"

export const preferencesStorage = {
  getTheme(): ThemeMode {
    return (localStorage.getItem(`${PREFIX}theme`) as ThemeMode) || "system"
  },

  setTheme(mode: ThemeMode): void {
    localStorage.setItem(`${PREFIX}theme`, mode)
  },

  getAccentColor(): string {
    return localStorage.getItem(`${PREFIX}accent`) || "#00d4ff"
  },

  setAccentColor(color: string): void {
    localStorage.setItem(`${PREFIX}accent`, color)
  },

  getAccentPresets(): string[] {
    try {
      const raw = localStorage.getItem(`${PREFIX}accent-presets`)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  setAccentPresets(presets: string[]): void {
    localStorage.setItem(`${PREFIX}accent-presets`, JSON.stringify(presets))
  },

  getDensity(): Density {
    return (localStorage.getItem(`${PREFIX}density`) as Density) || "normal"
  },

  setDensity(density: Density): void {
    localStorage.setItem(`${PREFIX}density`, density)
  },

  getCylinderConfig(type: CylinderPressureType): CylinderConfig | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}cylinder-${type}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  setCylinderConfig(type: CylinderPressureType, config: CylinderConfig): void {
    localStorage.setItem(`${PREFIX}cylinder-${type}`, JSON.stringify(config))
  },

  getVisibleSignals(): string[] | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}visible-signals`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  setVisibleSignals(keys: string[]): void {
    localStorage.setItem(`${PREFIX}visible-signals`, JSON.stringify(keys))
  },
}
