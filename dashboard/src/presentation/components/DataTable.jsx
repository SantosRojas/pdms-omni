import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

const inputStyle = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '5px 8px 5px 26px',
  color: 'var(--text-main)',
  fontSize: '0.78rem',
  fontFamily: 'var(--font-family)',
  outline: 'none',
  boxSizing: 'border-box',
};

const iconStyle = { position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };

export const DataTable = ({
  columns,
  data,
  keyExtractor = (_, i) => i,
  defaultPageSize = 30,
  pageSizeOptions = [15, 30, 50, 100],
  emptyMessage = 'No records found.',
}) => {
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const setFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setPage(0);
  };

  const clearFilters = () => { setFilters({}); setPage(0); };

  const filtered = useMemo(() => {
    const activeKeys = Object.keys(filters);
    if (activeKeys.length === 0) return data;
    return data.filter(row =>
      activeKeys.every(key => {
        const value = String(row[key] ?? '').toLowerCase();
        return value.includes(filters[key].toLowerCase());
      })
    );
  }, [data, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const hasActiveFilters = Object.keys(filters).length > 0;

  const thStyle = {
    padding: '12px 16px 8px',
    textAlign: 'left',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    verticalAlign: 'bottom',
    minWidth: '100px',
  };

  const filterContainer = { position: 'relative', marginTop: '8px' };

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--input-bg)', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {filtered.length} / {data.length} registros
          </span>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)', padding: '4px 10px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font-family)',
            }}>
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Filas:</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            style={{
              background: 'var(--btn-bg)', border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-main)', padding: '4px 8px', fontSize: '0.8rem',
              fontFamily: 'var(--font-family)', outline: 'none', cursor: 'pointer',
            }}>
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--input-bg)', borderBottom: '2px solid var(--border)' }}>
              {columns.map(col => (
                <th key={col.key} style={thStyle}>
                  <div>{col.label}</div>
                  {col.filterable !== false && (
                    <div style={filterContainer}>
                      <Search size={12} style={iconStyle} />
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        value={filters[col.key] || ''}
                        onChange={e => setFilter(col.key, e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length > 0 ? pageRows.map((row, i) => (
              <tr key={keyExtractor(row, i)} style={{
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.12s',
              }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {columns.map(col => (
                  <td key={col.key} style={{
                    padding: '10px 16px',
                    ...(col.cellStyle || {}),
                  }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)', fontSize: '0.82rem',
      }}>
        <span>Página {page + 1} de {totalPages}</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            style={{
              background: 'var(--btn-bg)', border: '1px solid var(--border)', borderRadius: '6px',
              color: page === 0 ? '#333' : 'var(--text-main)', padding: '5px 9px',
              cursor: page === 0 ? 'default' : 'pointer', display: 'flex', fontFamily: 'var(--font-family)',
            }}>
            <ChevronLeft size={15} />
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
            style={{
              background: 'var(--btn-bg)', border: '1px solid var(--border)', borderRadius: '6px',
              color: page >= totalPages - 1 ? '#333' : 'var(--text-main)', padding: '5px 9px',
              cursor: page >= totalPages - 1 ? 'default' : 'pointer', display: 'flex', fontFamily: 'var(--font-family)',
            }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
