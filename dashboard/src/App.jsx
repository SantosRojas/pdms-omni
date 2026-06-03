import React, { useState, useEffect } from 'react';
import { LoginPage } from './presentation/pages/LoginPage';
import { Dashboard } from './presentation/pages/Dashboard';
import { HistoryView } from './presentation/pages/HistoryView';
import { AdminPage } from './presentation/pages/AdminPage';
import { EquivalencesPage } from './presentation/pages/EquivalencesPage';
import { ProfilePage } from './presentation/pages/ProfilePage';
import { Sidebar } from './presentation/components/Sidebar';
import { apiService } from './infrastructure/api';
import './index.css';

const parseHash = () => {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/history/')) {
    const therapyId = parseInt(hash.replace('#/history/', ''), 10);
    if (!isNaN(therapyId)) {
      return { view: 'history', historyTherapy: { id: therapyId } };
    }
  } else if (hash === '#/admin') {
    return { view: 'admin', historyTherapy: null };
  } else if (hash === '#/equivalences') {
    return { view: 'equivalences', historyTherapy: null };
  } else if (hash === '#/profile') {
    return { view: 'profile', historyTherapy: null };
  }
  return { view: 'dashboard', historyTherapy: null };
};

function App() {
  const [user, setUser] = useState(null);     // { id, username, role, ... }
  const [loading, setLoading] = useState(!!apiService.getToken());
  
  const initialRoute = parseHash();
  const [view, setView] = useState(initialRoute.view);
  const [historyTherapy, setHistoryTherapy] = useState(initialRoute.historyTherapy);

  useEffect(() => {
    const restoreSession = async () => {
      const token = apiService.getToken();
      if (token) {
        try {
          const userData = await apiService.getMe();
          setUser(userData);
        } catch (err) {
          console.error('Error recovering session:', err);
          apiService.setToken(null);
        }
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHash();
      setView(route.view);
      setHistoryTherapy(route.historyTherapy);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = (userData, token) => {
    apiService.setToken(token);
    setUser(userData);
    const route = parseHash();
    if (route.view === 'dashboard') {
      window.location.hash = '#/';
    }
  };

  const handleLogout = async () => {
    await apiService.logout();
    setUser(null);
    window.location.hash = '#/';
  };

  // Session restoring/loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
        color: 'var(--text-main)',
        fontFamily: 'var(--font-family)',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(0,210,255,0.1)',
          borderTop: '3px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Restoring session...</p>
      </div>
    );
  }

  // Not logged in → show login
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Logged in → sidebar layout with routed content
  const renderContent = () => {
    switch (view) {
      case 'history':
        return (
          <HistoryView
            therapy={historyTherapy}
            onBack={() => { window.location.hash = '#/'; }}
          />
        );

      case 'admin':
        return (
          <AdminPage
            currentUser={user}
            onBack={() => { window.location.hash = '#/'; }}
          />
        );

      case 'equivalences':
        return (
          <EquivalencesPage
            userRole={user.role}
            onBack={() => { window.location.hash = '#/'; }}
          />
        );

      case 'profile':
        return (
          <ProfilePage
            currentUser={user}
            onBack={() => { window.location.hash = '#/'; }}
            onUpdateUser={setUser}
          />
        );

      default:
        return (
          <Dashboard
            user={user}
            onNavigateHistory={(therapy) => {
              window.location.hash = `#/history/${therapy.id}`;
            }}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar user={user} onLogout={handleLogout} />
      <main style={{ flex: 1, marginLeft: '240px', padding: '20px', minWidth: 0 }}>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
