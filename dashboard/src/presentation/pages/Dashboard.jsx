import React, { useState, useEffect, useMemo } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { useSerialStatus } from '../../application/useSerialStatus';
import { apiService } from '../../infrastructure/api';
import { Cylinder } from '../components/Cylinder';
import { StatCard } from '../components/StatCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Activity, Droplets, Thermometer, Wind, User, Clock, Database, TrendingUp, ChevronRight, Search, X, Play, Square, AlertTriangle, Radio } from 'lucide-react';
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
      const current = groups.get(machineKey);
      const machineInfo = {
        machine_id: therapy.machine_id,
        serial_number: therapy.serial_number,
        software_version: therapy.software_version,
      };

      if (current) {
        current.therapies.push(therapy);
        continue;
      }

      groups.set(machineKey, {
        key: machineKey,
        ...machineInfo,
        therapies: [therapy],
      });
    }

    return [...groups.values()].sort((left, right) => {
      const leftTherapy = left.therapies[0];
      const rightTherapy = right.therapies[0];
      return String(rightTherapy?.started_at || '').localeCompare(String(leftTherapy?.started_at || '')) || (right.machine_id - left.machine_id);
    });
  }, [therapiesSorted]);

  const filteredMachineGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return machineGroups;

    return machineGroups
      .map(machine => {
        const therapies = machine.therapies.filter(therapy => {
          const haystack = [
            machine.serial_number,
            machine.software_version,
            machine.machine_id,
            therapy.id,
            therapy.patient_id_str,
            therapy.started_at,
            therapy.ended_at || '',
            therapy.status,
          ]
            .map(value => String(value ?? '').toLowerCase())
            .join(' ');

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

  useEffect(() => {
    apiService.getTherapies()
      .then(list => {
        setTherapies(list);
      })
      .catch((e) => {
        setTherapyError(e.message);
      });
  }, []);

  const navBtnStyle = (bg, color) => ({
    background: bg, border: `1px solid ${color}30`,
    color, padding: '7px 14px', borderRadius: '10px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '0.8rem', fontFamily: 'var(--font-family)', fontWeight: 500,
    transition: 'all 0.2s',
  });

  return (
    <div className="app-container">
      {!selectedTherapy ? (
        <div className="glass-panel" style={{ padding: '28px', display: 'grid', gap: '20px' }}>
          <div>
            <div className="header-title">
              <Activity color="var(--primary)" size={28} />
              OMNI Real-Time
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
              Selecciona una terapia para ver su historial y, si sigue activa, la telemetría en vivo.
            </p>
          </div>

          {/* ── Serial Reader Control Panel ── */}
          <div style={{
            background: serialStatus.status === 'FailedLimit' ? 'rgba(239,68,68,0.08)'
              : serialStatus.status === 'Running' ? 'rgba(16,185,129,0.06)'
                : 'var(--btn-bg)',
            border: `1px solid ${serialStatus.status === 'FailedLimit' ? 'rgba(239,68,68,0.3)'
              : serialStatus.status === 'Running' ? 'rgba(16,185,129,0.25)'
                : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            transition: 'all 0.3s ease',
          }}>
            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: '200px' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: serialStatus.status === 'Running' ? '#10b981'
                  : serialStatus.status === 'Initializing' ? '#f59e0b'
                    : serialStatus.status === 'FailedLimit' ? '#ef4444'
                      : '#64748b',
                boxShadow: serialStatus.status === 'Running' ? '0 0 8px rgba(16,185,129,0.5)'
                  : serialStatus.status === 'Initializing' ? '0 0 8px rgba(245,158,11,0.5)'
                    : 'none',
                animation: (serialStatus.status === 'Running' || serialStatus.status === 'Initializing') ? 'pulse 2s infinite' : 'none',
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio size={14} />
                  Puerto Serial
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {serialStatus.status === 'Running' && 'Lectura activa'}
                  {serialStatus.status === 'Initializing' && 'Inicializando dispositivo...'}
                  {serialStatus.status === 'Stopped' && 'Lectura detenida'}
                  {serialStatus.status === 'FailedLimit' && `Lectura suspendida tras ${serialStatus.max_failures} fallos consecutivos`}
                  {serialStatus.status === 'Unknown' && 'Estado desconocido'}
                </div>
              </div>
            </div>

            {/* Failure counter */}
            {serialStatus.consecutive_failures > 0 && serialStatus.status !== 'FailedLimit' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '999px',
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                fontSize: '0.78rem', fontWeight: 500,
              }}>
                <AlertTriangle size={13} />
                {serialStatus.consecutive_failures}/{serialStatus.max_failures} fallos
              </div>
            )}

            {serialStatus.status === 'FailedLimit' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '999px',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                fontSize: '0.78rem', fontWeight: 500,
              }}>
                <AlertTriangle size={13} />
                Límite alcanzado ({serialStatus.max_failures})
              </div>
            )}

            {/* Controls */}
            {canControlSerial && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {(serialStatus.status === 'Stopped' || serialStatus.status === 'FailedLimit' || serialStatus.status === 'Unknown') && (
                  <button
                    onClick={() => {
                      if (therapies.length > 0) {
                        setShowStartModal(true);
                      } else {
                        startReader(true);
                      }
                    }}
                    disabled={serialLoading}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none', color: '#fff',
                      padding: '8px 18px', borderRadius: '12px',
                      cursor: serialLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.82rem', fontWeight: 600,
                      opacity: serialLoading ? 0.6 : 1,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                    }}
                  >
                    <Play size={14} /> Iniciar
                  </button>
                )}
                {(serialStatus.status === 'Running' || serialStatus.status === 'Initializing') && (
                  <button
                    onClick={stopReader}
                    disabled={serialLoading}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none', color: '#fff',
                      padding: '8px 18px', borderRadius: '12px',
                      cursor: serialLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.82rem', fontWeight: 600,
                      opacity: serialLoading ? 0.6 : 1,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
                    }}
                  >
                    <Square size={14} /> Detener
                  </button>
                )}
              </div>
            )}

            {serialError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.8rem', width: '100%' }}>
                Error: {serialError}
              </div>
            )}
          </div>

          {therapyError && (
            <div style={{ color: 'var(--danger)' }}>No se pudieron cargar las terapias: {therapyError}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por máquina, paciente, terapia o fecha"
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px 42px 12px 38px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  fontSize: '0.95rem',
                  fontFamily: 'var(--font-family)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar buscador"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {filteredMachineGroups.length} máquina{filteredMachineGroups.length === 1 ? '' : 's'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {filteredMachineGroups.length > 0 ? filteredMachineGroups.map(machine => {
              const activeTherapies = machine.therapies.filter(therapy => activeTherapyIds.has(String(therapy.id)));
              const openTherapies = machine.therapies.filter(therapy => !therapy.ended_at && therapy.status !== 'completed');

              return (
                <details
                  key={machine.key}
                  style={{
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '18px',
                    overflow: 'hidden',
                  }}
                >
                  <summary style={{
                    listStyle: 'none',
                    cursor: 'pointer',
                    padding: '18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '14px',
                    color: 'var(--text-main)',
                    userSelect: 'none',
                  }}>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1rem' }}>Máquina {machine.serial_number}</strong>
                        <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '999px', background: activeTherapies.length ? 'rgba(16,185,129,0.15)' : openTherapies.length ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)', color: activeTherapies.length ? '#34d399' : openTherapies.length ? '#f59e0b' : 'var(--text-muted)' }}>
                          {activeTherapies.length ? `${activeTherapies.length} activa${activeTherapies.length > 1 ? 's' : ''}` : openTherapies.length ? `${openTherapies.length} sin cerrar` : 'Sin actividad'}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>SW {machine.software_version} · {machine.therapies.length} terapia{machine.therapies.length > 1 ? 's' : ''}</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', transition: 'transform 0.18s' }} />
                  </summary>

                  <div style={{ borderTop: '1px solid var(--border)', padding: '18px', display: 'grid', gap: '12px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Selecciona una terapia de esta máquina:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      {machine.therapies.map(therapy => {
                        const isOpen = !therapy.ended_at && therapy.status !== 'completed';
                        const active = activeTherapyIds.has(String(therapy.id));
                        const badgeLabel = active ? 'Activa' : isOpen ? 'Sin cerrar' : 'Finalizada';

                        return (
                          <button
                            key={therapy.id}
                            onClick={() => setSelectedTherapyId(String(therapy.id))}
                            style={{
                              textAlign: 'left',
                              background: 'var(--panel-bg, rgba(255,255,255,0.04))',
                              border: '1px solid var(--border)',
                              borderRadius: '16px',
                              padding: '16px',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              transition: 'transform 0.18s, border-color 0.18s',
                              display: 'grid',
                              gap: '10px',
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = 'var(--primary)';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Terapia #{therapy.id}</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>{therapy.patient_id_str}</div>
                              </div>
                              <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', background: active ? 'rgba(16,185,129,0.15)' : isOpen ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)', color: active ? '#34d399' : isOpen ? '#f59e0b' : 'var(--text-muted)' }}>
                                {badgeLabel}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              Inició: {therapy.started_at}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {therapy.ended_at || 'Aún sin cierre'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            }) : (
              <div style={{ padding: '20px', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)' }}>
                No se encontraron máquinas ni terapias para esa búsqueda.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="glass-panel header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="header-title">
              <Activity color="var(--primary)" size={28} />
              OMNI Real-Time
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedTherapyId('')} style={navBtnStyle('var(--btn-bg)', 'var(--text-main)')}>
                Cambiar terapia
              </button>

              <button onClick={() => onNavigateHistory(selectedTherapy)} style={navBtnStyle('var(--btn-nav-history)', 'var(--btn-nav-history-text)')}>
                <Database size={14} /> History
              </button>

              <ThemeToggle />

              {/* Status */}
              <div className="connection-status">
                <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
                {therapyIsActive && connected ? 'LIVE' : 'HISTORY'}
              </div>
            </div>
          </header>

          <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Terapia seleccionada</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedTherapy.patient_id_str} · Máquina {selectedTherapy.serial_number}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {therapyIsActive ? 'Terapia en curso: se muestran datos en tiempo real y el historial.' : selectedTherapyIsOpen ? 'Sesión abierta sin cierre: solo se muestra historial para evitar mezclarla con la sesión activa.' : 'Terapia finalizada: sólo historial disponible.'}
            </div>
          </div>

          {/* Main Grid */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(280px, 1fr) 3fr', gap: '20px' }}>
            {/* Left - Info */}
            <div className="side-panel">
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={20} color="var(--secondary)" /> General Information
                </h3>
                <StatCard title="Patient ID" value={selectedTherapy.patient_id_str} iconName="Contact" color="#0ea5e9" />
                <StatCard title="Machine Serial" value={selectedTherapy.serial_number} iconName="HardDrive" color="#eab308" />
                <StatCard title="Machine SW" value={selectedTherapy.software_version} iconName="Server" color="var(--secondary)" />
                <StatCard title="Therapy Status" value={selectedTherapy.status} iconName="Activity" color={therapyIsActive ? '#10b981' : 'var(--text-muted)'} />
                <StatCard title="Therapy Started" value={selectedTherapy.started_at} iconName="Clock" color="var(--primary)" />
                <StatCard title="Therapy Ended" value={selectedTherapy.ended_at || 'In progress'} iconName="Clock" color="#f97316" />
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
                  <div style={{ padding: '20px', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Esta terapia ya terminó. Los valores en vivo se ocultaron para evitar mezclar historial con telemetría en tiempo real.
                  </div>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="main-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {therapyIsActive ? (
                <>
                  {/* Flows */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Droplets size={20} color="var(--primary)" /> Flow Dynamics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <StatCard title="Blood Flow" value={data.flows.c_pump_bs_bl_flow_act.value} unit={data.flows.c_pump_bs_bl_flow_act.unit} iconName="HeartPulse" color="var(--art-color)" />
                      <StatCard title="Dialysate Flow" value={data.flows.c_pump_fs_mid_flow_act.value} unit={data.flows.c_pump_fs_mid_flow_act.unit} iconName="Droplets" color="var(--tmp-color)" />
                      <StatCard title="Net Removal" value={data.flows.c_net_rem_flow_act.value} unit={data.flows.c_net_rem_flow_act.unit} iconName="Wind" color="var(--fil-color)" />
                    </div>
                  </div>

                  {/* Pressures */}
                  <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Thermometer size={20} color="var(--accent)" /> Real-Time Pressures
                    </h3>

                    {/* Cylinders */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', marginBottom: '40px', minHeight: '200px' }}>
                      <Cylinder label="Arterial (AP)" value={data.pressures.c_press_ap_act.value} unit={data.pressures.c_press_ap_act.unit} max={500} min={-400} colorVar="--art-color" />
                      <Cylinder label="Venous (VP)" value={data.pressures.c_press_vp_act.value} unit={data.pressures.c_press_vp_act.unit} max={300} min={-400} colorVar="--ven-color" />
                      <Cylinder label="TMP (PTM)" value={data.pressures.c_press_tmp_act.value} unit={data.pressures.c_press_tmp_act.unit} max={80} min={0} colorVar="--tmp-color" />
                      <Cylinder label="Filter (FP)" value={data.pressures.c_press_fp_act.value} unit={data.pressures.c_press_fp_act.unit} max={500} min={0} colorVar="--fil-color" />
                    </div>

                    {/* Time Series Chart */}
                    <div style={{ flex: 1, minHeight: '300px', width: '100%', marginTop: 'auto', borderTop: '1px solid var(--border)', pt: '24px' }}>
                      <h4 style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <TrendingUp size={16} /> Pressure Trends (Time Series)
                      </h4>
                      <div style={{ width: '100%', height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data.history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis
                              dataKey="time"
                              stroke="var(--text-muted)"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              stroke="var(--text-muted)"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', background: 'var(--panel-bg)' }}
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
                </>
              ) : (
                <div className="glass-panel" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  La terapia seleccionada ya finalizó. Sólo se mostrará el historial desde la vista de terapia.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Start Serial Modal ── */}
      {showStartModal && (
        <div className="modal-fade-in" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div className="modal-slide-up" style={{
            background: 'var(--bg-card)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '30px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            color: 'var(--text-main)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={20} color="var(--primary)" />
                Iniciar lectura serial
              </h3>
              <button
                onClick={() => setShowStartModal(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '4px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              El puerto serial está detenido. Selecciona cómo deseas inicializar la sesión de lectura para la máquina conectada:
            </p>

            {therapiesSorted[0] && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '24px',
              }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Última terapia registrada
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Paciente</span>
                    <span style={{ fontWeight: 500 }}>{therapiesSorted[0].patient_id_str || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Nº Serie Máquina</span>
                    <span style={{ fontWeight: 500 }}>{therapiesSorted[0].serial_number || 'N/A'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Inicio</span>
                    <span style={{ fontWeight: 500 }}>{therapiesSorted[0].started_at || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  startReader(true);
                  setShowStartModal(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, var(--primary, #00d2ff), #00a2cc)',
                  border: 'none', color: '#0f172a',
                  padding: '12px 20px', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                  transition: 'transform 0.1s, opacity 0.2s',
                  boxShadow: '0 4px 12px rgba(0, 210, 255, 0.25)',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Crear nueva terapia
              </button>

              <button
                onClick={() => {
                  startReader(false);
                  setShowStartModal(false);
                }}
                style={{
                  background: 'var(--btn-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '12px 20px', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-glow)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--btn-bg)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
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
