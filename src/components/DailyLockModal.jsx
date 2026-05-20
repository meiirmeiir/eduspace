import React from "react";
import { THEME } from "../lib/appConstants.js";

/**
 * Модальное окно, открывается при попытке зайти в "Ежедневные задачи"
 * пока у ученика нет ни одного освоенного навыка.
 * Показывает прогресс-шаги до разблокировки.
 */
export default function DailyLockModal({ open, onClose, smartDiagDone, onStartDiagnostic, onViewPlan, onOpenFaq }) {
  if (!open) return null;

  const steps = [
    {
      done: smartDiagDone,
      title: "Пройди диагностику",
      desc: "Адаптивный тест, который выявит твой уровень и построит план обучения.",
    },
    {
      done: false,
      title: "Освой первый навык",
      desc: "Пройди три этапа по любому навыку из плана: теория и задачи уровней A → B → C.",
      hasHelp: true,
    },
    {
      done: false,
      title: "Получи ежедневные задачи",
      desc: "На следующий день после освоения первого навыка задачи появятся здесь.",
    },
  ];

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ежедневные задачи заблокированы"
      style={{
        position:"fixed", inset:0, zIndex:10000,
        background:"rgba(15,23,42,0.55)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:16,
      }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          background:"#fff",
          borderRadius:16,
          maxWidth:520, width:"100%",
          maxHeight:"90vh", overflowY:"auto",
          boxShadow:"0 24px 64px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ padding:"22px 24px 12px", borderBottom:`1px solid ${THEME.border}`, display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ fontSize:32, lineHeight:1 }}>🔒</div>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:18, color:THEME.primary, margin:0 }}>
              Ежедневные задачи пока заблокированы
            </h2>
            <p style={{ fontSize:13, color:THEME.textLight, margin:"6px 0 0", lineHeight:1.5 }}>
              Чтобы открыть этот раздел, нужно освоить хотя бы один навык. Вот короткий путь:
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              background:"transparent", border:"none", color:THEME.textLight,
              fontSize:22, cursor:"pointer", padding:0, lineHeight:1,
            }}
          >×</button>
        </div>

        {/* Steps */}
        <div style={{ padding:"18px 24px 8px", display:"flex", flexDirection:"column", gap:14 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <div style={{
                flexShrink:0,
                width:28, height:28, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                background: s.done ? "#10b981" : "transparent",
                border: s.done ? "2px solid #10b981" : `2px solid ${THEME.border}`,
                color: s.done ? "#fff" : THEME.textLight,
                fontSize:13, fontWeight:700,
              }}>
                {s.done ? "✓" : (i + 1)}
              </div>
              <div style={{ flex:1, minWidth:0, paddingTop:2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <div style={{
                    fontFamily:"'Montserrat',sans-serif", fontWeight:700,
                    fontSize:14, color: s.done ? THEME.textLight : THEME.primary,
                    textDecoration: s.done ? "line-through" : "none",
                  }}>{s.title}</div>
                  {s.hasHelp && (
                    <button
                      onClick={()=>onOpenFaq?.("skillMastery")}
                      aria-label="Подробнее в FAQ"
                      title="Подробнее в FAQ"
                      style={{
                        flexShrink:0,
                        width:20, height:20, borderRadius:"50%",
                        border:`1px solid ${THEME.border}`,
                        background:"transparent", color:THEME.textLight,
                        fontSize:11, fontWeight:700, cursor:"pointer",
                        display:"inline-flex", alignItems:"center", justifyContent:"center",
                        padding:0, lineHeight:1,
                      }}
                    >?</button>
                  )}
                </div>
                <div style={{ fontSize:13, color:THEME.textLight, lineHeight:1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding:"12px 24px 22px", display:"flex", gap:10, flexWrap:"wrap" }}>
          {smartDiagDone ? (
            <button
              onClick={onViewPlan}
              style={{
                flex:1, minWidth:180,
                background:THEME.primary, color:THEME.accent, border:"none",
                borderRadius:10, padding:"12px 18px", fontWeight:700, fontSize:14, cursor:"pointer",
              }}
            >
              🗺️ Перейти к плану
            </button>
          ) : (
            <button
              onClick={onStartDiagnostic}
              style={{
                flex:1, minWidth:180,
                background:THEME.primary, color:THEME.accent, border:"none",
                borderRadius:10, padding:"12px 18px", fontWeight:700, fontSize:14, cursor:"pointer",
              }}
            >
              🎯 Начать диагностику
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background:"transparent", border:`1px solid ${THEME.border}`, color:THEME.textLight,
              borderRadius:10, padding:"12px 18px", fontWeight:600, fontSize:14, cursor:"pointer",
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
