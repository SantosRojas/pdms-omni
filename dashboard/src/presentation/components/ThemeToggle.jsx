import React from 'react';
import { useTheme } from './useTheme';
import { Moon, Sun, Monitor } from 'lucide-react';

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

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
      case 'light': return <Sun size={15} />;
      case 'dark': return <Moon size={15} />;
      default: return <Monitor size={15} />;
    }
  };

  return (
    <button 
      onClick={handleToggle}
      title={`Tema: ${theme}`}
      className="btn-icon btn-ghost"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
      }}
    >
      {getIcon()}
    </button>
  );
};
