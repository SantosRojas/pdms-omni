import React from 'react';
import { Radio } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { InfoRow } from './InfoRow';
import { toLocalDatetime } from '../../infrastructure/time';

export const StartSerialModal = ({ show, onClose, latestTherapy, onStartReader }) => {
  return (
    <Modal show={show} onClose={onClose} title="Iniciar lectura serial" icon={Radio} iconColor="var(--primary)">
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
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
            fontSize: 'var(--fs-xxs)',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            fontWeight: 600,
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}>
            Última terapia registrada
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 'var(--fs-sm)' }}>
            <InfoRow label="Paciente" value={latestTherapy.patient_id_str || 'N/A'} />
            <InfoRow label="Nº Serie Máquina" value={latestTherapy.serial_number || 'N/A'} />
            <InfoRow label="Inicio" value={toLocalDatetime(latestTherapy.started_at) || 'N/A'} gridColumn="span 2" />
          </div>
        </div>
      )}

      <Modal.Footer>
        <Button variant="primary" fullWidth centered onClick={() => { onStartReader(true); onClose(); }}>
          Crear nueva terapia
        </Button>
        <Button variant="ghost" fullWidth centered onClick={() => { onStartReader(false); onClose(); }}>
          Continuar terapia actual
        </Button>
      </Modal.Footer>
    </Modal>
  );
};