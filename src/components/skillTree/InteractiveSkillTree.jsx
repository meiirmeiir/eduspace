import React, { useEffect } from "react";
import { ReactFlow, Background, Controls, Panel, useNodesState, useEdgesState, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

// ── SKILL TREE HELPERS ────────────────────────────────────────────────────────

const SKILL_VERT_LABELS = {
  ALGEBRA:'Алгебра', GEOMETRY:'Геометрия', WORD_PROBLEMS:'Текст. задачи',
  STATISTICS:'Статистика', FUNCTIONS:'Функции', EQUATIONS:'Уравнения',
  TRIGONOMETRY:'Тригонометрия', COMBINATORICS:'Комбинаторика',
  SEQUENCES:'Последоват-ти', DERIVATIVES:'Производные',
};

// Сезонные зоны — каждая вертикаль получает свой сезон
const ZONE_SEASONS_CYCLE = ['summer','autumn','spring','winter'];
const VERT_SEASON = {
  ALGEBRA:'summer', FUNCTIONS:'summer', SEQUENCES:'summer',
  GEOMETRY:'autumn', EQUATIONS:'autumn', DERIVATIVES:'autumn',
  WORD_PROBLEMS:'spring', TRIGONOMETRY:'spring',
  STATISTICS:'winter', COMBINATORICS:'winter',
};
const SEASON_CFG = {
  summer:{
    label:'ЛЕТО', icon:'☀',
    zoneBg:'rgba(6,18,0,0.9)', accent:'#9ed438', dim:'#3a5010',
    starC:'#ffffa0', glowC:'rgba(158,212,56,0.6)',
    nodeActBg:'rgba(158,212,56,0.14)', nodeMastBg:'rgba(40,140,10,0.22)',
    nodeBlkBg:'rgba(140,20,20,0.22)', road:'#4a7a10',
    borderAct:'#9ed438', borderMast:'#50d820', borderBlk:'#ef4444', borderLock:'#1e3a0a',
    gradeLabelC:'rgba(158,212,56,0.55)',
    zoneLabelBg:'rgba(6,18,0,0.85)', zoneSkyBg:'rgba(4,12,0,0.95)',
  },
  autumn:{
    label:'ОСЕНЬ', icon:'🍂',
    zoneBg:'rgba(22,6,0,0.9)', accent:'#e8843a', dim:'#6b2a08',
    starC:'#ffcc88', glowC:'rgba(232,132,58,0.6)',
    nodeActBg:'rgba(232,132,58,0.14)', nodeMastBg:'rgba(200,70,10,0.22)',
    nodeBlkBg:'rgba(140,20,20,0.22)', road:'#7a3208',
    borderAct:'#e8843a', borderMast:'#f0a040', borderBlk:'#ef4444', borderLock:'#3a1a04',
    gradeLabelC:'rgba(232,132,58,0.55)',
    zoneLabelBg:'rgba(22,6,0,0.85)', zoneSkyBg:'rgba(15,4,0,0.95)',
  },
  spring:{
    label:'ВЕСНА', icon:'🌸',
    zoneBg:'rgba(18,2,22,0.9)', accent:'#e070d0', dim:'#601860',
    starC:'#ffccff', glowC:'rgba(224,112,208,0.6)',
    nodeActBg:'rgba(224,112,208,0.14)', nodeMastBg:'rgba(160,40,160,0.22)',
    nodeBlkBg:'rgba(140,20,20,0.22)', road:'#782878',
    borderAct:'#e070d0', borderMast:'#d060e0', borderBlk:'#ef4444', borderLock:'#3a083a',
    gradeLabelC:'rgba(224,112,208,0.55)',
    zoneLabelBg:'rgba(18,2,22,0.85)', zoneSkyBg:'rgba(12,1,16,0.95)',
  },
  winter:{
    label:'ЗИМА', icon:'❄',
    zoneBg:'rgba(0,6,28,0.9)', accent:'#70b8f8', dim:'#183870',
    starC:'#c8e8ff', glowC:'rgba(112,184,248,0.6)',
    nodeActBg:'rgba(112,184,248,0.14)', nodeMastBg:'rgba(30,90,200,0.22)',
    nodeBlkBg:'rgba(140,20,20,0.22)', road:'#184888',
    borderAct:'#70b8f8', borderMast:'#80d0ff', borderBlk:'#ef4444', borderLock:'#081830',
    gradeLabelC:'rgba(112,184,248,0.55)',
    zoneLabelBg:'rgba(0,6,28,0.85)', zoneSkyBg:'rgba(0,4,18,0.95)',
  },
};

/**
 * Преобразует модули плана в плоский массив навыков с пресеквизитами.
 * Пресеквизиты выводятся по принципу: в одной вертикали навык grade N
 * является пресеквизитом навыка grade N+1.
 */
function buildSkillGraph(modules) {
  const seen = {};
  for (const mod of (modules || [])) {
    const byV = mod.by_vertical || {};
    for (const [vertId, skills] of Object.entries(byV)) {
      const sorted = [...skills].sort((a, b) => a.grade - b.grade);
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        if (!seen[s.id]) {
          seen[s.id] = {
            id:           s.id,
            grade:        s.grade,
            vertical:     vertId,
            passRate:     s.passRate || 0,
            name:         s.skill_name || s.name || null,
            prerequisites: i > 0 ? [sorted[i - 1].id] : [],
          };
        }
      }
    }
  }
  return Object.values(seen);
}

/**
 * Вычисляет статус каждого навыка (MASTERED / ACTIVE / LOCKED).
 * ACTIVE = все пресеквизиты MASTERED (или их нет).
 * LOCKED = хотя бы один пресеквизит не MASTERED.
 * Итеративная пропагация до стабильности (топологический обход).
 */
function computeSkillStatuses(skills, masteredSet) {
  const st = {};
  for (const s of skills) st[s.id] = masteredSet.has(s.id) ? 'MASTERED' : 'PENDING';
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of skills) {
      if (st[s.id] === 'MASTERED') continue;
      const unlocked = (s.prerequisites || []).length === 0
        || s.prerequisites.every(pid => st[pid] === 'MASTERED');
      const next = unlocked ? 'ACTIVE' : 'LOCKED';
      if (st[s.id] !== next) { st[s.id] = next; changed = true; }
    }
  }
  return skills.map(s => ({ ...s, status: st[s.id] || 'LOCKED' }));
}

/**
 * Вертикальный layout: ось Y = класс (grade) снизу вверх,
 * ось X = зона (вертикаль). Каждая вертикаль — отдельная сезонная зона.
 */
// Форматирует skill_id в читаемое название
function _fmtSkillId(id, vertical) {
  if (!id) return '???';
  let s = String(id);
  const vpfx = (vertical || '').toLowerCase();
  if (s.toLowerCase().startsWith(vpfx + '_')) s = s.slice(vpfx.length + 1);
  else if (s.toLowerCase().startsWith(vpfx)) s = s.slice(vpfx.length);
  s = s.replace(/^[_-]*(g\d+|grade_?\d+|\d{1,2})[_-]?/gi, '');
  s = s.replace(/[_-]*(g\d+|grade_?\d+|\d{1,2}кл?)[_-]*/gi, ' ');
  s = s.replace(/[_-]+/g, ' ').trim();
  if (!s || s.length < 2) {
    // Fallback: last 2 parts of original id
    const parts = id.split(/[_-]/);
    s = parts.slice(-2).join(' ');
  }
  return s.split(' ').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function computeSkillLayout(skills) {
  const NW = 118, NH = 88;  // квадратные узлы Soul Tree стиля
  const ZONE_W = 190, ZONE_GAP = 58;
  const GRADE_STEP = 118;
  const PAD_LEFT = 36, PAD_TOP = 54, PAD_BOT = 76;

  if (!skills.length) return {
    nodes: [],
    meta: { zones:[], grades:[], canvasW:800, canvasH:600,
            ZONE_W, ZONE_GAP, NW, NH, GRADE_STEP, PAD_LEFT, PAD_TOP, PAD_BOT,
            verticals:[], PAD_X:PAD_LEFT, PAD_Y:PAD_TOP },
  };

  const vertOrder = [...new Set(skills.map(s => s.vertical))];
  const gradeList = [...new Set(skills.map(s => s.grade))].sort((a, b) => a - b);
  const minGrade  = gradeList[0];
  const maxGrade  = gradeList[gradeList.length - 1];

  const canvasH = PAD_TOP + (maxGrade - minGrade) * GRADE_STEP + NH + PAD_BOT;
  const canvasW = PAD_LEFT + vertOrder.length * (ZONE_W + ZONE_GAP) + ZONE_GAP;

  const nodes = skills.map(s => {
    const zi     = vertOrder.indexOf(s.vertical);
    const season = ZONE_SEASONS_CYCLE[zi % 4]; // строго по индексу: 0=лето,1=осень,2=зима,3=весна
    return {
      ...s,
      x: PAD_LEFT + ZONE_GAP + zi * (ZONE_W + ZONE_GAP) + (ZONE_W - NW) / 2,
      y: PAD_TOP + (maxGrade - s.grade) * GRADE_STEP,
      w: NW, h: NH,
      zoneIdx: zi,
      season,
    };
  });

  const zones = vertOrder.map((v, i) => {
    const season = ZONE_SEASONS_CYCLE[i % 4]; // строго по индексу
    return {
      id: v,
      label: SKILL_VERT_LABELS[v] || v,
      season,
      theme: SEASON_CFG[season],
      x: PAD_LEFT + ZONE_GAP + i * (ZONE_W + ZONE_GAP),
      w: ZONE_W,
    };
  });

  const meta = {
    zones,
    grades: gradeList.map(g => ({
      label: g,
      y: PAD_TOP + (maxGrade - g) * GRADE_STEP + NH / 2,
    })),
    canvasW, canvasH,
    ZONE_W, ZONE_GAP, NW, NH, GRADE_STEP, PAD_LEFT, PAD_TOP, PAD_BOT,
    // legacy compat (used nowhere after rewrite but kept for safety)
    verticals: vertOrder.map((v, i) => ({ label: v, y: 0 })),
    PAD_X: PAD_LEFT, PAD_Y: PAD_TOP,
  };

  return { nodes, meta };
}

// ── PIXEL ART RPG SKILL TREE (React Flow + Dagre) ────────────────────────────

const PIXEL_FONT = "'Press Start 2P', 'Courier New', monospace";

// Biome per vertical
const VERTICAL_BIOME = {
  ALGEBRA:'summer', FUNCTIONS:'summer', EQUATIONS:'summer', SEQUENCES:'summer',
  GEOMETRY:'spring', TRIGONOMETRY:'spring', DERIVATIVES:'spring',
  WORD_PROBLEMS:'autumn', COMBINATORICS:'autumn',
  STATISTICS:'winter',
};

// Иконки вертикалей и классов
const VERTICAL_ICONS = {
  ALGEBRA:'⚗️', FUNCTIONS:'📈', EQUATIONS:'⚖️', GEOMETRY:'📐',
  COMBINATORICS:'🎲', STATISTICS:'📊', ARITHMETIC:'🔢',
};
const GRADE_RPG_ICONS = { 5:'🪙', 6:'🗡️', 7:'⚔️', 8:'🛡️', 9:'🏰', 10:'👑', 11:'💎' };

// Pixel RPG biome configs
const BIOME_CFG = {
  summer:{
    label:'SUMMER', ruLabel:'ЛЕТО', icon:'☀️',
    terrain:'linear-gradient(180deg,#0b2e06 0%,#16500d 40%,#266b18 70%,#1e5c12 100%)',
    accentColor:'#7fff3a', borderColor:'#4fb825',
    nodeActive:{
      bg:'#0a1f04', border:'#7fff3a',
      glow:'rgba(127,255,58,0.75)', glowFar:'rgba(127,255,58,0.15)',
      text:'#b8ff80', subText:'rgba(160,255,100,0.6)',
    },
    nodeMastered:{
      bg:'#080f03', border:'#ffd700',
      glow:'rgba(255,215,0,0.55)', glowFar:'rgba(255,215,0,0.12)',
      text:'#ffe870', subText:'rgba(255,220,80,0.6)',
    },
    nodeLocked:{ bg:'rgba(4,8,3,0.85)', border:'rgba(80,110,60,0.3)', text:'rgba(120,150,100,0.4)' },
    edgeActive:'#7fff3a', edgeMastered:'#60e030',
    deco:['🌴','🌿','🏕️','🌴','🌊','🌿','🌴'],
  },
  autumn:{
    label:'AUTUMN', ruLabel:'ОСЕНЬ', icon:'🍂',
    terrain:'linear-gradient(180deg,#180400 0%,#3d0e00 40%,#6b1e00 70%,#8c2e10 100%)',
    accentColor:'#ff9030', borderColor:'#c45a10',
    nodeActive:{
      bg:'#150700', border:'#ff9030',
      glow:'rgba(255,144,48,0.75)', glowFar:'rgba(255,144,48,0.15)',
      text:'#ffbe80', subText:'rgba(255,180,100,0.6)',
    },
    nodeMastered:{
      bg:'#100500', border:'#ffd700',
      glow:'rgba(255,215,0,0.55)', glowFar:'rgba(255,215,0,0.12)',
      text:'#ffe870', subText:'rgba(255,220,80,0.6)',
    },
    nodeLocked:{ bg:'rgba(8,3,0,0.85)', border:'rgba(110,70,30,0.3)', text:'rgba(150,110,60,0.4)' },
    edgeActive:'#ff9030', edgeMastered:'#ffb040',
    deco:['🍂','🎃','🍁','🏚️','🍁','🎃','🍂'],
  },
  winter:{
    label:'WINTER', ruLabel:'ЗИМА', icon:'❄️',
    terrain:'linear-gradient(180deg,#000818 0%,#061225 40%,#0c1f42 70%,#0a1835 100%)',
    accentColor:'#80ccff', borderColor:'#3a78cc',
    nodeActive:{
      bg:'#000814', border:'#80ccff',
      glow:'rgba(128,204,255,0.75)', glowFar:'rgba(128,204,255,0.15)',
      text:'#b8e8ff', subText:'rgba(160,220,255,0.6)',
    },
    nodeMastered:{
      bg:'#00060f', border:'#ffd700',
      glow:'rgba(255,215,0,0.55)', glowFar:'rgba(255,215,0,0.12)',
      text:'#ffe870', subText:'rgba(255,220,80,0.6)',
    },
    nodeLocked:{ bg:'rgba(0,3,10,0.85)', border:'rgba(40,70,120,0.3)', text:'rgba(70,110,160,0.4)' },
    edgeActive:'#80ccff', edgeMastered:'#a0e0ff',
    deco:['❄️','⛄','🏔️','💎','❄️','⛄','🏔️'],
  },
  spring:{
    label:'SPRING', ruLabel:'ВЕСНА', icon:'🌸',
    terrain:'linear-gradient(180deg,#0a001e 0%,#180038 40%,#28004e 70%,#1e003a 100%)',
    accentColor:'#e060ff', borderColor:'#9020cc',
    nodeActive:{
      bg:'#0c0016', border:'#e060ff',
      glow:'rgba(224,96,255,0.75)', glowFar:'rgba(224,96,255,0.15)',
      text:'#f0a8ff', subText:'rgba(220,140,255,0.6)',
    },
    nodeMastered:{
      bg:'#08000f', border:'#ffd700',
      glow:'rgba(255,215,0,0.55)', glowFar:'rgba(255,215,0,0.12)',
      text:'#ffe870', subText:'rgba(255,220,80,0.6)',
    },
    nodeLocked:{ bg:'rgba(5,0,10,0.85)', border:'rgba(80,30,110,0.3)', text:'rgba(120,60,160,0.4)' },
    edgeActive:'#e060ff', edgeMastered:'#c040f0',
    deco:['🌸','🌺','⛩️','🌸','🌺','🌸','🌸'],
  },
};

const ST_NODE_W = 156;
const ST_NODE_H = 92;

function getSkillDisplayName(skill) {
  if (skill.name) return skill.name;
  const id = skill.id || '';
  const vert = (skill.vertical || '').toLowerCase();
  let s = id;
  if (s.toLowerCase().startsWith(vert + '_')) s = s.slice(vert.length + 1);
  else if (s.toLowerCase().startsWith(vert)) s = s.slice(vert.length);
  s = s.replace(/^[_-]*(g\d+|grade_?\d+|\d{1,2})[_-]?/gi, '');
  s = s.replace(/[_-]+/g, ' ').trim();
  if (!s || s.length < 2) s = id.split(/[_-]/).slice(-2).join(' ');
  return s.split(' ').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Zone Background Node — pixel art terrain ──────────────────────────────────
function ZoneBgNode({ data }) {
  const { biome, width, height } = data;
  const cfg = BIOME_CFG[biome] || BIOME_CFG.summer;
  const decoPos = [
    { l:'6%', t:'9%', sz:22 }, { l:'80%', t:'6%', sz:20 },
    { l:'12%', t:'50%', sz:24 }, { l:'76%', t:'45%', sz:22 },
    { l:'44%', t:'76%', sz:26 }, { l:'3%', t:'80%', sz:18 },
    { l:'87%', t:'78%', sz:20 },
  ];
  return (
    <div style={{
      width, height,
      background: cfg.terrain,
      border: `2px solid ${cfg.borderColor}45`,
      position: 'relative', overflow: 'hidden',
      pointerEvents: 'none',
      imageRendering: 'pixelated',
    }}>
      {/* Pixel grid overlay */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:`
          linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)
        `,
        backgroundSize:'8px 8px',
      }}/>
      {/* Atmospheric glow */}
      <div style={{
        position:'absolute', top:'30%', left:'50%',
        transform:'translate(-50%,-50%)',
        width:'72%', height:'55%',
        background:`radial-gradient(ellipse,${cfg.accentColor}18 0%,transparent 70%)`,
        filter:'blur(24px)',
        borderRadius:'50%',
      }}/>
      {/* Decorations */}
      {cfg.deco.map((em, i) => {
        const p = decoPos[i % decoPos.length];
        return (
          <div key={i} style={{
            position:'absolute', left:p.l, top:p.t,
            fontSize:p.sz, lineHeight:1, opacity:0.52,
            filter:'drop-shadow(0 3px 6px rgba(0,0,0,0.75))',
          }}>{em}</div>
        );
      })}
      {/* Zone label badge — bottom-left like reference */}
      <div style={{
        position:'absolute', bottom:10, left:10,
        background:'rgba(0,0,0,0.8)',
        border:`2px solid ${cfg.borderColor}70`,
        padding:'4px 10px',
        display:'flex', alignItems:'center', gap:6,
        imageRendering:'pixelated',
      }}>
        <span style={{ fontSize:11 }}>{cfg.icon}</span>
        <span style={{
          fontFamily:PIXEL_FONT, fontSize:5.5,
          color:cfg.accentColor, letterSpacing:'1.5px',
          textShadow:`0 0 10px ${cfg.accentColor}`,
        }}>{cfg.label}</span>
      </div>
    </div>
  );
}

// ── Pixel Skill Node ──────────────────────────────────────────────────────────
function PixelSkillNode({ data }) {
  const { skill, biome, onStart } = data;
  if (!skill) return null;
  const cfg     = BIOME_CFG[biome] || BIOME_CFG.summer;
  const isLocked   = skill.status === 'LOCKED';
  const isActive   = skill.status === 'ACTIVE';
  const isMastered = skill.status === 'MASTERED';
  const theme   = isMastered ? cfg.nodeMastered : isActive ? cfg.nodeActive : cfg.nodeLocked;
  const displayName = getSkillDisplayName(skill);

  // Pixel-art box-shadow border (hard 3px on all sides + glow)
  const pixelShadow = isActive
    ? [
        `0 0 0 3px ${theme.border}`,
        `0 0 0 6px rgba(0,0,0,0.9)`,
        `0 0 22px 6px ${theme.glow}`,
        `0 0 44px 14px ${theme.glowFar}`,
        `inset 2px 2px 0 0 ${theme.border}25`,
        `inset -2px -2px 0 0 rgba(0,0,0,0.4)`,
      ].join(',')
    : isMastered
    ? [
        `0 0 0 3px ${theme.border}`,
        `0 0 0 6px rgba(0,0,0,0.9)`,
        `0 0 16px 4px ${theme.glow}`,
        `inset 2px 2px 0 0 ${theme.border}20`,
      ].join(',')
    : [
        `0 0 0 2px ${theme.border}`,
        `0 0 0 4px rgba(0,0,0,0.7)`,
      ].join(',');

  const statusEmoji  = isMastered ? '✅' : isActive ? '⚡' : '🔒';
  const vertIcon     = VERTICAL_ICONS[(skill.vertical||'').toUpperCase()] || '🔮';
  const gradeIcon    = GRADE_RPG_ICONS[skill.grade] || '🎮';

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, userSelect:'none' }}>
      <Handle type="target" position={Position.Bottom} style={{ opacity:0, bottom:-8 }}/>
      <Handle type="source" position={Position.Top}    style={{ opacity:0, top:-8 }}/>

      {/* Floating status icon above node */}
      <div style={{
        fontSize:18, lineHeight:1,
        opacity: isLocked ? 0.4 : 1,
        filter: (isActive || isMastered)
          ? `drop-shadow(0 0 8px ${theme.glow}) drop-shadow(0 0 4px ${theme.border})`
          : 'drop-shadow(0 2px 5px rgba(0,0,0,0.9))',
        animation: isActive ? 'pixelFloat 2.4s ease-in-out infinite' : 'none',
      }}>{statusEmoji}</div>

      {/* Main pixel card */}
      <div
        onClick={isActive && onStart ? () => onStart(skill.id) : undefined}
        style={{
          width: ST_NODE_W,
          background: theme.bg,
          boxShadow: pixelShadow,
          padding: '8px 10px 9px',
          opacity: isLocked ? 0.42 : 1,
          position: 'relative',
          cursor: isActive && onStart ? 'pointer' : 'default',
          animation: isActive ? 'pixelPulse 2.4s ease-in-out infinite' : 'none',
          imageRendering: 'pixelated',
        }}
      >
        {/* Pixel corner squares */}
        {[{top:2,left:2},{top:2,right:2},{bottom:2,left:2},{bottom:2,right:2}].map((p,i)=>(
          <div key={i} style={{ position:'absolute', width:4, height:4, background:theme.border, opacity:0.85, ...p }}/>
        ))}

        {/* Header: vertical icon + grade icon */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:3, paddingBottom:3,
          borderBottom:`1px solid ${theme.border}30`,
        }}>
          <span style={{ fontSize:11, opacity: isLocked ? 0.5 : 0.9 }}>{vertIcon}</span>
          <span style={{
            fontFamily:PIXEL_FONT, fontSize:4,
            color:theme.border, opacity:0.8,
            letterSpacing:'0.05em',
          }}>{gradeIcon} {skill.grade}КЛ</span>
        </div>

        {/* Top accent line */}
        <div style={{
          position:'absolute', top:28, left:10, right:10, height:1,
          background:`linear-gradient(90deg,transparent,${theme.border}60,transparent)`,
        }}/>

        {/* Skill name — pixel font, uppercase */}
        <div style={{
          fontFamily: PIXEL_FONT,
          fontSize: displayName.length > 18 ? 5 : displayName.length > 13 ? 6 : 7,
          color: theme.text,
          lineHeight: 1.65,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginTop: 5, marginBottom: 3,
          padding: '0 2px',
          textShadow: (isActive || isMastered) ? `0 0 12px ${theme.border}` : 'none',
          minHeight: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          wordBreak: 'break-word',
        }}>{displayName}</div>

        {/* Bottom line */}
        <div style={{
          position:'absolute', bottom:14, left:10, right:10, height:1,
          background:`linear-gradient(90deg,transparent,${theme.border}40,transparent)`,
        }}/>

        {/* Action button */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
          {isActive && onStart && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onStart(skill.id); }}
              style={{
                fontFamily:PIXEL_FONT, fontSize:4.5, fontWeight:900,
                background:theme.border, color:'#000',
                border:'none', padding:'3px 7px',
                cursor:'pointer', letterSpacing:'0.5px',
                boxShadow:`0 3px 0 rgba(0,0,0,0.5),0 0 10px 3px ${theme.glow}`,
              }}>
              ▶СТАРТ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Ortho Edge — 90-degree pixel paths ────────────────────────────────────────
function PixelEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const { fromStatus = 'LOCKED', toStatus = 'LOCKED', biome = 'summer' } = data || {};
  const cfg    = BIOME_CFG[biome] || BIOME_CFG.summer;
  const isMast = fromStatus === 'MASTERED';
  const isAct  = toStatus === 'ACTIVE';
  const isFlow = isMast && isAct;

  const color   = isFlow ? cfg.edgeActive : isMast ? cfg.edgeMastered : 'rgba(90,100,130,0.22)';
  const strokeW = isFlow ? 3 : isMast ? 2 : 1;
  const dash    = (!isMast && !isAct) ? '5 7' : undefined;
  const opac    = isFlow ? 1 : isMast ? 0.8 : 0.28;

  // Orthogonal path: source → midY horizontal → target
  const midY = (sourceY + targetY) / 2;
  const pathD = `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;

  return (
    <g opacity={opac}>
      {(isMast || isAct) && (
        <path d={pathD} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth={strokeW + 6} strokeLinejoin="miter"/>
      )}
      <path
        id={id} d={pathD} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={dash} strokeLinecap="square" strokeLinejoin="miter"
        style={(isMast||isAct) ? { filter:`drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color}80)` } : undefined}
      />
      {isFlow && (
        <path
          d={pathD} fill="none"
          stroke="rgba(255,255,255,0.65)" strokeWidth={1.5}
          strokeDasharray="8 18" strokeLinecap="square" strokeLinejoin="miter"
          style={{ animation:'edgeFlow 1.4s linear infinite' }}
        />
      )}
    </g>
  );
}

// Stable refs (outside component)
const PIXEL_NODE_TYPES = { pixelSkill: PixelSkillNode, zoneBg: ZoneBgNode };
const PIXEL_EDGE_TYPES = { pixelEdge: PixelEdge };

// Dagre layout
function buildPixelFlow(skills, onStartFn) {
  const ZONE_PAD = 44;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir:'BT', nodesep:68, ranksep:108, marginx:64, marginy:64 });

  const NW = ST_NODE_W + 16, NH = ST_NODE_H + 34;
  for (const s of skills) g.setNode(s.id, { width:NW, height:NH });

  const skillIds = new Set(skills.map(s => s.id));
  const edgePairs = [];
  for (const s of skills) {
    for (const pid of (s.prerequisites || [])) {
      if (skillIds.has(pid)) { g.setEdge(pid, s.id); edgePairs.push([pid, s.id]); }
    }
  }
  dagre.layout(g);

  const skillMap = Object.fromEntries(skills.map(s => [s.id, s]));
  const rfNodes  = skills.map(s => {
    const pos   = g.node(s.id);
    const biome = VERTICAL_BIOME[s.vertical] || 'summer';
    return {
      id:s.id, type:'pixelSkill',
      position:{ x:pos.x - NW/2, y:pos.y - NH/2 },
      data:{ skill:s, biome, onStart:onStartFn },
      draggable:false, selectable:false,
    };
  });

  const bounds = {};
  for (const n of rfNodes) {
    const b2 = n.data.biome;
    const { x, y } = n.position;
    if (!bounds[b2]) bounds[b2] = { minX:Infinity, minY:Infinity, maxX:-Infinity, maxY:-Infinity };
    const b = bounds[b2];
    b.minX = Math.min(b.minX, x);       b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x + NW);  b.maxY = Math.max(b.maxY, y + NH);
  }

  const bgNodes = Object.entries(bounds).map(([biome, b]) => ({
    id:`zone-${biome}`, type:'zoneBg',
    position:{ x:b.minX - ZONE_PAD, y:b.minY - ZONE_PAD },
    data:{ biome, width:b.maxX - b.minX + 2*ZONE_PAD, height:b.maxY - b.minY + 2*ZONE_PAD },
    draggable:false, selectable:false, zIndex:-1,
  }));

  const rfEdges = edgePairs.map(([pid, cid], i) => ({
    id:`e-${pid}-${cid}`,
    source:pid, target:cid,
    type:'pixelEdge',
    data:{
      fromStatus:skillMap[pid]?.status || 'LOCKED',
      toStatus:  skillMap[cid]?.status || 'LOCKED',
      biome:     VERTICAL_BIOME[skillMap[pid]?.vertical] || 'summer',
    },
  }));

  return { nodes:[...bgNodes, ...rfNodes], edges:rfEdges };
}

// ── Interactive Skill Tree ────────────────────────────────────────────────────
function InteractiveSkillTree({ skills, onStartTraining }) {
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!skills || !skills.length) { setRFNodes([]); setRFEdges([]); return; }
    const { nodes, edges } = buildPixelFlow(skills, onStartTraining);
    setRFNodes(nodes); setRFEdges(edges);
  }, [skills, onStartTraining]);

  return (
    <div style={{
      width:'100%', height:'82vh', minHeight:580,
      background:'linear-gradient(180deg,#010108 0%,#020312 40%,#03020e 100%)',
      border:'3px solid rgba(255,210,60,0.18)',
      boxShadow:'0 0 0 6px #000',
      position:'relative',
      imageRendering:'pixelated',
    }}>
      {/* Starfield */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
        {[
          ['11%','4%'],['24%','2%'],['39%','8%'],['57%','3%'],['72%','6%'],['88%','4%'],
          ['6%','13%'],['46%','11%'],['91%','9%'],['20%','17%'],['66%','15%'],['35%','20%'],
        ].map(([x,y],i)=>(
          <div key={i} style={{
            position:'absolute', left:x, top:y,
            width:i%3===0?2:1, height:i%3===0?2:1,
            background:`rgba(255,255,255,${0.3+i%4*0.12})`,
            borderRadius:'50%',
          }}/>
        ))}
      </div>

      {/* Header bar */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:42, zIndex:30,
        background:'rgba(0,0,0,0.9)',
        borderBottom:'2px solid rgba(255,210,60,0.28)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', pointerEvents:'none',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>⚔️</span>
          <span style={{
            fontFamily:PIXEL_FONT, fontSize:8, color:'#ffd050',
            textShadow:'0 0 14px rgba(255,200,50,0.9)', letterSpacing:'1.5px',
          }}>SKILL TREE: ПУТЬ ГЕРОЯ</span>
        </div>
        <div style={{ display:'flex', gap:18, alignItems:'center' }}>
          {[
            { c:'#7fff3a', l:'ЛЕТО ☀️' },
            { c:'#ff9030', l:'ОСЕНЬ 🍂' },
            { c:'#80ccff', l:'ЗИМА ❄️' },
            { c:'#e060ff', l:'ВЕСНА 🌸' },
          ].map(b=>(
            <span key={b.l} style={{
              fontFamily:PIXEL_FONT, fontSize:5, color:b.c,
              textShadow:`0 0 8px ${b.c}80`, letterSpacing:'0.5px',
            }}>{b.l}</span>
          ))}
        </div>
      </div>

      {/* React Flow */}
      <div style={{ position:'absolute', inset:0, top:42 }}>
        <ReactFlow
          nodes={rfNodes} edges={rfEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={PIXEL_NODE_TYPES} edgeTypes={PIXEL_EDGE_TYPES}
          fitView fitViewOptions={{ padding:0.14, maxZoom:0.88 }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          minZoom={0.06} maxZoom={2.5}
          proOptions={{ hideAttribution:true }}
        >
          <Background color="#090b14" gap={20} variant="dots" size={1} style={{ opacity:0.55 }}/>
          <Controls position="bottom-right"
            style={{ background:'rgba(0,0,0,0.92)', border:'2px solid rgba(255,210,60,0.22)' }}/>
          <Panel position="bottom-left">
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[
                { ic:'✅', label:'ОСВОЕНО',  color:'#ffd700' },
                { ic:'⚡', label:'АКТИВНО',  color:'#7fff3a' },
                { ic:'🔒', label:'ЗАКРЫТО',  color:'rgba(160,175,210,0.45)' },
              ].map(({ ic, label, color })=>(
                <div key={label} style={{
                  display:'flex', alignItems:'center', gap:7,
                  background:'rgba(0,0,0,0.88)',
                  border:`1px solid ${color}45`, padding:'4px 10px',
                }}>
                  <span style={{ fontSize:10 }}>{ic}</span>
                  <span style={{ fontFamily:PIXEL_FONT, fontSize:5, color, letterSpacing:'1px' }}>{label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <style>{`
        @keyframes pixelPulse {
          0%,100% { filter: brightness(1); }
          50%      { filter: brightness(1.25); }
        }
        @keyframes pixelFloat {
          0%,100% { transform:translateY(0px); }
          50%      { transform:translateY(-6px); }
        }
        @keyframes edgeFlow {
          from { stroke-dashoffset:26; }
          to   { stroke-dashoffset:0; }
        }
        .react-flow__handle { opacity:0 !important; }
        .react-flow__controls { border-radius:0 !important; overflow:hidden; }
        .react-flow__controls-button {
          background:rgba(0,0,0,0.92) !important;
          border-color:rgba(255,210,60,0.2) !important;
          color:rgba(255,210,60,0.85) !important;
          border-radius:0 !important;
        }
        .react-flow__controls-button:hover { background:rgba(20,20,40,0.98) !important; }
        .react-flow__panel { margin:10px !important; }
        .react-flow__edge-path { stroke-linecap:square !important; }
      `}</style>
    </div>
  );
}

// SoulNode: Square node in Soul Tree style with skill name display
function SoulNode({ node, onStart }) {
  const isLocked   = node.status === 'LOCKED';
  const isActive   = node.status === 'ACTIVE';
  const isMastered = node.status === 'MASTERED';
  const isBlocked  = node.status === 'BLOCKED';

  const season = node.season || 'summer';
  const theme  = SEASON_CFG[season] || SEASON_CFG.summer;

  // Soul Tree cyan for mastered (like in the reference)
  const CYAN = '#22d3ee';
  const RED  = '#ef4444';
  const PFONT = "'Segoe UI',Arial,sans-serif";

  const borderC = isMastered ? CYAN
                : isActive   ? theme.accent
                : isBlocked  ? RED
                : 'rgba(255,255,255,0.07)';

  const bgC = isMastered ? 'rgba(0,200,220,0.1)'
            : isActive   ? theme.nodeActBg
            : isBlocked  ? 'rgba(200,20,20,0.12)'
            : 'rgba(6,6,14,0.88)';

  const glow = isMastered
    ? `0 0 0 1px ${CYAN}, 0 0 18px 4px rgba(0,210,220,0.55), 0 0 36px 10px rgba(0,180,200,0.2)`
    : isActive
    ? `0 0 0 1px ${theme.accent}, 0 0 16px 3px ${theme.glowC}, 0 0 30px 8px ${theme.glowC.replace('0.6','0.12')}`
    : isBlocked
    ? `0 0 0 1px ${RED}, 0 0 12px 3px rgba(239,68,68,0.45)`
    : `0 0 0 1px rgba(255,255,255,0.05)`;

  const nameC = isMastered ? CYAN : isActive ? theme.accent : isBlocked ? RED : 'rgba(255,255,255,0.2)';

  // Format skill_id into readable name
  const rawName = _fmtSkillId(node.id, node.vertical);
  // Split long names into 2 lines by word
  const words = rawName.split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur.length === 0) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= 11) lines[lines.length - 1] += ' ' + w;
    else if (lines.length < 3) lines.push(w);
  }

  const statusLabel = isMastered ? '✦ ОСВОЕНО'
                    : isActive   ? '▶ АКТИВНО'
                    : isBlocked  ? '✖ БЛОК'
                    : '';

  return (
    <div style={{
      position:'absolute', left:node.x, top:node.y, width:node.w, height:node.h,
      background:bgC,
      border:`2px solid ${borderC}`,
      borderRadius:5,
      boxShadow:glow,
      padding:'7px 8px 6px',
      display:'flex', flexDirection:'column', justifyContent:'space-between',
      opacity:isLocked ? 0.25 : 1,
      pointerEvents:isLocked ? 'none' : 'auto',
      userSelect:'none',
      animation:isActive ? 'skillPulse 2.8s ease-in-out infinite' : 'none',
      transition:'opacity 0.2s',
    }}>
      {/* Skill name lines */}
      <div>
        {lines.filter(Boolean).map((ln, li) => (
          <div key={li} style={{
            fontSize:10, fontWeight:700, lineHeight:1.25,
            color:nameC, fontFamily:PFONT,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {ln}
          </div>
        ))}
        <div style={{
          fontSize:7, color:'rgba(255,255,255,0.18)', fontFamily:PFONT, marginTop:2,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {SKILL_VERT_LABELS[node.vertical] || node.vertical}
        </div>
      </div>

      {/* Grade badge + status/button */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:3 }}>
        <span style={{
          fontSize:7, fontWeight:700, color:borderC,
          background:'rgba(0,0,0,0.55)', padding:'1px 5px',
          border:`1px solid ${borderC}35`, fontFamily:PFONT, letterSpacing:'0.04em',
        }}>
          {node.grade}КЛ
        </span>
        {isActive && onStart ? (
          <button onClick={e => { e.stopPropagation(); onStart(node.id); }} style={{
            background:`linear-gradient(180deg,${theme.accent} 0%,${theme.dim} 100%)`,
            color:'#000', fontWeight:800, fontSize:7, border:'none', borderRadius:3,
            padding:'2px 6px', cursor:'pointer', fontFamily:PFONT,
          }}>
            ▶ СТАРТ
          </button>
        ) : statusLabel ? (
          <span style={{ fontSize:7, color:nameC, fontFamily:PFONT, fontWeight:700 }}>
            {statusLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { buildSkillGraph, computeSkillStatuses, computeSkillLayout };
export default InteractiveSkillTree;
