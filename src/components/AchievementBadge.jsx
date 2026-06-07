import React, { useState } from 'react';
import { TIER_COLORS } from '../lib/achievements.js';

const TIER_NAMES = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', exclusive: 'Эксклюзив' };

// Один значок достижения.
//   ach         — запись из ACHIEVEMENTS (id, icon, name, levels[], exclusive?, superExclusive?)
//   earnedLevel — наивысший полученный уровень (0 = не получено)
//   progress    — опц. текущее числовое значение (свой профиль) для прогресс-бара
// Серый вид — ТОЛЬКО при нулевом прогрессе; если прогресс есть, иконка цветная
// и под значком рисуется мини-бар к следующему уровню. Клик — модалка с
// уровнями и наградами.
export default function AchievementBadge({ ach, earnedLevel = 0, progress }) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);

  const earned = earnedLevel > 0;
  const curLevel = earned ? ach.levels[earnedLevel - 1] : null;
  const nextLevel = ach.levels[earnedLevel] || null; // следующий не полученный
  const tier = curLevel?.tier || ach.levels[0].tier;
  const color = TIER_COLORS[tier] || '#94a3b8';

  // Числовой прогресс к следующему уровню (если у уровня есть threshold).
  const nextThreshold = typeof nextLevel?.threshold === 'number' ? nextLevel.threshold : null;
  const hasProgress = typeof progress === 'number' && progress > 0;
  const progressPct = nextThreshold ? Math.min(100, Math.round((progress || 0) / nextThreshold * 100)) : null;

  // Внешний вид рамки/фона: серость только при нуле прогресса и без уровней.
  let frame;
  if (!earned && !hasProgress) {
    frame = { background: 'rgba(148,163,184,0.12)', border: '2px solid rgba(148,163,184,0.35)', filter: 'grayscale(1)', opacity: 0.65 };
  } else if (!earned && hasProgress) {
    // прогресс есть — цветная иконка, мягкая рамка цвета первого тира
    frame = { background: `${color}14`, border: `2px dashed ${color}88`, boxShadow: `0 0 8px ${color}30` };
  } else if (ach.superExclusive) {
    frame = { background: 'linear-gradient(135deg,#f97316,#fbbf24,#a78bfa)', border: '2px solid #fff', boxShadow: '0 0 16px rgba(167,139,250,0.6)' };
  } else if (ach.exclusive) {
    frame = { background: 'linear-gradient(135deg,#6d28d9,#a78bfa)', border: `2px solid ${color}`, boxShadow: `0 0 12px ${color}66` };
  } else {
    frame = { background: `${color}1f`, border: `2.5px solid ${color}`, boxShadow: `0 0 10px ${color}40` };
  }

  // Текст следующего уровня для tooltip
  let nextText = null;
  if (nextLevel) {
    const base = `Следующий: ${TIER_NAMES[nextLevel.tier] || ''} — ${nextLevel.desc}`;
    nextText = (typeof progress === 'number' && nextThreshold != null)
      ? `${base} (${Math.min(progress, nextThreshold)}/${nextThreshold})`
      : base;
  } else if (earned) {
    nextText = 'Максимальный уровень';
  } else if (typeof progress === 'number' && typeof ach.levels[0].threshold === 'number') {
    nextText = `${ach.levels[0].desc} (${Math.min(progress, ach.levels[0].threshold)}/${ach.levels[0].threshold})`;
  }

  return (
    <>
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 92 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setOpen(true)}
    >
      <div style={{
        width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, position: 'relative', cursor: 'pointer', flexShrink: 0, ...frame,
      }}>
        <span style={{ filter: (earned || hasProgress) ? 'none' : 'grayscale(1)' }}>{ach.icon}</span>
        {!earned && !hasProgress && (
          <span style={{ position: 'absolute', right: -2, bottom: -2, fontSize: 16, background: '#fff', borderRadius: '50%', lineHeight: 1 }}>🔒</span>
        )}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
        color: earned ? (ach.superExclusive ? '#fde68a' : (ach.exclusive ? '#a78bfa' : color)) : (hasProgress ? color : '#94a3b8'),
        maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {ach.name}
      </div>
      {/* Мини прогресс-бар + X/Y к следующему уровню */}
      {nextThreshold != null && typeof progress === 'number' && (
        <div style={{ width: 72 }}>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(148,163,184,0.25)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: 99, background: color, transition: 'width .3s' }}/>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: hasProgress ? color : '#94a3b8', textAlign: 'center', marginTop: 2 }}>
            {Math.min(progress, nextThreshold)}/{nextThreshold}
          </div>
        </div>
      )}

      {hover && !open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8,
          width: 200, background: '#0f172a', color: '#fff', borderRadius: 10, padding: '10px 12px',
          fontSize: 12, lineHeight: 1.45, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', textAlign: 'left',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>
            {ach.icon} {ach.name}{earned ? ` · ${TIER_NAMES[tier] || ''}` : ''}
          </div>
          {earned
            ? <div style={{ color: 'rgba(255,255,255,0.75)' }}>{curLevel.desc}</div>
            : <div style={{ color: 'rgba(255,255,255,0.6)' }}>{hasProgress ? 'В процессе' : 'Не получено'}</div>}
          {nextText && <div style={{ marginTop: 5, color: color, fontWeight: 600 }}>{nextText}</div>}
          <div style={{ marginTop: 5, color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Нажми для подробностей</div>
        </div>
      )}
    </div>

    {/* Модалка с уровнями достижения и наградами */}
    {open && (
      <div onClick={() => setOpen(false)} style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,8,18,0.8)',
        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }} role="dialog" aria-modal="true">
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 420, background: '#0f172a', border: `1px solid ${color}55`,
          borderRadius: 16, padding: '20px 22px', color: '#e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, ...frame }}>
              <span style={{ filter: (earned || hasProgress) ? 'none' : 'grayscale(1)' }}>{ach.icon}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 17, color: '#f0f6fc' }}>{ach.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)' }}>
                {earned ? `Получено: ${TIER_NAMES[tier] || ''}` : hasProgress ? 'В процессе' : 'Ещё не получено'}
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ach.levels.map(lv => {
              const got = earnedLevel >= lv.level;
              const lvColor = TIER_COLORS[lv.tier] || '#94a3b8';
              const lvThreshold = typeof lv.threshold === 'number' ? lv.threshold : null;
              const lvPct = lvThreshold && typeof progress === 'number' ? Math.min(100, Math.round(progress / lvThreshold * 100)) : null;
              return (
                <div key={lv.level} style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: got ? `${lvColor}1a` : 'rgba(148,163,184,0.07)',
                  border: `1px solid ${got ? lvColor : 'rgba(148,163,184,0.2)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: got ? lvColor : '#94a3b8' }}>
                      {got ? '✓' : '○'} {TIER_NAMES[lv.tier] || `Уровень ${lv.level}`}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.7)', flex: 1 }}>{lv.desc}</span>
                    {lv.crystals > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#7dd3fc', whiteSpace: 'nowrap' }}>+{lv.crystals} 💎</span>}
                  </div>
                  {!got && lvPct != null && (
                    <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lvPct}%`, background: lvColor, borderRadius: 99 }}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
