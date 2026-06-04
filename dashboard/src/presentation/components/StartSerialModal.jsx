import React from 'react';
import { Radio, X } from 'lucide-react';
import { toLocalDatetime } from '../../infrastructure/time';

export const StartSerialModal = ({ show, onClose, latestTherapy, onStartReader }) => {
  if (!show) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-content modal-slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={20} color="var(--primary)" />
            Iniciar lectura serial
          </h3>
          <button onClick={onClose} className="modal-close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          El puerto serial está detenido. Selecciona cómo deseas inicializar la sesión de lectura para la máquina conectada:
        </p>

        {latestTherapy && (
          <div style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}>
              Última terapia registrada
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.75rem' }}>Paciente</span>
                <span style={{ fontWeight: 500 }}>{latestTherapy.patient_id_str || 'N/A'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.75rem' }}>Nº Serie Máquina</span>
                <span style={{ fontWeight: 500 }}>{latestTherapy.serial_number || 'N/A'}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.75rem' }}>Inicio</span>
                <span style={{ fontWeight: 500 }}>{toLocalDatetime(latestTherapy.started_at) || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            className="btn btn-primary"
            onClick={() => { onStartReader(true); onClose(); }}
            style={{ justifyContent: 'center', padding: '12px 20px' }}
          >
            Crear nueva terapia
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => { onStartReader(false); onClose(); }}
            style={{ justifyContent: 'center', padding: '12px 20px' }}
          >
            Continuar terapia actual
          </button>
        </div>
      </div>
    </div>
  );
};
