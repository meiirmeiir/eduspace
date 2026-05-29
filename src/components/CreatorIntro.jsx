import React, { useEffect, useRef, useState } from 'react';
import { ensureCreatorStyles, playFanfare } from './creatorFx.js';

// Входная анимация Создателя: корона спускается сверху на аватар + бёрст искр
// из центра + тихая фанфара (Web Audio). Проигрывается один раз при открытии
// (guard через ref). Оверлей абсолютный — кладётся поверх обёртки аватара.
export default function CreatorIntro({ crownSize = 46 }) {
  ensureCreatorStyles();
  const [show, setShow] = useState(true);
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    playFanfare();
    const t = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}>
      {/* корона спускается на верх аватара */}
      <div style={{
        position: 'absolute', left: '50%', top: -Math.round(crownSize * 0.5), fontSize: crownSize, lineHeight: 1,
        animation: 'crCrownDrop 1.1s cubic-bezier(.2,.8,.2,1) forwards', filter: 'drop-shadow(0 0 8px #fbbf24)',
      }}>👑</div>
      {/* радиальный бёрст искр из центра */}
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', transformOrigin: '0 0', transform: `rotate(${i * 36}deg)` }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', opacity: 0,
            background: i % 2 ? '#fde68a' : '#c084fc', boxShadow: '0 0 6px #fbbf24',
            animation: 'crBurstFly 0.9s ease-out 0.15s forwards',
          }} />
        </div>
      ))}
    </div>
  );
}
