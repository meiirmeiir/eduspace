import React from "react";
import { useTheme } from "../ThemeContext.jsx";

export default function ThemeToggle() {
  const { dark, toggle, shopTheme } = useTheme();
  // Shop-тема перебивает dark/light: пока она надета, переключатель прячем,
  // чтобы пользователь не получал «двух источников правды» по палитре.
  if (shopTheme) return null;
  return (
    <div className="theme-toggle">
      <button className="theme-toggle-track" onClick={toggle} title={dark ? 'Светлая тема' : 'Тёмная тема'}>
        <span className={`theme-toggle-thumb${dark ? ' is-dark' : ''}`}>
          <span className="theme-toggle-glyph">{dark ? '🌙' : '☀️'}</span>
        </span>
      </button>
    </div>
  );
}
