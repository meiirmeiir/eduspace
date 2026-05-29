import React, { useMemo } from 'react';

// Атмосферный фон карты модулей: космический градиент + 2 слоя дрейфующих
// звёзд (CSS box-shadow) + тёплый подсвет, растущий с прогрессом. Чистый CSS,
// фиксированный за вьюпортом ReactFlow (не панится) → «глубина» без нагрузки.
function starShadows(n, w, h) {
  return Array.from({ length: n }, () => `${Math.round(Math.random() * w)}px ${Math.round(Math.random() * h)}px #fff`).join(', ');
}

export default function MapBackground({ progress = 0 }) {
  const stars1 = useMemo(() => starShadows(70, 1600, 1000), []);
  const stars2 = useMemo(() => starShadows(34, 1600, 1000), []);
  const warm = Math.min(0.3, Math.max(0, progress) * 0.32); // 0..0.3 — теплее с прогрессом

  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0,
      background: 'radial-gradient(ellipse at 50% 38%, #14132e 0%, #0a0a1e 46%, #05050f 100%)',
    }}>
      <div className="map-stars map-stars-a" style={{ boxShadow: stars1 }} />
      <div className="map-stars map-stars-b" style={{ boxShadow: stars2 }} />
      {/* тёплый подсвет по прогрессу */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 62%, rgba(251,191,36,${warm}) 0%, transparent 58%)` }} />
    </div>
  );
}
