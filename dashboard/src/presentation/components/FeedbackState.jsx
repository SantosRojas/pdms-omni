import React from 'react';
import { Database, Loader } from 'lucide-react';

export const LoadingState = ({ message = 'Cargando...', padding = '60px' }) => (
  <div style={{ padding, textAlign: 'center' }}>
    <Loader size={32} className="spinner" style={{ margin: '0 auto 16px' }} />
    <p style={{ color: 'var(--text-tertiary)' }}>{message}</p>
  </div>
);

export const EmptyState = ({ icon: Icon = Database, message, padding = '48px' }) => (
  <div style={{ padding, textAlign: 'center', color: 'var(--text-tertiary)' }}>
    {Icon && <Icon size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />}
    <div>{message}</div>
  </div>
);