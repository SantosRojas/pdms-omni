import React from 'react';
import { Play, Square, AlertTriangle, Radio } from 'lucide-react';

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
          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} />
            Puerto Serial
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
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
            <button
              className="btn btn-primary"
              onClick={() => hasOpenTherapies ? onStart() : onStartDirect(true)}
              disabled={serialLoading}
              style={{ opacity: serialLoading ? 0.6 : 1 }}
            >
              <Play size={14} /> Iniciar
            </button>
          )}
          {(serialStatus.status === 'Running' || serialStatus.status === 'Initializing') && (
            <button
              className="btn btn-danger"
              onClick={onStop}
              disabled={serialLoading}
              style={{ opacity: serialLoading ? 0.6 : 1 }}
            >
              <Square size={14} /> Detener
            </button>
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
