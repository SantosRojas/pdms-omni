import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { ChevronLeft, User, Mail, Shield, Check, Key } from 'lucide-react';
import { Button } from '../components/Button';

export const ProfilePage = ({ currentUser, onBack, onUpdateUser }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    setFormData({
      full_name: currentUser.full_name || '',
      email: currentUser.email || '',
      password: '',
    });
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    setLoading(true);

    try {
      const updates = {};
      if (formData.full_name !== currentUser.full_name) updates.full_name = formData.full_name;
      if (formData.email !== currentUser.email) updates.email = formData.email;
      if (formData.password) updates.password = formData.password;

      if (Object.keys(updates).length > 0) {
        await apiService.updateUser(currentUser.id || currentUser.user_id, updates);
        setMsg({ text: '¡Perfil actualizado exitosamente!', type: 'success' });
        const newUserData = { ...currentUser, full_name: formData.full_name, email: formData.email };
        onUpdateUser(newUserData);
        setFormData(prev => ({ ...prev, password: '' }));
      } else {
        setMsg({ text: 'No hay cambios para guardar.', type: 'info' });
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container app-container-sm" style={{ gap: '20px' }}>
      <div className="glass-panel page-header animate-slide-up" style={{ marginTop: '20px' }}>
        <div className="page-header-left">
          <button onClick={onBack} className="btn btn-ghost">
            <ChevronLeft size={18} /> Volver
          </button>
          <User size={22} color="var(--primary)" />
          <h2 style={{ fontSize: 'var(--fs-xl)' }}>Mi Perfil</h2>
        </div>
      </div>

      <div className="glass-panel-elevated animate-slide-up" style={{ padding: '32px' }}>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--fs-hero)',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: 'var(--primary-shadow-md)',
          }}>
            {currentUser.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--fs-xxl)', margin: 0 }}>{currentUser.username}</h3>
            <span style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
            }}>
              <Shield size={14} color="var(--primary)" /> Rol: {currentUser.role}
            </span>
          </div>
        </div>

        {msg.text && (
          <div className={`message-box ${msg.type === 'error' ? 'message-error' : msg.type === 'success' ? 'message-success' : 'message-info'}`} style={{ marginBottom: '24px' }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> Nombre Completo
            </label>
            <input
              type="text"
              className="input"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="ej. Juan Pérez"
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> Correo Electrónico
            </label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="usuario@ejemplo.com"
            />
          </div>
          
          <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-default)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} /> Nueva Contraseña
            </label>
            <p style={{ fontSize: 'var(--fs-xxs)', color: 'var(--text-tertiary)', marginTop: '4px', marginBottom: '8px' }}>
              Déjelo en blanco para mantener la contraseña actual.
            </p>
            <input
              type="password"
              className="input"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder="Ingrese nueva contraseña"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" loading={loading} icon={Check}>Guardar Cambios</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
