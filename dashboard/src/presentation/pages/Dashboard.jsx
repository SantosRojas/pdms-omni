import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { toLocalTimeOnly, toLocalDate, toLocalDatetime } from '../../infrastructure/time';
import { Cylinder } from '../components/Cylinder';
import { StatCard } from '../components/StatCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Activity, Droplets, Thermometer, Wind, User, Clock, Database, TrendingUp, ChevronRight, Search, X, Play, Square, AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard = ({ user, onNavigateHistory }) => {
  const [therapies, setTherapies] = useState([]);
  const [selectedTherapyId, setSelectedTherapyId] = useState('');
  const [therapyError, setTherapyError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const { serialStatus, loading: serialLoading, error: serialError, startReader, stopReader } = useSerialStatus();

  const canControlSerial = user.role === 'admin' || user.role === 'operator';

  const therapiesSorted = useMemo(
    () => [...therapies].sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')) || (b.id - a.id)),
    [therapies]
  );

  const activeTherapyIds = useMemo(() => {
    const latestOpenByPair = new Map();
    for (const therapy of therapiesSorted) {
      const isOpen = !therapy.ended_at && therapy.status !== 'completed';
      if (!isOpen) continue;
      const pairKey = `${therapy.patient_id_str}::${therapy.serial_number}`;
      const current = latestOpenByPair.get(pairKey);
      if (!current || String(therapy.started_at || '') > String(current.started_at || '')) {
        latestOpenByPair.set(pairKey, therapy);
      }
    }
    return new Set([...latestOpenByPair.values()].map(therapy => String(therapy.id)));
  }, [therapiesSorted]);

  const machineGroups = useMemo(() => {
    const groups = new Map();
    for (const therapy of therapiesSorted) {
      const machineKey = String(therapy.machine_id);
      if (groups.has(machineKey)) {
        groups.get(machineKey).therapies.push(therapy);
        continue;
      }
      groups.set(machineKey, {
        key: machineKey,
        machine_id: therapy.machine_id,
        serial_number: therapy.serial_number,
        software_version: therapy.software_version,
        therapies: [therapy],
      });
    }
    return [...groups.values()].sort((left, right) => {
      return String(right.therapies[0]?.started_at || '').localeCompare(String(left.therapies[0]?.started_at || '')) || (right.machine_id - left.machine_id);
    });
  }, [therapiesSorted]);

  const filteredMachineGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return machineGroups;
    return machineGroups
      .map(machine => {
        const therapies = machine.therapies.filter(therapy => {
          const haystack = [
            machine.serial_number, machine.software_version, machine.machine_id,
            therapy.id, therapy.patient_id_str, therapy.started_at,
            therapy.ended_at || '', therapy.status,
          ].map(v => String(v ?? '').toLowerCase()).join(' ');
          return haystack.includes(query);
        });
        return therapies.length > 0 ? { ...machine, therapies } : null;
      })
      .filter(Boolean);
  }, [machineGroups, searchQuery]);

  const selectedTherapy = useMemo(
    () => therapies.find(t => String(t.id) === String(selectedTherapyId)) || null,
    [therapies, selectedTherapyId]
  );
  const selectedTherapyIsOpen = !!selectedTherapy && !selectedTherapy.ended_at && selectedTherapy.status !== 'completed';
  const therapyIsActive = !!selectedTherapy && activeTherapyIds.has(String(selectedTherapy.id));

  const { data, connected } = useTelemetry(selectedTherapy?.id, therapyIsActive);

  // ── Accumulated therapy chart ──
  const [accData, setAccData] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState(null);
  const [accDate, setAccDate] = useState('');

  const fetchAccData = useCallback(async () => {
    if (!selectedTherapyId) return;
    setAccLoading(true);
    setAccError(null);
    try {
      const rows = await apiService.getTherapyHistory(Number(selectedTherapyId), 5000);
      const byTs = {};
      rows.forEach(r => {
        if (typeof r.physical_value !== 'number') return;
        if (!byTs[r.timestamp]) byTs[r.timestamp] = { time: r.timestamp };
        byTs[r.timestamp][r.internal_name] = r.physical_value;
      });
      const sorted = Object.values(byTs).sort((a, b) => a.time.localeCompare(b.time));
      const withTimeOnly = sorted.map(p => ({
        ...p,
        timeOnly: toLocalTimeOnly(p.time),
      }));
      const therapyDate = toLocalDate(sorted[0]?.time);
      setAccDate(therapyDate);
      setAccData(withTimeOnly);
    } catch (e) {
      setAccError(e.message);
    } finally {
      setAccLoading(false);
    }
  }, [selectedTherapyId]);

  useEffect(() => {
    if (selectedTherapyId && therapyIsActive) {
      fetchAccData();
    } else {
      setAccData([]);
    }
  }, [selectedTherapyId, therapyIsActive, fetchAccData]);

  const hasAccData = accData.length > 1;

  useEffect(() => {
    apiService.getTherapies()
      .then(list => setTherapies(list))
      .catch(e => setTherapyError(e.message));
  }, []);

  return (
    <div className="app-container">
      {!selectedTherapy ? (
        <>
          {/* ── Therapy Selection View ── */}
          <div className="glass-panel animate-slide-up" style={{ padding: '28px', display: 'grid', gap: '24px' }}>
            <div>
              <div className="header-title">
                <Activity color="var(--primary)" size={28} />
                OMNI Real-Time
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Selecciona una terapia para ver su historial y, si sigue activa, la telemetría en vivo.
              </p>
            </div>

            {/* Serial Panel */}
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

              {canControlSerial && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(serialStatus.status === 'Stopped' || serialStatus.status === 'FailedLimit' || serialStatus.status === 'Unknown') && (
                    <button
                      className="btn btn-success"
                      onClick={() => therapies.length > 0 ? setShowStartModal(true) : startReader(true)}
                      disabled={serialLoading}
                      style={{ opacity: serialLoading ? 0.6 : 1 }}
                    >
                      <Play size={14} /> Iniciar
                    </button>
                  )}
                  {(serialStatus.status === 'Running' || serialStatus.status === 'Initializing') && (
                    <button
                      className="btn btn-danger"
                      onClick={stopReader}
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

            {therapyError && (
              <div className="message-box message-error">
                No se pudieron cargar las terapias: {therapyError}
              </div>
            )}

            {/* Search */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por máquina, paciente, terapia o fecha"
                  style={{ paddingLeft: '38px' }}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="search-clear" aria-label="Limpiar">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                {filteredMachineGroups.length} máquina{filteredMachineGroups.length === 1 ? '' : 's'}
              </div>
            </div>

            {/* Machine Groups */}
            <div style={{ display: 'grid', gap: '14px' }}>
              {filteredMachineGroups.length > 0 ? filteredMachineGroups.map(machine => {
                const activeTherapies = machine.therapies.filter(t => activeTherapyIds.has(String(t.id)));
                const openTherapies = machine.therapies.filter(t => !t.ended_at && t.status !== 'completed');

                return (
                  <details key={machine.key} className="machine-details">
                    <summary>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1rem' }}>Máquina {machine.serial_number}</strong>
                          <span className={`badge ${activeTherapies.length ? 'badge-active' : openTherapies.length ? 'badge-open' : 'badge-closed'}`}>
                            {activeTherapies.length ? `${activeTherapies.length} activa${activeTherapies.length > 1 ? 's' : ''}`
                              : openTherapies.length ? `${openTherapies.length} sin cerrar`
                                : 'Sin actividad'}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                          SW {machine.software_version} · {machine.therapies.length} terapia{machine.therapies.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.18s' }} />
                    </summary>

                    <div style={{ padding: '20px', display: 'grid', gap: '12px' }}>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Selecciona una terapia de esta máquina:</div>
                      <div className="card-grid">
                        {machine.therapies.map(therapy => {
                          const isOpen = !therapy.ended_at && therapy.status !== 'completed';
                          const active = activeTherapyIds.has(String(therapy.id));
                          const badgeLabel = active ? 'Activa' : isOpen ? 'Sin cerrar' : 'Finalizada';

                          return (
                            <button
                              key={therapy.id}
                              className="detail-card animate-fade-in"
                              onClick={() => setSelectedTherapyId(String(therapy.id))}
                              style={{ textAlign: 'left', display: 'grid', gap: '10px' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
                                    Terapia #{therapy.id}
                                  </div>
                                  <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>
                                    {therapy.patient_id_str}
                                  </div>
                                </div>
                                <span className={`badge ${active ? 'badge-active' : isOpen ? 'badge-open' : 'badge-closed'}`}>
                                  {badgeLabel}
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                                Inició: {toLocalDatetime(therapy.started_at)}
                              </div>
                              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                                {therapy.ended_at ? toLocalDatetime(therapy.ended_at) : 'Aún sin cierre'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                );
              }) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Search size={20} />
                  </div>
                  <span>No se encontraron máquinas ni terapias para esa búsqueda.</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── Live View Header ── */}
          <header className="glass-panel page-header animate-slide-up">
            <div className="page-header-left">
              <div className="header-title">
                <Activity color="var(--primary)" size={28} />
                OMNI Real-Time
              </div>
            </div>

            <div className="page-header-right">
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTherapyId('')}>
                Cambiar terapia
              </button>

              <button
                className="btn btn-sm"
                style={{
                  background: 'var(--btn-nav-history)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  color: 'var(--btn-nav-history-text)',
                }}
                onClick={() => onNavigateHistory(selectedTherapy)}
              >
                <Database size={14} /> History
              </button>

              <ThemeToggle />

              <div className="connection-status">
                <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
                {therapyIsActive && connected ? 'LIVE' : 'HISTORY'}
              </div>
            </div>
          </header>

          {/* Selected Therapy Info */}
          <div className="glass-panel animate-fade-in" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Terapia seleccionada
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                {selectedTherapy.patient_id_str} · Máquina {selectedTherapy.serial_number}
              </div>
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
              {therapyIsActive ? 'Terapia en curso: se muestran datos en tiempo real y el historial.'
                : selectedTherapyIsOpen ? 'Sesión abierta sin cierre: solo se muestra historial.'
                : 'Terapia finalizada: sólo historial disponible.'}
            </div>
          </div>

          {/* Main Grid */}
          <div className="dashboard-grid">
            {/* Left Panel */}
            <div className="side-panel">
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 className="section-title">
                  <User size={20} color="var(--secondary)" /> General Information
                </h3>
                <StatCard title="Patient ID" value={selectedTherapy.patient_id_str} iconName="Contact" color="#0ea5e9" />
                <StatCard title="Machine Serial" value={selectedTherapy.serial_number} iconName="HardDrive" color="#eab308" />
                <StatCard title="Machine SW" value={selectedTherapy.software_version} iconName="Server" color="var(--secondary)" />
                <StatCard title="Therapy Status" value={selectedTherapy.status} iconName="Activity" color={therapyIsActive ? '#10b981' : 'var(--text-tertiary)'} />
                <StatCard title="Therapy Started" value={toLocalDatetime(selectedTherapy.started_at)} iconName="Clock" color="var(--primary)" />
                <StatCard title="Therapy Ended" value={selectedTherapy.ended_at ? toLocalDatetime(selectedTherapy.ended_at) : 'In progress'} iconName="Clock" color="#f97316" />
                {therapyIsActive ? (
                  <>
                    <StatCard title="Patient Weight" value={data.info.g_patient_data_weight_set.value} unit={data.info.g_patient_data_weight_set.unit} iconName="Activity" color="var(--secondary)" />
                    <StatCard title="System State" value={data.info.g_trmt_main_state_set.value} iconName="Activity" color="#10b981" />
                    <StatCard title="Therapy Mode" value={data.info.g_therapy_mode_set.value} iconName="HeartPulse" color="var(--accent)" />
                    <StatCard title="Anticoagulant" value={data.info.g_anticoag_mode_set.value} iconName="Beaker" color="#a855f7" />
                    <StatCard title="Renal Dose" value={data.info.d_renal_dose_act.value} unit={data.info.d_renal_dose_act.unit} iconName="Zap" color="#f97316" />
                    <StatCard title="Therapy Time" value={data.info.c_acc_therapy_time_act.value} unit={data.info.c_acc_therapy_time_act.unit} iconName="Clock" color="var(--primary)" />
                    <StatCard title="Acc. Net Removal" value={data.info.c_acc_net_rem_vol_act.value} unit={data.info.c_acc_net_rem_vol_act.unit} iconName="Droplets" color="#22d3ee" />
                  </>
                ) : (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <span>Esta terapia ya terminó. Los valores en vivo se ocultaron para evitar mezclar historial con telemetría en tiempo real.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="main-panel">
              {therapyIsActive ? (
                <>
                  {/* Flow Dynamics */}
                  <div className="glass-panel animate-slide-up" style={{ padding: '24px' }}>
                    <h3 className="section-title">
                      <Droplets size={20} color="var(--primary)" /> Flow Dynamics
                    </h3>
                    <div className="card-grid-3">
                      <StatCard title="Blood Flow" value={data.flows.c_pump_bs_bl_flow_act.value} unit={data.flows.c_pump_bs_bl_flow_act.unit} iconName="HeartPulse" color="var(--art-color)" />
                      <StatCard title="Dialysate Flow" value={data.flows.c_pump_fs_mid_flow_act.value} unit={data.flows.c_pump_fs_mid_flow_act.unit} iconName="Droplets" color="var(--tmp-color)" />
                      <StatCard title="Net Removal" value={data.flows.c_net_rem_flow_act.value} unit={data.flows.c_net_rem_flow_act.unit} iconName="Wind" color="var(--fil-color)" />
                    </div>
                  </div>

                  {/* Pressures */}
                  <div className="glass-panel animate-slide-up" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 className="section-title">
                      <Thermometer size={20} color="var(--accent)" /> Real-Time Pressures
                    </h3>

                    {/* Cylinder Gauges */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', marginBottom: '40px', minHeight: '200px', paddingTop: '16px' }}>
                      <Cylinder label="Arterial (AP)" value={data.pressures.c_press_ap_act.value} unit={data.pressures.c_press_ap_act.unit} max={500} min={-400} colorVar="--art-color" />
                      <Cylinder label="Venous (VP)" value={data.pressures.c_press_vp_act.value} unit={data.pressures.c_press_vp_act.unit} max={300} min={-400} colorVar="--ven-color" />
                      <Cylinder label="TMP (PTM)" value={data.pressures.c_press_tmp_act.value} unit={data.pressures.c_press_tmp_act.unit} max={80} min={0} colorVar="--tmp-color" />
                      <Cylinder label="Filter (FP)" value={data.pressures.c_press_fp_act.value} unit={data.pressures.c_press_fp_act.unit} max={500} min={0} colorVar="--fil-color" />
                    </div>

                    {/* Time Series Chart */}
                    <div style={{ flex: 1, minHeight: '300px', width: '100%', marginTop: 'auto', borderTop: '1px solid var(--border-default)' }}>
                      <h4 className="section-title" style={{ marginTop: '20px', border: 'none', padding: '0 0 16px' }}>
                        <TrendingUp size={16} /> Pressure Trends (Time Series)
                      </h4>
                      <div style={{ width: '100%', height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data.history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                            <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid var(--border-default)',
                                boxShadow: 'var(--shadow-lg)',
                                background: 'var(--bg-elevated)',
                              }}
                              labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="c_press_ap_act" stroke="var(--art-color)" name="Arterial" dot={false} strokeWidth={3} animationDuration={300} />
                            <Line type="monotone" dataKey="c_press_vp_act" stroke="var(--ven-color)" name="Venous" dot={false} strokeWidth={3} animationDuration={300} />
                            <Line type="monotone" dataKey="c_press_tmp_act" stroke="var(--tmp-color)" name="TMP" dot={false} strokeWidth={3} animationDuration={300} />
                            <Line type="monotone" dataKey="c_press_fp_act" stroke="var(--fil-color)" name="Filter" dot={false} strokeWidth={3} animationDuration={300} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* ── Accumulated Therapy Chart ── */}
                  <div className="glass-panel animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
                        <Database size={20} color="var(--primary)" /> Therapy Accumulated Trends
                        {accDate && <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '8px' }}>{accDate}</span>}
                      </h3>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={fetchAccData}
                        disabled={accLoading}
                        title="Refresh accumulated data"
                      >
                        <RefreshCw size={14} style={{ animation: accLoading ? 'spin 1s linear infinite' : 'none' }} />
                        Actualizar
                      </button>
                    </div>

                    {accError && (
                      <div className="message-box message-error" style={{ marginBottom: '12px' }}>
                        {accError}
                      </div>
                    )}

                    {accLoading && !hasAccData && (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px' }} />
                        Cargando datos acumulados...
                      </div>
                    )}

                    {!accLoading && !hasAccData && !accError && (
                      <div className="empty-state" style={{ padding: '32px' }}>
                        <Database size={24} style={{ opacity: 0.3 }} />
                        <span>No hay datos históricos suficientes para esta terapia.</span>
                      </div>
                    )}

                    {hasAccData && (
                      <div style={{ width: '100%', height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={accData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                            <XAxis dataKey="timeOnly" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid var(--border-default)',
                                boxShadow: 'var(--shadow-lg)',
                                background: 'var(--bg-elevated)',
                              }}
                              labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                            />
                            <Legend />
                            {accData.some(d => d.c_acc_net_rem_vol_act !== undefined) && (
                              <Line type="monotone" dataKey="c_acc_net_rem_vol_act" stroke="#22d3ee" name="Acc. Net Removal" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.c_acc_therapy_time_act !== undefined) && (
                              <Line type="monotone" dataKey="c_acc_therapy_time_act" stroke="var(--primary)" name="Therapy Time" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.d_renal_dose_act !== undefined) && (
                              <Line type="monotone" dataKey="d_renal_dose_act" stroke="#a855f7" name="Renal Dose" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.c_net_rem_flow_act !== undefined) && (
                              <Line type="monotone" dataKey="c_net_rem_flow_act" stroke="var(--fil-color)" name="Net Removal Flow" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.c_press_ap_act !== undefined) && (
                              <Line type="monotone" dataKey="c_press_ap_act" stroke="var(--art-color)" name="Arterial" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.c_press_vp_act !== undefined) && (
                              <Line type="monotone" dataKey="c_press_vp_act" stroke="var(--ven-color)" name="Venous" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.c_press_tmp_act !== undefined) && (
                              <Line type="monotone" dataKey="c_press_tmp_act" stroke="var(--tmp-color)" name="TMP" dot={false} strokeWidth={2} />
                            )}
                            {accData.some(d => d.c_press_fp_act !== undefined) && (
                              <Line type="monotone" dataKey="c_press_fp_act" stroke="var(--fil-color)" name="Filter" dot={false} strokeWidth={2} />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="glass-panel empty-state" style={{ padding: '48px' }}>
                  <Database size={32} style={{ opacity: 0.3 }} />
                  <span>La terapia seleccionada ya finalizó. Sólo se mostrará el historial desde la vista de terapia.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Start Serial Modal ── */}
      {showStartModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowStartModal(false)}>
          <div className="modal-content modal-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Radio size={20} color="var(--primary)" />
                Iniciar lectura serial
              </h3>
              <button onClick={() => setShowStartModal(false)} className="modal-close">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              El puerto serial está detenido. Selecciona cómo deseas inicializar la sesión de lectura para la máquina conectada:
            </p>

            {therapiesSorted[0] && (
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
                    <span style={{ fontWeight: 500 }}>{therapiesSorted[0].patient_id_str || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.75rem' }}>Nº Serie Máquina</span>
                    <span style={{ fontWeight: 500 }}>{therapiesSorted[0].serial_number || 'N/A'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.75rem' }}>Inicio</span>
                    <span style={{ fontWeight: 500 }}>{toLocalDatetime(therapiesSorted[0].started_at) || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={() => { startReader(true); setShowStartModal(false); }}
                style={{ justifyContent: 'center', padding: '12px 20px' }}
              >
                Crear nueva terapia
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => { startReader(false); setShowStartModal(false); }}
                style={{ justifyContent: 'center', padding: '12px 20px' }}
              >
                Continuar terapia actual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
