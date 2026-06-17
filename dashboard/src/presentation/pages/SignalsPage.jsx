import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { Activity, Check, X } from 'lucide-react';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

export const SignalsPage = ({ userRole, onBack }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [editState, setEditState] = useState({});

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    apiService.getSignals()
      .then(data => setRows(data))
      .catch(e => setError(e.message));
  }, []);

  const handleEdit = (row) => {
    setEditState({
      id: row.id,
      display_name: row.display_name ?? '',
      unit: row.unit ?? '',
    });
  };

  const handleCancel = () => {
    setEditState({});
  };

  const handleSave = async () => {
    setError('');
    setSavingId(editState.id);
    try {
      await apiService.updateSignal(
        editState.id,
        editState.display_name || null,
        editState.unit || null,
      );
      setEditState({});
      const data = await apiService.getSignals();
      setRows(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          {r.id}
        </span>
      ),
    },
    {
      key: 'internal_name',
      label: 'Nombre Interno',
      render: (r) => (
        <span className="font-mono" style={{ fontSize: 'var(--fs-xs)' }}>
          {r.internal_name}
        </span>
      ),
    },
    {
      key: 'display_name',
      label: 'Nombre Mostrado',
      render: (r) => {
        if (editState.id === r.id) {
          return (
            <input
              className="input"
              value={editState.display_name}
              onChange={e => setEditState({ ...editState, display_name: e.target.value })}
              style={{ width: '100%', minWidth: '180px' }}
              placeholder="(usa el nombre interno)"
              autoFocus
            />
          );
        }
        return (
          <span style={{
            background: r.display_name ? 'var(--btn-nav-equiv)' : 'transparent',
            color: r.display_name ? 'var(--btn-nav-equiv-text)' : 'var(--text-tertiary)',
            padding: r.display_name ? '2px 10px' : '0',
            borderRadius: '6px',
            fontSize: 'var(--fs-xs)',
            fontStyle: r.display_name ? 'normal' : 'italic',
          }}>
            {r.display_name || '(sin nombre)'}
          </span>
        );
      },
    },
    {
      key: 'unit',
      label: 'Unidad',
      render: (r) => {
        if (editState.id === r.id) {
          return (
            <input
              className="input"
              value={editState.unit}
              onChange={e => setEditState({ ...editState, unit: e.target.value })}
              style={{ width: '100%', minWidth: '100px' }}
              placeholder="ej. mmHg"
            />
          );
        }
        return (
          <span style={{
            color: r.unit ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontStyle: r.unit ? 'normal' : 'italic',
          }}>
            {r.unit || '(sin unidad)'}
          </span>
        );
      },
    },
    ...(isAdmin ? [{
      key: 'actions',
      label: 'Acciones',
      filterable: false,
      render: (r) => {
        if (editState.id === r.id) {
          return (
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                onClick={handleSave}
                disabled={savingId === r.id}
              >
                Guardar
              </Button>
              <Button variant="ghost" size="sm" icon={X} onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          );
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            icon={Activity}
            onClick={() => handleEdit(r)}
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            Editar
          </Button>
        );
      },
    }] : []),
  ];

  return (
    <div className="app-container">
      <PageHeader icon={Activity} iconColor="#a855f7" onBack={onBack} title="Configuración de Señales">
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
          ({rows.length} total)
        </span>
      </PageHeader>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}

      {!isAdmin && (
        <div className="message-box message-info" style={{ marginBottom: '16px' }}>
          Solo los administradores pueden editar nombres y unidades.
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={r => r.id}
        defaultPageSize={50}
        emptyMessage="No se encontraron señales."
      />
    </div>
  );
};
