import React from 'react';
import { Droplets, Thermometer, TrendingUp } from 'lucide-react';
import { Cylinder } from './Cylinder';
import { StatCard } from './StatCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const PressurePanel = ({ data }) => {
  return (
    <>
      <div className="glass-panel animate-slide-up" style={{ padding: '24px' }}>
        <h3 className="section-title">
          <Droplets size={20} color="var(--primary)" /> Dinámica de Flujos
        </h3>
        <div className="card-grid-3">
          <StatCard title="Flujo Sanguíneo" value={data.flows.c_pump_bs_bl_flow_act.value} unit={data.flows.c_pump_bs_bl_flow_act.unit} iconName="HeartPulse" color="var(--art-color)" />
          <StatCard title="Flujo de Diálisis" value={data.flows.c_pump_fs_mid_flow_act.value} unit={data.flows.c_pump_fs_mid_flow_act.unit} iconName="Droplets" color="var(--tmp-color)" />
          <StatCard title="Remoción Neta" value={data.flows.c_net_rem_flow_act.value} unit={data.flows.c_net_rem_flow_act.unit} iconName="Wind" color="var(--fil-color)" />
        </div>
      </div>

      <div className="glass-panel animate-slide-up" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="section-title">
          <Thermometer size={20} color="var(--accent)" /> Presiones en Tiempo Real
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', marginBottom: '40px', minHeight: '200px', paddingTop: '16px' }}>
          <Cylinder label="Arterial (AP)" value={data.pressures.c_press_ap_act.value} unit={data.pressures.c_press_ap_act.unit} max={500} min={-400} colorVar="--art-color" />
          <Cylinder label="Venoso (VP)" value={data.pressures.c_press_vp_act.value} unit={data.pressures.c_press_vp_act.unit} max={300} min={-400} colorVar="--ven-color" />
          <Cylinder label="TMP (PTM)" value={data.pressures.c_press_tmp_act.value} unit={data.pressures.c_press_tmp_act.unit} max={80} min={0} colorVar="--tmp-color" />
          <Cylinder label="Filtro (FP)" value={data.pressures.c_press_fp_act.value} unit={data.pressures.c_press_fp_act.unit} max={500} min={0} colorVar="--fil-color" />
        </div>

        <div style={{ flex: 1, minHeight: '300px', width: '100%', marginTop: 'auto', borderTop: '1px solid var(--border-default)' }}>
          <h4 className="section-title" style={{ marginTop: '20px', border: 'none', padding: '0 0 16px' }}>
            <TrendingUp size={16} /> Tendencia de Presiones (Serie Temporal)
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
                <Line type="monotone" dataKey="c_press_vp_act" stroke="var(--ven-color)" name="Venoso" dot={false} strokeWidth={3} animationDuration={300} />
                <Line type="monotone" dataKey="c_press_tmp_act" stroke="var(--tmp-color)" name="TMP" dot={false} strokeWidth={3} animationDuration={300} />
                <Line type="monotone" dataKey="c_press_fp_act" stroke="var(--fil-color)" name="Filtro" dot={false} strokeWidth={3} animationDuration={300} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};
