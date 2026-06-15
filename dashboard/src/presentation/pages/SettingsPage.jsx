import React from 'react';
import { Settings, Palette, Gauge, RotateCcw, Sun, Moon, Monitor, Type, Minimize2, Maximize2 } from 'lucide-react';
import { useTheme } from '../components/useTheme';
import { useCylinderConfig } from '../../application/useCylinderConfig';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';

const PRESET_COLORS = ['#00d2ff', '#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b'];

const THEME_LABELS = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon };

const CYLINDER_LABELS = {
  arterial: 'Arterial (AP)',
  venoso: 'Venoso (VP)',
  tmp: 'TMP (PTM)',
  filtro: 'Filtro (FP)',
};

const DENSITY_LABELS = { compact: 'Normal', normal: 'Mediano', large: 'Grande' };
const DENSITY_ICONS = { compact: Minimize2, normal: Type, large: Maximize2 };

export const SettingsPage = ({ onBack }) => {
  const {
    accentColor, setAccentColor,
    customPresets, addCustomPreset, removeCustomPreset,
    density, setDensity,
  } = useTheme();

  const { configs, updateConfig, resetConfigs } = useCylinderConfig();

  return (
    <div className="app-container app-container-sm">
      <PageHeader icon={Settings} onBack={onBack} title="Ajustes" />

      <Card elevated className="animate-slide-up" style={{ padding: '32px' }}>

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
            <div style={{ fontSize: 'var(--fs-xxs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Colores predefinidos:</div>
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
              <div style={{ fontSize: 'var(--fs-xxs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Mis colores:</div>
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
                        fontSize: 'var(--fs-xxs)', cursor: 'pointer', display: 'flex',
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
            <Button
              variant="ghost"
              size="sm"
              icon={Palette}
              onClick={() => addCustomPreset(accentColor)}
              disabled={customPresets.includes(accentColor)}
            >Guardar color</Button>
          </div>
        </div>

      </Card>

      <Card elevated className="animate-slide-up" style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Type size={14} /> Tamaño
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['compact', 'normal', 'large'].map(mode => {
              const Icon = DENSITY_ICONS[mode];
              return (
                <Button
                  key={mode}
                  variant={density === mode ? 'primary' : 'ghost'}
                  size="sm"
                  icon={Icon}
                  onClick={() => setDensity(mode)}
                >{DENSITY_LABELS[mode]}</Button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card elevated className="animate-slide-up" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Gauge size={14} /> Configuración de Cilindros
          </label>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetConfigs}>Restablecer valores</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {Object.entries(CYLINDER_LABELS).map(([key, label]) => (
            <div key={key} className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: '12px', color: 'var(--text-primary)' }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: 'var(--fs-xxs)', color: 'var(--text-tertiary)' }}>
                  Mínimo
                  <input
                    type="text"
                    inputMode="decimal"
                    value={configs[key]?.min ?? 0}
                    onChange={e => updateConfig(key, 'min', e.target.value)}
                    className="input"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </label>
                <label style={{ fontSize: 'var(--fs-xxs)', color: 'var(--text-tertiary)' }}>
                  Máximo
                  <input
                    type="text"
                    inputMode="decimal"
                    value={configs[key]?.max ?? 500}
                    onChange={e => updateConfig(key, 'max', e.target.value)}
                    className="input"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </label>
                <label style={{ fontSize: 'var(--fs-xxs)', color: 'var(--text-tertiary)' }}>
                  Paso
                  <input
                    type="text"
                    inputMode="decimal"
                    value={configs[key]?.step ?? 100}
                    onChange={e => updateConfig(key, 'step', e.target.value)}
                    className="input"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
