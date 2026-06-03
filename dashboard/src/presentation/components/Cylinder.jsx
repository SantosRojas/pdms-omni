import React from 'react';

export const Cylinder = ({ 
  label, 
  value, 
  unit, 
  max = 500, 
  min = -200, 
  colorVar = '--primary' 
}) => {
  const range = max - min;
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  
  const clampedValue = Math.max(min, Math.min(max, numValue));
  
  const heightPercent = ((clampedValue - min) / range) * 100;
  
  const zeroPercent = min < 0 && max > 0 ? ((0 - min) / range) * 100 : null;
  
  return (
    <div className="cylinder-container">
      
      <div className="cylinder-header">
        <h4>{label}</h4>
        <div className="cylinder-value" style={{ color: `var(${colorVar})` }}>
          {value} <span className="cylinder-unit">{unit}</span>
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: '8px' }}>
        <div className="cylinder-visual">
          
          {zeroPercent !== null && (
            <div className="cylinder-zero-line" style={{ bottom: `${zeroPercent}%` }} />
          )}

          <div className="cylinder-fill" style={{
            height: `${heightPercent}%`,
            backgroundColor: `var(${colorVar})`,
          }} />
        </div>
        
        <div className="cylinder-scale">
          <span>{max}</span>
          {zeroPercent !== null && (
            <span style={{ position: 'absolute', bottom: `calc(${zeroPercent}% - 6px)` }}>0</span>
          )}
          <span>{min}</span>
        </div>
      </div>
    </div>
  );
};
