import React, { useState, useEffect } from 'react';
import { useTelemetry } from '../../application/useTelemetry';
import { apiService } from '../../infrastructure/api';
import { Cylinder } from '../components/Cylinder';
import { StatCard } from '../components/StatCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Activity, Droplets, Thermometer, Wind, User, Clock, Database, Users, Layers, LogOut, Settings } from 'lucide-react';

export const Dashboard = ({ user, onNavigateHistory, onNavigateAdmin, onNavigateEquivalences, onNavigateProfile, onLogout }) => {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');

  const { data, connected } = useTelemetry(patientId);

  useEffect(() => {
    apiService.getPatients()
      .then(list => {
        setPatients(list);
        if (list.length > 0 && !patientId) setPatientId(list[0].patient_id_str);
      })
      .catch(() => {
        setPatients([{ id: 0, patient_id_str: 'UNKNOWN', created_at: '' }]);
        if (!patientId) setPatientId('UNKNOWN');
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
      {/* Header */}
      <header className="glass-panel header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="header-title">
          <Activity color="var(--primary)" size={28} />
          OMNI Real-Time
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Patient selector */}
          <select className="patient-select" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ padding: '7px 12px', fontSize: '0.85rem' }}>
            {patients.map(p => <option key={p.id} value={p.patient_id_str}>{p.patient_id_str}</option>)}
          </select>

          {/* Nav buttons */}
          <button onClick={() => onNavigateHistory(patientId)} style={navBtnStyle('var(--btn-nav-history)', 'var(--btn-nav-history-text)')}>
            <Database size={14} /> History
          </button>
          <button onClick={onNavigateEquivalences} style={navBtnStyle('var(--btn-nav-equiv)', 'var(--btn-nav-equiv-text)')}>
            <Layers size={14} /> Equivalences
          </button>
          {user.role === 'admin' && (
            <button onClick={onNavigateAdmin} style={navBtnStyle('var(--btn-nav-admin)', 'var(--btn-nav-admin-text)')}>
              <Users size={14} /> Users
            </button>
          )}

          {/* User info + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px', paddingLeft: '12px', borderLeft: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-main)' }}>{user.full_name || user.username}</strong>
              <span style={{ marginLeft: '4px', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', background: 'var(--btn-bg)' }}>{user.role}</span>
            </span>
            <ThemeToggle />
            <button onClick={onNavigateProfile} title="Profile Settings" style={{
              background: 'var(--btn-bg)', border: 'none', color: 'var(--text-main)',
              padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex',
            }}>
              <Settings size={16} />
            </button>
            <button onClick={onLogout} title="Logout" style={{
              background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--danger)',
              padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex',
            }}>
              <LogOut size={16} />
            </button>
          </div>

          {/* Status */}
          <div className="connection-status">
            <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            {connected ? 'LIVE' : 'OFF'}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left - Info */}
        <div className="side-panel">
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} color="var(--secondary)" /> General Information
            </h3>
            <StatCard title="Patient Weight" value={data.info.g_patient_data_weight_set.value} unit={data.info.g_patient_data_weight_set.unit} iconName="Activity" color="var(--secondary)" />
            <StatCard title="Therapy Mode" value={data.info.g_therapy_mode_set.value} iconName="HeartPulse" color="var(--accent)" />
            <StatCard title="Anticoagulant" value={data.info.g_anticoag_mode_set.value} iconName="Beaker" color="#a855f7" />
            <StatCard title="Kit Type" value={data.info.d_kit_type_str.value} iconName="HardDrive" color="#eab308" />
            <StatCard title="Therapy Time" value={data.info.c_acc_therapy_time_act.value} unit={data.info.c_acc_therapy_time_act.unit} iconName="Clock" color="var(--primary)" />
          </div>
        </div>

        {/* Right */}
        <div className="main-panel">
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
          <div className="glass-panel animate-slide-up" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Thermometer size={20} color="var(--accent)" /> Real-Time Pressures
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', flex: 1, paddingBottom: '20px' }}>
              <Cylinder label="Arterial (AP)" value={data.pressures.c_press_ap_act.value} unit={data.pressures.c_press_ap_act.unit} max={500} min={-300} colorVar="--art-color" />
              <Cylinder label="Venous (VP)" value={data.pressures.c_press_vp_act.value} unit={data.pressures.c_press_vp_act.unit} max={500} min={-100} colorVar="--ven-color" />
              <Cylinder label="TMP" value={data.pressures.c_press_tmp_act.value} unit={data.pressures.c_press_tmp_act.unit} max={600} min={-100} colorVar="--tmp-color" />
              <Cylinder label="Filter (FP)" value={data.pressures.c_press_fp_act.value} unit={data.pressures.c_press_fp_act.unit} max={600} min={-100} colorVar="--fil-color" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
