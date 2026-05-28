import React from 'react';

// Полноэкранная анимация повышения уровня. info = { newLevel, tierChanged, newTier }.
const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.7,
  dur: 1.6 + Math.random() * 1.4,
  rot: Math.random() * 360,
  color: ['#fbbf24', '#f97316', '#a78bfa', '#67e8f9', '#34d399'][i % 5],
}));

export default function LevelUpModal({ info, onClose }) {
  if (!info) return null;
  const color = info.newTier?.color || '#fbbf24';
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, overflow: 'hidden' }}
    >
      <style>{`
        @keyframes luPop { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes luFall { to { transform: translateY(110vh) rotate(720deg); opacity: 0.15; } }
        @keyframes luGlow { 0%,100%{filter:drop-shadow(0 0 14px var(--lc))} 50%{filter:drop-shadow(0 0 36px var(--lc))} }
      `}</style>

      {CONFETTI.map((c, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', top: -24, left: `${c.left}%`, width: 9, height: 14,
          background: c.color, borderRadius: 2, transform: `rotate(${c.rot}deg)`,
          animation: `luFall ${c.dur}s ${c.delay}s ease-in forwards`,
        }} />
      ))}

      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', textAlign: 'center', color: '#fff', padding: '0 24px', animation: 'luPop 0.6s cubic-bezier(0.2,0.8,0.2,1) both' }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color, marginBottom: 8 }}>
          Новый уровень
        </div>
        <div style={{ '--lc': color, fontFamily: "'Montserrat',sans-serif", fontSize: 120, fontWeight: 800, lineHeight: 1, color, animation: 'luGlow 1.8s ease-in-out infinite' }}>
          {info.newLevel}
        </div>
        {info.tierChanged && info.newTier && (
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color }}>
            Новый ранг: {info.newTier.name}!
          </div>
        )}
        <button
          onClick={onClose}
          style={{ marginTop: 26, background: color, color: '#0f172a', border: 'none', borderRadius: 12, padding: '12px 36px', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
