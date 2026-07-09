import { useState, useCallback } from "react"
import type { CylinderConfig, CylinderPressureType } from "@/domain/value-objects/cylinder-config"
import { DEFAULT_CYLINDER_CONFIGS } from "@/domain/value-objects/cylinder-config"
import { preferencesStorage } from "@/infrastructure/storage/preferences"

const ALL_TYPES = Object.keys(DEFAULT_CYLINDER_CONFIGS) as CylinderPressureType[]

function loadAllConfigs(): Record<CylinderPressureType, CylinderConfig> {
  const result = { ...DEFAULT_CYLINDER_CONFIGS }
  for (const type of ALL_TYPES) {
    const stored = preferencesStorage.getCylinderConfig(type)
    if (stored) result[type] = stored
  }
  return result
}

export function useCylinderConfigs() {
  const [configs, setConfigsState] = useState<Record<CylinderPressureType, CylinderConfig>>(loadAllConfigs)

  const updateConfig = useCallback((type: CylinderPressureType, field: keyof CylinderConfig, value: number) => {
    const updated = { ...configs[type], [field]: value }
    preferencesStorage.setCylinderConfig(type, updated)
    setConfigsState((prev) => ({ ...prev, [type]: updated }))
  }, [configs])

  const resetConfigs = useCallback(() => {
    for (const type of ALL_TYPES) {
      preferencesStorage.setCylinderConfig(type, DEFAULT_CYLINDER_CONFIGS[type])
    }
    setConfigsState({ ...DEFAULT_CYLINDER_CONFIGS })
  }, [])

  return { configs, updateConfig, resetConfigs }
}
