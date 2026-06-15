import React, { useEffect, useState, useCallback } from 'react';
import { ThemeContext, DEFAULT_ACCENT } from './themeContext';

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('omni-theme') || 'system';
  });

  const [accentColor, setAccentColorState] = useState(() => {
    return localStorage.getItem('omni-accent') || DEFAULT_ACCENT;
  });

  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const saved = localStorage.getItem('omni-accent-presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [density, setDensity] = useState(() => {
    return localStorage.getItem('omni-density') || 'compact';
  });

  // Sync accent color → HSL CSS variables
  useEffect(() => {
    const hsl = hexToHsl(accentColor);
    const root = window.document.documentElement;
    root.style.setProperty('--primary-h', String(hsl.h));
    root.style.setProperty('--primary-s', `${hsl.s}%`);
    root.style.setProperty('--primary-l', `${hsl.l}%`);
    localStorage.setItem('omni-accent', accentColor);
  }, [accentColor]);

  // Sync theme → data-theme attribute
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }

    localStorage.setItem('omni-theme', theme);
  }, [theme]);

  // Listen for system theme changes if set to system
  useEffect(() => {
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e) => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };

    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [theme]);

  // Sync density → data-density attribute
  useEffect(() => {
    const root = window.document.documentElement;
    if (density === 'normal') {
      root.removeAttribute('data-density');
    } else {
      root.setAttribute('data-density', density);
    }
    localStorage.setItem('omni-density', density);
  }, [density]);

  const addCustomPreset = useCallback((color) => {
    setCustomPresets(prev => {
      if (prev.includes(color)) return prev;
      const updated = [...prev, color];
      localStorage.setItem('omni-accent-presets', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeCustomPreset = useCallback((color) => {
    setCustomPresets(prev => {
      const updated = prev.filter(c => c !== color);
      localStorage.setItem('omni-accent-presets', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme,
      accentColor, setAccentColor: setAccentColorState,
      customPresets, addCustomPreset, removeCustomPreset,
      density, setDensity,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};


