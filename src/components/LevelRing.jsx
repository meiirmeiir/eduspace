import React from 'react';
import { getLevelInfo } from '../lib/levelUtils.js';
import { FRAME_STYLES } from '../lib/shopItems.js';

// Кольцо тира вокруг аватара + бейдж уровня внизу справа. Магазинная рамка
// (equippedFrame) применяется к самому аватару (внутри кольца). Легенда (41+) —
// анимированное огненное кольцо (conic-gradient + вращение).

let _stylesInjected = false;
function ensureStyles() {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.id = 'level-ring-styles';
  s.textContent = `
    @keyframes lrLegendSpin { to { transform: rotate(360deg); } }
    .lr-legend-ring {
      background: conic-gradient(from 0deg, #f97316, #fbbf24, #ef4444, #fb923c, #f97316);
      animation: lrLegendSpin 3.5s linear infinite;
    }`;
  document.head.appendChild(s);
}

export default function LevelRing({ xp = 0, avatarUrl, equippedFrame, size = 64, label = '', showLevel = true }) {
  ensureStyles();
  const info = getLevelInfo(xp);
  const color = info.tier.color;
  const isLegend = info.tier.tier === 'legend';
  const ringW = Math.max(2, Math.round(size * 0.07));
  const inner = size - ringW * 2;
  const badge = Math.max(16, Math.round(size * 0.36));
  const frameStyle = equippedFrame ? (FRAME_STYLES[equippedFrame] || null) : null;

  const avatar = avatarUrl
    ? <img src={avatarUrl} alt="" style={{ width: inner, height: inner, borderRadius: '50%', objectFit: 'cover', display: 'block', ...(frameStyle || {}) }} />
    : <div style={{
        width: inner, height: inner, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff',
        fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: Math.round(inner * 0.4), ...(frameStyle || {}),
      }}>{label}</div>;

  // Без уровня — только аватар+рамка (для teacher/admin).
  if (!showLevel) {
    return <span style={{ display: 'inline-flex', flexShrink: 0 }}>{avatar}</span>;
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      {/* кольцо тира */}
      <div
        className={isLegend ? 'lr-legend-ring' : undefined}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLegend ? undefined : color,
          boxShadow: `0 0 ${Math.round(size * 0.14)}px ${color}66`,
        }}
      />
      {/* аватар поверх центра кольца */}
      <div style={{
        position: 'absolute', top: ringW, left: ringW, width: inner, height: inner,
        borderRadius: '50%', overflow: 'hidden', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {avatar}
      </div>
      {/* бейдж уровня */}
      <div style={{
        position: 'absolute', right: -2, bottom: -2,
        minWidth: badge, height: badge, borderRadius: badge, padding: '0 4px', boxSizing: 'border-box',
        background: color, color: '#0f172a', border: '2px solid #0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: Math.round(badge * 0.52), lineHeight: 1,
      }}>{info.level}</div>
    </div>
  );
}
