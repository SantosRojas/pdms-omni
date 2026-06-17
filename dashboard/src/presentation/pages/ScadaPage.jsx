import React, { useCallback, useState, useEffect } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
import {
  Activity, Thermometer, Waves, User, Clock,
  HeartPulse, Droplets, Zap, Beaker, ArrowLeft,
  Monitor, Gauge,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Cylinder } from '../components/Cylinder';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/FeedbackState';
import { StatusBadge } from '../components/StatusBadge';
import { useCylinderConfig } from '../../application/useCylinderConfig';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-lg)',
  background: 'var(--bg-elevated)',
};

const Island = ({ children, style, ...props }) => (
  <div className="glass-panel scada-island" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', ...style }} {...props}>
    {children}
  </div>
);

const IslandHeader = ({ icon: _icon, color, title }) => {
  const Icon = _icon;
  return (
    <div className="scada-island-header">
      <Icon size={18} color={color} />
      <span>{title}</span>
    </div>
  );
};

const FlowBar = ({ label, value, unit, color, max }) => {
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const pct = Math.min(100, (numValue / max) * 100);

  return (
    <div className="scada-flow-bar">
      <div className="scada-flow-bar-header">
        <span className="scada-flow-bar-label">{label}</span>
        <span className="scada-flow-bar-value" style={{ color }}>
          {value} <span className="cylinder-unit">{unit}</span>
        </span>
      </div>
      <div className="scada-flow-bar-track">
        <div className="scada-flow-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const ButtonToggle = ({ showAnyChart, handleToggleView, parameter }) => {
  return (
    <>
      {!showAnyChart ? (
        <ToggleLeft
          size={18}
          onClick={() => handleToggleView(parameter)}
        />
      ) : (
        <ToggleRight
          size={18}
          onClick={() => handleToggleView(parameter)}
        />
      )}
    </>
  );
};

export const ScadaPage = () => {
  const { data, connected } = useTelemetry(true);
  const { serialStatus } = useSerialStatus();
  const { configs } = useCylinderConfig();
  const [therapyStart, setTherapyStart] = useState(null);
  const [showPressChart, setShowPressChart] = useState(false)
  const [showFlowChart, setShowFlowChart] = useState(false)

  useEffect(() => {
    let cancelled = false;
    apiService.getTherapies({ status: 'active', pageSize: 1 })
      .then(result => {
        if (!cancelled && result.therapies?.length > 0) {
          setTherapyStart(result.therapies[0].started_at);
        }
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, []);

  const serialIsRunning = serialStatus.status === 'Running' || serialStatus.status === 'Initializing';
  const hasData = data && data.info;
  const therapyActive = hasData && data.info.g_trmt_main_state_set?.value === '2';

  const handleBack = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  const handleToggleView = (parameter) => {
    switch (parameter) {
      case "pressure": setShowPressChart(!showPressChart)
      case "flow": setShowFlowChart(!showFlowChart)
    }
  }

  if (!connected && !hasData && !serialIsRunning) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <EmptyState icon={Monitor} message="Esperando conexión con el dispositivo..." />
      </div>
    );
  }


  return (
    <div className="app-container">
      <div className="scada-grid">

        {/* ───── Status Bar ───── */}
        <div className="scada-full">
          <Island style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
                <span style={{ fontWeight: 600, color: connected ? 'var(--success)' : 'var(--text-tertiary)' }}>
                  {connected ? 'EN VIVO' : 'DESCONECTADO'}
                </span>
              </div>
              {hasData && data.info.g_trmt_main_state_set?.value !== 'N/A' && (
                <StatusBadge variant={therapyActive ? 'active' : 'warning'}>
                  {data.info.g_trmt_main_state_set.value}
                </StatusBadge>
              )}
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
                Inicio: {therapyStart ? toLocalDatetime(therapyStart) : '---'}
              </span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
                Máquina: {hasData ? data.info.d_serial_number_to_odi?.value || 'N/A' : '---'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {hasData && data.info.c_acc_therapy_time_act && (
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                  <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                  {data.info.c_acc_therapy_time_act.value} {data.info.c_acc_therapy_time_act.unit}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleBack}>
                <ArrowLeft size={14} /> Volver
              </button>
            </div>
          </Island>
        </div>

        {/* ───── Patient Island ───── */}
        <Island style={{ borderTop: '3px solid var(--secondary)' }}>
          <IslandHeader icon={User} color="var(--secondary)" title={`Paciente: ${data.info.g_patient_id_str?.value ?? 'N/A'}`} />
          {hasData ? (
            <>
              <StatCard title="Peso" value={data.info.g_patient_data_weight_set?.value ?? 'N/A'} unit={data.info.g_patient_data_weight_set?.unit} iconName="Activity" color="var(--secondary)" />
              <StatCard title="Modo Terapia" value={data.info.g_therapy_mode_set?.value || 'N/A'} iconName="HeartPulse" color="var(--accent)" />
              <StatCard title="Anticoagulante" value={data.info.g_anticoag_mode_set?.value || 'N/A'} iconName="Beaker" color="#a855f7" />
              <StatCard title="Dosis renal" value={data.info.d_renal_dose_act?.value ?? 'N/A'} unit={data.info.d_renal_dose_act?.unit} iconName="Zap" color="#f97316" />
              <StatCard title="Tiempo de terapia" value={data.info.c_acc_therapy_time_act?.value ?? 'N/A'} unit={data.info.c_acc_therapy_time_act?.unit} iconName="Clock" color="var(--primary)" />
            </>
          ) : (
            <div className="empty-state" style={{ padding: '12px' }}><span>Esperando datos...</span></div>
          )}
        </Island>

        {/* ───── Pressures Island ───── */}
        <Island style={{ borderTop: '3px solid var(--art-color)' }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <IslandHeader icon={showPressChart ? Thermometer : Waves} color="var(--art-color)" title="Presiones" />
            <ButtonToggle
              showAnyChart={showPressChart}
              handleToggleView={handleToggleView}
              parameter={"pressure"}
            />
          </div>
          {
            !showPressChart ? (
              <>{connected && data.pressures ? (
                <div className="scada-cylinder-2x2">
                  <Cylinder label="Arterial" value={data.pressures.c_press_ap_act.value} unit={data.pressures.c_press_ap_act.unit} config={configs.arterial} colorVar="--art-color" />
                  <Cylinder label="Venoso" value={data.pressures.c_press_vp_act.value} unit={data.pressures.c_press_vp_act.unit} config={configs.venoso} colorVar="--ven-color" />
                  <Cylinder label="TMP" value={data.pressures.c_press_tmp_act.value} unit={data.pressures.c_press_tmp_act.unit} config={configs.tmp} colorVar="--tmp-color" />
                  <Cylinder label="Filtro" value={data.pressures.c_press_fp_act.value} unit={data.pressures.c_press_fp_act.unit} config={configs.filtro} colorVar="--fil-color" />
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '12px' }}><span>Esperando datos...</span></div>
              )}
              </>
            ) : (
              <>
                {data.history && data.history.length > 1 ? (
                  <div style={{ width: '100%', height: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                        <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }} />
                        <Legend />
                        <Line type="monotone" dataKey="c_press_ap_act" stroke="var(--art-color)" name="Arterial" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="c_press_vp_act" stroke="var(--ven-color)" name="Venoso" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="c_press_tmp_act" stroke="var(--tmp-color)" name="TMP" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="c_press_fp_act" stroke="var(--fil-color)" name="Filtro" dot={false} strokeWidth={2} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <span>{data.history && data.history.length === 1 ? 'Acumulando más datos...' : 'Esperando datos de presiones...'}</span>
                  </div>
                )}
              </>
            )
          }
        </Island>

        <div style={{ display: "flex", gap: "1rem", flexDirection: "column", alignContent: "space-between" }}>
          <Island style={{ borderTop: '3px solid var(--art-color)' }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <IslandHeader icon={showFlowChart ? Gauge : Waves} color="var(--art-color)" title="Presiones" />
              <ButtonToggle
                showAnyChart={showFlowChart}
                handleToggleView={handleToggleView}
                parameter={"flow"}
              />
            </div>
            {
              !showFlowChart ? (
                <>{connected && data.flows ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <FlowBar label="Sanguíneo" value={data.flows.c_pump_bs_bl_flow_act.value} unit={data.flows.c_pump_bs_bl_flow_act.unit} color="var(--art-color)" max={400} />
                    <FlowBar label="Diálisis" value={data.flows.c_pump_fs_mid_flow_act.value} unit={data.flows.c_pump_fs_mid_flow_act.unit} color="var(--tmp-color)" max={600} />
                    <FlowBar label="Rem. Neta" value={data.flows.c_net_rem_flow_act.value} unit={data.flows.c_net_rem_flow_act.unit} color="var(--fil-color)" max={1000} />
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '12px' }}><span>Esperando datos...</span></div>
                )}
                </>
              ) : (
                <>
                  {data.history && data.history.length > 1 ? (
                    <div style={{ width: '100%', height: '200px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                          <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }} />
                          <Legend />
                          <Line type="monotone" dataKey="c_pump_bs_bl_flow_act" stroke="var(--art-color)" name="Flujo Sanguíneo" dot={false} strokeWidth={2} isAnimationActive={false} />
                          <Line type="monotone" dataKey="c_pump_fs_mid_flow_act" stroke="var(--tmp-color)" name="Flujo Diálisis" dot={false} strokeWidth={2} isAnimationActive={false} />
                          <Line type="monotone" dataKey="c_net_rem_flow_act" stroke="var(--fil-color)" name="Rem. Neta" dot={false} strokeWidth={2} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '24px' }}>
                      <span>{data.history && data.history.length === 1 ? 'Acumulando más datos...' : 'Esperando datos de flujos...'}</span>
                    </div>
                  )}
                </>
              )
            }
          </Island>


          {/* ───── Acumulative  ───── */}
          <Island style={{ borderTop: '3px solid var(--primary)' }}>
            <IslandHeader icon={Gauge} color="var(--primary)" title="Acumulados" />
            {hasData ? (
              <div className="scada-stats-row">
                <StatCard title="Tiempo de terapia" value={data.info.c_acc_therapy_time_act?.value ?? 'N/A'} unit={data.info.c_acc_therapy_time_act?.unit} iconName="Clock" color="var(--primary)" />
                <StatCard title="Eliminación neta" value={data.info.c_acc_net_rem_vol_act?.value ?? 'N/A'} unit={data.info.c_acc_net_rem_vol_act?.unit} iconName="Droplets" color="#22d3ee" />
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '12px' }}><span>Esperando datos...</span></div>
            )}
          </Island>
        </div>
      </div>
    </div>
  );
};
