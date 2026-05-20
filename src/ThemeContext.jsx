import { createContext, useContext, useMemo, useState } from 'react';
import { THEME_LIGHT, THEME_DARK } from './lib/appConstants.js';

const ThemeContext = createContext(null);

// BUG-13: dark mode = data-theme="dark" on <html>, which triggers
// the explicit overrides in index.css. Default (no attribute) = light.
// Theme is applied in main.jsx before first render, so the initial
// state below is correct on mount.
//
// Audit follow-up: expose a `theme` object (light/dark palette) so new
// components can do `const { theme } = useTheme()` and styles update
// reactively when the theme switches.
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );

  const toggle = () => {
    const nowDark =
      document.documentElement.getAttribute('data-theme') === 'dark';
    if (nowDark) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'light'); } catch {}
      setIsDark(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('theme', 'dark'); } catch {}
      setIsDark(true);
    }
  };

  const value = useMemo(() => ({
    dark: isDark,
    theme: isDark ? THEME_DARK : THEME_LIGHT,
    toggle,
  }), [isDark]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
