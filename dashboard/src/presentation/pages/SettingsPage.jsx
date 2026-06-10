import React from 'react';
import { ChevronLeft, Settings, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

const PRESET_COLORS = ['#00d2ff', '#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b'];

const THEME_LABELS = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon };

export const SettingsPage = ({ onBack }) => {
  const {
    accentColor, setAccentColor,
    customPresets, addCustomPreset, removeCustomPreset,
    theme, setTheme,
  } = useTheme();

  return (
    <div className="app-container app-container-sm" style={{ gap: '20px' }}>
      <div className="glass-panel page-header animate-slide-up" style={{ marginTop: '20px' }}>
        <div className="page-header-left">
          <button onClick={onBack} className="btn btn-ghost">
            <ChevronLeft size={18} /> Volver
          </button>
          <Settings size={22} color="var(--primary)" />
          <h2 style={{ fontSize: '1.25rem' }}>Ajustes</h2>
        </div>
      </div>

      <div className="glass-panel-elevated animate-slide-up" style={{ padding: '32px' }}>

        {/* Tema */}
        {/* <div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-default)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            {theme === 'dark' ? <Moon size={14} /> : theme === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
            Tema
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['system', 'light', 'dark'].map(mode => {
              const Icon = THEME_ICONS[mode];
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`btn btn-sm${active ? ' btn-primary' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon size={14} /> {THEME_LABELS[mode]}
                </button>
              );
            })}
          </div>
        </div> */}

        {/* Color de Acento */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Palette size={14} /> Color de Acento
          </label>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Colores predefinidos:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  title={color}
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: color, cursor: 'pointer', padding: 0,
                    border: accentColor === color ? '3px solid var(--text-primary)' : '2px solid transparent',
                    outline: accentColor === color ? '2px solid var(--primary)' : 'none',
                    outlineOffset: '2px', transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>
          </div>

          {customPresets.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Mis colores:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {customPresets.map(color => (
                  <div key={color} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setAccentColor(color)}
                      title={color}
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: color, cursor: 'pointer', padding: 0,
                        border: accentColor === color ? '3px solid var(--text-primary)' : '2px solid transparent',
                        outline: accentColor === color ? '2px solid var(--primary)' : 'none',
                        outlineOffset: '2px', transition: 'border-color 0.15s',
                      }}
                    />
                    <button
                      onClick={() => removeCustomPreset(color)}
                      title="Eliminar"
                      style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: 'var(--danger)', color: 'white', border: 'none',
                        fontSize: '10px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              style={{
                width: '40px', height: '40px', borderRadius: '8px',
                border: '2px solid var(--border-default)', cursor: 'pointer',
                background: 'none', padding: 0,
              }}
            />
            <button
              onClick={() => addCustomPreset(accentColor)}
              disabled={customPresets.includes(accentColor)}
              className="btn btn-ghost btn-sm"
            >
              <Palette size={14} /> Guardar color
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
