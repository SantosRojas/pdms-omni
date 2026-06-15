import React from 'react';

export const InfoRow = ({ label, value, gridColumn, labelStyle, valueStyle }) => (
  <div style={{ gridColumn }}>
    <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: 'var(--fs-xxs)', ...labelStyle }}>{label}</span>
    <span style={{ fontWeight: 500, ...valueStyle }}>{value}</span>
  </div>
);