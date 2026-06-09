import React, { memo, useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { apiService } from '../../infrastructure/api';
import { toLocalTimeOnly, toLocalDate } from '../../infrastructure/time';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const AccumulatedPresureChart = memo(({ therapyId, isActive }) => {
  const [accData, setAccData] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState(null);
  const [accDate, setAccDate] = useState('');

  const fetchAccData = useCallback(async () => {
    if (!therapyId) return;
    setAccLoading(true);
    setAccError(null);
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
      setAccDate(date);
      setAccData(withTimeOnly);
    } catch (e) {
      setAccError(e.message);
    } finally {
      setAccLoading(false);
    }
  }, [therapyId]);

  useEffect(() => {
    if (therapyId && isActive) {
      fetchAccData();
    } else {
      setAccData([]);
    }
  }, [therapyId, isActive, fetchAccData]);

  const hasAccData = accData.length > 1;

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            <Database size={20} color="var(--primary)" /> Presiones Acumuladas
            {accDate && <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '8px' }}>{accDate}</span>}
          </h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={fetchAccData}
          disabled={accLoading}
          title="Actualizar datos acumulados"
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
              {accData.some(d => d.c_press_ap_act !== undefined) && (
                <Line type="monotone" dataKey="c_press_ap_act" stroke="var(--art-color)" name="Arterial" dot={false} strokeWidth={2} />
              )}
              {accData.some(d => d.c_press_vp_act !== undefined) && (
                <Line type="monotone" dataKey="c_press_vp_act" stroke="var(--ven-color)" name="Venoso" dot={false} strokeWidth={2} />
              )}
              {accData.some(d => d.c_press_tmp_act !== undefined) && (
                <Line type="monotone" dataKey="c_press_tmp_act" stroke="var(--tmp-color)" name="TMP" dot={false} strokeWidth={2} />
              )}
              {accData.some(d => d.c_press_fp_act !== undefined) && (
                <Line type="monotone" dataKey="c_press_fp_act" stroke="var(--fil-color)" name="Filtro" dot={false} strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});
