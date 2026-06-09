import React, { useState } from 'react';
import { apiService } from '../../infrastructure/api';
import { Activity, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

const MIN_USERNAME = 3;
const MIN_PASSWORD = 6;

const validate = (username, password) => {
  const errors = {};
  if (!username.trim()) errors.username = 'El usuario es obligatorio';
  else if (username.trim().length < MIN_USERNAME) errors.username = `Mínimo ${MIN_USERNAME} caracteres`;
  if (!password) errors.password = 'La contraseña es obligatoria';
  else if (password.length < MIN_PASSWORD) errors.password = `Mínimo ${MIN_PASSWORD} caracteres`;
  return errors;
};

export const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(validate(username, password));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate(username, password);
    setErrors(v);
    setTouched({ username: true, password: true });
    if (v.username || v.password) return;
    setServerError('');
    setLoading(true);
    try {
      const data = await apiService.login(username, password);
      onLogin(data.user, data.token);
    } catch (err) {
      setServerError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.08) 0%, transparent 70%)',
        top: '-200px',
        right: '-100px',
        animation: 'float 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        bottom: '-100px',
        left: '-80px',
        animation: 'float 5s ease-in-out infinite',
        animationDelay: '2s',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
        bottom: '30%',
        right: '20%',
        animation: 'float 6s ease-in-out infinite',
        animationDelay: '1s',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'absolute', top: 24, right: 24 }}>
        <ThemeToggle />
      </div>

      <div className="glass-panel-elevated animate-scale-in" style={{
        padding: '48px 40px',
        width: '420px',
        maxWidth: '90vw',
        position: 'relative',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: 'var(--primary-shadow-lg)',
          }}>
            <Activity size={32} color="#0f172a" />
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--text-primary), var(--primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '4px',
          }}>
            OMNI PDMS
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Inicia sesión para continuar
          </p>
        </div>

        {serverError && (
          <div className="message-box message-error" style={{ marginBottom: '24px' }}>
            <AlertCircle size={16} /> {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
          <div>
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              className={`input${touched.username && errors.username ? ' input-error' : ''}`}
              value={username}
              onChange={e => { setUsername(e.target.value); if (touched.username) setErrors(validate(e.target.value, password)); }}
              onBlur={() => handleBlur('username')}
              autoFocus
              placeholder="Ingresa tu usuario"
            />
            {touched.username && errors.username && (
              <span className="field-error">{errors.username}</span>
            )}
          </div>
          <div>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className={`input${touched.password && errors.password ? ' input-error' : ''}`}
              value={password}
              onChange={e => { setPassword(e.target.value); if (touched.password) setErrors(validate(username, e.target.value)); }}
              onBlur={() => handleBlur('password')}
              placeholder="Ingresa tu contraseña"
            />
            {touched.password && errors.password && (
              <span className="field-error">{errors.password}</span>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              justifyContent: 'center',
              padding: '12px',
              fontSize: '1rem',
              marginTop: '4px',
            }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> Ingresando...</>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
