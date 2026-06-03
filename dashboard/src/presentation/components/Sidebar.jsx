import React from 'react';
import { Home, Layers, Users, Settings, LogOut, Activity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { hash: '#/', label: 'Inicio', icon: Home, roles: null },
  { hash: '#/equivalences', label: 'Equivalencias', icon: Layers, roles: null },
  { hash: '#/admin', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { hash: '#/profile', label: 'Configuración', icon: Settings, roles: null },
];

export const Sidebar = ({ user, onLogout }) => {
  const currentHash = window.location.hash || '#/';

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      width: '240px',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      overflowY: 'auto',
    }}>
      {/* Logo / Brand */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Activity size={22} color="var(--primary)" />
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
          PDMS Omni
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map(item => {
          if (item.roles && !item.roles.includes(user.role)) return null;
          const active = currentHash === item.hash || 
            (item.hash === '#/' && currentHash === '#') ||
            (item.hash !== '#/' && currentHash.startsWith(item.hash));
          const Icon = item.icon;

          return (
            <a
              key={item.hash}
              href={item.hash}
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = item.hash;
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                textDecoration: 'none',
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                background: active ? 'rgba(0,210,255,0.08)' : 'transparent',
                fontWeight: active ? 600 : 400,
                fontSize: '0.85rem',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseOver={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--btn-bg)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }
              }}
              onMouseOut={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon size={18} />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* User info + Theme + Logout */}
      <div style={{
        padding: '16px 16px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {(user.full_name || user.username || '?')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.full_name || user.username}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {user.role}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.06)',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 500,
            fontFamily: 'var(--font-family)',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
