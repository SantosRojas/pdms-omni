import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
import { Users, Plus, Trash2, Edit3, ShieldCheck, Eye, Settings, ChevronLeft, X, Check } from 'lucide-react';

const ROLE_COLORS = {
  admin: '#ef4444',
  operator: '#f59e0b',
  viewer: '#10b981',
};

const ROLE_ICONS = {
  admin: ShieldCheck,
  operator: Settings,
  viewer: Eye,
};

export const AdminPage = ({ currentUser, onBack }) => {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try { setUsers(await apiService.getUsers()); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    setError('');
    try {
      await apiService.createUser(newUser.username, newUser.password, newUser.role);
      setNewUser({ username: '', password: '', role: 'viewer' });
      setShowCreate(false);
      loadUsers();
    } catch (e) { setError(e.message); }
  };

  const handleUpdate = async (id) => {
    try {
      await apiService.updateUser(id, editData);
      setEditId(null);
      loadUsers();
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try { await apiService.deleteUser(id); loadUsers(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      <div className="glass-panel page-header animate-slide-up">
        <div className="page-header-left">
          <button onClick={onBack} className="btn btn-ghost">
            <ChevronLeft size={18} /> Volver
          </button>
          <Users size={22} color="var(--secondary)" />
          <h2 style={{ fontSize: '1.25rem' }}>Gestión de Usuarios</h2>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}

      {showCreate && (
        <div className="glass-panel animate-slide-down" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <Plus size={18} color="var(--primary)" /> Crear Nuevo Usuario
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label>Nombre de Usuario</label>
              <input className="input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} style={{ width: '200px' }} placeholder="usuario" />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" className="input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '200px' }} placeholder="contraseña" />
            </div>
            <div>
              <label>Rol</label>
              <select className="input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '150px' }}>
                <option value="admin">Admin</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visor</option>
              </select>
            </div>
            <button onClick={handleCreate} className="btn btn-primary" style={{ marginBottom: '0' }}>
              <Check size={16} /> Crear
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost" style={{ marginBottom: '0' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {['ID', 'Usuario', 'Rol', 'Estado', 'Creado', 'Acciones'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const RoleIcon = ROLE_ICONS[u.role] || Eye;
                const isEditing = editId === u.id;
                return (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-tertiary)' }}>{u.id}</td>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {u.username}
                        {isEditing && (
                          <input
                            type="password"
                            className="input"
                            placeholder="Nueva contraseña (opcional)"
                            value={editData.password || ''}
                            onChange={e => setEditData({ ...editData, password: e.target.value })}
                            style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem' }}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      {isEditing ? (
                        <select className="input" value={editData.role || u.role} onChange={e => setEditData({ ...editData, role: e.target.value })} style={{ width: '120px' }}>
                          <option value="admin">Admin</option>
                          <option value="operator">Operador</option>
                          <option value="viewer">Visor</option>
                        </select>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 10px', borderRadius: '6px', fontSize: '0.8rem', background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role] }}>
                          <RoleIcon size={14} /> {u.role}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select className="input" value={editData.active !== undefined ? editData.active : u.active} onChange={e => setEditData({ ...editData, active: e.target.value === 'true' })} style={{ width: '100px' }}>
                          <option value="true">Activo</option>
                          <option value="false">Deshabilitado</option>
                        </select>
                      ) : (
                        <span style={{ color: u.active ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem' }}>
                          {u.active ? '● Activo' : '○ Deshabilitado'}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{toLocalDatetime(u.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => handleUpdate(u.id)} className="btn btn-primary btn-sm">Guardar</button>
                            <button onClick={() => setEditId(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(u.id); setEditData({}); }} className="btn btn-sm" style={{ background: 'var(--btn-nav-history)', color: 'var(--btn-nav-history-text)', border: 'none' }}>
                              <Edit3 size={12} /> Editar
                            </button>
                            {u.id !== currentUser.id && (
                              <button onClick={() => handleDelete(u.id)} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: 'none' }}>
                                <Trash2 size={12} /> Eliminar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
