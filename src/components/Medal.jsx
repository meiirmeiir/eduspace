import React from 'react';

// SVG-медаль рейтинговой недели.
// type:     gold | silver | bronze        — цвет обводки
// category: global | grade | region       — форма + фон
// weekId:   "YYYY-Www" (например "2026-W21") — парсим для подписи

const SHAPES = {
  global: { from: '#0f172a', to: '#1e3a8a', icon: '🌍' },
  grade:  { from: '#064e3b', to: '#059669', icon: '📚' },
  region: { from: '#2e1065', to: '#7c3aed', icon: '📍' },
};

const STROKE_COLOR = { gold: '#fbbf24', silver: '#94a3b8', bronze: '#b45309' };
const TYPE_EMOJI   = { gold: '🥇',      silver: '🥈',      bronze: '🥉'      };
const CAT_LABEL    = { global: 'Глобальный рейтинг', grade: 'Класс', region: 'Область' };

function parseWeekId(weekId) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekId || '');
  if (!m) return { year: 0, weekNum: 0 };
  return { year: Number(m[1]), weekNum: Number(m[2]) };
}

export default function Medal({ type = 'gold', category = 'global', weekId = '', size = 64, position }) {
  const { year, weekNum } = parseWeekId(weekId);
  const { from, to, icon } = SHAPES[category] || SHAPES.global;
  const stroke = STROKE_COLOR[type] || STROKE_COLOR.gold;
  const sw     = Math.max(2, Math.round(size * 0.06));
  const cx     = size / 2;
  const cy     = size / 2;
  const r      = (size - sw) / 2;
  const gradId = `med-${category}-${type}-${weekId || 'x'}`.replace(/[^A-Za-z0-9_-]/g, '_');

  const tip = `${TYPE_EMOJI[type] || ''} ${CAT_LABEL[category] || ''}`
            + (position ? ` · #${position}` : '')
            + (weekNum  ? ` · Неделя ${weekNum} · ${year}` : '');

  let shape = null;
  if (category === 'global') {
    shape = (
      <>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gradId})`} stroke={stroke} strokeWidth={sw}/>
        {/* Блик сверху для объёма */}
        <path
          d={`M ${cx - r*0.6} ${cy - r*0.25} A ${r*0.8} ${r*0.8} 0 0 1 ${cx + r*0.6} ${cy - r*0.25}`}
          stroke="rgba(255,255,255,0.45)" strokeWidth={Math.max(1, sw*0.5)} fill="none" strokeLinecap="round"
        />
      </>
    );
  } else if (category === 'grade') {
    // Щит: прямые верх и стороны, плавно сходится к нижнему острию.
    const path = [
      `M ${cx} ${sw}`,                                   // top center
      `L ${size - sw} ${size*0.22}`,                     // top right
      `L ${size - sw} ${size*0.55}`,                     // mid right
      `Q ${size - sw} ${size - sw} ${cx} ${size - sw}`,  // curve to bottom point
      `Q ${sw} ${size - sw} ${sw} ${size*0.55}`,         // curve to mid left
      `L ${sw} ${size*0.22}`,                            // top left
      'Z',
    ].join(' ');
    shape = <path d={path} fill={`url(#${gradId})`} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>;
  } else if (category === 'region') {
    // Flat-top hexagon: углы 0°,60°,120°,180°,240°,300° от центра.
    const pts = [...Array(6)].map((_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
    shape = <polygon points={pts} fill={`url(#${gradId})`} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>;
  }

  return (
    <div title={tip} style={{display:'inline-flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'help'}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={tip}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={from}/>
            <stop offset="100%" stopColor={to}/>
          </linearGradient>
        </defs>
        {shape}
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          fontSize={Math.round(size * 0.42)}
          style={{userSelect:'none'}}
        >{icon}</text>
      </svg>
      {(year > 0 && weekNum > 0) && (
        <div style={{fontSize:11, color:'#64748b', fontWeight:600, whiteSpace:'nowrap'}}>
          {year} · Нед. {weekNum}
        </div>
      )}
    </div>
  );
}
