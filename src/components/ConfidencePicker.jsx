import { CONFIDENCE_LEVELS, CONF_EMOJI, CONF_SHORT } from "../lib/appConstants.js";

// Шаг уровня уверенности (5 уровней) — те же ДАННЫЕ, что в реальной диагностике
// (CONFIDENCE_LEVELS + CONF_EMOJI/CONF_SHORT из appConstants → единый источник, без дрейфа).
// Self-contained inline-стили: demo — отдельный тёмный контекст без useTheme, а глобальный
// .conf-btn CSS — mobile-only + завязан на THEME-инлайн диагностики, не переиспускаем.
// value = выбранный v (число) | null. onChange(level) — level = объект {v,color,label}.
export default function ConfidencePicker({ value, onChange }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 10 }}>
        Насколько уверен в ответе?
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {CONFIDENCE_LEVELS.map((c) => {
          const active = value === c.v;
          return (
            <button
              key={c.v}
              type="button"
              aria-label={c.label}
              onClick={() => onChange(c)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                minHeight: 68, padding: "8px 2px", borderRadius: 14, cursor: "pointer",
                border: `1.5px solid ${active ? c.color : "rgba(255,255,255,0.14)"}`,
                background: active ? c.color + "22" : "rgba(255,255,255,0.04)",
                color: "#fff", fontFamily: "'Inter',sans-serif",
                transition: "transform .12s, border-color .15s, background .15s",
                transform: active ? "scale(1.05)" : "none",
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>{CONF_EMOJI[c.v]}</span>
              <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.1, color: active ? c.color : "rgba(255,255,255,0.55)" }}>
                {CONF_SHORT[c.v]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
