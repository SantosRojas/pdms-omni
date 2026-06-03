import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { DataTable } from '../components/DataTable';
import { Plus, Layers, X, Check, Trash2 } from 'lucide-react';

export const EquivalencesPage = ({ userRole, onBack }) => {
  const [rows, setRows] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newEq, setNewEq] = useState({ internal_name: '', numeric_value: '', display_name: '' });
  const [error, setError] = useState('');

  const canEdit = userRole === 'admin' || userRole === 'operator';
  const canDelete = userRole === 'admin';

  const loadData = async () => {
    try { setRows(await apiService.getEquivalences()); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { loadData(); }, []);

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

  const columns = [
    {
      key: 'internal_name',
      label: 'Parameter',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-family-mono, monospace)', fontSize: '0.82rem' }}>
          {r.internal_name}
        </span>
      ),
    },
    {
      key: 'numeric_value',
      label: 'Numeric Value',
      render: (r) => (
        <span style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {r.numeric_value}
        </span>
      ),
    },
    {
      key: 'display_name',
      label: 'Display Name',
      render: (r) => (
        <span style={{
          background: 'var(--btn-nav-equiv)', color: 'var(--btn-nav-equiv-text)',
          padding: '2px 10px', borderRadius: '6px', fontSize: '0.8rem',
        }}>
          {r.display_name}
        </span>
      ),
    },
    ...(canDelete ? [{
      key: 'actions',
      label: 'Actions',
      filterable: false,
      render: (r) => (
        <button onClick={() => handleDelete(r.signal_id, r.numeric_value)}
          style={{
            background: 'rgba(239,68,68,0.15)', border: 'none', color: 'var(--danger)',
            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem',
            fontFamily: 'var(--font-family)',
          }}>
          <Trash2 size={12} /> Delete
        </button>
      ),
    }] : []),
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
          }}>
            <X size={18} /> Back
          </button>
          <Layers size={22} color="#a855f7" />
          <h2 style={{ fontSize: '1.25rem' }}>Value Equivalences</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({rows.length} total)</span>
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

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '0.875rem' }}>
          {error}
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

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={r => `${r.signal_id}-${r.numeric_value}`}
        defaultPageSize={30}
        emptyMessage="No equivalences found."
      />
    </div>
  );
};
