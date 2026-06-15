import React from 'react';

const PADDING_CLASS = {
  sm: 'card-p-sm',
  md: '',
  lg: 'card-p-lg',
  none: 'card-p-none',
};

export const Card = ({
  elevated,
  padding = 'md',
  hover,
  children,
  className = '',
  style,
  ...props
}) => {
  const classes = [
    elevated ? 'glass-panel-elevated' : 'glass-panel',
    PADDING_CLASS[padding],
    hover && 'card-hover',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
};