import { useEffect, useRef } from 'react';
import { useNpc } from '../NpcContext.jsx';
import droneImg from '../assets/drone.png';

const STYLE_ID = 'npc-guide-styles';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes npc-float {
      0%   { transform: translateY(0px) rotate(-2deg); }
      50%  { transform: translateY(-10px) rotate(2deg); }
      100% { transform: translateY(0px) rotate(-2deg); }
    }
    @keyframes npc-fadein {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes npc-highlight-pulse {
      0%   { box-shadow: 0 0 0 4px rgba(212,175,55,0.6), 0 0 32px rgba(212,175,55,0.3); }
      50%  { box-shadow: 0 0 0 8px rgba(212,175,55,0.3), 0 0 48px rgba(212,175,55,0.5); }
      100% { box-shadow: 0 0 0 4px rgba(212,175,55,0.6), 0 0 32px rgba(212,175,55,0.3); }
    }
    .npc-float { animation: npc-float 3.5s ease-in-out infinite; }
    .npc-fadein { animation: npc-fadein 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .npc-overlay {
      position: fixed; inset: 0; z-index: 9990;
      background: rgba(0,0,0,0.55);
      pointer-events: none;
    }
    .npc-highlighted {
      position: relative;
      z-index: 9995 !important;
      border-radius: 12px;
      animation: npc-highlight-pulse 2s ease-in-out infinite;
      pointer-events: all;
    }
    /* NPC привязан к области дашборда (правее сайдбара) */
    .npc-panel {
      position: fixed;
      bottom: 32px;
      right: 32px;
      left: 268px; /* ширина сайдбара */
      pointer-events: none;
      z-index: 9999;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
    }
    .npc-panel-inner {
      pointer-events: all;
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      gap: 16px;
      max-width: 640px;
    }
    /* На мобильных сайдбар скрыт — NPC занимает всю ширину */
    @media (max-width: 768px) {
      .npc-panel { left: 0; right: 16px; bottom: 16px; }
    }
  `;
  document.head.appendChild(style);
}

export default function NpcGuide() {
  const { npcState, hideNpc, nextTourStep, skipTour } = useNpc();
  const highlightedRef = useRef(null);

  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove('npc-highlighted');
      highlightedRef.current.style.position = '';
      highlightedRef.current = null;
    }

    if (npcState.visible && npcState.selector && npcState.tourActive) {
      const el = document.querySelector(npcState.selector);
      if (el) {
        const computed = window.getComputedStyle(el).position;
        if (computed === 'static') el.style.position = 'relative';
        el.classList.add('npc-highlighted');
        highlightedRef.current = el;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return () => {
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove('npc-highlighted');
        highlightedRef.current.style.position = '';
        highlightedRef.current = null;
      }
    };
  }, [npcState.visible, npcState.selector, npcState.tourActive]);

  if (!npcState.visible) return null;

  const isTour = npcState.tourActive;
  const stepIdx = npcState.stepIdx ?? 0;
  const totalSteps = npcState.totalSteps ?? 1;

  return (
    <>
      {isTour && <div className="npc-overlay" />}

      <div className="npc-panel">
        <div className="npc-panel-inner npc-fadein">

          {/* Диалоговое окно */}
          <div style={{
            background: 'linear-gradient(160deg, #0d0d1a 0%, #111827 100%)',
            border: '2px solid #d4af37',
            borderRadius: 8,
            padding: '20px 24px 18px',
            boxShadow: '0 0 32px rgba(212,175,55,0.25), 0 8px 32px rgba(0,0,0,0.6)',
            position: 'relative',
            minWidth: 300,
            maxWidth: 400,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#d4af37', letterSpacing: 2, fontWeight: 700 }}>
                ▶ ПОМОЩНИК
              </div>
              <button onClick={isTour ? skipTour : hideNpc} style={{
                background: 'none', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37',
                fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', borderRadius: 4,
                padding: '2px 8px', lineHeight: 1.4,
              }}>
                [X]
              </button>
            </div>

            {isTour && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} style={{
                    height: 3, flex: 1, borderRadius: 2,
                    background: i <= stepIdx ? '#d4af37' : 'rgba(212,175,55,0.2)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            )}

            <p style={{
              fontFamily: 'monospace', fontSize: 14, color: '#e2e8f0',
              lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap',
            }}>
              {npcState.message}
            </p>

            {isTour && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={skipTour} style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11,
                  cursor: 'pointer', borderRadius: 4, padding: '5px 12px',
                }}>
                  Пропустить
                </button>
                <button onClick={nextTourStep} style={{
                  background: '#d4af37', color: '#0f172a', border: 'none',
                  fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', borderRadius: 4, padding: '6px 18px',
                }}>
                  {stepIdx < totalSteps - 1 ? 'Далее →' : 'Готово ✓'}
                </button>
              </div>
            )}

            <div style={{
              position: 'absolute', bottom: -11, right: 60,
              width: 0, height: 0,
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: '11px solid #d4af37',
            }} />
          </div>

          {/* Аватар NPC — 192×192 */}
          <div className="npc-float" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 192, height: 192, borderRadius: 16,
              border: '3px solid #d4af37',
              boxShadow: '0 0 32px rgba(212,175,55,0.5)',
              overflow: 'hidden', background: '#0d0d1a',
            }}>
              <img src={droneImg} alt="Помощник" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4af37', letterSpacing: 1 }}>
              ПОМОЩНИК
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
