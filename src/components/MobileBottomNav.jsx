import React from "react";

const ITEMS = [
  { id: "dashboard", icon: "🏠", label: "Главная" },
  { id: "plan",      icon: "🗺️", label: "План" },
  { id: "daily",     icon: "📝", label: "Дневник" },
  { id: "theory",    icon: "📖", label: "Теория" },
  { id: "profile",   icon: "👤", label: "Профиль" },
];

export default function MobileBottomNav({ active, onNavigate }) {
  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Основная навигация">
      {ITEMS.map(item => (
        <button
          key={item.id}
          className={`mbn-item ${active === item.id ? "active" : ""}`}
          onClick={() => onNavigate(item.id)}
          aria-current={active === item.id ? "page" : undefined}
        >
          <span className="mbn-icon">{item.icon}</span>
          <span className="mbn-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
