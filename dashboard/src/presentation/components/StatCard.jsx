import React from 'react';
import * as Icons from 'lucide-react';

export const StatCard = ({ title, value, unit, iconName, color = 'var(--primary)' }) => {
  const Icon = Icons[iconName] || Icons.HelpCircle;

  return (
    <div className="glass-panel" style={{
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        backgroundColor: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        boxShadow: `0 0 15px ${color}30`
      }}>
        <Icon size={24} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{unit}</span>}
        </div>
      </div>
    </div>
  );
};
