import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
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
    if (!confirm('Delete this user?')) return;
    try { await apiService.deleteUser(id); loadUsers(); }
    catch (e) { setError(e.message); }
  };

  const inputStyle = {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
    background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.875rem',
    fontFamily: 'var(--font-family)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div className="app-container" style={{ gap: '20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            color: 'var(--text-main)', padding: '8px 16px', borderRadius: '10px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.9rem', fontFamily: 'var(--font-family)',
          }}>
            <ChevronLeft size={18} /> Back
          </button>
          <Users size={22} color="var(--secondary)" />
          <h2 style={{ fontSize: '1.25rem' }}>User Management</h2>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          border: 'none', color: 'white', padding: '8px 20px', borderRadius: '10px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 600,
          boxShadow: '0 4px 15px rgba(0,210,255,0.3)',
        }}>
          <Plus size={16}/> New User
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.875rem' }}>
          ❌ {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="var(--primary)" /> Create New User
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Username</label>
              <input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} style={{ ...inputStyle, width: '200px' }} placeholder="username" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Password</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} style={{ ...inputStyle, width: '200px' }} placeholder="password" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Role</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ ...inputStyle, width: '150px' }}>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button onClick={handleCreate} style={{ background: 'var(--success)', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-family)', fontWeight: 600 }}>
              <Check size={16} /> Create
            </button>
            <button onClick={() => setShowCreate(false)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-family)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Username', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const RoleIcon = ROLE_ICONS[u.role] || Eye;
              const isEditing = editId === u.id;
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(0,210,255,0.04)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{u.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {u.username}
                      {isEditing && (
                        <input 
                          type="password" 
                          placeholder="New password (optional)" 
                          value={editData.password || ''} 
                          onChange={e => setEditData({ ...editData, password: e.target.value })} 
                          style={{ ...inputStyle, width: '100%', padding: '4px 8px', fontSize: '0.8rem' }} 
                        />
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <select value={editData.role || u.role} onChange={e => setEditData({ ...editData, role: e.target.value })} style={{ ...inputStyle, width: '120px' }}>
                        <option value="admin">Admin</option>
                        <option value="operator">Operator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 10px', borderRadius: '6px', fontSize: '0.8rem', background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role] }}>
                        <RoleIcon size={14} /> {u.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <select value={editData.active !== undefined ? editData.active : u.active} onChange={e => setEditData({ ...editData, active: e.target.value === 'true' })} style={{ ...inputStyle, width: '100px' }}>
                        <option value="true">Active</option>
                        <option value="false">Disabled</option>
                      </select>
                    ) : (
                      <span style={{ color: u.active ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem' }}>
                        {u.active ? '● Active' : '○ Disabled'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.created_at}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => handleUpdate(u.id)} style={{ background: 'var(--success)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-family)' }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-family)' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(u.id); setEditData({}); }} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', color: '#93c5fd', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontFamily: 'var(--font-family)' }}>
                            <Edit3 size={12} /> Edit
                          </button>
                          {u.id !== currentUser.id && (
                            <button onClick={() => handleDelete(u.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#fca5a5', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontFamily: 'var(--font-family)' }}>
                              <Trash2 size={12} /> Delete
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
  );
};
