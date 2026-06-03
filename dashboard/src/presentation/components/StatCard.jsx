import React from 'react';
import * as Icons from 'lucide-react';

export const StatCard = ({ title, value, unit, iconName, color = 'var(--primary)' }) => {
  const Icon = Icons[iconName] || Icons.HelpCircle;

  return (
    <div className="glass-panel" style={{
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
    }}>
      <div className="stat-card-icon" style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        backgroundColor: `${color}18`,
        color: color,
        boxShadow: `0 0 12px ${color}20`,
      }}>
        <Icon size={22} />
      </div>

      <div className="stat-card-body">
        <span className="stat-card-label">{title}</span>
        <div className="stat-card-value-row">
          <span className="stat-card-value">
            {value}
          </span>
          {unit && <span className="stat-card-unit">{unit}</span>}
        </div>
      </div>
    </div>
  );
};
