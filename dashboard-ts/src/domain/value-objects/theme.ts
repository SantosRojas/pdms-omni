export type ThemeMode = "system" | "light" | "dark"
export type Density = "compact" | "normal" | "large"

export interface ThemeState {
  mode: ThemeMode
  accentColor: string
  density: Density
  customPresets: string[]
}

export const DEFAULT_ACCENT = "#00d4ff"
export const ACCENT_PRESETS = [
  "#00d4ff",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
] as const
