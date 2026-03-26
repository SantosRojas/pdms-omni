import React, { useState, useEffect } from 'react';
import { apiService } from '../../infrastructure/api';
import { ChevronLeft, User, Mail, Shield, Check, X, Key } from 'lucide-react';

export const ProfilePage = ({ currentUser, onBack, onUpdateUser }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    // We populate with the current user's info.
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
        setMsg({ text: 'Profile updated successfully!', type: 'success' });
        
        // Pass the updated user info up to App.jsx to keep local state in sync
        const newUserData = { 
            ...currentUser, 
            full_name: formData.full_name, 
            email: formData.email 
        };
        onUpdateUser(newUserData);
        
        // clear password field so it doesn't stay populated
        setFormData(prev => ({ ...prev, password: '' }));
      } else {
        setMsg({ text: 'No changes to save.', type: 'info' });
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
    color: 'white', fontSize: '1rem', fontFamily: 'var(--font-family)', outline: 'none',
    transition: 'border-color 0.2s', boxSizing: 'border-box', marginTop: '6px'
  };

  return (
    <div className="app-container" style={{ gap: '20px', alignItems: 'center' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '600px', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            color: 'var(--text-main)', padding: '8px 16px', borderRadius: '10px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.9rem', fontFamily: 'var(--font-family)',
          }}>
            <ChevronLeft size={18} /> Back
          </button>
          <User size={22} color="var(--primary)" />
          <h2 style={{ fontSize: '1.25rem' }}>My Profile</h2>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '32px', width: '100%', maxWidth: '600px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {currentUser.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{currentUser.username}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Shield size={14} color="var(--primary)"/> Role: {currentUser.role}
            </span>
          </div>
        </div>

        {msg.text && (
          <div style={{
            padding: '10px 14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem',
            background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${msg.type === 'error' ? 'rgba(239,68,68,0.2)' : msg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
            color: msg.type === 'error' ? '#fca5a5' : msg.type === 'success' ? '#6ee7b7' : 'white',
          }}>
            {msg.type === 'error' ? '❌' : msg.type === 'success' ? '✅' : 'ℹ️'} {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> Full Name
            </label>
            <input 
              type="text" 
              value={formData.full_name} 
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              style={inputStyle}
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> Email Address
            </label>
            <input 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              style={inputStyle}
              placeholder="user@example.com"
            />
          </div>
          
          <div style={{ marginTop: '10px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} /> New Password
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Leave blank to keep current password.</p>
            <input 
              type="password" 
              value={formData.password} 
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              style={inputStyle}
              placeholder="Enter new password"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" disabled={loading} style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              border: 'none', color: 'white', padding: '10px 24px', borderRadius: '10px',
              cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 600,
              boxShadow: '0 4px 15px rgba(0,210,255,0.3)',
            }}>
              <Check size={16} /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
