import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { toLocalDatetime } from '../../infrastructure/time';
import { Users, Plus, Trash2, Edit, ShieldCheck, Eye, Settings, X, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';

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

  useEffect(() => {
    apiService.getUsers()
      .then(data => setUsers(data))
      .catch(e => setError(e.message));
  }, []);

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
    <div className="app-container">
      <PageHeader icon={Users} iconColor="var(--secondary)" onBack={onBack} title="Gestión de Usuarios">
        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>Nuevo Usuario</Button>
      </PageHeader>

      {error && (
        <div className="message-box message-error">{error}</div>
      )}

      {showCreate && (
        <div className="glass-panel animate-slide-down" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-body)' }}>
            <Plus size={18} color="var(--primary)" /> Crear Nuevo Usuario
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="Nombre de Usuario" required>
              <input className="input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} style={{ width: '200px' }} placeholder="usuario" />
            </FormField>
            <FormField label="Contraseña" required>
              <input type="password" className="input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '200px' }} placeholder="contraseña" />
            </FormField>
            <FormField label="Rol">
              <select className="input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '150px' }}>
                <option value="admin">Admin</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visor</option>
              </select>
            </FormField>
            <Button variant="primary" icon={Check} onClick={handleCreate}>Crear</Button>
            <Button variant="ghost" icon={X} onClick={() => setShowCreate(false)}>Cancelar</Button>
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
                            style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--fs-xs)' }}
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 10px', borderRadius: '6px', fontSize: 'var(--fs-xs)', background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role] }}>
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
                        <span style={{ color: u.active ? 'var(--success)' : 'var(--danger)', fontSize: 'var(--fs-sm)' }}>
                          {u.active ? '● Activo' : '○ Deshabilitado'}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>{toLocalDatetime(u.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isEditing ? (
                          <>
                            <Button variant="primary" size="sm" icon={Check} onClick={() => handleUpdate(u.id)}>Guardar</Button>
                            <Button variant="ghost" size="sm" icon={X} onClick={() => setEditId(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" icon={Edit} onClick={() => { setEditId(u.id); setEditData({}); }} style={{ background: 'var(--btn-nav-history)', color: 'var(--btn-nav-history-text)', border: '1px solid rgba(59,130,246,0.2)' }}>Editar</Button>
                            {u.id !== currentUser.id && (
                              <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(u.id)}>Eliminar</Button>
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
