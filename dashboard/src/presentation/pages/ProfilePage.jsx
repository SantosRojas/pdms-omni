import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../infrastructure/api';
import { User, Mail, Shield, Check, Lock, UserCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { Card } from '../components/Card';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateProfile({ full_name, email, password, confirmPassword }) {
  const errors = {};
  if (!full_name || full_name.trim().length < 2) {
    errors.full_name = 'El nombre debe tener al menos 2 caracteres.';
  }
  if (email && email.trim() && !EMAIL_RE.test(email.trim())) {
    errors.email = 'El correo electrónico no es válido.';
  }
  if (password && password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password && !confirmPassword) {
    errors.confirmPassword = 'Debe confirmar la nueva contraseña.';
  }
  if (password && confirmPassword && password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }
  return errors;
}

function passwordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['', 'Débil', 'Media', 'Buena', 'Fuerte'];
const STRENGTH_COLORS = ['', 'var(--danger)', 'var(--warning)', '#22c55e', 'var(--primary)'];

export const ProfilePage = ({ currentUser, onBack, onUpdateUser }) => {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    let mounted = true;
    setProfileLoading(true);
    apiService.getMe().then(data => {
      if (!mounted) return;
      setProfile(data);
      setFormData({ full_name: data.full_name || '', email: data.email || '', password: '', confirmPassword: '' });
    }).catch(() => {
      if (!mounted) return;
      if (currentUser) {
        setProfile(currentUser);
        setFormData({ full_name: currentUser.full_name || '', email: currentUser.email || '', password: '', confirmPassword: '' });
      }
    }).finally(() => {
      if (mounted) setProfileLoading(false);
    });
    return () => { mounted = false; };
  }, [currentUser]);

  useEffect(() => {
    if (msg.type === 'success') {
      const t = setTimeout(() => setMsg({ text: '', type: '' }), 3000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  const errors = validateProfile(formData);
  const isDirty = profile && (
    formData.full_name !== (profile.full_name || '') ||
    formData.email !== (profile.email || '') ||
    formData.password !== ''
  );

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ full_name: true, email: true, password: true, confirmPassword: true });
    if (Object.keys(errors).length > 0) return;
    setMsg({ text: '', type: '' });
    setLoading(true);
    try {
      const updates = {};
      if (formData.full_name !== profile.full_name) updates.full_name = formData.full_name;
      if (formData.email !== profile.email) updates.email = formData.email;
      if (formData.password) updates.password = formData.password;
      if (Object.keys(updates).length > 0) {
        await apiService.updateUser(profile.id, updates);
        setMsg({ text: '¡Perfil actualizado exitosamente!', type: 'success' });
        setProfile(prev => ({ ...prev, ...updates }));
        onUpdateUser({ ...currentUser, full_name: formData.full_name, email: formData.email });
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setTouched({});
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(formData.password);

  if (profileLoading) {
    return (
      <div className="app-container app-container-sm">
        <PageHeader icon={User} onBack={onBack} title="Mi Perfil" />
        <Card elevated padding="lg" className="animate-slide-up">
          <div className="loading-state">
            <div className="spinner spinner-lg" />
            <p>Cargando perfil...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-container app-container-sm">
      <PageHeader icon={User} onBack={onBack} title="Mi Perfil" />

      <Card elevated padding="none" className="animate-slide-up">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--fs-xxl)', margin: 0 }}>{profile.username}</h3>
            <span className="profile-role-badge">
              <Shield size={14} color="var(--primary)" /> Rol: {profile.role}
            </span>
          </div>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>
          {msg.text && (
            <div className={`message-box ${msg.type === 'error' ? 'message-error' : msg.type === 'success' ? 'message-success' : 'message-info'}`} style={{ marginBottom: '24px' }}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="profile-form">
            <FormField label="Nombre Completo" icon={UserCheck} required error={errors.full_name} touched={touched.full_name}>
              <input
                type="text"
                className={`input ${touched.full_name && errors.full_name ? 'input-error' : ''}`}
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                onBlur={() => handleBlur('full_name')}
                placeholder="ej. Juan Pérez"
              />
            </FormField>

            <FormField label="Correo Electrónico" icon={Mail} error={errors.email} touched={touched.email}>
              <input
                type="email"
                className={`input ${touched.email && errors.email ? 'input-error' : ''}`}
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                onBlur={() => handleBlur('email')}
                placeholder="usuario@ejemplo.com"
              />
            </FormField>

            <div className="form-section-divider">
              <FormField label="Nueva Contraseña" icon={Lock} error={errors.password} touched={touched.password}>
                <p className="form-hint">Déjelo en blanco para mantener la contraseña actual.</p>
                <input
                  type="password"
                  className={`input ${touched.password && errors.password ? 'input-error' : ''}`}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value, confirmPassword: '' })}
                  onBlur={() => handleBlur('password')}
                  placeholder="Ingrese nueva contraseña"
                />
                {formData.password && (
                  <div className="password-strength">
                    <div className="password-strength-bar" style={{ width: `${(strength / 4) * 100}%`, background: STRENGTH_COLORS[strength] }} />
                    <span style={{ color: STRENGTH_COLORS[strength], fontSize: 'var(--fs-xxs)' }}>
                      {STRENGTH_LABELS[strength]}
                    </span>
                  </div>
                )}
              </FormField>

              {formData.password && (
                <FormField label="Confirmar Contraseña" icon={Lock} required error={errors.confirmPassword} touched={touched.confirmPassword}>
                  <input
                    type="password"
                    className={`input ${touched.confirmPassword && errors.confirmPassword ? 'input-error' : ''}`}
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder="Repita la nueva contraseña"
                  />
                </FormField>
              )}
            </div>

            <div className="profile-form-actions">
              <Button type="submit" variant="primary" loading={loading} icon={Check} disabled={!isDirty}>
                Guardar Cambios
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
