import React from 'react';
import { FRAME_STYLES } from '../lib/shopItems.js';
import { ensureCreatorStyles } from './creatorFx.js';

// Эксклюзивное кольцо Создателя — вращающийся золото-пурпур conic-gradient +
// шиммер-блик + 6 орбитальных искр + двойное свечение. Намеренно НЕ похоже ни
// на один из 6 тиров. Аватар (img/инициалы + рамка магазина) по центру.
export default function CreatorRing({ size = 96, avatarUrl, equippedFrame, label = '' }) {
  ensureCreatorStyles();
  const ringW = Math.max(3, Math.round(size * 0.09));
  const inner = size - ringW * 2;
  const R = size / 2 - ringW / 2;            // радиус орбиты искр (центр обода)
  const dot = Math.max(3, Math.round(size * 0.045));
  const frameStyle = equippedFrame ? (FRAME_STYLES[equippedFrame] || null) : null;

  const avatar = avatarUrl
    ? <img src={avatarUrl} alt="" style={{ width: inner, height: inner, borderRadius: '50%', objectFit: 'cover', display: 'block', ...(frameStyle || {}) }} />
    : <div style={{
        width: inner, height: inner, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff',
        fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: Math.round(inner * 0.4), ...(frameStyle || {}),
      }}>{label}</div>;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      {/* вращающийся золото-пурпур обод */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'conic-gradient(from 0deg,#fbbf24,#a855f7,#f59e0b,#7c3aed,#fde68a,#fbbf24)',
        animation: 'crSpin 6s linear infinite',
        boxShadow: '0 0 16px rgba(251,191,36,.6), 0 0 30px rgba(168,85,247,.5)',
      }} />
      {/* шиммер-блик поверх обода */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
        background: 'linear-gradient(120deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%)',
        backgroundSize: '200% 200%', mixBlendMode: 'screen', animation: 'crShimmer 2.6s linear infinite',
      }} />
      {/* аватар по центру (закрывает середину обода) */}
      <div style={{
        position: 'absolute', top: ringW, left: ringW, width: inner, height: inner,
        borderRadius: '50%', overflow: 'hidden', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
      }}>
        {avatar}
      </div>
      {/* орбитальные искры */}
      <div style={{ position: 'absolute', inset: 0, animation: 'crOrbit 9s linear infinite', zIndex: 2, pointerEvents: 'none' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', transformOrigin: '0 0', transform: `rotate(${i * 60}deg) translateY(-${R}px)` }}>
            <div style={{
              width: dot, height: dot, marginLeft: -dot / 2, marginTop: -dot / 2, borderRadius: '50%',
              background: i % 2 ? '#fde68a' : '#c084fc',
              boxShadow: `0 0 6px ${i % 2 ? '#fbbf24' : '#a855f7'}`,
              animation: `crTwinkle ${1.5 + i * 0.2}s ease-in-out infinite`,
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}
