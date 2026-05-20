import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext(null);

// BUG-13: dark mode = data-theme="dark" on <html>, which triggers
// MapStyles.css filter:invert(1) hue-rotate(180deg) on #root.
// Default (no attribute) = light. Theme is applied in main.jsx
// before first render, so the initial state below is correct on mount.
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

  return (
    <ThemeContext.Provider value={{ dark: isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
