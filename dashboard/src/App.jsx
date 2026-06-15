import React, { useState, useEffect, useRef } from 'react';
import { LoginPage } from './presentation/pages/LoginPage';
import { Dashboard } from './presentation/pages/Dashboard';
import { HistoryView } from './presentation/pages/HistoryView';
import { AdminPage } from './presentation/pages/AdminPage';
import { EquivalencesPage } from './presentation/pages/EquivalencesPage';
import { ProfilePage } from './presentation/pages/ProfilePage';
import { SettingsPage } from './presentation/pages/SettingsPage';
import { Sidebar } from './presentation/components/Sidebar';
import { NotFoundPage } from './presentation/pages/NotFoundPage';
import { ErrorBoundary } from './presentation/components/ErrorBoundary';
import { apiService } from './infrastructure/api';
import { Activity, Menu, X } from 'lucide-react';
import './index.css';

const parseHash = () => {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/history/')) {
    const id = parseInt(hash.replace('#/history/', ''), 10);
    if (!isNaN(id)) {
      return { view: 'history', historyTherapy: { id }, dashboardTherapyId: null };
    }
  } else if (hash.startsWith('#/therapy/')) {
    const id = hash.replace('#/therapy/', '');
    return { view: 'dashboard', historyTherapy: null, dashboardTherapyId: id };
  } else if (hash === '#/admin') {
    return { view: 'admin', historyTherapy: null, dashboardTherapyId: null };
  } else if (hash === '#/equivalences') {
    return { view: 'equivalences', historyTherapy: null, dashboardTherapyId: null };
  } else if (hash === '#/profile') {
    return { view: 'profile', historyTherapy: null, dashboardTherapyId: null };
  } else if (hash === '#/settings') {
    return { view: 'settings', historyTherapy: null, dashboardTherapyId: null };
  } else if (hash === '#/live') {
    return { view: 'dashboard', historyTherapy: null, dashboardTherapyId: 'live' };
  } else if (hash === '#/' || hash === '#') {
    return { view: 'dashboard', historyTherapy: null, dashboardTherapyId: null };
  }
  return { view: 'not-found', historyTherapy: null, dashboardTherapyId: null };
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!apiService.getToken());
  
  const initialRoute = parseHash();
  const [view, setView] = useState(initialRoute.view);
  const [historyTherapy, setHistoryTherapy] = useState(initialRoute.historyTherapy);
  const [dashboardTherapyId, setDashboardTherapyId] = useState(initialRoute.dashboardTherapyId);
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const historySource = useRef(null);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const token = apiService.getToken();
      if (token) {
        try {
          const userData = await apiService.getMe();
          apiService.setToken(token);
          setUser(userData);
        } catch (err) {
          console.error('Error al recuperar sesión:', err);
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
      setDashboardTherapyId(route.dashboardTherapyId);
      setCurrentHash(window.location.hash || '#/');
      setSidebarOpen(false);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (sidebarOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen, isDesktop]);

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

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--primary-shadow-lg)',
          marginBottom: '8px',
        }}>
          <Activity size={32} color="#0f172a" />
        </div>
        <div className="spinner spinner-lg" style={{ borderColor: 'rgba(0,210,255,0.15)', borderTopColor: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-input)' }}>Restaurando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (view) {
      case 'history':
        return <HistoryView therapy={historyTherapy} userRole={user.role} onBack={() => { window.location.hash = historySource.current?.startsWith('#/therapy/') ? historySource.current : '#/'; historySource.current = null; }} />;
      case 'admin':
        return <AdminPage currentUser={user} onBack={() => { window.location.hash = '#/'; }} />;
      case 'equivalences':
        return <EquivalencesPage userRole={user.role} onBack={() => { window.location.hash = '#/'; }} />;
      case 'profile':
        return <ProfilePage currentUser={user} onBack={() => { window.location.hash = '#/'; }} onUpdateUser={setUser} />;
      case 'settings':
        return <SettingsPage onBack={() => { window.location.hash = '#/'; }} />;
      case 'not-found':
        return <NotFoundPage onBack={() => { window.location.hash = '#/'; }} />;
      default:
        return (
          <Dashboard
            user={user}
            therapyId={dashboardTherapyId}
            onNavigateHistory={(therapy) => {
              historySource.current = window.location.hash;
              window.location.hash = `#/history/${therapy.id}`;
            }}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar user={user} onLogout={handleLogout} open={sidebarOpen} currentHash={currentHash} />
      {sidebarOpen && !isDesktop && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <button
        className={`sidebar-toggle${sidebarOpen && isDesktop ? ' shifted' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <main
        className={`main-with-sidebar${sidebarOpen && isDesktop ? ' sidebar-pushed' : ''}`}
        onClick={() => { if (sidebarOpen && !isDesktop) setSidebarOpen(false); }}
      >
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
