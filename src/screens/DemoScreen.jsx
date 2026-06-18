import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LatexText from "../components/ui/LatexText.jsx";
import { pickDemoQuestions } from "../data/demoQuestions.js";
import ConfidencePicker from "../components/ConfidencePicker.jsx";

/**
 * DemoScreen — мини-диагностика из 5 задач БЕЗ регистрации.
 * Не использует useAuth и не обращается к Firestore (uid не нужен).
 * После каждого ответа сразу показывает правильный вариант и подсказку.
 * По завершении вызывает onFinish(result), где result = {answers, weakTopics,
 * strongTopics, correctCount, total}. onExit — выход на лендинг.
 *
 * Дизайн повторяет лендинг: тёмный фон, Inter, акцент по роли (cookie aapa_role).
 */

const GOLD = "#d4af37";
const PURPLE = "#a78bfa";
const BG = "#0a0a14";

function getRoleAccent() {
  try { const m = document.cookie.match(/aapa_role=(parent|student)/); return m && m[1] === "parent" ? GOLD : PURPLE; }
  catch { return PURPLE; }
}

const DIFF_LABEL = { easy: "Простая", medium: "Средняя", hard: "Сложная" };

const ease = [0.16, 1, 0.3, 1];

export default function DemoScreen({ onFinish, onExit }) {
  const accent = useMemo(getRoleAccent, []);
  const questions = useMemo(() => pickDemoQuestions(), []);
  const total = questions.length;

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);     // выбранный индекс ответа
  const [confidence, setConfidence] = useState(null); // {v,color,label} | null — 2-й шаг (уверенность)
  const [answers, setAnswers] = useState([]); // [{topic, correct, confidence}]

  const q = questions[idx];
  // Двухшаговость (как реальная диагностика): reveal/засчёт ТОЛЬКО после выбора ответа И
  // уверенности → защита от случайного тапа (друзья жаловались на одношаговый засчёт).
  const revealed = selected !== null && confidence !== null;

  const choose = useCallback((i) => {
    if (confidence !== null) return;  // уверенность выбрана → ответ зафиксирован
    setSelected(i);                   // до уверенности — вариант можно менять (не засчитываем)
  }, [confidence]);

  const confirm = useCallback((c) => {
    if (selected === null || confidence !== null) return;
    setConfidence(c);
    setAnswers((a) => [...a, { topic: q.topic, correct: selected === q.correct, confidence: c.v }]);
  }, [selected, confidence, q]);

  const next = useCallback(() => {
    if (idx + 1 < total) {
      setIdx(idx + 1);
      setSelected(null);
      setConfidence(null);
      return;
    }
    // финал: считаем слабые/сильные темы
    const weak = [], strong = [];
    answers.forEach(({ topic, correct }) => {
      if (correct) { if (!strong.includes(topic)) strong.push(topic); }
      else if (!weak.includes(topic)) weak.push(topic);
    });
    const strongTopics = strong.filter((t) => !weak.includes(t)); // тема слабая, если был хоть один промах
    const correctCount = answers.filter((a) => a.correct).length;
    onFinish?.({ answers, weakTopics: weak, strongTopics, correctCount, total, ts: new Date().toISOString() });
  }, [idx, total, answers, onFinish]);

  const progress = ((idx + (revealed ? 1 : 0)) / total) * 100;

  return (
    <div role="main" style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter',sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .dm-opt{width:100%;text-align:left;display:flex;align-items:center;gap:14px;padding:18px 18px;border-radius:16px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#fff;font-family:'Inter',sans-serif;font-size:16px;cursor:pointer;transition:border-color .18s,background .18s,transform .12s;}
        .dm-opt:not(.locked):hover{border-color:rgba(255,255,255,.3);transform:translateY(-1px);}
        .dm-opt.locked{cursor:default;}
        .dm-letter{flex-shrink:0;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;background:rgba(255,255,255,.08);}
        .dm-btn{border:none;border-radius:14px;font-family:'Inter',sans-serif;font-weight:700;font-size:16px;cursor:pointer;padding:16px 30px;transition:transform .2s,box-shadow .2s,opacity .2s;}
        .dm-btn:hover{transform:translateY(-2px);}
        .dm-x{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.6);width:38px;height:38px;border-radius:10px;cursor:pointer;font-size:18px;line-height:1;transition:.18s;}
        .dm-x:hover{background:rgba(255,255,255,.12);color:#fff;}
      `}</style>

      {/* фоновое свечение */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-12%", right: "-12%", width: 560, height: 560, borderRadius: "50%", background: `radial-gradient(circle,${accent}22 0%,transparent 70%)` }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 680, margin: "0 auto", padding: "20px 20px 48px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* шапка: прогресс + выход */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.5px" }}>AAPA <span style={{ color: accent }}>· демо</span></div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Задача {idx + 1} / {total}</div>
          <button className="dm-x" onClick={onExit} aria-label="Выйти">✕</button>
        </div>

        {/* прогресс-бар */}
        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 30 }}>
          <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease }}
            style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${accent},#7c3aed)` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4, ease }} style={{ flex: 1 }}>
            {/* метки темы/сложности */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <span style={{ background: `${accent}1f`, border: `1px solid ${accent}45`, color: accent, fontSize: 12, fontWeight: 800, padding: "5px 14px", borderRadius: 99, letterSpacing: "0.4px" }}>{q.topic}</span>
              <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 99 }}>{DIFF_LABEL[q.difficulty]}</span>
            </div>

            {/* текст задачи */}
            <div style={{ fontSize: "clamp(20px,3.4vw,26px)", fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.4px", marginBottom: 26 }}>
              <LatexText text={q.text} />
            </div>

            {/* варианты */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correct;
                const isSel = selected === i;
                let border = "rgba(255,255,255,.1)", bg = "rgba(255,255,255,.035)", letterBg = "rgba(255,255,255,.08)";
                if (revealed && isCorrect) { border = "#34d399"; bg = "rgba(52,211,153,0.12)"; letterBg = "#34d399"; }
                else if (revealed && isSel && !isCorrect) { border = "#f87171"; bg = "rgba(248,113,113,0.12)"; letterBg = "#f87171"; }
                else if (isSel && !revealed) { border = accent; bg = `${accent}1f`; letterBg = accent; } // выбран, ждём уверенности
                const hl = (revealed && (isCorrect || isSel)) || (isSel && !revealed);
                return (
                  <button key={i} className={`dm-opt${revealed ? " locked" : ""}`} onClick={() => choose(i)}
                    style={{ borderColor: border, background: bg }}>
                    <span className="dm-letter" style={{ background: letterBg, color: hl ? "#0a0e1a" : "#fff" }}>
                      {revealed && isCorrect ? "✓" : revealed && isSel ? "✕" : String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1 }}><LatexText text={opt} /></span>
                  </button>
                );
              })}
            </div>

            {/* шаг уверенности (как реальная диагностика) — после выбора варианта, до reveal */}
            {selected !== null && !revealed && (
              <ConfidencePicker value={confidence?.v ?? null} onChange={confirm} />
            )}

            {/* разбор */}
            <AnimatePresence>
              {revealed && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease }} style={{ overflow: "hidden" }}>
                  <div style={{ marginTop: 18, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: selected === q.correct ? "#34d399" : "#f87171", marginBottom: 6 }}>
                      {selected === q.correct ? "Верно!" : "Не угадал — но это нормально, мы учимся"}
                    </div>
                    <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                      <LatexText text={q.hint} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* кнопка далее */}
        <div style={{ marginTop: 26 }}>
          <button className="dm-btn" disabled={!revealed} onClick={next}
            style={{ width: "100%", background: revealed ? `linear-gradient(135deg,${accent},#7c3aed)` : "rgba(255,255,255,0.08)",
              color: revealed ? "#fff" : "rgba(255,255,255,0.35)", cursor: revealed ? "pointer" : "default",
              boxShadow: revealed ? `0 12px 30px ${accent}33` : "none" }}>
            {idx + 1 < total ? "Следующая задача →" : "Показать мой план →"}
          </button>
          {!revealed && <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 12 }}>{selected === null ? "Выбери ответ" : "Оцени уверенность, чтобы продолжить"}</p>}
        </div>
      </div>
    </div>
  );
}
