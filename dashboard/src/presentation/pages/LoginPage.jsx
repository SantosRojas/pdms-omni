import React, { useState } from 'react';
import { apiService } from '../../infrastructure/api';
import { LogIn, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiService.login(username, password);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Login failed');
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
      background: 'var(--bg-dark)',
      backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(0,210,255,0.06), transparent 40%), radial-gradient(circle at 70% 30%, rgba(59,130,246,0.06), transparent 40%)',
    }}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <ThemeToggle />
      </div>
      <div className="glass-panel" style={{
        padding: '48px',
        width: '420px',
        animation: 'slideUp 0.5s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 25px rgba(0,210,255,0.3)',
          }}>
            <LogIn size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(90deg, var(--text-main), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            OMNI PDMS
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Sign in to continue</p>
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '20px',
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Username</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              autoFocus required
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                background: 'var(--input-bg)', border: '1px solid var(--border)',
                color: 'var(--text-main)', fontSize: '1rem', fontFamily: 'var(--font-family)', outline: 'none',
                transition: 'border-color 0.2s', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                background: 'var(--input-bg)', border: '1px solid var(--border)',
                color: 'var(--text-main)', fontSize: '1rem', fontFamily: 'var(--font-family)', outline: 'none',
                transition: 'border-color 0.2s', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            padding: '12px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white', fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-family)',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 4px 15px rgba(0,210,255,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            marginTop: '8px',
          }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
