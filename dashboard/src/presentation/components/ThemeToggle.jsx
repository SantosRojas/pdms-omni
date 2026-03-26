import React from 'react';
import { useTheme } from './ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  // Cycle through themes: system -> light -> dark -> system
  const handleToggle = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    switch(theme) {
      case 'light': return <Sun size={16} />;
      case 'dark': return <Moon size={16} />;
      default: return <Monitor size={16} />;
    }
  };

  return (
    <button 
      onClick={handleToggle}
      title={`Theme: ${theme}`}
      style={{
        background: 'var(--btn-bg, rgba(255,255,255,0.05))',
        border: 'none',
        color: 'var(--text-main)',
        padding: '6px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}
    >
      {getIcon()}
    </button>
  );
};
