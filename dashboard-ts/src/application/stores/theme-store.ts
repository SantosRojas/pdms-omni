import { create } from "zustand"
import type { ThemeMode, Density } from "@/domain/value-objects/theme"
import { DEFAULT_ACCENT } from "@/domain/value-objects/theme"
import { preferencesStorage } from "@/infrastructure/storage/preferences"

interface ThemeState {
  mode: ThemeMode
  accentColor: string
  density: Density
  customPresets: string[]
  mqListener: (() => void) | null

  setMode: (mode: ThemeMode) => void
  setAccentColor: (color: string) => void
  setDensity: (density: Density) => void
  addPreset: (color: string) => void
  init: () => void
}

function applyTheme(mode: ThemeMode, accentColor: string, density: Density) {
  const root = document.documentElement

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const resolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode

  root.classList.toggle("dark", resolvedMode === "dark")

  const hex = accentColor.replace("#", "")
  const r = Number.parseInt(hex.substring(0, 2), 16)
  const g = Number.parseInt(hex.substring(2, 4), 16)
  const b = Number.parseInt(hex.substring(4, 6), 16)

  root.style.setProperty("--primary-r", r.toString())
  root.style.setProperty("--primary-g", g.toString())
  root.style.setProperty("--primary-b", b.toString())
  root.style.setProperty("--color-primary", accentColor)
  root.style.setProperty("--color-ring", accentColor)

  root.setAttribute("data-density", density)

  if (mode === "system") {
    root.style.colorScheme = "light dark"
  } else {
    root.style.colorScheme = mode
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "system",
  accentColor: DEFAULT_ACCENT,
  density: "normal",
  customPresets: [],
  mqListener: null,

  init: () => {
    const mode = preferencesStorage.getTheme()
    const accentColor = preferencesStorage.getAccentColor()
    const density = preferencesStorage.getDensity()
    const customPresets = preferencesStorage.getAccentPresets()

    const prev = get().mqListener
    if (prev) prev()

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const listener = () => {
      const s = get()
      if (s.mode === "system") {
        applyTheme("system", s.accentColor, s.density)
      }
    }
    mq.addEventListener("change", listener)

    const unsubscribe = () => {
      mq.removeEventListener("change", listener)
    }

    set({ mode, accentColor, density, customPresets, mqListener: unsubscribe })
    applyTheme(mode, accentColor, density)
  },

  setMode: (mode: ThemeMode) => {
    preferencesStorage.setTheme(mode)
    set({ mode })
    applyTheme(mode, get().accentColor, get().density)
  },

  setAccentColor: (accentColor: string) => {
    preferencesStorage.setAccentColor(accentColor)
    set({ accentColor })
    applyTheme(get().mode, accentColor, get().density)
  },

  setDensity: (density: Density) => {
    preferencesStorage.setDensity(density)
    set({ density })
    applyTheme(get().mode, get().accentColor, density)
  },

  addPreset: (color: string) => {
    const presets = [...get().customPresets, color]
    preferencesStorage.setAccentPresets(presets)
    set({ customPresets: presets })
  },
}))
