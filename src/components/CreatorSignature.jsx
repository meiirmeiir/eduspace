import React from 'react';
import { ensureCreatorStyles } from './creatorFx.js';

// Анимированная подпись Создателя «БМейірбек»: SVG-текст рукописным шрифтом
// (Caveat), прорисовка линии слева-направо через stroke-dashoffset, затем
// заливка золотом (fill-opacity 0→1). Играет один раз при монтировании.
// dash — константа длины контура (тюнится так, чтобы письмо завершалось к
// концу анимации; getTotalLength у <text> недоступен).
export default function CreatorSignature({ width = 340, dash = 2600 }) {
  ensureCreatorStyles();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22, marginBottom: 6 }}>
      <svg viewBox="0 0 380 110" width={width} height={Math.round(width * 110 / 380)} aria-label="Подпись: БМейірбек" style={{ overflow: 'visible' }}>
        <text
          x="10" y="80"
          fontFamily="'Caveat', cursive" fontSize="68" fontWeight="700"
          fill="#fbbf24" fillOpacity="0"
          stroke="#fbbf24" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"
          style={{
            strokeDasharray: dash,
            strokeDashoffset: dash,
            animation: 'crSign 2.8s ease-out forwards, crSignFill 0.9s ease-out 2.3s forwards',
            filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))',
          }}
        >
          БМейірбек
        </text>
      </svg>
    </div>
  );
}
