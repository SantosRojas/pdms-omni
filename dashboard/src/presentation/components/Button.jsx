import React from 'react';

const VARIANT_CLASS = {
  primary: 'btn-primary',
  danger: 'btn-danger',
  success: 'btn-success',
  ghost: 'btn-ghost',
  warning: 'btn-warning',
  purple: 'btn-purple',
  history: 'btn-history',
};

const SIZE_CLASS = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  children,
  fullWidth,
  centered,
  loading,
  className = '',
  ...props
}) => {
  const classes = [
    'btn',
    VARIANT_CLASS[variant] || '',
    SIZE_CLASS[size],
    fullWidth && 'btn-full',
    (centered || size === 'lg' || variant === 'ghost' && fullWidth) && 'btn-centered',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};