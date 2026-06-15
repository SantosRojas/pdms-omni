import React from 'react';
import { Home } from 'lucide-react';
import { LogoIcon } from '../components/LogoIcon';
import { Button } from '../components/Button';

export const NotFoundPage = ({ onBack }) => (
  <div className="app-container app-container-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <LogoIcon variant="neutral" size={64} />
      <h2>Página no encontrada</h2>
      <p style={{ color: 'var(--text-tertiary)' }}>La ruta a la que intentaste acceder no existe.</p>
      <Button variant="primary" icon={Home} onClick={onBack}>Volver al inicio</Button>
    </div>
  </div>
);
