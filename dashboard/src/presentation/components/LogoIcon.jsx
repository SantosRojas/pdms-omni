import React from 'react';
import { Activity } from 'lucide-react';

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
    boxShadow: 'var(--primary-shadow-lg)',
  },
  error: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
  },
  neutral: {
    background: 'var(--btn-bg)',
    border: '1px solid var(--border-default)',
  },
};

export const LogoIcon = ({ size = 72, variant = 'primary' }) => {
  const s = `${size}px`;
  return (
    <div style={{
      width: s, height: s, borderRadius: `${size * 0.25}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...VARIANTS[variant],
    }}>
      <Activity size={Math.round(size * 0.44)} color="#0f172a" />
    </div>
  );
};