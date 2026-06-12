import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cylinder-configs';

const DEFAULTS = {
  arterial: { min: -400, max: 500, step: 100 },
  venoso:   { min: -400, max: 300, step: 100 },
  tmp:      { min: 0,    max: 80,  step: 10  },
  filtro:   { min: 0,    max: 500, step: 50  },
};

const loadConfigs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = {};
      for (const key of Object.keys(DEFAULTS)) {
        merged[key] = { ...DEFAULTS[key], ...parsed[key] };
      }
      return merged;
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
};

const saveConfigs = (configs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
};

export const useCylinderConfig = () => {
  const [configs, setConfigs] = useState(loadConfigs);

  const updateConfig = useCallback((label, field, raw) => {
    setConfigs(prev => {
      let stored;
      if (raw === '' || raw === '-' || raw === '-.') {
        stored = raw;
      } else {
        const num = parseFloat(raw);
        if (isNaN(num)) return prev;
        stored = num;
      }
      const next = {
        ...prev,
        [label]: { ...prev[label], [field]: stored },
      };
      saveConfigs(next);
      return next;
    });
  }, []);

  const resetConfigs = useCallback(() => {
    setConfigs(DEFAULTS);
    saveConfigs(DEFAULTS);
  }, []);

  const getConfig = useCallback((label) => {
    const cfg = configs[label] || DEFAULTS.arterial;
    return {
      min: typeof cfg.min === 'number' ? cfg.min : 0,
      max: typeof cfg.max === 'number' ? cfg.max : 500,
      step: typeof cfg.step === 'number' ? cfg.step : 100,
    };
  }, [configs]);

  return { configs, updateConfig, resetConfigs, getConfig };
};
