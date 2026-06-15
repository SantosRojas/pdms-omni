import React from 'react';

const VARIANT_CLASS = {
  active: 'badge-active',
  open: 'badge-open',
  closed: 'badge-closed',
  warning: 'badge-warning',
  error: 'badge-error',
};

export const StatusBadge = ({ variant = 'active', children }) => (
  <span className={`badge ${VARIANT_CLASS[variant] || ''}`}>{children}</span>
);