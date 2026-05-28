import React from 'react';
import { getLevelInfo } from '../lib/levelUtils.js';

// Полоса опыта: «Уровень N · тир» + cur/next XP + бар с плавным заполнением.
// Цвет берётся из тира. Наследует цвет текста от родителя (работает на тёмном
// сайдбаре и на светлой карточке профиля).
export default function XpBar({ xp = 0, style }) {
  const info = getLevelInfo(xp);
  const pct = Math.round(info.progress * 100);
  return (
    <div style={{ width: '100%', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: info.tier.color, whiteSpace: 'nowrap' }}>
          Уровень {info.level} · {info.tier.name}
        </span>
        <span style={{ fontWeight: 600, opacity: 0.7, whiteSpace: 'nowrap' }}>
          {info.currentLevelXp}/{info.nextLevelXp} XP
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'rgba(148,163,184,0.25)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${info.tier.color}, ${info.tier.color}cc)`,
          borderRadius: 99, boxShadow: `0 0 8px ${info.tier.color}80`,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}
