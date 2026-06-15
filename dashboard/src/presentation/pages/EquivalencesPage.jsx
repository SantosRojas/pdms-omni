import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { DataTable } from '../components/DataTable';
import { Plus, Layers, X, Check, Trash2, ChevronLeft, Edit } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

export const EquivalencesPage = ({ userRole, onBack }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newEq, setNewEq] = useState({ internal_name: '', numeric_value: '', display_name: '' });

  // Edit state
  const [editingRow, setEditingRow] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');

  // Delete confirmation state
  const [deletingRow, setDeletingRow] = useState(null);
  const [deleteUser, setDeleteUser] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const canEdit = userRole === 'admin' || userRole === 'operator';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    apiService.getMe()
      .then(user => setCurrentUser(user))
      .catch(() => {});
  }, []);

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
    setDeleteUser(currentUser?.username ?? '');
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
        <span className="font-mono" style={{ fontSize: 'var(--fs-xs)' }}>
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
          fontSize: 'var(--fs-xs)',
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
            <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleEditStart(r)}
              style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>Editar</Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteStart(r)}>Eliminar</Button>
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
          <h2 style={{ fontSize: 'var(--fs-xl)' }}>Equivalencias de Valores</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>({rows.length} total)</span>
        </div>

        {canEdit && (
          <Button variant="purple" icon={Plus} onClick={() => setShowCreate(true)}>Añadir Equivalencia</Button>
        )}
      </div>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}

      <Modal show={showCreate} onClose={() => setShowCreate(false)} title="Añadir Nueva Equivalencia" icon={Plus} iconColor="#a855f7" size="sm">
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label>Nombre del Parámetro</label>
              <input className="input" value={newEq.internal_name} onChange={e => setNewEq({ ...newEq, internal_name: e.target.value })} style={{ width: '100%' }} placeholder="ej. g_therapy_mode_set" />
            </div>
            <div>
              <label>Valor Numérico</label>
              <input type="number" step="any" className="input" value={newEq.numeric_value} onChange={e => setNewEq({ ...newEq, numeric_value: e.target.value })} style={{ width: '100%' }} placeholder="0.0" />
            </div>
            <div>
              <label>Nombre Mostrado</label>
              <input className="input" value={newEq.display_name} onChange={e => setNewEq({ ...newEq, display_name: e.target.value })} style={{ width: '100%' }} placeholder="ej. Preparación" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button variant="primary" icon={Check} onClick={handleCreate}>Guardar</Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ─── Edit Modal ─── */}
      <Modal show={editingRow !== null} onClose={handleEditCancel} title="Editar Equivalencia" icon={Edit} iconColor="#a855f7" size="sm">
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label>Parámetro</label>
              <input className="input" value={editingRow?.internal_name || ''} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label>Valor Numérico</label>
              <input className="input" value={editingRow?.numeric_value || ''} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <label>Nombre Mostrado</label>
              <input className="input" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Nuevo nombre mostrado" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={handleEditCancel}>Cancelar</Button>
            <Button variant="primary" icon={Check} onClick={handleEditSave}>Guardar</Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal show={deletingRow !== null} onClose={handleDeleteCancel} title="Confirmar Eliminación" icon={Trash2} iconColor="var(--danger)" size="sm">
        <Modal.Body>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: '12px' }}>
            Se eliminará la equivalencia <strong>{deletingRow?.internal_name} = {deletingRow?.numeric_value}</strong> ({deletingRow?.display_name}).
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
        </Modal.Body>
        <Modal.Footer>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={handleDeleteCancel}>Cancelar</Button>
            <Button variant="danger" icon={Trash2} onClick={handleDeleteConfirm}>Confirmar Eliminación</Button>
          </div>
        </Modal.Footer>
      </Modal>

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
