import React from 'react';
import { Home, Layers, Users, User, Settings, LogOut, Activity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { hash: '#/', label: 'Inicio', icon: Home, roles: null },
  { hash: '#/equivalences', label: 'Equivalencias', icon: Layers, roles: null },
  { hash: '#/admin', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { hash: '#/profile', label: 'Perfil', icon: User, roles: null },
  { hash: '#/settings', label: 'Ajustes', icon: Settings, roles: null },
];

export const Sidebar = ({ user, onLogout, open, currentHash }) => {

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      {/* Logo / Brand */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Activity size={20} color="#0f172a" />
        </div>
        <span className="sidebar-logo-text">PDMS Omni</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
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
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(user.full_name || user.username || '?')[0].toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.full_name || user.username}</div>
            <div className="sidebar-user-role">{user.role}</div>
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
