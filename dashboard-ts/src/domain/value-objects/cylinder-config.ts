export interface CylinderConfig {
  min: number
  max: number
  step: number
}

export type CylinderPressureType = "arterial" | "venous" | "tmp" | "filter"

export const DEFAULT_CYLINDER_CONFIGS: Record<CylinderPressureType, CylinderConfig> = {
  arterial: { min: -400, max: 500, step: 100 },
  venous: { min: -400, max: 300, step: 100 },
  tmp: { min: 0, max: 80, step: 20 },
  filter: { min: 0, max: 500, step: 100 },
}
