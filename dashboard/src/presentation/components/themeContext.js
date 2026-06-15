import { createContext } from 'react';

export const DEFAULT_ACCENT = '#00d2ff';

export const ThemeContext = createContext({
  theme: 'system',
  setTheme: () => null,
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => null,
  customPresets: [],
  addCustomPreset: () => null,
  removeCustomPreset: () => null,
  density: 'compact',
  setDensity: () => null,
});
