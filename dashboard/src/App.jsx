import React, { useState } from 'react';
import { LoginPage } from './presentation/pages/LoginPage';
import { Dashboard } from './presentation/pages/Dashboard';
import { HistoryView } from './presentation/pages/HistoryView';
import { AdminPage } from './presentation/pages/AdminPage';
import { EquivalencesPage } from './presentation/pages/EquivalencesPage';
import { apiService } from './infrastructure/api';
import './index.css';

function App() {
  const [user, setUser] = useState(null);     // { id, username, role, ... }
  const [view, setView] = useState('dashboard');
  const [historyPatient, setHistoryPatient] = useState('');

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
          patientId={historyPatient}
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

    default:
      return (
        <Dashboard
          user={user}
          onNavigateHistory={(patientId) => {
            setHistoryPatient(patientId);
            setView('history');
          }}
          onNavigateAdmin={() => setView('admin')}
          onNavigateEquivalences={() => setView('equivalences')}
          onLogout={handleLogout}
        />
      );
  }
}

export default App;
