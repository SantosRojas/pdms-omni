import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

const inputStyle = {
  width: '100%',
  background: 'var(--bg-inset)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  padding: '5px 8px 5px 26px',
  color: 'var(--text-primary)',
  fontSize: '0.78rem',
  fontFamily: 'var(--font-family)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const iconStyle = { position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' };

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

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
            {filtered.length} / {data.length} registros
          </span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn btn-sm" style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)',
            }}>
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
        <div className="table-toolbar-right">
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Filas:</span>
          <select
            className="input"
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            style={{ width: 'auto', padding: '4px 28px 4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
          >
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>
                  <div>{col.label}</div>
                  {col.filterable !== false && (
                    <div style={{ position: 'relative', marginTop: '6px' }}>
                      <Search size={12} style={iconStyle} />
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        value={filters[col.key] || ''}
                        onChange={e => setFilter(col.key, e.target.value)}
                        style={inputStyle}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length > 0 ? pageRows.map((row, i) => (
              <tr key={keyExtractor(row, i)}>
                {columns.map(col => (
                  <td key={col.key} style={{ ...(col.cellStyle || {}) }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} className="empty-state" style={{ padding: '40px' }}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderTop: '1px solid var(--border-default)',
        color: 'var(--text-tertiary)',
        fontSize: '0.82rem',
      }}>
        <span>Página {page + 1} de {totalPages}</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            className="btn-icon btn-ghost"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{ opacity: page === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="btn-icon btn-ghost"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{ opacity: page >= totalPages - 1 ? 0.3 : 1 }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
