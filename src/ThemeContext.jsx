import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_LIGHT, THEME_DARK } from './lib/appConstants.js';

const ThemeContext = createContext(null);

// Палитры, перекрывающие base (light/dark) когда в equipped стоит shop-тема.
// Значения совпадают с CSS-селекторами в index.css ([data-shop-theme="..."]).
// primary === accent для тёмных shop-тем: на dark bg хорошо читается яркий
// акцентный цвет, и заголовки/кнопки с `color: THEME.primary` остаются видимы.
// Для sakura primary держим светло-розовым (surface) — index.css даёт ей
// тёмный фон, на котором светлый primary читается как «light-on-dark».
// onAccent — semantic-цвет текста НА accent-фоне (CTA-кнопки, шапки).
const SHOP_THEME_OVERRIDES = {
  galaxy: { primary:'#a78bfa', accent:'#a78bfa', onAccent:'#0f0a1e', onPrimary:'#e2e8f0', bg:'#0f0a1e', surface:'#1e1b4b', text:'#e2e8f0', textLight:'rgba(226,232,240,0.7)', border:'#312e81' },
  sakura: { primary:'#fce7f3', accent:'#f472b6', onAccent:'#831843', onPrimary:'#831843', bg:'#fff0f5', surface:'#fce7f3', text:'#831843', textLight:'rgba(131,24,67,0.7)', border:'#fbcfe8' },
  matrix: { primary:'#22c55e', accent:'#22c55e', onAccent:'#0a0f0a', onPrimary:'#22c55e', bg:'#0a0f0a', surface:'#0d1f0d', text:'#22c55e', textLight:'rgba(34,197,94,0.7)', border:'#14532d' },
  fire:   { primary:'#f97316', accent:'#f97316', onAccent:'#1a0a00', onPrimary:'#fed7aa', bg:'#1a0a00', surface:'#2d1000', text:'#fed7aa', textLight:'rgba(253,211,170,0.7)', border:'#7c2d12' },
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
  // Локальный «override» поверх медленного prop-канала (App ← AuthContext ←
  // Firestore onSnapshot). ShopScreen зовёт setShopTheme сразу после
  // успешного equipItem — UI обновляется мгновенно, не дожидаясь sync.
  const [shopThemeOverride, setShopThemeOverride] = useState(shopThemeValue);
  useEffect(() => { setShopThemeOverride(shopThemeValue); }, [shopThemeValue]);

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
    if (shopThemeOverride && SHOP_THEME_OVERRIDES[shopThemeOverride]) {
      document.body.dataset.shopTheme = shopThemeOverride;
    } else {
      delete document.body.dataset.shopTheme;
    }
  }, [shopThemeOverride]);

  const value = useMemo(() => {
    const override = shopThemeOverride ? SHOP_THEME_OVERRIDES[shopThemeOverride] : null;
    // Shop-тема имеет приоритет над dark mode: базой всегда LIGHT, чтобы
    // оверрайды не получали dark-«хвосты» по неперекрытым полям (success/warning/error).
    const base = override ? THEME_LIGHT : (isDark ? THEME_DARK : THEME_LIGHT);
    const theme = override ? { ...THEME_LIGHT, ...override } : base;
    return {
      dark: isDark,
      theme,
      toggle,
      shopTheme: shopThemeOverride || null,
      setShopTheme: setShopThemeOverride,
    };
  }, [isDark, shopThemeOverride]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
