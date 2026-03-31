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
  
  // Clamp value between min and max
  const clampedValue = Math.max(min, Math.min(max, numValue));
  
  // Calculate height percentage from bottom (0% = min, 100% = max)
  const heightPercent = ((clampedValue - min) / range) * 100;
  
  // 0 point indicator line (if minimum is negative)
  const zeroPercent = min < 0 && max > 0 ? ((0 - min) / range) * 100 : null;
  
  return (
    <div className="cylinder-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      
      {/* Title */}
      <div className="cylinder-header" style={{ textAlign: 'center' }}>
        <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</h4>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: `var(${colorVar})`, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
          {value} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>

      {/* 2D Flat Visual */}
      <div className="cylinder-visual-wrapper" style={{ position: 'relative', marginTop: '10px' }}>
        <div className="cylinder-visual" style={{
          position: 'relative',
          width: '40px',
          height: '240px',
          backgroundColor: 'var(--cylinder-bg)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          
          {/* Zero Line Marker (if necessary) */}
          {zeroPercent !== null && (
            <div style={{
              position: 'absolute',
              bottom: `${zeroPercent}%`,
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: 'var(--text-muted)',
              opacity: 0.6,
              zIndex: 1,
            }} title="Zero Pressure" />
          )}

          {/* Fill */}
          <div style={{
            width: '100%',
            height: `${heightPercent}%`,
            backgroundColor: `var(${colorVar})`,
            transition: 'height 0.3s ease-out',
            zIndex: 0,
          }} />

        </div>
        
        {/* Helper numbers/scale text if needed could go here, for now keeping it very simple */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0, left: '48px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500
        }}>
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

