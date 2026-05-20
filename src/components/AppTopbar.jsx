import React from "react";
import Logo from "./ui/Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

/**
 * Shared top bar for standalone screens (Theory, Daily, Plan,
 * Practice, Mastery, etc).
 *
 * Layout: [back ←] [logo] [title] [theme toggle]
 * Full-width on every viewport, themed via index.css.
 */
export default function AppTopbar({ title, onBack }) {
  return (
    <nav className="app-topbar" data-inner-nav>
      {onBack && (
        <button className="app-topbar-back" onClick={onBack} aria-label="Назад">
          <span aria-hidden="true">←</span>
          <span className="app-topbar-back-text">Назад</span>
        </button>
      )}
      <Logo size={28} />
      {title && <span className="app-topbar-title">{title}</span>}
      <ThemeToggle />
    </nav>
  );
}
