import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Инлайн-подсказка: маленькая иконка «?» + тултип.
// Десктоп — hover/focus; тач — тап (тоггл, закрытие по тапу вне/скроллу).
// Тултип рендерится в портал с position:fixed → не обрезается overflow:hidden
// у предков (ESR-виджет, карточки) и краем экрана (горизонтальный кламп).
// Цвет иконки = currentColor (наследует тему: светлый на тёмном фоне и наоборот);
// color-проп — опциональный оверрайд.
export default function InfoTooltip({ text, color }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, placement: 'top' });
  const ref = useRef(null);
  const isTouch = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(hover: none)').matches : false;

  const compute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const TW = 260, GAP = 8, MARGIN = 8;
    let left = r.left + r.width / 2 - TW / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - TW - MARGIN));
    const above = r.top > 130; // если сверху мало места — показать снизу
    const top = above ? r.top - GAP : r.bottom + GAP;
    setPos({ left, top, placement: above ? 'top' : 'bottom' });
  }, []);

  const show = useCallback(() => { compute(); setOpen(true); }, [compute]);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback((e) => {
    e.preventDefault();
    // Не stopPropagation: клик всплывает к document. Листенер закрытия для
    // этого тултипа добавляется в useEffect ПОСЛЕ события (само-закрытия нет),
    // а уже открытый соседний тултип при этом корректно закроется.
    setOpen(o => { if (!o) compute(); return !o; });
  }, [compute]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const hoverProps = isTouch ? {} : { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };

  return (
    <span
      ref={ref}
      tabIndex={0}
      role="button"
      aria-label="Подсказка"
      onClick={toggle}
      {...hoverProps}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: '50%',
        border: `1px solid ${color || 'currentColor'}`,
        color: color || 'currentColor', opacity: 0.55,
        fontSize: 11, fontWeight: 700, lineHeight: 1, cursor: 'help',
        fontFamily: "'Inter', sans-serif", userSelect: 'none', flexShrink: 0,
        verticalAlign: 'middle', marginLeft: 6,
      }}
    >
      ?
      {open && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed', left: pos.left, top: pos.top,
            transform: pos.placement === 'top' ? 'translateY(-100%)' : 'none',
            maxWidth: 260, background: '#0f172a', color: '#e2e8f0',
            padding: '10px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
            fontWeight: 500, fontFamily: "'Inter', sans-serif",
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)', zIndex: 10000,
            border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
