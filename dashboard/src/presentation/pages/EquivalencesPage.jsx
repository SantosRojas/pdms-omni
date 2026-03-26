import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../../infrastructure/api';
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, Layers, X, Check } from 'lucide-react';

export const EquivalencesPage = ({ userRole, onBack }) => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newEq, setNewEq] = useState({ internal_name: '', numeric_value: '', display_name: '' });
  const [error, setError] = useState('');
  const pageSize = 30;

  const canEdit = userRole === 'admin' || userRole === 'operator';
  const canDelete = userRole === 'admin';

  const loadData = async () => {
    try { setRows(await apiService.getEquivalences()); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.internal_name.toLowerCase().includes(q) ||
      r.display_name.toLowerCase().includes(q) ||
      String(r.numeric_value).includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Group by internal_name for visual clarity
  const groups = useMemo(() => {
    const map = new Map();
    pageRows.forEach(r => {
      if (!map.has(r.internal_name)) map.set(r.internal_name, []);
      map.get(r.internal_name).push(r);
    });
    return map;
  }, [pageRows]);

  const handleCreate = async () => {
    setError('');
    try {
      await apiService.createEquivalence(newEq.internal_name, newEq.numeric_value, newEq.display_name);
      setNewEq({ internal_name: '', numeric_value: '', display_name: '' });
      setShowCreate(false);
      loadData();
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (signal_id, numeric_value) => {
    if (!confirm(`Delete equivalence ${numeric_value}?`)) return;
    try { await apiService.deleteEquivalence(signal_id, numeric_value); loadData(); }
    catch (e) { setError(e.message); }
  };

  const inputStyle = {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
    background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.875rem',
    fontFamily: 'var(--font-family)', outline: 'none', boxSizing: 'border-box',
  };

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
          }}>
            <ChevronLeft size={18} /> Back
          </button>
          <Layers size={22} color="#a855f7" />
          <h2 style={{ fontSize: '1.25rem' }}>Value Equivalences</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({rows.length} total)</span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Filter..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{ ...inputStyle, paddingLeft: '34px', width: '200px' }} />
          </div>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} style={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', color: 'white',
              padding: '8px 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 600,
              boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
            }}>
              <Plus size={16} /> Add Equivalence
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '0.875rem' }}>
          ❌ {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="#a855f7" /> Add New Equivalence
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Parameter Name</label>
              <input value={newEq.internal_name} onChange={e => setNewEq({ ...newEq, internal_name: e.target.value })} style={{ ...inputStyle, width: '220px' }} placeholder="e.g. g_therapy_mode_set" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Numeric Value</label>
              <input type="number" step="any" value={newEq.numeric_value} onChange={e => setNewEq({ ...newEq, numeric_value: e.target.value })} style={{ ...inputStyle, width: '140px' }} placeholder="0.0" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Display Name</label>
              <input value={newEq.display_name} onChange={e => setNewEq({ ...newEq, display_name: e.target.value })} style={{ ...inputStyle, width: '220px' }} placeholder="e.g. Preparation" />
            </div>
            <button onClick={handleCreate} style={{ background: 'var(--success)', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-family)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={16} /> Save
            </button>
            <button onClick={() => setShowCreate(false)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-family)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--input-bg)', borderBottom: '1px solid var(--border)' }}>
              {['Parameter', 'Numeric Value', 'Display Name', ...(canDelete ? ['Actions'] : [])].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([name, items]) => (
              items.map((r, i) => (
                <tr key={`${r.signal_id}-${r.numeric_value}`} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 16px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {i === 0 ? name : ''}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {r.numeric_value}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: 'var(--btn-nav-equiv)', color: 'var(--btn-nav-equiv-text)', padding: '2px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                      {r.display_name}
                    </span>
                  </td>
                  {canDelete && (
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={() => handleDelete(r.signal_id, r.numeric_value)}
                        style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: 'var(--danger)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontFamily: 'var(--font-family)' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No equivalences found.</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <span>{filtered.length} records</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ background: 'var(--btn-bg)', border: '1px solid var(--border)', borderRadius: '8px', color: page === 0 ? '#333' : 'var(--text-main)', padding: '6px 10px', cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'var(--font-family)' }}>
              <ChevronLeft size={16} />
            </button>
            <span>Page {page + 1} / {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ background: 'var(--btn-bg)', border: '1px solid var(--border)', borderRadius: '8px', color: page >= totalPages - 1 ? '#333' : 'var(--text-main)', padding: '6px 10px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: 'var(--font-family)' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
