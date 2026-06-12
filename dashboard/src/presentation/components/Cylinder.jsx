import React from 'react';

export const Cylinder = ({
  label,
  value,
  unit,
  config = { min: -200, max: 500, step: 100 },
  colorVar = '--primary'
}) => {
  const { min, max, step } = config;
  const range = max - min;
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const clampedValue = Math.max(min, Math.min(max, numValue));
  const heightPercent = ((clampedValue - min) / range) * 100;
  const zeroPercent = min < 0 && max > 0 ? ((0 - min) / range) * 100 : null;

  const ticks = [];
  for (let v = min; v <= max; v += step) {
    ticks.push({ value: v, percent: ((v - min) / range) * 100 });
  }

  return (
    <div className="cylinder-container">
      <div className="cylinder-header">
        <h4>{label}</h4>
        <div className="cylinder-value" style={{ color: `var(${colorVar})` }}>
          {value} <span className="cylinder-unit">{unit}</span>
        </div>
      </div>

      <div className="cylinder-body">
        <div className="cylinder-visual-wrapper">
          <div className="cylinder-visual">
            {zeroPercent !== null && (
              <div className="cylinder-zero-line" style={{ bottom: `${zeroPercent}%` }} />
            )}
            <div className="cylinder-fill" style={{
              height: `${heightPercent}%`,
              backgroundColor: `var(${colorVar})`,
            }} />
            <div className="cylinder-ticks">
              {ticks.map(tick => (
                <div
                  key={tick.value}
                  className="cylinder-tick"
                  style={{ bottom: `${tick.percent}%` }}
                />
              ))}
            </div>
          </div>


        </div>

        <div className="cylinder-scale">
          {ticks.map(tick => (
            <div
              key={tick.value}
              className="cylinder-tick-label"
              style={{ bottom: `${tick.percent}%` }}
            >
              {tick.value}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
