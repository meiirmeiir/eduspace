// Гайд-карусель для онбординга родителя: «как ребёнок даёт код».
// Ручное листание (стрелки + точки + свайп), БЕЗ автопрокрутки — родитель читает
// в своём темпе. Слайды — схематичные HTML-моки (телефон-рамка + стрелка-подсветка),
// не реальные скрины (UI меняется — моки устойчивее, фейк-код P-123456, нулевой вес).
// Тема-aware (light/dark), профессиональный стиль (как дашборд).
import React, { useState, useRef } from "react";
import { useTheme } from "../ThemeContext.jsx";

export default function OnboardingGuide() {
  const { theme: THEME, dark } = useTheme();
  const [i, setI] = useState(0);
  const touchX = useRef(null);

  const C = {
    card: THEME.surface, border: THEME.border, text: THEME.text, dim: THEME.textLight, accent: THEME.accent,
    screen: dark ? "#0f1422" : "#f1f5f9",
    el: dark ? "rgba(255,255,255,0.09)" : "#e2e8f0",
    bezel: dark ? "#2a2f3e" : "#cbd5e1",
  };

  const Phone = ({ children }) => (
    <div style={{ width: 220, maxWidth: "100%", height: 250, margin: "0 auto", background: C.screen, border: `6px solid ${C.bezel}`,
      borderRadius: 24, padding: 12, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden", position: "relative" }}>
      {children}
    </div>
  );
  const Bar = ({ w = "100%", h = 10, c }) => <div style={{ width: w, height: h, borderRadius: 5, background: c || C.el }} />;

  const slides = [
    {
      title: "1. Открыть профиль",
      caption: "Ребёнок открывает приложение и нажимает вкладку «Профиль» внизу.",
      mock: (
        <Phone>
          <Bar w="55%" h={12} />
          <Bar h={36} /><Bar h={36} />
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            {[["🏠", "Главная", false], ["🗺", "План", false], ["👤", "Профиль", true]].map(([ic, lb, act]) => (
              <div key={lb} style={{ flex: 1, textAlign: "center", padding: "4px 2px", borderRadius: 8,
                background: act ? `${C.accent}22` : "transparent", border: act ? `1.5px solid ${C.accent}` : "1px solid transparent" }}>
                <div style={{ fontSize: 13 }}>{ic}</div>
                <div style={{ fontSize: 8, color: act ? C.text : C.dim, fontWeight: act ? 700 : 400 }}>{lb}</div>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 44, right: 16, color: C.accent, fontSize: 20, fontWeight: 800 }}>↓</div>
        </Phone>
      ),
    },
    {
      title: "2. Найти «Код для родителя»",
      caption: "В профиле прокручивает до раздела «👨‍👩‍👧 Код для родителя».",
      mock: (
        <Phone>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.el, flexShrink: 0 }} />
            <Bar w="50%" h={10} />
          </div>
          <Bar h={24} />
          <div style={{ background: C.card, border: `1.5px solid ${C.accent}`, borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>👨‍👩‍👧 Код для родителя</div>
            <div style={{ marginTop: 6, fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "1px" }}>P-123456</div>
          </div>
          <div style={{ position: "absolute", top: 92, right: 6, color: C.accent, fontSize: 20, fontWeight: 800 }}>←</div>
          <div style={{ flex: 1 }} />
        </Phone>
      ),
    },
    {
      title: "3. Показать код",
      caption: "Ребёнок диктует или показывает код — введите его в форме справа.",
      mock: (
        <Phone>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10, color: C.dim, textAlign: "center" }}>👨‍👩‍👧 Код для родителя</div>
          <div style={{ alignSelf: "center", background: C.card, border: `1.5px solid ${C.accent}`, borderRadius: 12,
            padding: "12px 18px", fontFamily: "monospace", fontWeight: 800, fontSize: 26, color: C.text, letterSpacing: "2px" }}>P-123456</div>
          <div style={{ fontSize: 10, color: C.dim, textAlign: "center", marginTop: 6 }}>📋 Скопировать</div>
          <div style={{ flex: 1 }} />
        </Phone>
      ),
    },
  ];
  const n = slides.length;
  const go = d => setI(p => (p + d + n) % n);
  const s = slides[i];
  const navBtn = { width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card,
    color: C.text, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 18px",
      boxShadow: dark ? "0 8px 28px -10px rgba(0,0,0,0.5)" : "0 8px 24px -12px rgba(10,25,47,0.12)" }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 14 }}>Как ребёнок даёт код</div>
      <div
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touchX.current || 0); if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}
      >
        <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 10, textAlign: "center" }}>{s.title}</div>
        {s.mock}
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5, textAlign: "center", marginTop: 12, minHeight: 40 }}>{s.caption}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 6 }}>
        <button type="button" onClick={() => go(-1)} aria-label="Назад" style={navBtn}>‹</button>
        <div style={{ display: "flex", gap: 7 }}>
          {slides.map((_, k) => (
            <button key={k} type="button" onClick={() => setI(k)} aria-label={`Слайд ${k + 1}`}
              style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
                background: k === i ? C.accent : C.el, transition: "width .3s" }} />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Вперёд" style={navBtn}>›</button>
      </div>
    </div>
  );
}
