import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { DataTable } from '../components/DataTable';
import { Plus, Layers, X, Check, Trash2, ChevronLeft, Edit3 } from 'lucide-react';

const decodeTokenUsername = () => {
  try {
    const token = apiService.getToken();
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username || payload.sub || '';
  } catch { return ''; }
};

export const EquivalencesPage = ({ userRole, onBack }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newEq, setNewEq] = useState({ internal_name: '', numeric_value: '', display_name: '' });

  // Edit state
  const [editingRow, setEditingRow] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');

  // Delete confirmation state
  const [deletingRow, setDeletingRow] = useState(null);
  const [deleteUser, setDeleteUser] = useState(decodeTokenUsername());
  const [deleteReason, setDeleteReason] = useState('');

  const canEdit = userRole === 'admin' || userRole === 'operator';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    apiService.getEquivalences()
      .then(data => setRows(data))
      .catch(e => setError(e.message));
  }, []);

  const handleCreate = async () => {
    setError('');
    try {
      await apiService.createEquivalence(newEq.internal_name, newEq.numeric_value, newEq.display_name);
      setNewEq({ internal_name: '', numeric_value: '', display_name: '' });
      setShowCreate(false);
      const data = await apiService.getEquivalences();
      setRows(data);
    } catch (e) { setError(e.message); }
  };

  const handleEditStart = (row) => {
    setEditingRow(row);
    setEditDisplayName(row.display_name);
  };

  const handleEditCancel = () => {
    setEditingRow(null);
    setEditDisplayName('');
  };

  const handleEditSave = async () => {
    if (!editDisplayName.trim()) {
      setError('El nombre mostrado no puede estar vacío');
      return;
    }
    setError('');
    try {
      await apiService.updateEquivalence(editingRow.signal_id, editingRow.numeric_value, editDisplayName);
      setEditingRow(null);
      setEditDisplayName('');
      const data = await apiService.getEquivalences();
      setRows(data);
    } catch (e) { setError(e.message); }
  };

  const handleDeleteStart = (row) => {
    setDeletingRow(row);
    setDeleteUser(decodeTokenUsername());
    setDeleteReason('');
  };

  const handleDeleteCancel = () => {
    setDeletingRow(null);
    setDeleteUser('');
    setDeleteReason('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteUser.trim()) {
      setError('El nombre del usuario no puede estar vacío');
      return;
    }
    if (!deleteReason.trim()) {
      setError('El motivo de eliminación no puede estar vacío');
      return;
    }
    setError('');
    try {
      await apiService.deleteEquivalence(deletingRow.signal_id, deletingRow.numeric_value, deleteUser, deleteReason);
      setDeletingRow(null);
      setDeleteUser('');
      setDeleteReason('');
      const data = await apiService.getEquivalences();
      setRows(data);
    } catch (e) { setError(e.message); }
  };

  const columns = [
    {
      key: 'internal_name',
      label: 'Parámetro',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: '0.82rem' }}>
          {r.internal_name}
        </span>
      ),
    },
    {
      key: 'numeric_value',
      label: 'Valor Numérico',
      render: (r) => (
        <span style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {r.numeric_value}
        </span>
      ),
    },
    {
      key: 'display_name',
      label: 'Nombre Mostrado',
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
    ...(canEdit || canDelete ? [{
      key: 'actions',
      label: 'Acciones',
      filterable: false,
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {canEdit && (
            <button onClick={() => handleEditStart(r)}
              className="btn btn-sm"
              style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: 'none' }}>
              <Edit3 size={12} /> Editar
            </button>
          )}
          {canDelete && (
            <button onClick={() => handleDeleteStart(r)}
              className="btn btn-sm"
              style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: 'none' }}>
              <Trash2 size={12} /> Eliminar
            </button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      <div className="glass-panel page-header animate-slide-up">
        <div className="page-header-left">
          <button onClick={onBack} className="btn btn-ghost">
            <ChevronLeft size={18} /> Volver
          </button>
          <Layers size={22} color="#a855f7" />
          <h2 style={{ fontSize: '1.25rem' }}>Equivalencias de Valores</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>({rows.length} total)</span>
        </div>

        {canEdit && (
          <button onClick={() => setShowCreate(true)} className="btn" style={{
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
          }}>
            <Plus size={16} /> Añadir Equivalencia
          </button>
        )}
      </div>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}

      {showCreate && (
        <div className="glass-panel animate-slide-down" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <Plus size={18} color="#a855f7" /> Añadir Nueva Equivalencia
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label>Nombre del Parámetro</label>
              <input className="input" value={newEq.internal_name} onChange={e => setNewEq({ ...newEq, internal_name: e.target.value })} style={{ width: '220px' }} placeholder="ej. g_therapy_mode_set" />
            </div>
            <div>
              <label>Valor Numérico</label>
              <input type="number" step="any" className="input" value={newEq.numeric_value} onChange={e => setNewEq({ ...newEq, numeric_value: e.target.value })} style={{ width: '140px' }} placeholder="0.0" />
            </div>
            <div>
              <label>Nombre Mostrado</label>
              <input className="input" value={newEq.display_name} onChange={e => setNewEq({ ...newEq, display_name: e.target.value })} style={{ width: '220px' }} placeholder="ej. Preparación" />
            </div>
            <button onClick={handleCreate} className="btn btn-success">
              <Check size={16} /> Guardar
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ─── */}
      {editingRow && (
        <div className="modal-backdrop animate-fade-in" onClick={handleEditCancel}>
          <div className="modal-content modal-slide-up" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '480px' }}>
            <div className="modal-header">
              <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#a855f7" /> Editar Equivalencia
              </h4>
              <button onClick={handleEditCancel} className="modal-close"><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label>Parámetro</label>
                <input className="input" value={editingRow.internal_name} disabled style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label>Valor Numérico</label>
                <input className="input" value={editingRow.numeric_value} disabled style={{ opacity: 0.6 }} />
              </div>
              <div>
                <label>Nombre Mostrado</label>
                <input className="input" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Nuevo nombre mostrado" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={handleEditCancel} className="btn btn-ghost">Cancelar</button>
              <button onClick={handleEditSave} className="btn btn-success"><Check size={16} /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deletingRow && (
        <div className="modal-backdrop animate-fade-in" onClick={handleDeleteCancel}>
          <div className="modal-content modal-slide-up" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '520px' }}>
            <div className="modal-header">
              <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <Trash2 size={18} color="var(--danger)" /> Confirmar Eliminación
              </h4>
              <button onClick={handleDeleteCancel} className="modal-close"><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
              Se eliminará la equivalencia <strong>{deletingRow.internal_name} = {deletingRow.numeric_value}</strong> ({deletingRow.display_name}).
              Esta acción queda registrada.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label>Nombre del usuario que elimina</label>
                <input className="input" value={deleteUser} onChange={e => setDeleteUser(e.target.value)} placeholder="Tu nombre de usuario" />
              </div>
              <div>
                <label>Motivo de eliminación</label>
                <textarea className="input" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Describe el motivo..." rows={3} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={handleDeleteCancel} className="btn btn-ghost">Cancelar</button>
              <button onClick={handleDeleteConfirm} className="btn" style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>
                <Trash2 size={16} /> Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={r => `${r.signal_id}-${r.numeric_value}`}
        defaultPageSize={30}
        emptyMessage="No se encontraron equivalencias."
      />
    </div>
  );
};
