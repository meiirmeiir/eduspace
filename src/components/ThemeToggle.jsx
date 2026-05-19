import React from "react";
import { useTheme } from "../ThemeContext.jsx";

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <div className="theme-toggle">
      <button className="theme-toggle-track" onClick={toggle} title={dark ? 'Светлая тема' : 'Тёмная тема'}>
        <span className={`theme-toggle-thumb${dark ? ' is-dark' : ''}`}>
          {dark ? '🌙' : '☀️'}
        </span>
      </button>
    </div>
  );
}
