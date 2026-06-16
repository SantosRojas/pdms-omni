import React, { memo } from 'react';
import { User, Clock } from 'lucide-react';
import { StatCard } from './StatCard';
import { toLocalDatetime } from '../../infrastructure/time';

export const GeneralInfo = memo(({ selectedTherapy, therapyIsActive, isPreTherapy, data }) => {
  const hasData = data && data.info;

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 className="section-title">
        <User size={20} color="var(--secondary)" /> Información General
      </h3>
      {selectedTherapy && (
        <>
          <StatCard title="Paciente" value={selectedTherapy.patient_id_str} iconName="Contact" color="#0ea5e9" />
          <StatCard title="Estado de la terapia" value={selectedTherapy.status} iconName="Activity" color={therapyIsActive ? '#10b981' : 'var(--text-tertiary)'} />
          <StatCard title="Inicio de la terapia" value={toLocalDatetime(selectedTherapy.started_at)} iconName="Clock" color="var(--primary)" />
          <StatCard title="Fin de la terapia" value={selectedTherapy.ended_at ? toLocalDatetime(selectedTherapy.ended_at) : 'En progreso'} iconName="Clock" color="#f97316" />
        </>
      )}
      {isPreTherapy ? (
        hasData ? (
          <>
            <StatCard title="Estado del sistema" value={data.info.g_trmt_main_state_set.value} iconName="Activity" color="#10b981" />
            <StatCard title="Peso del paciente" value={data.info.g_patient_data_weight_set.value} unit={data.info.g_patient_data_weight_set.unit} iconName="Activity" color="var(--secondary)" />
            <StatCard title="Modo de terapia" value={data.info.g_therapy_mode_set.value} iconName="HeartPulse" color="var(--accent)" />
            <StatCard title="Anticoagulante" value={data.info.g_anticoag_mode_set.value} iconName="Beaker" color="#a855f7" />
          </>
        ) : (
          <div className="empty-state" style={{ padding: '12px' }}>
            <span>Esperando datos del dispositivo...</span>
          </div>
        )
      ) : therapyIsActive ? (
        hasData ? (
          <>
            <StatCard title="Peso del paciente" value={data.info.g_patient_data_weight_set.value} unit={data.info.g_patient_data_weight_set.unit} iconName="Activity" color="var(--secondary)" />
            <StatCard title="Estado del sistema" value={data.info.g_trmt_main_state_set.value} iconName="Activity" color="#10b981" />
            <StatCard title="Modo de terapia" value={data.info.g_therapy_mode_set.value} iconName="HeartPulse" color="var(--accent)" />
            <StatCard title="Anticoagulante" value={data.info.g_anticoag_mode_set.value} iconName="Beaker" color="#a855f7" />
            <StatCard title="Dosis renal" value={data.info.d_renal_dose_act.value} unit={data.info.d_renal_dose_act.unit} iconName="Zap" color="#f97316" />
            <StatCard title="Tiempo de terapia" value={data.info.c_acc_therapy_time_act.value} unit={data.info.c_acc_therapy_time_act.unit} iconName="Clock" color="var(--primary)" />
            <StatCard title="Eliminación neta acumulada" value={data.info.c_acc_net_rem_vol_act.value} unit={data.info.c_acc_net_rem_vol_act.unit} iconName="Droplets" color="#22d3ee" />
          </>
        ) : (
          <div className="empty-state" style={{ padding: '12px' }}>
            <span>Cargando telemetría...</span>
          </div>
        )
      ) : selectedTherapy && (
        <div className="empty-state" style={{ padding: '24px' }}>
          <span>Esta terapia ya terminó. Los valores en vivo se ocultaron para evitar mezclar historial con telemetría en tiempo real.</span>
        </div>
      )}
    </div>
  );
});
