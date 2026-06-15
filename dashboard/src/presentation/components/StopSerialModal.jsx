import React from 'react';
import { Square } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export const StopSerialModal = ({ show, onClose, onStopReader }) => {
  return (
    <Modal show={show} onClose={onClose} title="Detener lectura serial" icon={Square} iconColor="var(--danger)">
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
        El puerto serial está leyendo datos. ¿Qué deseas hacer con la terapia en curso?
      </p>

      <Modal.Footer>
        <Button variant="danger" fullWidth centered onClick={() => { onStopReader(true); onClose(); }}>
          Finalizar terapia y detener lectura
        </Button>
        <Button variant="ghost" fullWidth centered onClick={() => { onStopReader(false); onClose(); }}>
          Solo detener lectura (terapia queda abierta)
        </Button>
      </Modal.Footer>
    </Modal>
  );
};