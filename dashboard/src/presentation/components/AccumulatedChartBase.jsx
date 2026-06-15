import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Maximize, Minimize, Download, BarChart3 } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './FeedbackState';
import { apiService } from '../../infrastructure/api';
import { toLocalTimeOnly, toLocalDate } from '../../infrastructure/time';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import html2canvas from 'html2canvas';

let chartCounter = 0;

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-lg)',
  background: 'var(--bg-elevated)',
};

export const AccumulatedChartBase = memo(({ title, icon, therapyId, isActive, emptyMessage, lines }) => {
  const Icon = icon;
  const [accData, setAccData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accDate, setAccDate] = useState('');
  const [brushIdx, setBrushIdx] = useState({ start: 0, end: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartId = useRef(`chart-${++chartCounter}`).current;
  const containerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!therapyId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiService.getTherapyHistory(Number(therapyId), 5000);
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
      const date = toLocalDate(sorted[0]?.time);
      setAccDate(date || '');
      setAccData(withTimeOnly);
      setBrushIdx({ start: 0, end: Math.max(0, withTimeOnly.length - 1) });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [therapyId]);

  useEffect(() => {
    if (therapyId && isActive) {
      fetchData();
    } else {
      setAccData([]);
    }
  }, [therapyId, isActive, fetchData]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleBrushChange = (range) => {
    if (range) {
      setBrushIdx({ start: range.startIndex, end: range.endIndex });
    }
  };

  const resetZoom = () => {
    setBrushIdx({ start: 0, end: Math.max(0, accData.length - 1) });
  };

  const exportAsSVG = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsPNG = async () => {
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
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Error exporting PNG:', e);
    }
  };

  const toggleFullscreen = async () => {
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
  };

  const hasData = accData.length > 1;
  const isZoomed = brushIdx.end - brushIdx.start < accData.length - 2;

  return (
    <div
      ref={containerRef}
      id={chartId}
      className="glass-panel animate-slide-up chart-container"
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
        <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0, flexShrink: 0 }}>
          <Icon size={20} color="var(--primary)" /> {title}
          {accDate && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '8px' }}>{accDate}</span>}
        </h3>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isZoomed && (
            <Button variant="ghost" size="sm" onClick={resetZoom}>
              Reset Zoom
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={Download} onClick={exportAsSVG}>SVG</Button>
          <Button variant="ghost" size="sm" icon={Download} onClick={exportAsPNG}>PNG</Button>
          <Button variant="ghost" size="sm" icon={isFullscreen ? Minimize : Maximize} onClick={toggleFullscreen} />
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchData} disabled={loading}
            style={loading ? { pointerEvents: 'none', opacity: 0.6 } : undefined} />
        </div>
      </div>

      {error && (
        <div className="message-box message-error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {loading && !hasData && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Cargando datos...
        </div>
      )}

      {!loading && !hasData && !error && (
        <EmptyState icon={BarChart3} message={emptyMessage} />
      )}

      {hasData && (
        <div style={{ width: '100%', height: isFullscreen ? '100%' : '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={accData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="timeOnly" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--primary)', fontWeight: 'bold' }} />
              <Legend />
              {lines.map(line => (
                <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} name={line.name} dot={false} strokeWidth={2} />
              ))}
              <Brush
                dataKey="timeOnly"
                height={30}
                stroke="var(--primary)"
                fill="var(--bg-inset)"
                travellerWidth={12}
                startIndex={brushIdx.start}
                endIndex={brushIdx.end}
                onChange={handleBrushChange}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});
