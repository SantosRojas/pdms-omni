import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from './Button';

export const PageHeader = ({ icon: Icon, iconColor, title, onBack, backLabel = 'Volver', children }) => (
  <div className="glass-panel page-header animate-slide-up">
    <div className="page-header-left">
      <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>{backLabel}</Button>
      {Icon && <Icon size={22} color={iconColor || 'var(--primary)'} />}
      <h2 style={{ fontSize: 'var(--fs-xl)' }}>{title}</h2>
    </div>
    {children && <div className="page-header-right">{children}</div>}
  </div>
);