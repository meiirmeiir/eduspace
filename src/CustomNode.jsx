import { Handle, Position } from '@xyflow/react';
import './MapStyles.css';

// Современный узел карты модулей. Визуал зависит от status + mastery
// (раскладка/данные/логика не меняются — только вид).
const NODE_W = 312;

// ── Гем навыка (мини-ромб с цветом по фазе) ───────────────────────────────
const GEM = {
  not_started:  { c: '#64748b', glow: null },
  phase_A_done: { c: '#4ade80', glow: '#22c55e' },
  phase_B_done: { c: '#fde047', glow: '#eab308' },
  mastered:     { c: '#fbbf24', glow: '#f59e0b' },
};
function Gem({ phase_status }) {
  const g = GEM[phase_status] || GEM.not_started;
  return (
    <span style={{
      display: 'inline-block', width: 11, height: 11, transform: 'rotate(45deg)', borderRadius: 3,
      background: `linear-gradient(135deg, rgba(255,255,255,0.55), ${g.c})`,
      border: `1px solid ${g.c}`,
      boxShadow: g.glow ? `0 0 6px ${g.glow}` : 'none',
    }} />
  );
}

// Палитра по визуальному состоянию.
const STATES = {
  mastered:   { grad: 'linear-gradient(135deg,#15803d 0%,#22c55e 55%,#eab308 100%)', border: '#86efac', shadow: '0 0 18px rgba(34,197,94,0.45)', text: '#fff',     sub: 'rgba(255,255,255,0.85)', bar: '#fde68a', label: 'Освоен',        badge: '✓' },
  inprogress: { grad: 'linear-gradient(135deg,#92400e 0%,#f59e0b 100%)',             border: '#fcd34d', shadow: '0 0 14px rgba(245,158,11,0.40)', text: '#fff',     sub: 'rgba(255,255,255,0.85)', bar: '#fff7ed', label: 'В процессе',    badge: null },
  available:  { grad: 'linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%)',             border: '#93c5fd', shadow: '0 0 14px rgba(59,130,246,0.45)', text: '#fff',     sub: 'rgba(255,255,255,0.80)', bar: '#dbeafe', label: 'Доступен',      badge: null },
  locked:     { grad: 'linear-gradient(135deg,#1e293b 0%,#334155 100%)',             border: '#475569', shadow: 'none',                            text: '#94a3b8',  sub: '#64748b',                bar: '#64748b', label: 'Заблокировано', badge: '🔒' },
};

export default function CustomNode({ data }) {
  const { title, grade, status = 'active', micro_skills = [], mastery = 0 } = data;
  const vs = status === 'locked' ? 'locked'
    : mastery >= 100 ? 'mastered'
    : mastery > 0 ? 'inprogress'
    : 'available';
  const s = STATES[vs];

  return (
    <div className={`skill-node skill-node-${vs}`}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

      <div className="skill-node-card" style={{
        width: NODE_W, boxSizing: 'border-box', position: 'relative',
        background: s.grad, border: `1.5px solid ${s.border}`, borderRadius: 16,
        boxShadow: s.shadow, padding: '14px 16px', opacity: vs === 'locked' ? 0.82 : 1,
      }}>
        {s.badge && (
          <div style={{ position: 'absolute', top: 10, right: 13, fontSize: 18, lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{s.badge}</div>
        )}

        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 15, color: s.text, lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.45)', paddingRight: 26, wordBreak: 'break-word' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: s.sub, marginTop: 3, fontFamily: "'Inter',sans-serif" }}>{grade}</div>

        {/* Прогресс-бар */}
        <div style={{ height: 7, background: 'rgba(0,0,0,0.28)', borderRadius: 4, overflow: 'hidden', marginTop: 12, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)' }}>
          <div style={{ height: '100%', width: `${mastery}%`, background: s.bar, borderRadius: 4, boxShadow: `0 0 8px ${s.bar}`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.text, fontFamily: "'Inter',sans-serif", opacity: 0.95 }}>{s.label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.text, fontFamily: "'Inter',sans-serif", opacity: 0.85 }}>{mastery}%</span>
        </div>

        {/* Гемы навыков */}
        {micro_skills.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap', alignItems: 'center' }}>
            {micro_skills.map((sk, i) => <Gem key={sk.id ?? i} phase_status={sk.phase_status} />)}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}
