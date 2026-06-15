import React from 'react';

export const FlexRow = ({ gap = 8, align = 'center', wrap, children, style, className, ...props }) => (
  <div
    className={className}
    style={{ display: 'flex', gap: `${gap}px`, alignItems: align, flexWrap: wrap ? 'wrap' : undefined, ...style }}
    {...props}
  >
    {children}
  </div>
);