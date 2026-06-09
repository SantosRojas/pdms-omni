import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
import { DataTable } from '../components/DataTable';
import { Download, Clock, ChevronLeft } from 'lucide-react';
import { CommentsSection } from '../components/CommentsSection';

export const HistoryView = ({ therapy, userRole, onBack }) => {
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
      setError(`Error al descargar: ${e.message}`);
    }
  };

  const columns = [
    {
      key: 'timestamp',
      label: 'Fecha/Hora',
      render: (r) => (
        <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
          {toLocalDatetime(r.timestamp)}
        </span>
      ),
    },
    {
      key: 'internal_name',
      label: 'Parámetro',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 500 }}>
          {r.internal_name}
        </span>
      ),
    },
    {
      key: 'physical_value',
      label: 'Valor',
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
          background: 'var(--btn-nav-history)',
          color: 'var(--btn-nav-history-text)',
          padding: '2px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
        }}>
          {r.display_value}
        </span>
      ) : (
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>—</span>
      ),
    },
    {
      key: 'unit',
      label: 'Unidad',
      render: (r) => (
        <span style={{ color: 'var(--text-tertiary)' }}>{r.unit}</span>
      ),
    },
  ];

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      <div className="glass-panel page-header animate-slide-up">
        <div className="page-header-left">
          <button onClick={onBack} className="btn btn-ghost">
            <ChevronLeft size={18} /> Volver
          </button>
          <h2 style={{ fontSize: '1.25rem' }}>
            Datos Históricos — Terapia <strong style={{ color: 'var(--primary)' }}>#{therapy?.id}</strong>
          </h2>
        </div>

        {userRole !== 'viewer' && (
          <button onClick={handleDownload} className="btn btn-success">
            <Download size={16} /> Exportar Excel (CSV)
          </button>
        )}
      </div>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}
      <CommentsSection therapyId={therapy?.id} />

      {loading ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>Cargando historial...</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(r, i) => r.id || i}
          defaultPageSize={50}
          pageSizeOptions={[25, 50, 100, 200]}
          emptyMessage="No se encontraron datos."
        />
      )}

    </div>
  );
};
