import React, { useState } from 'react';
import { apiService } from '../../infrastructure/api';
import { AlertCircle, LogIn } from 'lucide-react';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogoIcon } from '../components/LogoIcon';
import { FormField } from '../components/FormField';

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

const BG_CIRCLES = [
  { size: 600, color: 'hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.08)', top: '-200px', right: '-100px', delay: 0, duration: 4 },
  { size: 400, color: 'rgba(59,130,246,0.06)', bottom: '-100px', left: '-80px', delay: 2, duration: 5 },
  { size: 300, color: 'rgba(99,102,241,0.04)', bottom: '30%', right: '20%', delay: 1, duration: 6 },
];

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
      {BG_CIRCLES.map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${c.size}px`,
          height: `${c.size}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${c.color} 0%, transparent 70%)`,
          top: c.top,
          right: c.right,
          bottom: c.bottom,
          left: c.left,
          animation: `float ${c.duration}s ease-in-out infinite`,
          animationDelay: `${c.delay}s`,
          pointerEvents: 'none',
        }} />
      ))}

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
          <div style={{ margin: '0 auto 20px', width: 'fit-content' }}>
            <LogoIcon size={72} variant="primary" />
          </div>
          <h1 style={{
            fontSize: 'var(--fs-hero)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--text-primary), var(--primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '4px',
          }}>
            OMNI PDMS
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
            Inicia sesión para continuar
          </p>
        </div>

        {serverError && (
          <div className="message-box message-error" style={{ marginBottom: '24px' }}>
            <AlertCircle size={16} /> {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
          <FormField label="Nombre de Usuario" error={errors.username} touched={touched.username} required>
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
          </FormField>
          <FormField label="Contraseña" error={errors.password} touched={touched.password} required>
            <input
              id="password"
              type="password"
              className={`input${touched.password && errors.password ? ' input-error' : ''}`}
              value={password}
              onChange={e => { setPassword(e.target.value); if (touched.password) setErrors(validate(username, e.target.value)); }}
              onBlur={() => handleBlur('password')}
              placeholder="Ingresa tu contraseña"
            />
          </FormField>
          <Button type="submit" variant="primary" size="lg" fullWidth centered loading={loading} icon={LogIn}>
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
};
