import React, { useState } from 'react';
import { TIER_COLORS } from '../lib/achievements.js';

const TIER_NAMES = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', exclusive: 'Эксклюзив' };

// Один значок достижения.
//   ach         — запись из ACHIEVEMENTS (id, icon, name, levels[], exclusive?, superExclusive?)
//   earnedLevel — наивысший полученный уровень (0 = не получено)
//   progress    — опц. текущее числовое значение (свой профиль) для «X/Y» до следующего уровня
export default function AchievementBadge({ ach, earnedLevel = 0, progress }) {
  const [hover, setHover] = useState(false);

  const earned = earnedLevel > 0;
  const curLevel = earned ? ach.levels[earnedLevel - 1] : null;
  const nextLevel = ach.levels[earnedLevel] || null; // следующий не полученный
  const tier = curLevel?.tier || ach.levels[0].tier;
  const color = TIER_COLORS[tier] || '#94a3b8';

  // Внешний вид рамки/фона
  let frame;
  if (!earned) {
    frame = { background: 'rgba(148,163,184,0.12)', border: '2px solid rgba(148,163,184,0.35)', filter: 'grayscale(1)', opacity: 0.65 };
  } else if (ach.superExclusive) {
    frame = { background: 'linear-gradient(135deg,#f97316,#fbbf24,#a78bfa)', border: '2px solid #fff', boxShadow: '0 0 16px rgba(167,139,250,0.6)' };
  } else if (ach.exclusive) {
    frame = { background: 'linear-gradient(135deg,#6d28d9,#a78bfa)', border: `2px solid ${color}`, boxShadow: `0 0 12px ${color}66` };
  } else {
    frame = { background: `${color}1f`, border: `2.5px solid ${color}`, boxShadow: `0 0 10px ${color}40` };
  }

  // Текст следующего уровня для tooltip
  let nextText = null;
  if (nextLevel) {
    const base = `Следующий: ${TIER_NAMES[nextLevel.tier] || ''} — ${nextLevel.desc}`;
    nextText = (typeof progress === 'number' && typeof nextLevel.threshold === 'number')
      ? `${base} (${Math.min(progress, nextLevel.threshold)}/${nextLevel.threshold})`
      : base;
  } else if (earned) {
    nextText = 'Максимальный уровень';
  } else if (typeof progress === 'number' && typeof ach.levels[0].threshold === 'number') {
    // не получено, но есть прогресс к первому уровню
    nextText = `${ach.levels[0].desc} (${Math.min(progress, ach.levels[0].threshold)}/${ach.levels[0].threshold})`;
  }

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 84 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setHover(h => !h)}
    >
      <div style={{
        width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, position: 'relative', cursor: 'pointer', flexShrink: 0, ...frame,
      }}>
        <span style={{ filter: earned ? 'none' : 'grayscale(1)' }}>{ach.icon}</span>
        {!earned && (
          <span style={{ position: 'absolute', right: -2, bottom: -2, fontSize: 16, background: '#fff', borderRadius: '50%', lineHeight: 1 }}>🔒</span>
        )}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
        color: earned ? (ach.exclusive ? '#a78bfa' : color) : '#94a3b8',
        maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {ach.name}
      </div>

      {hover && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8,
          width: 200, background: '#0f172a', color: '#fff', borderRadius: 10, padding: '10px 12px',
          fontSize: 12, lineHeight: 1.45, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', textAlign: 'left',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>
            {ach.icon} {ach.name}{earned ? ` · ${TIER_NAMES[tier] || ''}` : ''}
          </div>
          {earned
            ? <div style={{ color: 'rgba(255,255,255,0.75)' }}>{curLevel.desc}</div>
            : <div style={{ color: 'rgba(255,255,255,0.6)' }}>Не получено</div>}
          {nextText && <div style={{ marginTop: 5, color: color, fontWeight: 600 }}>{nextText}</div>}
        </div>
      )}
    </div>
  );
}
