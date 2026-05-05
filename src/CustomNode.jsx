import { Handle, Position } from '@xyflow/react';
import './MapStyles.css';
import lockIcon  from './assets/lock.png.png';
import checkIcon from './assets/check.png.png';
import plainImg  from './assets/plain.png';

// ── Пиксельный объёмный кристалл ──────────────────────────────────────────
function PixelCrystal({ phase_status }) {
  const C = {
    not_started:  { L: '#64748b', M: '#475569', D: '#1e293b', glow: null },
    phase_A_done: { L: '#4ade80', M: '#16a34a', D: '#052e16', glow: '#22c55e' },
    phase_B_done: { L: '#fde047', M: '#ca8a04', D: '#451a03', glow: '#eab308' },
    mastered:     { L: '#fef08a', M: '#f59e0b', D: '#78350f', glow: '#FFD700' },
  }[phase_status] || { L: '#64748b', M: '#475569', D: '#1e293b', glow: null };

  return (
    <svg
      width="13" height="20"
      viewBox="0 0 8 12"
      shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        filter: C.glow
          ? `drop-shadow(0 0 3px ${C.glow}) drop-shadow(0 0 7px ${C.glow}55)`
          : 'none',
        flexShrink: 0,
      }}
    >
      {/* Tip (lightest) */}
      <rect x="3" y="0" width="2" height="1" fill={C.L} />
      {/* Upper left = light */}
      <rect x="2" y="1" width="2" height="1" fill={C.L} />
      {/* Upper right = dark */}
      <rect x="4" y="1" width="2" height="1" fill={C.D} />
      {/* Wide left face */}
      <rect x="0" y="2" width="4" height="3" fill={C.M} />
      {/* Highlight on left face top */}
      <rect x="0" y="2" width="3" height="1" fill={C.L} />
      {/* Wide right face (shadow) */}
      <rect x="4" y="2" width="4" height="3" fill={C.D} />
      {/* Center divider for 3D edge */}
      <rect x="3" y="1" width="1" height="5" fill="rgba(0,0,0,0.30)" />
      {/* Lower taper */}
      <rect x="1" y="5" width="3" height="2" fill={C.M} />
      <rect x="4" y="5" width="3" height="2" fill={C.D} />
      {/* Bottom tip */}
      <rect x="2" y="7" width="2" height="1" fill={C.M} />
      <rect x="4" y="7" width="2" height="1" fill={C.D} />
      <rect x="3" y="8" width="2" height="2" fill={C.D} />
    </svg>
  );
}

// Размеры отображения острова (оригинал 630×396, масштаб ~0.41)
const ISLAND_W = 312;
const ISLAND_H = Math.round(312 * 396 / 630); // ≈ 196

// ── Главный компонент ─────────────────────────────────────────────────────
export default function CustomNode({ data }) {
  const { title, grade, status = 'active', micro_skills = [], mastery = 0 } = data;

  const progressColor =
    mastery >= 100 ? '#22c55e' :
    mastery > 0    ? '#f59e0b' : '#6366f1';

  const glowFilter =
    status === 'active'   ? 'drop-shadow(0 0 10px rgba(255,215,0,0.28))' :
    status === 'mastered' ? 'drop-shadow(0 0 12px rgba(34,197,94,0.38))' :
    'none';

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      filter: glowFilter,
    }}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Остров — картинка plain.png с текстом поверх */}
      <div style={{ position: 'relative', width: ISLAND_W, height: ISLAND_H }}>
        <img
          src={plainImg}
          alt=""
          style={{
            width: ISLAND_W,
            height: ISLAND_H,
            imageRendering: 'pixelated',
            display: 'block',
            filter: status === 'locked' ? 'grayscale(1) brightness(0.4)' : 'none',
          }}
        />
        {/* Текст по центру картинки, отступ 90px слева и справа */}
        <div style={{
          position: 'absolute',
          top: 0, left: 90, right: 90, bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            color: status === 'locked' ? '#94a3b8' : '#fff',
            fontWeight: 800,
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 1.4,
            fontFamily: 'Inter, sans-serif',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            textShadow: '0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 2px 6px rgba(0,0,0,0.8)',
          }}>
            {title}
          </span>
        </div>

        {/* Замок — абсолютно по центру поверх текста */}
        {status === 'locked' && (
          <img src={lockIcon} alt="locked" style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            imageRendering: 'pixelated',
            width: 84, height: 84,
          }} />
        )}

        {/* Галочка — абсолютно по центру */}
        {status === 'mastered' && (
          <img src={checkIcon} alt="mastered" style={{
            position: 'absolute',
            top: 10, right: 10,
            imageRendering: 'pixelated',
            width: 22, height: 22,
          }} />
        )}
      </div>

      {/* Прогресс-бар */}
      <div style={{
        width: ISLAND_W - 40,
        height: 7,
        background: 'rgba(255,255,255,0.10)',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 6,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          height: '100%',
          width: `${mastery}%`,
          background: progressColor,
          borderRadius: 2,
          boxShadow: `0 0 8px ${progressColor}`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Кристаллы */}
      {micro_skills.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 4,
          marginTop: 7,
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          {micro_skills.map((skill, idx) => (
            <PixelCrystal key={skill.id ?? idx} phase_status={skill.phase_status} />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}
