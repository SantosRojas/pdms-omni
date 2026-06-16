import React from 'react';
import { ArrowLeft, History } from 'lucide-react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';

export const MonitoringHeader = ({
  mode,
  selectedTherapy,
  therapyIsActive,
  isPreTherapy,
  connected,
  data,
  onBack,
  onNavigateHistory,
}) => {
  const isLive = mode === 'live';
  const hasData = data && data.info;

  return (
    <header className="glass-panel page-header animate-slide-up">
      <div className="monitoring-header-left">
        <div className="monitoring-header-label">
          {isLive ? 'Monitor en vivo' : isPreTherapy ? 'Pre-terapia' : 'Terapia seleccionada'}
        </div>
        <div className="monitoring-header-title">
          {selectedTherapy
            ? `${selectedTherapy.patient_id_str} · Máquina ${selectedTherapy.serial_number}`
            : isLive
              ? hasData && data.info.d_serial_number_to_odi?.value !== 'N/A'
                ? `Máquina ${data.info.d_serial_number_to_odi.value}`
                : 'Esperando datos de la máquina...'
              : hasData
                ? `Paciente ${data.info.g_patient_id_str?.value || 'N/A'} · Máquina ${data.info.d_serial_number_to_odi?.value || 'N/A'}`
                : 'Cargando...'
          }
        </div>
      </div>

      <div className="monitoring-header-right">
        {isLive && (
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={14} /> Volver
          </button>
        )}

        {!isLive && selectedTherapy && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              Cambiar terapia
            </button>
            <Button variant="history" size="sm" icon={History} onClick={() => onNavigateHistory(selectedTherapy)}>
              Historial
            </Button>
          </>
        )}

        <div className="connection-status">
          {connected && (therapyIsActive || isPreTherapy || isLive) && hasData && data.info.g_trmt_main_state_set?.value !== 'N/A' && (
            <StatusBadge variant={therapyIsActive ? 'active' : 'warning'} style={{ marginRight: '8px' }}>
              {data.info.g_trmt_main_state_set.value}
            </StatusBadge>
          )}
          <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected && (therapyIsActive || isPreTherapy || isLive) ? 'EN VIVO' : connected ? 'CONECTADO' : 'HISTORIAL'}
        </div>
      </div>
    </header>
  );
};
