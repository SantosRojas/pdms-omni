import React, { useState } from 'react';
import { LoginPage } from './presentation/pages/LoginPage';
import { Dashboard } from './presentation/pages/Dashboard';
import { HistoryView } from './presentation/pages/HistoryView';
import { AdminPage } from './presentation/pages/AdminPage';
import { EquivalencesPage } from './presentation/pages/EquivalencesPage';
import { ProfilePage } from './presentation/pages/ProfilePage';
import { apiService } from './infrastructure/api';
import './index.css';

function App() {
  const [user, setUser] = useState(null);     // { id, username, role, ... }
  const [view, setView] = useState('dashboard');
  const [historyTherapy, setHistoryTherapy] = useState(null);

  const handleLogin = (userData, token) => {
    apiService.setToken(token);
    setUser(userData);
    setView('dashboard');
  };

  const handleLogout = async () => {
    await apiService.logout();
    setUser(null);
    setView('dashboard');
  };

  // Not logged in → show login
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Logged in → route by view
  switch (view) {
    case 'history':
      return (
        <HistoryView
          therapy={historyTherapy}
          onBack={() => setView('dashboard')}
        />
      );

    case 'admin':
      return (
        <AdminPage
          currentUser={user}
          onBack={() => setView('dashboard')}
        />
      );

    case 'equivalences':
      return (
        <EquivalencesPage
          userRole={user.role}
          onBack={() => setView('dashboard')}
        />
      );

    case 'profile':
      return (
        <ProfilePage
          currentUser={user}
          onBack={() => setView('dashboard')}
          onUpdateUser={setUser}
        />
      );

    default:
      return (
        <Dashboard
          user={user}
          onNavigateHistory={(therapy) => {
            setHistoryTherapy(therapy);
            setView('history');
          }}
          onNavigateAdmin={() => setView('admin')}
          onNavigateEquivalences={() => setView('equivalences')}
          onNavigateProfile={() => setView('profile')}
          onLogout={handleLogout}
        />
      );
  }
}

export default App;
