import React from 'react';
import { Activity } from 'lucide-react';

export const NotFoundPage = ({ onBack }) => (
  <div className="app-container app-container-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '16px',
        background: 'var(--btn-bg)', border: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Activity size={28} style={{ opacity: 0.3 }} />
      </div>
      <h2>Página no encontrada</h2>
      <p style={{ color: 'var(--text-tertiary)' }}>La ruta a la que intentaste acceder no existe.</p>
      <button className="btn btn-primary" onClick={onBack}>
        Volver al inicio
      </button>
    </div>
  </div>
);
