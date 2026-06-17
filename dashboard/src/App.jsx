import React, { useState, useEffect, useRef } from 'react';
import { LoginPage } from './presentation/pages/LoginPage';
import { TherapySelectionPage } from './presentation/pages/TherapySelectionPage';
import { LiveMonitorPage } from './presentation/pages/LiveMonitorPage';
import { ScadaPage } from './presentation/pages/ScadaPage';
import { TherapyDetailPage } from './presentation/pages/TherapyDetailPage';
import { HistoryView } from './presentation/pages/HistoryView';
import { AdminPage } from './presentation/pages/AdminPage';
import { EquivalencesPage } from './presentation/pages/EquivalencesPage';
import { SignalsPage } from './presentation/pages/SignalsPage';
import { ProfilePage } from './presentation/pages/ProfilePage';
import { SettingsPage } from './presentation/pages/SettingsPage';
import { Sidebar } from './presentation/components/Sidebar';
import { NotFoundPage } from './presentation/pages/NotFoundPage';
import { ErrorBoundary } from './presentation/components/ErrorBoundary';
import { apiService } from './infrastructure/api';
import { Menu, X } from 'lucide-react';
import { Button } from './presentation/components/Button';
import { LogoIcon } from './presentation/components/LogoIcon';
import './index.css';

const parseHash = () => {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/history/')) {
    const id = parseInt(hash.replace('#/history/', ''), 10);
    if (!isNaN(id)) {
      return { view: 'history', historyTherapy: { id }, therapyDetailId: null };
    }
  } else if (hash.startsWith('#/therapy/')) {
    const id = hash.replace('#/therapy/', '');
    return { view: 'therapy-detail', historyTherapy: null, therapyDetailId: id };
  } else if (hash === '#/admin') {
    return { view: 'admin', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/equivalences') {
    return { view: 'equivalences', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/signals-config') {
    return { view: 'signals-config', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/profile') {
    return { view: 'profile', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/settings') {
    return { view: 'settings', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/scada') {
    return { view: 'scada', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/live') {
    return { view: 'live-monitor', historyTherapy: null, therapyDetailId: null };
  } else if (hash === '#/' || hash === '#') {
    return { view: 'therapy-selection', historyTherapy: null, therapyDetailId: null };
  }
  return { view: 'not-found', historyTherapy: null, therapyDetailId: null };
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!apiService.getToken());

  const initialRoute = parseHash();
  const [view, setView] = useState(initialRoute.view);
  const [historyTherapy, setHistoryTherapy] = useState(initialRoute.historyTherapy);
  const [therapyDetailId, setTherapyDetailId] = useState(initialRoute.therapyDetailId);
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
        } catch {
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
      setTherapyDetailId(route.therapyDetailId);
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
    window.location.hash = '#/';
  };

  const handleLogout = async () => {
    await apiService.logout();
    setUser(null);
    window.location.hash = '#/';
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <LogoIcon size={72} variant="primary" />
        <div className="spinner spinner-lg" style={{ borderColor: 'rgba(0,210,255,0.15)', borderTopColor: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-input)' }}>Restaurando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const handleNavigateHistory = (therapy) => {
    historySource.current = window.location.hash;
    window.location.hash = `#/history/${therapy.id}`;
  };

  const handleHistoryBack = () => {
    window.location.hash = historySource.current?.startsWith('#/therapy/') ? historySource.current : '#/';
    historySource.current = null;
  };

  const renderContent = () => {
    switch (view) {
      case 'history':
        return <HistoryView therapy={historyTherapy} userRole={user.role} onBack={handleHistoryBack} />;
      case 'therapy-detail':
        return <TherapyDetailPage therapyId={therapyDetailId} onNavigateHistory={handleNavigateHistory} />;
      case 'scada':
        return <ScadaPage />;
      case 'live-monitor':
        return <LiveMonitorPage user={user} />;
      case 'admin':
        return <AdminPage currentUser={user} onBack={() => { window.location.hash = '#/'; }} />;
      case 'equivalences':
        return <EquivalencesPage userRole={user.role} onBack={() => { window.location.hash = '#/'; }} />;
      case 'signals-config':
        return <SignalsPage userRole={user.role} onBack={() => { window.location.hash = '#/'; }} />;
      case 'profile':
        return <ProfilePage currentUser={user} onBack={() => { window.location.hash = '#/'; }} onUpdateUser={setUser} />;
      case 'settings':
        return <SettingsPage onBack={() => { window.location.hash = '#/'; }} />;
      case 'not-found':
        return <NotFoundPage onBack={() => { window.location.hash = '#/'; }} />;
      default:
        return <TherapySelectionPage user={user} onNavigateHistory={handleNavigateHistory} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar user={user} onLogout={handleLogout} open={sidebarOpen} currentHash={window.location.hash || '#/'} />
      {sidebarOpen && !isDesktop && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Button
        variant="ghost"
        size="icon"
        icon={sidebarOpen ? X : Menu}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`sidebar-toggle${sidebarOpen && isDesktop ? ' shifted' : ''}`}
        aria-label="Toggle menu"
      />
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
