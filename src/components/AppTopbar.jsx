import React from "react";
import Logo from "./ui/Logo.jsx";
import TopbarStats from "./TopbarStats.jsx";

/**
 * Единый верхний бар для standalone-экранов (Theory, Daily, Plan, Shop,
 * Leaderboard, Friends, Practice, Diagnostics и т.д.). Трёхзонный:
 *   ЛЕВО   — Назад (или leftSlot, напр. бургер) + Logo (без подзаголовка).
 *   ЦЕНТР  — иконка + title (+ subtitle). Только десктоп (≥768px), на мобайле скрыт.
 *   ПРАВО  — rightSlot + TopbarStats (чипы ESR/Кристаллы + переключатель темы).
 *
 * Переключатель темы теперь всегда в правой зоне (TopbarStats), независимо от
 * variant — dark/transparent-экраны его больше не теряют.
 *
 * Props (все опциональны, обратносовместимо):
 *   title     — заголовок раздела (центр, десктоп)
 *   subtitle  — подпись под заголовком
 *   onBack    — обработчик «Назад» (по умолчанию history.back()); onBack={null} → без кнопки
 *   backLabel — текст кнопки назад (по умолчанию «Назад»)
 *   variant   — 'light' (default) | 'dark' (THEME.primary) | 'transparent' (blur)
 *   rightSlot — кастомный контент справа (перед TopbarStats)
 *   leftSlot  — кастомный контент слева (перед кнопкой «Назад»)
 *   user      — пользователь для чипов ESR/Кристаллы (read-only; нет user → нет чипов)
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
  leftSlot = null,
  user,
}) {
  const dark = variant === "dark" || variant === "transparent";
  // onBack не передан → history.back(); onBack={null} → кнопку «Назад» не рисуем.
  const showBack = onBack !== null;
  const handleBack = onBack || (() => { try { window.history.back(); } catch { /* noop */ } });

  return (
    <nav className={`app-topbar app-topbar--${variant}`} data-inner-nav>
      <div className="app-topbar-left">
        {leftSlot}
        {showBack && (
          <button className="app-topbar-back" onClick={handleBack} aria-label={backLabel}>
            <span aria-hidden="true">←</span>
            <span className="app-topbar-back-text">{backLabel}</span>
          </button>
        )}
        <Logo size={28} light={dark} showSubtitle={false} />
      </div>
      {title && (
        <div className="app-topbar-center">
          <span className="app-topbar-title">{title}</span>
          {subtitle && <span className="app-topbar-subtitle">{subtitle}</span>}
        </div>
      )}
      <div className="app-topbar-right">
        {rightSlot}
        <TopbarStats user={user} dark={dark} />
      </div>
    </nav>
  );
}
