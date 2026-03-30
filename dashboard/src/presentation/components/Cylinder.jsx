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
        <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</h4>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: `var(${colorVar})`, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
          {value} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>

      {/* 3D Cylinder Visual */}
      <div className="cylinder-visual-wrapper" style={{ position: 'relative', padding: '10px' }}>
        <div className="cylinder-visual" style={{
          position: 'relative',
          width: '56px',
          height: '240px',
          backgroundColor: 'var(--cylinder-bg)',
          borderRadius: '28px',
          border: '1.5px solid var(--cylinder-border)',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2), 0 10px 25px -10px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 2
        }}>
          
          {/* Fill */ }
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${heightPercent}%`,
            background: `linear-gradient(90deg, 
              rgba(0,0,0,0.2) 0%, 
              var(${colorVar}) 25%, 
              var(${colorVar}) 50%, 
              rgba(255,255,255,0.3) 85%, 
              var(${colorVar}) 100%)`,
            boxShadow: `0 -5px 15px -3px var(${colorVar}), 0 0 10px var(${colorVar})40`,
            transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {/* Top surface of liquid with a slight glow */}
            <div style={{
              position: 'absolute',
              top: '-10px',
              left: 0,
              right: 0,
              height: '20px',
              borderRadius: '50%',
              backgroundColor: `var(${colorVar})`,
              filter: 'brightness(1.35)',
              boxShadow: `inset 0 0 8px rgba(0,0,0,0.1), 0 0 15px var(${colorVar})`,
              opacity: heightPercent > 2 ? 1 : 0,
              zIndex: 3
            }}/>
          </div>

          {/* Scale markers */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '20px 0', pointerEvents: 'none', opacity: 0.3
          }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} style={{ width: i%2 === 0 ? '15px' : '8px', height: '1.5px', background: 'var(--text-muted)', marginLeft: 'auto' }} />
            ))}
          </div>

          {/* Outer Cylinder Highlights (Glass Reflection) */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--cylinder-glass-reflection)',
            pointerEvents: 'none',
            borderRadius: '28px',
            zIndex: 4
          }}/>
        </div>
        
        {/* Decorative Ring at the top */}
        <div style={{
          position: 'absolute',
          top: '-2px', left: '50%', transform: 'translateX(-50%)',
          width: '64px', height: '24px',
          borderRadius: '50%', border: '2px solid var(--cylinder-border)',
          background: 'var(--cylinder-base)', opacity: 0.5, zIndex: 1
        }} />
      </div>

      {/* Base */}
      <div className="cylinder-base-container" style={{ position: 'relative' }}>
        <div style={{
          width: '70px',
          height: '12px',
          backgroundColor: 'var(--cylinder-base)',
          borderRadius: '50%',
          boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
          border: '1px solid var(--cylinder-border)',
          zIndex: 5,
          position: 'relative'
        }}/>
        {/* Glow under base */}
        <div style={{
          position: 'absolute',
          top: '4px', left: '10%', right: '10%', height: '8px',
          backgroundColor: `var(${colorVar})`,
          filter: 'blur(10px)', opacity: 0.2, zIndex: 0
        }}/>
      </div>
    </div>
  );
};
