import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { Droplets, Thermometer, TrendingUp, Waves, Download, Maximize, Minimize } from 'lucide-react';
import { Cylinder } from './Cylinder';
import { StatCard } from './StatCard';
import { Button } from './Button';
import { useCylinderConfig } from '../../application/useCylinderConfig';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-lg)',
  background: 'var(--bg-elevated)',
};

const LiveTrendChart = memo(({ title, icon, data, lines, chartId }) => {
  const Icon = icon;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const exportAsSVG = useCallback(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chartId}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [chartId]);

  const exportAsPNG = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim() || null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${chartId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Error exporting PNG:', e);
    }
  }, [chartId]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Error toggling fullscreen:', e);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      id={chartId}
      className="chart-container"
      style={{
        flex: 1,
        minHeight: isFullscreen ? '100%' : '300px',
        width: '100%',
        marginTop: 'auto',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '16px' }}>
        <h4 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          <Icon size={16} /> {title}
        </h4>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button variant="ghost" size="sm" icon={Download} onClick={exportAsSVG}>SVG</Button>
          <Button variant="ghost" size="sm" icon={Download} onClick={exportAsPNG}>PNG</Button>
          <Button variant="ghost" size="sm" icon={isFullscreen ? Minimize : Maximize} onClick={toggleFullscreen} />
        </div>
      </div>
      <div style={{ width: '100%', height: isFullscreen ? '100%' : '250px', flex: isFullscreen ? 1 : 'none' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }} />
            <Legend />
            {lines.map(line => (
              <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} name={line.name} dot={false} strokeWidth={3} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export const PressurePanel = memo(({ data }) => {
  const { configs } = useCylinderConfig();

  return (
    <>
      <div className="glass-panel animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h3 className="section-title">
          <Thermometer size={20} color="var(--accent)" /> Presiones en Tiempo Real
        </h3>
        <div className="cylinder-gauges">
          <Cylinder label="Arterial (AP)" value={data.pressures.c_press_ap_act.value} unit={data.pressures.c_press_ap_act.unit} config={configs.arterial} colorVar="--art-color" />
          <Cylinder label="Venoso (VP)" value={data.pressures.c_press_vp_act.value} unit={data.pressures.c_press_vp_act.unit} config={configs.venoso} colorVar="--ven-color" />
          <Cylinder label="TMP (PTM)" value={data.pressures.c_press_tmp_act.value} unit={data.pressures.c_press_tmp_act.unit} config={configs.tmp} colorVar="--tmp-color" />
          <Cylinder label="Filtro (FP)" value={data.pressures.c_press_fp_act.value} unit={data.pressures.c_press_fp_act.unit} config={configs.filtro} colorVar="--fil-color" />
        </div>

        <LiveTrendChart
          title="Tendencia de Presiones"
          icon={TrendingUp}
          data={data.history}
          chartId="live-pressure-trend"
          lines={[
            { key: 'c_press_ap_act', name: 'Arterial', color: 'var(--art-color)' },
            { key: 'c_press_vp_act', name: 'Venoso', color: 'var(--ven-color)' },
            { key: 'c_press_tmp_act', name: 'TMP', color: 'var(--tmp-color)' },
            { key: 'c_press_fp_act', name: 'Filtro', color: 'var(--fil-color)' },
          ]}
        />
      </div>

      <div className="glass-panel animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h3 className="section-title">
          <Waves size={20} color="var(--primary)" /> Flujo en Tiempo Real
        </h3>
        <div className="card-grid-3" style={{ marginBottom: '16px' }}>
          <StatCard title="Flujo Sanguíneo" value={data.flows.c_pump_bs_bl_flow_act.value} unit={data.flows.c_pump_bs_bl_flow_act.unit} iconName="HeartPulse" color="var(--art-color)" />
          <StatCard title="Flujo de Diálisis" value={data.flows.c_pump_fs_mid_flow_act.value} unit={data.flows.c_pump_fs_mid_flow_act.unit} iconName="Droplets" color="var(--tmp-color)" />
          <StatCard title="Remoción Neta" value={data.flows.c_net_rem_flow_act.value} unit={data.flows.c_net_rem_flow_act.unit} iconName="Wind" color="var(--fil-color)" />
        </div>

        <LiveTrendChart
          title="Tendencia de Flujos (Serie Temporal)"
          icon={Waves}
          data={data.history}
          chartId="live-flow-trend"
          lines={[
            { key: 'c_pump_bs_bl_flow_act', name: 'Flujo Sanguíneo', color: 'var(--art-color)' },
            { key: 'c_pump_fs_mid_flow_act', name: 'Flujo Diálisis', color: 'var(--tmp-color)' },
            { key: 'c_net_rem_flow_act', name: 'Remoción Neta', color: 'var(--fil-color)' },
          ]}
        />
      </div>
    </>
  );
});
