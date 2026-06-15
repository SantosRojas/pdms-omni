import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
import { DataTable } from '../components/DataTable';
import { Download, ChevronLeft, Table2, BarChart3 } from 'lucide-react';
import { Button } from '../components/Button';
import { CommentsSection } from '../components/CommentsSection';
import { AccumulatedPresureChart } from '../components/AccumulatedPresureChart';
import { AccumulatedFlowChart } from '../components/AccumulatedFlowChart';

export const HistoryView = ({ therapy, userRole, onBack }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(true);
  const [showCharts, setShowCharts] = useState(true);

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
        <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: 'var(--fs-xs)' }}>
          {toLocalDatetime(r.timestamp)}
        </span>
      ),
    },
    {
      key: 'internal_name',
      label: 'Parámetro',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 500 }}>
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
          fontSize: 'var(--fs-xs)',
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
          <h2 style={{ fontSize: 'var(--fs-xl)' }}>
            Datos Históricos — Terapia <strong style={{ color: 'var(--primary)' }}>#{therapy?.id}</strong>
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowTable(s => !s)}
            title={showTable ? 'Ocultar tabla' : 'Mostrar tabla'}
            style={{ opacity: showTable ? 1 : 0.5 }}
          >
            <Table2 size={16} /> Tabla
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowCharts(s => !s)}
            title={showCharts ? 'Ocultar gráficas' : 'Mostrar gráficas'}
            style={{ opacity: showCharts ? 1 : 0.5 }}
          >
            <BarChart3 size={16} /> Gráficas
          </button>
          {userRole !== 'viewer' && (
            <button onClick={handleDownload} className="btn btn-primary">
              <Download size={16} /> Exportar Excel (CSV)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}
      <CommentsSection therapyId={therapy?.id} />

      {showTable && (loading ? (
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
      ))}

      {showCharts && (
        <>
          <AccumulatedPresureChart therapyId={therapy.id} isActive={true} />
          <AccumulatedFlowChart therapyId={therapy.id} isActive={true} />
        </>
      )}

    </div>
  );
};
