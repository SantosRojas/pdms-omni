import React from 'react';
import { Home, Layers, Users, Settings, LogOut, Activity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { hash: '#/', label: 'Inicio', icon: Home, roles: null },
  { hash: '#/equivalences', label: 'Equivalencias', icon: Layers, roles: null },
  { hash: '#/admin', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { hash: '#/profile', label: 'Configuración', icon: Settings, roles: null },
];

export const Sidebar = ({ user, onLogout, open }) => {
  const currentHash = window.location.hash || '#/';

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      {/* Logo / Brand */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,210,255,0.3)',
        }}>
          <Activity size={20} color="#0f172a" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          PDMS Omni
        </span>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: '16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
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
              className={`nav-link${active ? ' active' : ''}`}
            >
              <Icon size={18} />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* User info + Theme + Logout */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border-default)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary), #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {(user.full_name || user.username || '?')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user.full_name || user.username}
            </div>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-tertiary)',
              textTransform: 'capitalize',
            }}>
              {user.role}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={onLogout}
          className="btn-logout"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
