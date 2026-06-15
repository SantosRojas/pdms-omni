import React from 'react';

export const FormField = ({ label, icon: Icon, error, touched, required, children }) => (
  <div>
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-sm)', marginBottom: '6px' }}>
      {Icon && <Icon size={14} />}
      {label}
      {required && <span style={{ color: 'var(--danger)' }}>*</span>}
    </label>
    {children}
    {touched && error && <span className="field-error">{error}</span>}
  </div>
);