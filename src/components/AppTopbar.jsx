import React from "react";
import Logo from "./ui/Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

/**
 * Единый верхний бар для standalone-экранов (Theory, Daily, Plan, Shop,
 * Leaderboard, Friends, Practice, Diagnostics и т.д.).
 *
 * Props (все опциональны, обратносовместимо):
 *   title            — заголовок раздела
 *   subtitle         — подпись рядом с заголовком («Задача 1/5», «📖 Теория»)
 *   onBack           — обработчик кнопки «Назад» (по умолчанию history.back())
 *   backLabel        — текст кнопки назад (по умолчанию «Назад»)
 *   variant          — 'light' (default) | 'dark' (THEME.primary) | 'transparent' (blur)
 *   rightSlot        — кастомный контент справа (рядом с переключателем темы)
 *   showThemeToggle  — показывать переключатель темы (default: true для light, false иначе)
 *
 * Высота 64px, padding 0 24px (16px на мобильном) — едины для всех вариантов.
 */
export default function AppTopbar({
  title,
  subtitle,
  onBack,
  backLabel = "Назад",
  variant = "light",
  rightSlot = null,
  showThemeToggle,
}) {
  const dark = variant === "dark" || variant === "transparent";
  const showToggle = showThemeToggle ?? (variant === "light");
  // onBack не передан → history.back(); onBack={null} → кнопку «Назад» не рисуем.
  const showBack = onBack !== null;
  const handleBack = onBack || (() => { try { window.history.back(); } catch { /* noop */ } });

  return (
    <nav className={`app-topbar app-topbar--${variant}`} data-inner-nav>
      {showBack && (
        <button className="app-topbar-back" onClick={handleBack} aria-label={backLabel}>
          <span aria-hidden="true">←</span>
          <span className="app-topbar-back-text">{backLabel}</span>
        </button>
      )}
      <Logo size={28} light={dark} />
      {title && <span className="app-topbar-title">{title}</span>}
      {subtitle && <span className="app-topbar-subtitle">{subtitle}</span>}
      {(rightSlot || showToggle) && (
        <div className="app-topbar-right">
          {rightSlot}
          {showToggle && <ThemeToggle />}
        </div>
      )}
    </nav>
  );
}
