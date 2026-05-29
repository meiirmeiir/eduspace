import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext.jsx';

// Прогресс по плану как коллекционная сборка космолёта. 10 деталей; каждые 10%
// освоенных навыков открывают одну (эскиз-чертёж → полноцвет с анимацией). Под
// кораблём — бар с 10 метками-деталями. При 100% — разовый взлёт + свечение.
// «Играет один раз» по uid через localStorage (как aapa_planet_seen_*).

// Порядок сборки 1→10 (деталь i открывается при progress ≥ i·10%).
const PARTS = [
  { id: 'hull', name: 'Корпус', d: 'M110 66 C127 66 132 86 132 108 L132 168 C132 181 122 188 110 188 C98 188 88 181 88 168 L88 108 C88 86 93 66 110 66 Z', fill: 'url(#gHull)', stroke: '#9fb6e0' },
  { id: 'nose', name: 'Нос', d: 'M110 42 C119 52 128 64 130 78 L90 78 C92 64 101 52 110 42 Z', fill: 'url(#gGold)', stroke: '#ffe08a' },
  { id: 'cockpit', name: 'Кабина', circle: [110, 104, 13.5], fill: 'url(#gGlass)', stroke: '#bfe9ff' },
  { id: 'wingL', name: 'Левое крыло', d: 'M88 122 L54 192 L72 192 L88 162 Z', fill: 'url(#gHull2)', stroke: '#9fb6e0' },
  { id: 'wingR', name: 'Правое крыло', d: 'M132 122 L166 192 L148 192 L132 162 Z', fill: 'url(#gHull2)', stroke: '#9fb6e0' },
  { id: 'tail', name: 'Хвостовой стабилизатор', d: 'M90 182 L130 182 L136 204 L84 204 Z', fill: 'url(#gHull2)', stroke: '#9fb6e0' },
  { id: 'engineL', name: 'Левый двигатель', d: 'M92 202 L106 202 L103 220 L95 220 Z', fill: '#3f4d6b', stroke: '#9fb0d0' },
  { id: 'engineR', name: 'Правый двигатель', d: 'M114 202 L128 202 L125 220 L117 220 Z', fill: '#3f4d6b', stroke: '#9fb0d0' },
  { id: 'antenna', name: 'Антенна', d: 'M110 42 L110 22', circle: [110, 20, 2.5], fill: 'none', stroke: '#bfe9ff', thin: true },
  { id: 'trim', name: 'Дюзы и детали', lines: ['M92 138 L128 138', 'M95 158 L125 158', 'M110 82 L110 130'], circles: [[99, 122, 2], [121, 122, 2]], fill: 'none', stroke: '#ffd86b', thin: true },
];
const BY_ID = Object.fromEntries(PARTS.map((p, i) => [p.id, { ...p, idx: i + 1 }]));
// z-порядок отрисовки цветных слоёв (крылья/двигатели/хвост позади корпуса)
const Z = ['wingL', 'wingR', 'tail', 'engineL', 'engineR', 'hull', 'nose', 'cockpit', 'antenna', 'trim'];

const STARS = [[30, 40], [180, 30], [200, 90], [22, 110], [196, 160], [34, 200], [186, 214], [60, 24], [150, 220], [16, 70]];

const KEYFRAMES = `
@keyframes shipPartAppear { 0%{opacity:0;transform:translateY(-10px) scale(.8);} 60%{opacity:1;} 100%{opacity:1;transform:none;} }
@keyframes shipLaunch { 0%{transform:translateY(0);} 22%{transform:translateY(-46px);} 60%{transform:translateY(-46px);} 100%{transform:translateY(0);} }
@keyframes shipFlame { 0%,100%{opacity:0;transform:scaleY(.4);} 12%{opacity:1;transform:scaleY(1);} 55%{opacity:1;transform:scaleY(1.1);} 72%{opacity:0;transform:scaleY(.4);} }
@keyframes shipGlow { 0%,100%{filter:drop-shadow(0 0 5px rgba(102,178,255,0.5));} 50%{filter:drop-shadow(0 0 16px rgba(102,178,255,0.95));} }
`;

function renderPart(p, mode, style) {
  const sketch = mode === 'sketch';
  const base = sketch
    ? { fill: 'none', stroke: 'rgba(148,163,184,0.5)', strokeWidth: 1.4, strokeDasharray: '4 3', opacity: 0.5, strokeLinejoin: 'round' }
    : { fill: p.thin ? 'none' : p.fill, stroke: p.stroke, strokeWidth: p.thin ? 2 : 1.2, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const els = [];
  if (p.d) els.push(<path key="d" d={p.d} {...base} />);
  if (p.circle) els.push(<circle key="c" cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} {...base} />);
  (p.lines || []).forEach((d, k) => els.push(<path key={'l' + k} d={d} {...base} />));
  (p.circles || []).forEach((c, k) => els.push(<circle key={'cc' + k} cx={c[0]} cy={c[1]} r={c[2]} {...base} fill={sketch ? 'none' : p.stroke} />));
  return <g key={p.id + mode} style={style}>{els}</g>;
}

export default function ShipProgress({ mastered = 0, total = 0, ready = false, uid }) {
  const { theme: THEME } = useTheme();
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const K = Math.min(10, Math.floor(pct / 10));

  const key = uid ? `aapa_ship_parts_${uid}` : 'aapa_ship_parts';
  const [seen] = useState(() => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } });
  useEffect(() => { if (!ready) return; try { localStorage.setItem(key, String(K)); } catch {} }, [K, key, ready]);

  if (!ready) {
    return <div className="empty-state" style={{ padding: '12px 0', fontSize: 14 }}>Пройди диагностику чтобы увидеть свой прогресс</div>;
  }

  const launching = K === 10 && seen < 10;
  const partStyle = (idx) => {
    if (idx > seen) { const order = idx - seen - 1; return { animation: `shipPartAppear .55s ease ${order * 120}ms both`, transformBox: 'fill-box', transformOrigin: 'center' }; }
    return undefined;
  };
  const flameStyle = { animation: launching ? 'shipFlame 2.4s ease 0.3s 1 both' : 'none', opacity: 0, transformBox: 'fill-box', transformOrigin: 'top' };
  const nextPct = (K + 1) * 10 - pct;

  return (
    <div>
      <style>{KEYFRAMES}</style>
      <svg viewBox="0 0 220 250" style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="gHull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fa8d8" /><stop offset="0.5" stopColor="#4a5e90" /><stop offset="1" stopColor="#2a3a66" />
          </linearGradient>
          <linearGradient id="gHull2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#42527c" /><stop offset="1" stopColor="#222f52" />
          </linearGradient>
          <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9a8" /><stop offset="1" stopColor="#e0a93b" />
          </linearGradient>
          <radialGradient id="gGlass">
            <stop offset="0" stopColor="#e6f7ff" /><stop offset="0.55" stopColor="#5ab4e6" /><stop offset="1" stopColor="#1c5e8c" />
          </radialGradient>
          <linearGradient id="gFlame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3b0" /><stop offset="0.5" stopColor="#ffb13b" /><stop offset="1" stopColor="#ff5a2b" />
          </linearGradient>
          <radialGradient id="gBg" cx="0.5" cy="0.42" r="0.7">
            <stop offset="0" stopColor="#1a2348" /><stop offset="0.6" stopColor="#0c1230" /><stop offset="1" stopColor="#070a1c" />
          </radialGradient>
        </defs>

        {/* фон-космос */}
        <rect x="3" y="3" width="214" height="244" rx="18" fill="url(#gBg)" />
        {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill="#fff" opacity={0.45} />)}

        <g style={K === 10 ? { animation: 'shipGlow 3s ease-in-out infinite' } : undefined}>
          <g style={launching ? { animation: 'shipLaunch 2.4s ease 0.3s 1 both', transformBox: 'fill-box', transformOrigin: 'center' } : undefined}>
            {/* эскизы всех деталей (синька-чертёж) */}
            {Z.map((id) => renderPart(BY_ID[id], 'sketch', undefined))}
            {/* пламя — только во время взлёта */}
            <path d="M95 220 L103 220 L99 246 Z" fill="url(#gFlame)" style={flameStyle} />
            <path d="M117 220 L125 220 L121 246 Z" fill="url(#gFlame)" style={flameStyle} />
            {/* цветные слои собранных деталей */}
            {Z.map((id) => { const p = BY_ID[id]; return p.idx <= K ? renderPart(p, 'color', partStyle(p.idx)) : null; })}
          </g>
        </g>
      </svg>

      {/* прогресс-бар с 10 метками-деталями */}
      <div style={{ position: 'relative', marginTop: 16, padding: '0 5px' }}>
        <div style={{ height: 10, borderRadius: 99, background: 'rgba(148,163,184,0.25)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #f5c518, #66b2ff)', borderRadius: 99, boxShadow: '0 0 8px rgba(102,178,255,0.5)', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ position: 'absolute', top: -2, left: 5, right: 5, height: 0 }}>
          {PARTS.map((p, i) => {
            const reached = i + 1 <= K;
            return (
              <span key={p.id} title={p.name} style={{
                position: 'absolute', left: `${(i + 1) * 10}%`, transform: 'translateX(-50%)',
                width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box',
                border: `1.5px solid ${reached ? '#f5c518' : 'rgba(148,163,184,0.6)'}`,
                background: reached ? 'radial-gradient(circle, #fff, #f5c518)' : 'transparent',
                boxShadow: reached ? '0 0 6px rgba(245,197,24,0.7)' : 'none',
              }} />
            );
          })}
        </div>
      </div>

      {/* подписи */}
      <div style={{ marginTop: 14, fontSize: 13, color: THEME.textLight, fontWeight: 600, textAlign: 'center' }}>
        Освоено <b style={{ color: THEME.primary }}>{mastered}</b> из {total} навыков · собрано <b style={{ color: '#f5c518' }}>{K}</b> из 10 деталей
      </div>
      {K < 10
        ? <div style={{ marginTop: 4, fontSize: 12, color: THEME.textLight, textAlign: 'center' }}>До следующей детали: ещё {nextPct}%</div>
        : <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#f5c518', textAlign: 'center' }}>🚀 Корабль собран! Ты освоил весь план</div>}
    </div>
  );
}
