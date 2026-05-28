import React, { useState } from 'react';
import AchievementBadge from './AchievementBadge.jsx';

// Частицы (кристаллы/искры), вылетающие при открытии.
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  angle: (Math.PI * 2 * i) / 24 + (Math.random() - 0.5),
  dist: 90 + Math.random() * 70,
  delay: Math.random() * 0.15,
  emoji: ['💎', '✨', '⭐'][i % 3],
}));

// item: { type:'achievement', ach, level } | { type:'quest', quest:{icon,title,crystals} }
export default function RewardChest({ item, onClose }) {
  const [open, setOpen] = useState(false);
  if (!item) return null;

  const isAch = item.type === 'achievement';
  const crystals = isAch ? item.level?.crystals : item.quest?.crystals;
  const title = isAch ? item.ach?.name : item.quest?.title;
  const subtitle = isAch ? (item.level?.desc || '') : 'Квест выполнен';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, overflow: 'hidden' }}>
      <style>{`
        @keyframes rcChestIdle { 0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-6px) rotate(-3deg)} 75%{transform:translateY(-6px) rotate(3deg)} }
        @keyframes rcGlow { from{opacity:0;transform:scale(0.4)} to{opacity:0.9;transform:scale(1)} }
        @keyframes rcReveal { 0%{opacity:0;transform:scale(0.5) translateY(10px)} 70%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes rcParticle { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)} 20%{opacity:1} 100%{opacity:0} }
      `}</style>

      <div style={{ position: 'relative', textAlign: 'center', color: '#fff', padding: '0 24px', width: '100%', maxWidth: 360 }}>
        {!open ? (
          // ── Закрытый сундук ──
          <button
            onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, margin: '0 auto' }}
          >
            <div style={{ fontSize: 110, lineHeight: 1, animation: 'rcChestIdle 1.6s ease-in-out infinite', filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.5))' }}>📦</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, color: '#fbbf24' }}>Нажми, чтобы открыть</div>
          </button>
        ) : (
          // ── Открытый: свет + частицы + награда ──
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* световое пятно */}
            <div style={{ position: 'absolute', top: '40%', left: '50%', width: 280, height: 280, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.45), transparent 70%)', animation: 'rcGlow 0.5s ease-out both', pointerEvents: 'none' }} />
            {/* частицы */}
            {PARTICLES.map((p, i) => (
              <span key={i} style={{
                position: 'absolute', top: '38%', left: '50%', fontSize: 18, pointerEvents: 'none',
                '--tx': `${Math.cos(p.angle) * p.dist}px`, '--ty': `${Math.sin(p.angle) * p.dist}px`,
                animation: `rcParticle 1.1s ${p.delay}s ease-out forwards`,
                transform: `translate(calc(-50% + ${Math.cos(p.angle) * p.dist}px), calc(-50% + ${Math.sin(p.angle) * p.dist}px))`,
              }}>{p.emoji}</span>
            ))}

            <div style={{ position: 'relative', animation: 'rcReveal 0.5s 0.1s ease-out both' }}>
              {isAch
                ? <AchievementBadge ach={item.ach} earnedLevel={item.level?.level || 1} />
                : <div style={{ fontSize: 64, lineHeight: 1 }}>{item.quest?.icon || '⚡'}</div>}
            </div>

            <div style={{ marginTop: 12, animation: 'rcReveal 0.5s 0.25s ease-out both' }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 22 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{subtitle}</div>}
              {crystals > 0 && (
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 20, color: '#a78bfa', marginTop: 10 }}>
                  +{crystals} 💎
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              style={{ marginTop: 22, background: '#fbbf24', color: '#0f172a', border: 'none', borderRadius: 12, padding: '12px 40px', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer', animation: 'rcReveal 0.5s 0.4s ease-out both' }}
            >
              Забрать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
