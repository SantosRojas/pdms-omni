import React from 'react';
import { Square, X } from 'lucide-react';

export const StopSerialModal = ({ show, onClose, onStopReader }) => {
  if (!show) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-content modal-slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Square size={20} color="var(--danger)" />
            Detener lectura serial
          </h3>
          <button onClick={onClose} className="modal-close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          El puerto serial está leyendo datos. ¿Qué deseas hacer con la terapia en curso?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            className="btn btn-danger"
            onClick={() => { onStopReader(true); onClose(); }}
            style={{ justifyContent: 'center', padding: '12px 20px' }}
          >
            Finalizar terapia y detener lectura
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => { onStopReader(false); onClose(); }}
            style={{ justifyContent: 'center', padding: '12px 20px' }}
          >
            Solo detener lectura (terapia queda abierta)
          </button>
        </div>
      </div>
    </div>
  );
};
