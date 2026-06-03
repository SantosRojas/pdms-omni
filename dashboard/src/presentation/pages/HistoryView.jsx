import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { DataTable } from '../components/DataTable';
import { Download, Clock, X } from 'lucide-react';
import { CommentsSection } from '../components/CommentsSection';

export const HistoryView = ({ therapy, onBack }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!therapy?.id) return;
    setLoading(true);
    setError(null);
    apiService.getTherapyHistory(therapy.id, 2000)
      .then(data => { setRows(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [therapy?.id]);

  const handleDownload = async () => {
    try {
      await apiService.downloadTherapyReport(therapy.id, 5000);
    } catch (e) {
      setError(`Download failed: ${e.message}`);
    }
  };

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (r) => (
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
          {r.timestamp}
        </span>
      ),
    },
    {
      key: 'internal_name',
      label: 'Parameter',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-family-mono, monospace)', fontSize: '0.82rem', fontWeight: 500 }}>
          {r.internal_name}
        </span>
      ),
    },
    {
      key: 'physical_value',
      label: 'Value',
      render: (r) => (
        <span style={{ color: 'var(--primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {typeof r.physical_value === 'number' ? r.physical_value.toFixed(2) : r.physical_value}
        </span>
      ),
    },
    {
      key: 'display_value',
      label: 'Display',
      render: (r) => r.display_value ? (
        <span style={{
          background: 'var(--btn-nav-history)', color: 'var(--btn-nav-history-text)',
          padding: '2px 10px', borderRadius: '6px', fontSize: '0.8rem',
        }}>
          {r.display_value}
        </span>
      ) : (
        <span style={{ color: '#555' }}>—</span>
      ),
    },
    {
      key: 'unit',
      label: 'Unit',
      render: (r) => (
        <span style={{ color: 'var(--text-muted)' }}>{r.unit}</span>
      ),
    },
  ];

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{
            background: 'var(--btn-bg)', border: '1px solid var(--border)',
            color: 'var(--text-main)', padding: '8px 16px', borderRadius: '10px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.9rem', fontFamily: 'var(--font-family)',
            transition: 'all 0.2s',
          }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <X size={18} /> Back
          </button>
          <h2 style={{ fontSize: '1.25rem' }}>
            Historical Data — Therapy <strong style={{ color: 'var(--primary)' }}>#{therapy?.id}</strong>
          </h2>
        </div>

        <button onClick={handleDownload} style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          border: 'none', color: 'white',
          padding: '8px 20px', borderRadius: '10px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 600,
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
          transition: 'transform 0.15s',
        }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Download size={16} /> Export Excel (CSV)
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Clock size={32} style={{ animation: 'pulse 1.5s infinite' }} />
          <p style={{ marginTop: '12px' }}>Loading history...</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(r, i) => r.id || i}
          defaultPageSize={50}
          pageSizeOptions={[25, 50, 100, 200]}
          emptyMessage="No data found."
        />
      )}

      <CommentsSection therapyId={therapy?.id} />
    </div>
  );
};
