import React, { useState } from 'react';
import { Play, Square, AlertTriangle, X, Radio } from 'lucide-react';

export const SerialPanel = ({
  serialStatus,
  serialLoading,
  serialError,
  canControlSerial,
  hasTherapies,
  onStart,
  onStartDirect,
  onStop,
}) => {
  const [dismissedAtFailure, setDismissedAtFailure] = useState(null);

  return (
    <div className={`serial-panel ${serialStatus.status}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '200px' }}>
        <div className={`status-dot ${serialStatus.status === 'Running' ? 'connected' : serialStatus.status === 'Initializing' ? 'initializing' : serialStatus.status === 'FailedLimit' ? 'disconnected' : 'stopped'}`} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} />
            Puerto Serial
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {serialStatus.status === 'Running' && 'Lectura activa'}
            {serialStatus.status === 'Initializing' && 'Inicializando dispositivo...'}
            {serialStatus.status === 'Stopped' && 'Lectura detenida'}
            {serialStatus.status === 'FailedLimit' && `Lectura suspendida tras ${serialStatus.max_failures} fallos consecutivos`}
            {serialStatus.status === 'Unknown' && 'Estado desconocido'}
          </div>
        </div>
      </div>

      {serialStatus.consecutive_failures > 0 && serialStatus.status !== 'FailedLimit' && (
        <span className="badge badge-warning">
          <AlertTriangle size={13} />
          {serialStatus.consecutive_failures}/{serialStatus.max_failures} conexión
        </span>
      )}

      {serialStatus.status === 'FailedLimit' && (
        <span className="badge badge-error">
          <AlertTriangle size={13} />
          Límite alcanzado ({serialStatus.max_failures})
        </span>
      )}

      {serialStatus.data_warnings > 0 && (
        <span className="badge badge-warning" style={{ background: 'rgba(245,158,11,0.08)' }}>
          <AlertTriangle size={13} />
          {serialStatus.data_warnings} advertencias de datos
        </span>
      )}

      {serialStatus.consecutive_failures > 0 && serialStatus.consecutive_failures !== dismissedAtFailure && (
        <div className={`serial-notification ${serialStatus.status === 'FailedLimit' ? 'notification-error' : 'notification-warning'}`}>
          <div className="notification-content">
            <AlertTriangle size={16} />
            <span>
              {serialStatus.status === 'FailedLimit'
                ? `Conexión suspendida tras ${serialStatus.max_failures} fallos consecutivos. Presiona "Iniciar" para reintentar.`
                : `Fallo de conexión: ${serialStatus.consecutive_failures}/${serialStatus.max_failures} intentos.`}
            </span>
          </div>
          <button className="notification-close" onClick={() => setDismissedAtFailure(serialStatus.consecutive_failures)} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
      )}

      {canControlSerial && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {(serialStatus.status === 'Stopped' || serialStatus.status === 'FailedLimit' || serialStatus.status === 'Unknown') && (
            <button
              className="btn btn-success"
              onClick={() => hasTherapies ? onStart() : onStartDirect(true)}
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
