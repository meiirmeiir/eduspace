import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext(null);

// BUG-13: derive state from the DOM attribute (single source of truth).
// Theme is applied to <html> in main.jsx before render, so the initial
// state below is always correct on mount.
export function ThemeProvider({ children }) {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  );

  const toggleTheme = () => {
    const nowLight =
      document.documentElement.getAttribute('data-theme') === 'light';
    if (nowLight) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'dark'); } catch {}
      setIsLight(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch {}
      setIsLight(true);
    }
  };

  return (
    <ThemeContext.Provider value={{ dark: !isLight, isLight, toggle: toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
