import React from 'react';
import { Play, Square, AlertTriangle, Radio } from 'lucide-react';
import { Button } from './Button';

export const SerialPanel = ({
  serialStatus,
  serialLoading,
  serialError,
  canControlSerial,
  hasOpenTherapies,
  onStart,
  onStartDirect,
  onStop,
}) => {
  return (
    <div className={`glass-panel serial-panel ${serialStatus.status}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '200px' }}>
        <div className={`status-dot ${serialStatus.status === 'Running' ? 'connected' : serialStatus.status === 'Initializing' ? 'initializing' : serialStatus.status === 'FailedLimit' ? 'disconnected' : 'stopped'}`} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} />
            Puerto Serial
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {serialStatus.status === 'Running' && 'Lectura activa'}
            {serialStatus.status === 'Initializing' && 'Inicializando...'}
            {serialStatus.status === 'Stopped' && 'Lectura detenida'}
            {serialStatus.status === 'FailedLimit' && 'Revisar la conexión con el equipo y volver a intentarlo'}
            {serialStatus.status === 'Unknown' && 'Estado desconocido'}
          </div>
        </div>
      </div>

      {serialStatus.status === 'FailedLimit' && (
        <span className="badge badge-error">
          <AlertTriangle size={13} />
          Revisar conexión
        </span>
      )}

      {canControlSerial && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {(serialStatus.status === 'Stopped' || serialStatus.status === 'FailedLimit' || serialStatus.status === 'Unknown') && (
            <Button variant="primary" icon={Play} disabled={serialLoading} loading={serialLoading} onClick={() => hasOpenTherapies ? onStart() : onStartDirect(true)}>
              Iniciar
            </Button>
          )}
          {(serialStatus.status === 'Running' || serialStatus.status === 'Initializing') && (
            <Button variant="danger" icon={Square} disabled={serialLoading} loading={serialLoading} onClick={onStop}>
              Detener
            </Button>
          )}
        </div>
      )}

      {serialError && (
        <div className="message-box message-error" style={{ width: '100%' }}>
          Error: {serialError}
        </div>
      )}
    </div>
  );
};
