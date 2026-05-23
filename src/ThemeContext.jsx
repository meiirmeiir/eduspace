import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_LIGHT, THEME_DARK } from './lib/appConstants.js';

const ThemeContext = createContext(null);

// Палитры, перекрывающие base (light/dark) когда в equipped стоит shop-тема.
// Значения совпадают с CSS-селекторами в index.css ([data-shop-theme="..."]).
// primary НЕ совпадает с bg: иначе элементы с `color: THEME.primary` (H1,
// CTA-кнопки с `background:THEME.primary, color:THEME.accent`) сливаются с
// фоном. Поднимаем primary до контрастного оттенка surface.
const SHOP_THEME_OVERRIDES = {
  galaxy: { primary:'#1e1b4b', accent:'#a78bfa', bg:'#0f0a1e', surface:'#1e1b4b', text:'#e2e8f0', textLight:'rgba(226,232,240,0.7)', border:'#312e81' },
  sakura: { primary:'#fce7f3', accent:'#f472b6', bg:'#fff0f5', surface:'#fce7f3', text:'#831843', textLight:'rgba(131,24,67,0.7)', border:'#fbcfe8' },
  matrix: { primary:'#0d1f0d', accent:'#22c55e', bg:'#0a0f0a', surface:'#0d1f0d', text:'#22c55e', textLight:'rgba(34,197,94,0.7)', border:'#14532d' },
  fire:   { primary:'#2d1000', accent:'#f97316', bg:'#1a0a00', surface:'#2d1000', text:'#fed7aa', textLight:'rgba(253,211,170,0.7)', border:'#7c2d12' },
};

// BUG-13: dark mode = data-theme="dark" on <html>. Default (no attr) = light.
// Применяется в main.jsx до первого рендера, чтобы initial state ниже был корректен.
//
// shopThemeValue приходит из App.jsx после резолва user?.equipped?.theme через
// getShopItem(...).value. Если значение известно SHOP_THEME_OVERRIDES, оно
// мерджится поверх base-палитры; параллельно ставим document.body.dataset.shopTheme
// (CSS-оверрайды в index.css зависят от этого атрибута).
export function ThemeProvider({ children, shopThemeValue = null }) {
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

  useEffect(() => {
    if (shopThemeValue && SHOP_THEME_OVERRIDES[shopThemeValue]) {
      document.body.dataset.shopTheme = shopThemeValue;
    } else {
      delete document.body.dataset.shopTheme;
    }
  }, [shopThemeValue]);

  const value = useMemo(() => {
    const override = shopThemeValue ? SHOP_THEME_OVERRIDES[shopThemeValue] : null;
    // Shop-тема имеет приоритет над dark mode: базой всегда LIGHT, чтобы
    // оверрайды не получали dark-«хвосты» по неперекрытым полям (success/warning/error).
    const base = override ? THEME_LIGHT : (isDark ? THEME_DARK : THEME_LIGHT);
    const theme = override ? { ...THEME_LIGHT, ...override } : base;
    return { dark: isDark, theme, toggle, shopTheme: shopThemeValue || null };
  }, [isDark, shopThemeValue]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
