import React from "react";

const ITEMS = [
  { id: "dashboard", icon: "🏠", label: "Главная" },
  { id: "plan",      icon: "🗺️", label: "План" },
  { id: "daily",     icon: "📝", label: "Ежедневные задачи" },
  { id: "theory",    icon: "📖", label: "Теория" },
  { id: "profile",   icon: "👤", label: "Профиль" },
];

// dailyStatus: 'locked' | 'due' | 'done' | null
function dailyBadgeFor(status) {
  if (status === 'locked') return <span className="mbn-badge mbn-badge-lock" aria-label="заблокировано">🔒</span>;
  if (status === 'due')    return <span className="mbn-badge mbn-badge-due"  aria-label="есть задачи"/>;
  if (status === 'done')   return <span className="mbn-badge mbn-badge-done" aria-label="выполнено">✅</span>;
  return null;
}

export default function MobileBottomNav({ active, onNavigate, dailyStatus = null }) {
  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Основная навигация">
      {ITEMS.map(item => {
        const badge = item.id === "daily" ? dailyBadgeFor(dailyStatus) : null;
        return (
          <button
            key={item.id}
            data-nav-id={item.id}
            className={`mbn-item ${active === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? "page" : undefined}
          >
            <span className="mbn-icon">
              {item.icon}
              {badge}
            </span>
            <span className="mbn-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
