import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// BUG-4: use data-theme="light" attribute (no filter:invert), persist as 'theme'.
// Default = dark (no attribute on <html>). Light = attribute present.
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') !== 'light'; }
    catch { return true; }
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'dark'); } catch {}
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch {}
    }
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
