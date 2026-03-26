import React from 'react';

export const Cylinder = ({ 
  label, 
  value, 
  unit, 
  max = 500, 
  min = -200, 
  colorVar = '--primary' 
}) => {
  // Calculate percentage for fill (handling negative mins correctly)
  const range = max - min;
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  
  // Clamp value between min and max for raw visuals
  const clampedValue = Math.max(min, Math.min(max, numValue));
  
  // Calculate height percentage from bottom (0% = min, 100% = max)
  const heightPercent = ((clampedValue - min) / range) * 100;
  
  return (
    <div className="cylinder-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      
      {/* Title */}
      <div className="cylinder-header" style={{ textAlign: 'center' }}>
        <h4 style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '4px' }}>{label}</h4>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: `var(${colorVar})` }}>
          {value} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>{unit}</span>
        </div>
      </div>

      {/* 3D Cylinder Visual */}
      <div className="cylinder-visual" style={{
        position: 'relative',
        width: '60px',
        height: '220px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '30px',
        border: '2px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        
        {/* Fill */ }
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${heightPercent}%`,
          background: `linear-gradient(90deg, 
            rgba(0,0,0,0.4) 0%, 
            var(${colorVar}) 50%, 
            rgba(255,255,255,0.2) 80%, 
            var(${colorVar}) 100%)`,
          boxShadow: `0 0 20px var(${colorVar})`,
          transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          borderTopRadius: '50%',
        }}>
          {/* Top surface of liquid */}
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: 0,
            right: 0,
            height: '20px',
            borderRadius: '50%',
            backgroundColor: `var(${colorVar})`,
            filter: 'brightness(1.5)',
            boxShadow: `inset 0 0 8px rgba(0,0,0,0.2)`,
            opacity: heightPercent > 0 ? 1 : 0
          }}/>
        </div>

        {/* Outer Cylinder Highlights (Glass Reflection) */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
          borderRadius: '30px'
        }}/>
      </div>

      {/* Base */}
      <div style={{
        width: '80px',
        height: '10px',
        backgroundColor: '#222',
        borderRadius: '50%',
        boxShadow: '0 5px 10px rgba(0,0,0,0.8)'
      }}/>
    </div>
  );
};
