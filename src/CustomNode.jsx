import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import './MapStyles.css';

// Узел карты = 2D-планета (CSS, без WebGL — на карте много узлов). Состояние
// поверхности отражает прогресс модуля (5 стадий, как у 3D-планеты в попапе).
// Footprint 312px и handles сохранены — раскладка/связи не меняются.
// Заблокированная планета не «мёртвый камень»: дышащий rim-glow («ждёт
// пробуждения»), а на hover — кроссфейд в превью цветущего мира + тултип
// с незакрытыми пререквизитами.
const NODE_W = 312;
const PLANET = 92;       // диаметр планеты
const ORBIT_R = 58;      // радиус орбиты звёзд-этапов
const STAR = 7;

// Стадия планеты из статуса + прогресса модуля.
function planetStage(vs, mastery) {
  if (vs === 'locked') return 'dead';
  if (mastery >= 100)  return 'lush';
  if (mastery >= 60)   return 's2';
  if (mastery > 0)     return 's1';
  return 'stone';
}
const STAGE_STARS = { dead: 0, stone: 0, s1: 1, s2: 2, lush: 3 };

// Поверхность: слои radial-gradient (верхние = океаны/зелень/облака над базой).
const PLANET_BG = {
  dead: 'radial-gradient(circle at 62% 58%, rgba(0,0,0,0.42) 0 7%, transparent 9%), radial-gradient(circle at 38% 70%, rgba(0,0,0,0.32) 0 5%, transparent 7%), radial-gradient(circle at 36% 30%, #6b5c4e, #3a2f27 58%, #241c16 100%)',
  stone: 'radial-gradient(circle at 36% 30%, #aab0b8, #5a5e66 62%, #3b3e44 100%)',
  s1: 'radial-gradient(ellipse 22% 16% at 62% 42%, #2f7fb8 0 70%, transparent 72%), radial-gradient(ellipse 16% 12% at 32% 66%, #2a6fa0 0 70%, transparent 72%), radial-gradient(circle at 44% 34%, rgba(40,120,50,0.55) 0 9%, transparent 11%), radial-gradient(circle at 36% 30%, #b89b6a, #6b5536 70%)',
  s2: 'radial-gradient(ellipse 26% 18% at 64% 44%, #2766a0 0 72%, transparent 74%), radial-gradient(ellipse 20% 16% at 30% 64%, #235e96 0 72%, transparent 74%), radial-gradient(ellipse 18% 14% at 50% 30%, #3a8a4a 0 72%, transparent 74%), radial-gradient(circle at 36% 30%, #4e9e63, #2f6e7a 74%)',
  lush: 'radial-gradient(ellipse 12% 7% at 56% 32%, rgba(255,255,255,0.7) 0 70%, transparent 74%), radial-gradient(ellipse 10% 6% at 38% 60%, rgba(255,255,255,0.5) 0 70%, transparent 74%), radial-gradient(ellipse 26% 18% at 64% 46%, #1e6fb0 0 72%, transparent 74%), radial-gradient(ellipse 22% 16% at 32% 64%, #1b62a0 0 72%, transparent 74%), radial-gradient(ellipse 20% 15% at 48% 30%, #3fa85a 0 72%, transparent 74%), radial-gradient(circle at 36% 30%, #5fbf7a, #1e5a8a 76%)',
};
const PLANET_GLOW = {
  dead: '0 0 10px rgba(167,139,250,0.14)', // едва заметный rim — планета «ждёт пробуждения»
  stone: '0 0 8px rgba(200,210,230,0.12)',
  s1: '0 0 10px rgba(90,160,220,0.22)', s2: '0 0 13px rgba(80,180,255,0.28)',
  lush: '0 0 16px rgba(120,200,255,0.5)',
};
const INSET_SHADE = 'inset -6px -8px 14px rgba(0,0,0,0.55), inset 7px 7px 12px rgba(255,255,255,0.10)';

const BAR_COLOR = { mastered: '#22c55e', inprogress: '#f59e0b', available: '#3b82f6', locked: '#64748b' };

export default function CustomNode({ data }) {
  const { title, status = 'active', mastery = 0, appearDelay = 0, prereqsLeft = [] } = data;
  const [hovered, setHovered] = useState(false);
  const vs = status === 'locked' ? 'locked'
    : mastery >= 100 ? 'mastered'
    : mastery > 0 ? 'inprogress'
    : 'available';
  const stage = planetStage(vs, mastery);
  const starsLit = STAGE_STARS[stage];
  const badge = vs === 'locked' ? '🔒' : vs === 'mastered' ? '✓' : null;
  const locked = vs === 'locked';
  const preview = locked && hovered; // hover по заблокированной → превью «будущего вида»

  return (
    <div className={`skill-node skill-node-${vs}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

      <div className="skill-node-appear" style={{ animationDelay: `${appearDelay}s`, width: NODE_W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Планета + орбита-звёзды */}
        <div style={{ position: 'relative', width: PLANET, height: PLANET }}>
          {(stage === 'lush' || preview) && (
            <div className="planet-glow" style={{ position: 'absolute', inset: -12, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,200,255,0.55), transparent 70%)', pointerEvents: 'none' }} />
          )}
          {/* Дышащий rim — заблокированная планета «ждёт пробуждения» */}
          {locked && !preview && (
            <div className="planet-dormant-glow" style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: 'radial-gradient(circle, transparent 44%, rgba(186,156,255,0.65) 58%, rgba(139,92,246,0.30) 70%, transparent 82%)', pointerEvents: 'none' }} />
          )}
          <div className="planet-ball" style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: PLANET_BG[stage],
            boxShadow: INSET_SHADE + (PLANET_GLOW[stage] ? ', ' + PLANET_GLOW[stage] : ''),
            // Заблокированная планета заметно пригашена — очевидно, что недоступна
            opacity: preview ? 0 : stage === 'dead' ? 0.55 : 1,
            transition: 'opacity 0.45s ease',
          }} />
          {/* Превью цветущего мира (кроссфейд на hover по заблокированной) */}
          {locked && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: PLANET_BG.lush,
              boxShadow: INSET_SHADE + ', ' + PLANET_GLOW.lush,
              opacity: preview ? 1 : 0,
              transition: 'opacity 0.45s ease',
              pointerEvents: 'none',
            }} />
          )}

          {/* 3 звезды-этапа на вращающейся орбите */}
          <div className="planet-orbit" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[0, 1, 2].map((i) => {
              const ang = (i * 120 - 90) * Math.PI / 180;
              const x = Math.cos(ang) * ORBIT_R, y = Math.sin(ang) * ORBIT_R;
              const lit = i < starsLit;
              return (
                <span key={i} style={{
                  position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`,
                  width: STAR, height: STAR, marginLeft: -STAR / 2, marginTop: -STAR / 2,
                  borderRadius: '50%',
                  background: lit ? 'radial-gradient(circle, #fff7d6, #fbbf24 70%)' : '#475569',
                  boxShadow: lit ? '0 0 6px #fbbf24' : 'none',
                  opacity: lit ? 1 : 0.35,
                }} />
              );
            })}
          </div>

          {badge && (
            <div style={{
              position: 'absolute', top: -4, right: -4, fontSize: 18, lineHeight: 1,
              textShadow: '0 1px 3px rgba(0,0,0,0.85)',
              // мягкое золотое свечение, чтобы замок читался на тёмном космосе
              filter: locked ? 'drop-shadow(0 0 6px rgba(251,191,36,0.8))' : 'none',
              opacity: preview ? 0 : 1, transition: 'opacity 0.3s',
            }}>{badge}</div>
          )}

          {/* Тултип пробуждения: что нужно закрыть, чтобы разблокировать */}
          {preview && (
            <div style={{
              position: 'absolute', left: '50%', bottom: PLANET + 16, transform: 'translateX(-50%)',
              width: 230, zIndex: 30, pointerEvents: 'none',
              background: 'rgba(10,14,28,0.92)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(167,139,250,0.45)', borderRadius: 12,
              padding: '10px 14px', textAlign: 'left',
              boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', marginBottom: 4 }}>
                ✨ Так планета будет выглядеть после пробуждения
              </div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: 'rgba(226,232,240,0.85)', lineHeight: 1.45 }}>
                {prereqsLeft.length > 0 ? (
                  <>
                    Чтобы пробудить, освой:
                    {prereqsLeft.slice(0, 3).map(p => (
                      <div key={p.name} style={{ marginTop: 3, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ color: '#fff' }}>• {p.name}</span>
                        <span style={{ color: '#fbbf24', flexShrink: 0, fontWeight: 700 }}>{p.mastery}%</span>
                      </div>
                    ))}
                    {prereqsLeft.length > 3 && <div style={{ marginTop: 3, color: 'rgba(226,232,240,0.6)' }}>и ещё {prereqsLeft.length - 3}…</div>}
                  </>
                ) : 'Освой пререквизиты, чтобы пробудить этот мир.'}
              </div>
            </div>
          )}
        </div>

        {/* Подпись + прогресс — на тёмной подложке, читаемо на любом зуме.
            Класс под названием убран: его дублирует баннер-разделитель этажа. */}
        <div style={{ textAlign: 'center', marginTop: 14, width: '100%' }}>
          <div style={{
            display: 'inline-block', maxWidth: 240,
            background: 'rgba(8,12,26,0.68)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
            border: '1px solid rgba(148,163,184,0.16)', borderRadius: 11, padding: '7px 13px 8px',
          }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 15, color: '#ffffff', lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.8)', wordBreak: 'break-word' }}>
              {title}
            </div>
          </div>
          <div style={{ width: 150, height: 8, margin: '8px auto 0', background: 'rgba(0,0,0,0.45)', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}>
            <div style={{ height: '100%', width: `${mastery}%`, background: BAR_COLOR[vs], borderRadius: 99, boxShadow: `0 0 7px ${BAR_COLOR[vs]}`, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#e2e8f0', marginTop: 4, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{mastery}%</div>
        </div>
      </div>

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}
