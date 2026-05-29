import React, { useMemo } from 'react';
import { ensureCreatorStyles } from './creatorFx.js';

// Эксклюзивный анимированный космический фон Создателя (нет в магазине).
// Медленный звёздный градиент + мерцающие звёзды (box-shadow) + плавающие
// искры-звёзды. Чистый CSS (без WebGL), работает постоянно и дёшево.
function starShadows(n, w, h) {
  return Array.from({ length: n }, () => `${Math.round(Math.random() * w)}px ${Math.round(Math.random() * h)}px #fff`).join(', ');
}

export default function CreatorBackground() {
  ensureCreatorStyles();
  const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const h = typeof window !== 'undefined' ? window.innerHeight : 900;
  const stars1 = useMemo(() => starShadows(90, w, h), [w, h]);
  const stars2 = useMemo(() => starShadows(40, w, h), [w, h]);
  const floats = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 8, dur: 9 + Math.random() * 8, gold: i % 2 === 0,
  })), []);

  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden',
      background: 'linear-gradient(135deg,#0a0918,#1e1b4b,#312e81,#0a0918)',
      backgroundSize: '400% 400%', animation: 'crBgShift 20s ease infinite',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, borderRadius: '50%', boxShadow: stars1, animation: 'crStarTwinkle 4s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 2, borderRadius: '50%', boxShadow: stars2, animation: 'crStarTwinkle 6s ease-in-out infinite' }} />
      {floats.map((f, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: -12, left: `${f.left}%`, width: 6, height: 6, borderRadius: '50%',
          background: f.gold ? '#fde68a' : '#c084fc', boxShadow: `0 0 8px ${f.gold ? '#fbbf24' : '#a855f7'}`,
          animation: `crFloat ${f.dur}s linear ${f.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}
