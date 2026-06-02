import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../../infrastructure/api';
import { Clock, Download, Search, ChevronLeft, ChevronRight, Database } from 'lucide-react';

export const HistoryView = ({ therapy, onBack }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    if (!therapy?.id) return;
    setLoading(true);
    setError(null);
    apiService.getTherapyHistory(therapy.id, 2000)
      .then(data => { setRows(data); setPage(0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [therapy?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.internal_name.toLowerCase().includes(q) ||
      r.timestamp.toLowerCase().includes(q) ||
      (r.display_value && r.display_value.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleDownload = async () => {
    try {
      await apiService.downloadTherapyReport(therapy.id, 5000);
    } catch (e) {
      setError(`Download failed: ${e.message}`);
    }
  };

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{
            background: 'var(--btn-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
            padding: '8px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.9rem',
            fontFamily: 'var(--font-family)',
            transition: 'all 0.2s',
          }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <ChevronLeft size={18} /> Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="var(--secondary)" />
            <h2 style={{ fontSize: '1.25rem' }}>Historical Data</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>— Therapy: <strong style={{ color: 'var(--primary)' }}>#{therapy?.id}</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter parameter..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '8px 12px 8px 34px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-family)',
                width: '220px',
                outline: 'none',
              }}
            />
          </div>

          {/* Download */}
          <button onClick={handleDownload} style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            color: 'white',
            padding: '8px 20px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontFamily: 'var(--font-family)',
            fontWeight: 600,
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            transition: 'transform 0.15s',
          }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Download size={16} /> Export Excel (CSV)
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', flex: 1 }}>
        {loading && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={32} style={{ animation: 'pulse 1.5s infinite' }} />
            <p style={{ marginTop: '12px' }}>Loading history...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--danger)' }}>
            <p>❌ {error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--input-bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Timestamp', 'Parameter', 'Value', 'Display', 'Unit'].map(h => (
                      <th key={h} style={{
                        padding: '14px 16px',
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr key={r.id || i} style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <Clock size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        {r.timestamp}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{r.internal_name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {typeof r.physical_value === 'number' ? r.physical_value.toFixed(2) : r.physical_value}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {r.display_value ? (
                          <span style={{
                            background: 'var(--btn-nav-history)',
                            color: 'var(--btn-nav-history-text)',
                            padding: '2px 10px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                          }}>{r.display_value}</span>
                        ) : (
                          <span style={{ color: '#555' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{r.unit}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}>
              <span>{filtered.length} records total</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: page === 0 ? '#333' : 'var(--text-main)',
                    padding: '6px 10px',
                    cursor: page === 0 ? 'default' : 'pointer',
                    fontFamily: 'var(--font-family)',
                  }}
                ><ChevronLeft size={16} /></button>
                <span>Page {page + 1} / {totalPages}</span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: page >= totalPages - 1 ? '#333' : 'var(--text-main)',
                    padding: '6px 10px',
                    cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                    fontFamily: 'var(--font-family)',
                  }}
                ><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
