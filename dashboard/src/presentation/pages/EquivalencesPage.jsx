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

  const columns = [
    {
      key: 'internal_name',
      label: 'Parameter',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: '0.82rem' }}>
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
          background: 'var(--btn-nav-equiv)',
          color: 'var(--btn-nav-equiv-text)',
          padding: '2px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
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
          className="btn btn-sm"
          style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: 'none' }}>
          <Trash2 size={12} /> Delete
        </button>
      ),
    }] : []),
  ];

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      <div className="glass-panel page-header animate-slide-up">
        <div className="page-header-left">
          <button onClick={onBack} className="btn btn-ghost">
            <X size={18} /> Back
          </button>
          <Layers size={22} color="#a855f7" />
          <h2 style={{ fontSize: '1.25rem' }}>Value Equivalences</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>({rows.length} total)</span>
        </div>

        {canEdit && (
          <button onClick={() => setShowCreate(true)} className="btn" style={{
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
          }}>
            <Plus size={16} /> Add Equivalence
          </button>
        )}
      </div>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}

      {showCreate && (
        <div className="glass-panel animate-slide-down" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <Plus size={18} color="#a855f7" /> Add New Equivalence
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label>Parameter Name</label>
              <input className="input" value={newEq.internal_name} onChange={e => setNewEq({ ...newEq, internal_name: e.target.value })} style={{ width: '220px' }} placeholder="e.g. g_therapy_mode_set" />
            </div>
            <div>
              <label>Numeric Value</label>
              <input type="number" step="any" className="input" value={newEq.numeric_value} onChange={e => setNewEq({ ...newEq, numeric_value: e.target.value })} style={{ width: '140px' }} placeholder="0.0" />
            </div>
            <div>
              <label>Display Name</label>
              <input className="input" value={newEq.display_name} onChange={e => setNewEq({ ...newEq, display_name: e.target.value })} style={{ width: '220px' }} placeholder="e.g. Preparation" />
            </div>
            <button onClick={handleCreate} className="btn btn-success">
              <Check size={16} /> Save
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost">
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
