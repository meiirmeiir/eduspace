import { useState, useEffect, useRef } from "react";

const QUESTIONS = [
  {
    id: 1, section: "Алгебра", topic: "Линейные уравнения",
    text: "Решите уравнение: 3x + 7 = 22",
    options: ["x = 5", "x = 3", "x = 7", "x = 4"],
    correct: 0,
    hints: [
      "💡 Перенесите свободный член в правую часть уравнения",
      "📝 Вычтите 7 из обеих частей: 3x = 22 − 7 = 15",
      "✅ Разделите обе части на 3: x = 15 ÷ 3 = 5"
    ]
  },
  {
    id: 2, section: "Геометрия", topic: "Площадь треугольника",
    text: "Основание треугольника 8 см, высота 5 см. Найдите площадь.",
    options: ["20 см²", "40 см²", "13 см²", "16 см²"],
    correct: 0,
    hints: [
      "💡 Вспомните формулу площади треугольника",
      "📝 S = (основание × высота) ÷ 2",
      "✅ S = (8 × 5) ÷ 2 = 40 ÷ 2 = 20 см²"
    ]
  },
  {
    id: 3, section: "Алгебра", topic: "Степени",
    text: "Вычислите: 2⁵ + 3² = ?",
    options: ["41", "32", "27", "39"],
    correct: 0,
    hints: [
      "💡 Вычислите каждую степень по отдельности",
      "📝 2⁵ = 2×2×2×2×2 = 32",
      "✅ 3² = 9; итого: 32 + 9 = 41"
    ]
  },
  {
    id: 4, section: "Вероятность", topic: "Классическая вероятность",
    text: "В урне 3 красных и 7 синих шаров. Вероятность вытащить красный:",
    options: ["0.3", "0.7", "0.5", "0.03"],
    correct: 0,
    hints: [
      "💡 P = (число благоприятных) ÷ (число всех исходов)",
      "📝 Всего шаров: 3 + 7 = 10",
      "✅ P = 3 ÷ 10 = 0.3"
    ]
  },
  {
    id: 5, section: "Геометрия", topic: "Теорема Пифагора",
    text: "Катеты прямоугольного треугольника: 6 см и 8 см. Найдите гипотенузу.",
    options: ["10 см", "12 см", "7 см", "14 см"],
    correct: 0,
    hints: [
      "💡 Используйте теорему Пифагора: c² = a² + b²",
      "📝 c² = 6² + 8² = 36 + 64 = 100",
      "✅ c = √100 = 10 см"
    ]
  }
];

const CONFIDENCE = [
  { v: 1, label: "Абсолютно неуверен", emoji: "😰", color: "#ef4444" },
  { v: 2, label: "Неуверен", emoji: "😟", color: "#f97316" },
  { v: 3, label: "Нейтрально", emoji: "😐", color: "#eab308" },
  { v: 4, label: "Уверен", emoji: "😊", color: "#22c55e" },
  { v: 5, label: "Абсолютно уверен", emoji: "😎", color: "#2563eb" },
];

const RPG_NODES = [
  { id: 1, type: "npc", name: "Линейные уравнения", emoji: "📐", topic: "Алгебра", x: 60, y: 390 },
  { id: 2, type: "npc", name: "Степени и корни", emoji: "🔢", topic: "Алгебра", x: 170, y: 280 },
  { id: 3, type: "boss", name: "БОСС: Алгебра", emoji: "👾", topic: "Алгебра", x: 290, y: 180 },
  { id: 4, type: "npc", name: "Площадь фигур", emoji: "📏", topic: "Геометрия", x: 410, y: 270 },
  { id: 5, type: "npc", name: "Теорема Пифагора", emoji: "📐", topic: "Геометрия", x: 510, y: 380 },
  { id: 6, type: "boss", name: "БОСС: Геометрия", emoji: "🐉", topic: "Геометрия", x: 620, y: 240 },
  { id: 7, type: "npc", name: "Вероятность", emoji: "🎲", topic: "Вероятность", x: 710, y: 140 },
  { id: 8, type: "boss", name: "ФИНАЛ: ЕНТ", emoji: "🏆", topic: "ЕНТ", x: 820, y: 60 },
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];

const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

// ── Animated Draft ────────────────────────────────────────────────────────────
function AnimatedDraft() {
  const lines = [
    { text: "Задача 3: Вычислите 2⁵ + 3²", color: "#1e3a8a", bold: true },
    { text: "  Шаг 1: 2⁵ = 2 × 2 × 2 × 2 × 2", color: "#374151" },
    { text: "  2⁵ = 32", color: "#374151" },
    { text: "  Шаг 2: 3² = 3 × 3 = 9", color: "#374151" },
    { text: "  Шаг 3: 32 + 9 = 41", color: "#374151" },
    { text: "  Ответ: 41  ✓", color: "#16a34a", bold: true },
  ];
  const [vLines, setVLines] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    if (vLines >= lines.length) {
      const t = setTimeout(() => { setVLines(0); setCharIdx(0); }, 2500);
      return () => clearTimeout(t);
    }
    if (charIdx < lines[vLines].text.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), 38);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => { setVLines(v => v + 1); setCharIdx(0); }, 280);
      return () => clearTimeout(t);
    }
  }, [vLines, charIdx]);

  return (
    <div style={{
      background: "#fffef0", border: "2px solid #e5e7eb", borderRadius: 14,
      padding: "18px 22px", fontFamily: "monospace", fontSize: 14, lineHeight: 2,
      minHeight: 170, boxShadow: "inset 0 2px 8px #0001", position: "relative"
    }}>
      <div style={{ position: "absolute", top: 10, right: 12, fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
        ✏️ ЧЕРНОВИК
      </div>
      {lines.map((line, i) => (
        <div key={i} style={{ color: line.color, fontWeight: line.bold ? 800 : 400, whiteSpace: "pre" }}>
          {i < vLines ? line.text
            : i === vLines ? (
              <>
                {line.text.slice(0, charIdx)}
                <span style={{ borderRight: "2px solid #2563eb", animation: "blink 0.8s infinite" }}>​</span>
              </>
            ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Timer (stopwatch — counts up) ─────────────────────────────────────────────
function Timer({ seconds }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const color = seconds < 60 ? "#2563eb" : seconds < 120 ? "#f59e0b" : "#ef4444";
  const deg = Math.min((seconds % 60) / 60 * 360, 360);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 54, height: 54, borderRadius: "50%",
        background: `conic-gradient(${color}55 ${deg}deg, #e0e7ff ${deg}deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 12, color, fontFamily: "Sora,sans-serif"
        }}>
          {mins > 0 ? `${mins}:${String(secs).padStart(2,"0")}` : `${secs}с`}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>ВРЕМЯ</span>
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>без лимита</span>
      </div>
    </div>
  );
}

// ── Intro Screen ─────────────────────────────────────────────────────────────
function IntroScreen({ onStart }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#eff6ff,#dbeafe)", padding: 24 }}>
      <div style={{ maxWidth: 600, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 54, marginBottom: 10 }}>📋</div>
          <h1 style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 28, color: "#1e3a8a" }}>
            Перед началом диагностики
          </h1>
          <p style={{ color: "#64748b", marginTop: 8, fontSize: 15, lineHeight: 1.7 }}>
            Прочитайте внимательно, это поможет получить точный результат
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 24px #2563eb15", border: "1px solid #e0e7ff", overflow: "hidden" }}>

          {/* Warning block */}
          <div style={{ background: "#fefce8", borderBottom: "1px solid #fde68a", padding: "18px 24px", display: "flex", gap: 14 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 800, color: "#854d0e", fontSize: 15, marginBottom: 4 }}>
                Обязательно ведите черновик!
              </div>
              <div style={{ color: "#78350f", fontSize: 13, lineHeight: 1.6 }}>
                Все вычисления записывайте на бумаге. В конце теста вы сфотографируете черновик — ИИ проверит ваши рассуждения и поможет выявить ошибки в процессе мышления, а не только в ответе.
              </div>
            </div>
          </div>

          <div style={{ padding: "24px 28px" }}>
            {/* Rules */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 15, color: "#1e3a8a", marginBottom: 14 }}>
                📌 Правила диагностики
              </div>
              {[
                ["⏱️", "Секундомер фиксирует ваше время", "Лимита нет — работайте в своём темпе"],
                ["💡", "Доступны подсказки 3 уровней", "Открываются по очереди"],
                ["🧠", "После ответа — уровень уверенности", "Это важная часть диагностики"],
                ["📸", "В конце загрузите фото черновика", "ИИ проанализирует решения"],
              ].map(([icon, title, sub], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8faff", borderRadius: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Draft example */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 15, color: "#1e3a8a", marginBottom: 6 }}>
                ✍️ Как правильно вести черновик
              </div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                Записывайте каждый шаг на новой строке — так ИИ точнее проанализирует ваши рассуждения:
              </p>
              <AnimatedDraft />
            </div>

            <button
              onClick={onStart}
              style={{
                width: "100%", padding: "14px 0", background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                color: "#fff", border: "none", borderRadius: 14, fontFamily: "Nunito,sans-serif",
                fontWeight: 800, fontSize: 17, cursor: "pointer", boxShadow: "0 6px 20px #2563eb40",
                transition: "transform .2s"
              }}
              onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.target.style.transform = "translateY(0)"}
            >
              Начать диагностику 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Question Screen ───────────────────────────────────────────────────────────
function QuestionScreen({ question, qNum, total, onComplete }) {
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [hintsOpen, setHintsOpen] = useState(0);
  const [visibleHint, setVisibleHint] = useState(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setElapsed(0);
    setSelected(null);
    setConfidence(null);
    setHintsOpen(0);
    setVisibleHint(null);
    startRef.current = Date.now();
  }, [question.id]);

  useEffect(() => {
    if (selected !== null) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [selected]);

  const openHint = (level) => {
    if (level > hintsOpen + 1) return;
    setHintsOpen(prev => Math.max(prev, level));
    setVisibleHint(v => v === level ? null : level);
  };

  const handleSelect = (i) => {
    if (selected !== null) return;
    setSelected(i);
  };

  const handleNext = () => {
    onComplete({
      questionId: question.id,
      topic: question.topic,
      section: question.section,
      selectedAnswer: selected,
      correct: selected === question.correct,
      confidence: confidence?.v,
      timeSpent: elapsed,
      hintLevel: hintsOpen,
    });
  };

  const answered = selected !== null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: "#1e3a8a" }}>
            Вопрос {qNum} <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 15 }}>из {total}</span>
          </div>
          <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
            <span style={{ background: "#eff6ff", color: "#2563eb", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{question.section}</span>
            <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{question.topic}</span>
          </div>
        </div>
        <Timer seconds={elapsed} />
      </div>

      {/* Progress */}
      <div style={{ background: "#e0e7ff", borderRadius: 99, height: 6, marginBottom: 22, overflow: "hidden" }}>
        <div style={{ width: `${((qNum - 1) / total) * 100}%`, background: "linear-gradient(90deg,#2563eb,#7c3aed)", height: "100%", borderRadius: 99, transition: "width .4s" }} />
      </div>


      {/* Question */}
      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e0e7ff", boxShadow: "0 2px 16px #2563eb0a", padding: "22px 26px", marginBottom: 14 }}>
        <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.65, color: "#1e293b", marginBottom: 20 }}>
          {question.text}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {question.options.map((opt, i) => {
            let bg = "#f8faff", border = "#e0e7ff", clr = "#1e293b", cursor_ = "pointer";
            if (answered) {
              if (i === question.correct) { bg = "#dcfce7"; border = "#16a34a"; clr = "#15803d"; }
              else if (i === selected) { bg = "#fee2e2"; border = "#ef4444"; clr = "#dc2626"; }
              cursor_ = "default";
            } else if (selected === i) {
              bg = "#eff6ff"; border = "#2563eb";
            }
            return (
              <div key={i} onClick={() => handleSelect(i)} style={{
                padding: "13px 18px", borderRadius: 12, border: `2px solid ${border}`,
                background: bg, color: clr, fontWeight: 600, fontSize: 15,
                cursor: cursor_, transition: "all .18s",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>
                  <b style={{ color: answered ? clr : "#2563eb", marginRight: 10, fontFamily: "Sora,sans-serif" }}>
                    {String.fromCharCode(65 + i)}.
                  </b>
                  {opt}
                </span>
                {answered && i === question.correct && <span style={{ fontSize: 18 }}>✅</span>}
                {answered && i === selected && i !== question.correct && <span style={{ fontSize: 18 }}>❌</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confidence — shown after answer */}
      {answered && (
        <div style={{ background: "#fff", borderRadius: 18, border: "2px solid #bfdbfe", boxShadow: "0 2px 16px #2563eb0a", padding: "18px 22px", marginBottom: 14 }}>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 14, color: "#1e3a8a", marginBottom: 14 }}>
            🧠 Оцените свою уверенность в ответе
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CONFIDENCE.map(c => {
              const active = confidence?.v === c.v;
              return (
                <div key={c.v} onClick={() => setConfidence(c)} style={{
                  flex: 1, minWidth: 85, padding: "10px 6px", borderRadius: 12, textAlign: "center",
                  border: `2px solid ${active ? c.color : "#e0e7ff"}`,
                  background: active ? c.color + "15" : "#f8faff",
                  cursor: "pointer", transition: "all .18s",
                }}>
                  <div style={{ fontSize: 24 }}>{c.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: active ? c.color : "#64748b", marginTop: 4, lineHeight: 1.3 }}>
                    {c.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hints */}
      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #fde68a", padding: "16px 20px", marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#92400e", marginBottom: 12 }}>
          💡 Подсказки (открываются по очереди)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {question.hints.map((hint, i) => {
            const lvl = i + 1;
            const locked = lvl > hintsOpen + 1;
            const visible = visibleHint === lvl && !locked;
            const opened = lvl <= hintsOpen;
            return (
              <div key={i}>
                <button
                  disabled={locked}
                  onClick={() => openHint(lvl)}
                  style={{
                    width: "100%", textAlign: "left", padding: "9px 14px",
                    background: opened ? "#fffbeb" : "#fafafa",
                    border: `1.5px solid ${opened ? "#fbbf24" : locked ? "#e2e8f0" : "#fcd34d"}`,
                    borderRadius: 10, fontSize: 13, fontWeight: 700,
                    color: locked ? "#cbd5e1" : "#92400e", cursor: locked ? "not-allowed" : "pointer",
                    fontFamily: "Nunito,sans-serif", transition: "all .2s", display: "flex", justifyContent: "space-between"
                  }}>
                  <span>
                    {locked ? `🔒 Подсказка ${lvl}` : opened ? `${visible ? "▲" : "▶"} Подсказка ${lvl}` : `▶ Подсказка ${lvl} — нажмите для открытия`}
                  </span>
                  {locked && <span style={{ fontSize: 11, color: "#cbd5e1" }}>Сначала откройте {lvl - 1}</span>}
                </button>
                {visible && (
                  <div style={{
                    marginTop: 6, padding: "11px 14px", background: "#fffbeb",
                    borderRadius: 10, fontSize: 14, color: "#78350f",
                    border: "1px solid #fde68a", lineHeight: 1.6
                  }}>
                    {hint}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next */}
      <button
        disabled={!answered || !confidence}
        onClick={handleNext}
        style={{
          width: "100%", padding: 14, background: (!answered || !confidence) ? "#e0e7ff" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
          color: (!answered || !confidence) ? "#94a3b8" : "#fff", border: "none", borderRadius: 14,
          fontFamily: "Nunito,sans-serif", fontWeight: 800, fontSize: 16, cursor: (!answered || !confidence) ? "not-allowed" : "pointer",
          transition: "all .2s"
        }}>
        {!answered ? "Выберите ответ" : !confidence ? "⚠️ Укажите уровень уверенности" : qNum < total ? "Следующий вопрос →" : "Завершить и загрузить черновик 📸"}
      </button>
    </div>
  );
}

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen({ answers, onAnalyze }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const correct = answers.filter(a => a.correct).length;

  const handleSubmit = async () => {
    setLoading(true);
    let imageData = null;
    if (files[0]) {
      imageData = await new Promise(res => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.readAsDataURL(files[0]);
      });
    }
    onAnalyze(imageData, files.length > 0);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 54, marginBottom: 10 }}>📸</div>
        <h2 style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 24, color: "#1e3a8a" }}>
          Загрузите фото черновика
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
          Сфотографируйте все страницы. ИИ проверит ваши рассуждения и составит подробный отчёт.
        </p>
      </div>

      {/* Quick summary */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e0e7ff", padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#1e3a8a", marginBottom: 12 }}>Ваши ответы:</div>
        {answers.map((a, i) => {
          const conf = CONFIDENCE.find(c => c.v === a.confidence);
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < answers.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>{i+1}. {a.topic}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, background: "#f1f5f9", borderRadius: 6, padding: "2px 7px", color: "#64748b", fontWeight: 600 }}>⏱ {a.timeSpent}с</span>
                {conf && <span style={{ fontSize: 14 }}>{conf.emoji}</span>}
                {a.hintLevel > 0 && <span style={{ fontSize: 12, background: "#fef3c7", borderRadius: 6, padding: "2px 7px", color: "#92400e", fontWeight: 700 }}>💡×{a.hintLevel}</span>}
                <span style={{ fontSize: 18 }}>{a.correct ? "✅" : "❌"}</span>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 12, textAlign: "right", fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 16, color: correct / answers.length >= 0.6 ? "#2563eb" : "#ef4444" }}>
          {correct} / {answers.length} верных ответов
        </div>
      </div>

      {/* Upload area */}
      <div
        onClick={() => document.getElementById("diagUpload").click()}
        style={{
          border: "2.5px dashed #93c5fd", borderRadius: 18, padding: "36px 24px",
          textAlign: "center", background: "#f0f7ff", marginBottom: 20, cursor: "pointer",
          transition: "all .2s"
        }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📎</div>
        <p style={{ fontWeight: 800, color: "#2563eb", fontSize: 15 }}>Нажмите для выбора фото</p>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>JPG, PNG — можно несколько файлов</p>
        {files.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {files.map((f, i) => (
              <div key={i} style={{ background: "#dbeafe", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#2563eb" }}>
                ✅ {f.name}
              </div>
            ))}
          </div>
        )}
        <input id="diagUpload" type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={e => setFiles(Array.from(e.target.files))} />
      </div>

      <button
        onClick={handleSubmit} disabled={loading}
        style={{
          width: "100%", padding: 15, borderRadius: 14, border: "none", fontFamily: "Nunito,sans-serif",
          fontWeight: 800, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#e0e7ff" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
          color: loading ? "#94a3b8" : "#fff", transition: "all .2s"
        }}>
        {loading ? "Отправляем..." : files.length > 0 ? "🤖 Отправить на анализ ИИ" : "Получить отчёт без фото →"}
      </button>
    </div>
  );
}

// ── Analyzing Screen ──────────────────────────────────────────────────────────
function AnalyzingScreen() {
  const [step, setStep] = useState(0);
  const steps = ["Анализирую ваши ответы…", "Оцениваю уровень уверенности…", "Проверяю черновики…", "Составляю рекомендации…", "Создаю индивидуальный план…"];
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 28 }}>
      <div style={{ fontSize: 64, animation: "spin 2s linear infinite" }}>🤖</div>
      <h2 style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 22, color: "#1e3a8a", textAlign: "center" }}>
        ИИ анализирует ваши результаты
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 320 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, transition: "opacity .5s", opacity: i <= step ? 1 : 0.25 }}>
            <div style={{ fontSize: 18, transition: "all .3s" }}>{i < step ? "✅" : i === step ? "⏳" : "○"}</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: i === step ? "#2563eb" : "#64748b" }}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{ width: 280, background: "#e0e7ff", borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${((step + 1) / steps.length) * 100}%`, background: "linear-gradient(90deg,#2563eb,#7c3aed)", height: "100%", borderRadius: 99, transition: "width .8s" }} />
      </div>
    </div>
  );
}

// ── Report Screen ─────────────────────────────────────────────────────────────
function ReportScreen({ report, onViewPlan }) {
  const { answers, aiAnalysis } = report;
  const correct = answers.filter(a => a.correct).length;
  const total = answers.length;
  const score = Math.round((correct / total) * 100);
  const avgConf = +(answers.reduce((s, a) => s + (a.confidence || 3), 0) / total).toFixed(1);
  const avgTime = Math.round(answers.reduce((s, a) => s + a.timeSpent, 0) / total);
  const hintsUsed = answers.filter(a => a.hintLevel > 0).length;

  const sections = {};
  answers.forEach(a => {
    if (!sections[a.section]) sections[a.section] = { t: 0, c: 0 };
    sections[a.section].t++;
    if (a.correct) sections[a.section].c++;
  });

  const scoreColor = score >= 80 ? "#16a34a" : score >= 60 ? "#2563eb" : "#ef4444";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px" }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${scoreColor}15, ${scoreColor}08)`,
        border: `2px solid ${scoreColor}30`, borderRadius: 20, padding: "28px 24px",
        textAlign: "center", marginBottom: 24
      }}>
        <div style={{ fontSize: 56, marginBottom: 6 }}>
          {score >= 80 ? "🏆" : score >= 60 ? "📊" : "📖"}
        </div>
        <h1 style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 24, color: "#1e3a8a" }}>
          Результат диагностики
        </h1>
        <div style={{ fontFamily: "Sora,sans-serif", fontSize: 72, fontWeight: 900, color: scoreColor, lineHeight: 1, margin: "10px 0 4px" }}>
          {score}%
        </div>
        <p style={{ color: "#64748b", fontSize: 15 }}>
          {correct} из {total} правильных ответов
        </p>
        <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: scoreColor }}>
          {score >= 80 ? "Отличный результат! Вы хорошо подготовлены 🎉"
           : score >= 60 ? "Хороший уровень. Есть зоны для роста 💪"
           : "Есть над чем поработать. ИИ составит план 📚"}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Ср. уверенность", value: `${avgConf}/5`, icon: "🧠", color: "#7c3aed" },
          { label: "Ср. время/задача", value: `${avgTime}с`, icon: "⏱️", color: "#0ea5e9" },
          { label: "Открыто подсказок", value: `${hintsUsed}/${total}`, icon: "💡", color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e0e7ff", padding: "16px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 900, fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* By section */}
      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e0e7ff", padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 16, color: "#1e3a8a", marginBottom: 16 }}>📊 По разделам</h3>
        {Object.entries(sections).map(([sec, d]) => {
          const pct = Math.round((d.c / d.t) * 100);
          const col = pct >= 80 ? "#16a34a" : pct >= 60 ? "#2563eb" : "#ef4444";
          return (
            <div key={sec} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{sec}</span>
                <span style={{ fontFamily: "Sora,sans-serif", fontWeight: 900, color: col }}>{pct}%</span>
              </div>
              <div style={{ background: "#e0e7ff", borderRadius: 99, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, background: col, height: "100%", borderRadius: 99, transition: "width 1s .3s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Per question */}
      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e0e7ff", padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 16, color: "#1e3a8a", marginBottom: 16 }}>🔍 Подробный разбор</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {answers.map((a, i) => {
            const conf = CONFIDENCE.find(c => c.v === a.confidence);
            return (
              <div key={i} style={{
                padding: "14px 16px", background: a.correct ? "#f0fdf4" : "#fef2f2",
                borderRadius: 14, border: `1.5px solid ${a.correct ? "#bbf7d0" : "#fecaca"}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
                      {i + 1}. {a.topic}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, background: "#e0e7ff", color: "#2563eb", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>⏱ {a.timeSpent}с</span>
                      {conf && <span style={{ fontSize: 12, background: conf.color + "18", color: conf.color, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{conf.emoji} {conf.label}</span>}
                      {a.hintLevel > 0 && <span style={{ fontSize: 12, background: "#fef3c7", color: "#92400e", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>💡 Подсказка уровня {a.hintLevel}</span>}
                    
                    </div>
                  </div>
                  <div style={{ fontSize: 24, marginLeft: 12 }}>{a.correct ? "✅" : "❌"}</div>
                </div>
                {!a.correct && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff7ed", borderRadius: 10, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                    ⚠️ Рекомендуем повторить тему: <b>{a.topic}</b>
                  </div>
                )}
                {a.correct && a.confidence <= 2 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#fefce8", borderRadius: 10, fontSize: 13, color: "#854d0e", fontWeight: 600 }}>
                    🤔 Ответ верный, но уверенность низкая — стоит закрепить тему <b>{a.topic}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI analysis */}
      {aiAnalysis && (
        <div style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)", borderRadius: 18, padding: "22px 26px", marginBottom: 24, color: "#fff" }}>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            🤖 Анализ ИИ
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.85, opacity: .95, whiteSpace: "pre-wrap" }}>
            {aiAnalysis}
          </div>
        </div>
      )}

      <button
        onClick={onViewPlan}
        style={{
          width: "100%", padding: 16, background: "linear-gradient(135deg,#7c3aed,#2563eb)",
          color: "#fff", border: "none", borderRadius: 16, fontFamily: "Nunito,sans-serif",
          fontWeight: 800, fontSize: 17, cursor: "pointer", boxShadow: "0 6px 24px #7c3aed40"
        }}>
        🗺️ Открыть индивидуальный план (RPG) →
      </button>
    </div>
  );
}

// ── RPG Map ───────────────────────────────────────────────────────────────────
function RPGMap({ answers }) {
  const [selected, setSelected] = useState(null);

  const sections = {};
  if (answers) {
    answers.forEach(a => {
      if (!sections[a.section]) sections[a.section] = { t: 0, c: 0 };
      sections[a.section].t++;
      if (a.correct) sections[a.section].c++;
    });
  }

  const getHp = (topic, isBoss) => {
    const max = isBoss ? 200 : 100;
    const match = Object.entries(sections).find(([s]) => topic.includes(s) || s.includes(topic));
    if (!match) return Math.round(max * 0.75);
    const [, d] = match;
    const mastery = d.c / d.t;
    return Math.round(max * (1 - mastery));
  };

  return (
    <div style={{ padding: "28px 20px", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Sora,sans-serif", fontSize: 26, fontWeight: 800, color: "#1e3a8a", marginBottom: 4 }}>
        🗺️ Индивидуальный план обучения
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
        Перед тобой твой личный путь к ЕНТ. Каждый навык — это NPC с HP. Чем ниже твой результат в диагностике — тем больше HP у противника. Победи всех и дойди до финального босса!
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { emoji: "👤", label: "NPC — навык для изучения", color: "#2563eb" },
          { emoji: "👾🐉", label: "БОСС — серьёзный тест", color: "#7c3aed" },
          { emoji: "❤️", label: "HP — сколько осталось проработать", color: "#ef4444" },
          { emoji: "⚔️", label: "Нажми на персонажа для деталей", color: "#64748b" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: l.color, background: l.color + "10", borderRadius: 99, padding: "5px 12px" }}>
            {l.emoji} {l.label}
          </div>
        ))}
      </div>

      <div style={{ background: "linear-gradient(180deg,#0f172a,#1e3a8a)", borderRadius: 20, padding: 20, overflowX: "auto", marginBottom: 20, boxShadow: "0 8px 40px #0f172a40" }}>
        <svg width={920} height={510} style={{ display: "block" }}>
          {/* Stars */}
          {Array.from({ length: 40 }).map((_, i) => (
            <circle key={i} cx={Math.random() * 920} cy={Math.random() * 510}
              r={Math.random() * 1.5 + 0.5} fill="#ffffff" opacity={Math.random() * 0.6 + 0.2} />
          ))}

          {/* Path lines */}
          {RPG_PATHS.map(([a, b]) => {
            const na = RPG_NODES.find(n => n.id === a);
            const nb = RPG_NODES.find(n => n.id === b);
            const sz = 40;
            return (
              <line key={`${a}-${b}`}
                x1={na.x + sz} y1={na.y + sz}
                x2={nb.x + sz} y2={nb.y + sz}
                stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="10 5" opacity={.5} />
            );
          })}

          {/* Nodes */}
          {RPG_NODES.map(node => {
            const isBoss = node.type === "boss";
            const sz = isBoss ? 80 : 64;
            const hp = getHp(node.topic, isBoss);
            const maxHp = isBoss ? 200 : 100;
            const hpPct = Math.min(hp / maxHp, 1);
            const defeated = hp <= 0;
            const sel = selected === node.id;
            const hpColor = hpPct > 0.6 ? "#ef4444" : hpPct > 0.3 ? "#f97316" : "#22c55e";

            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`}
                onClick={() => setSelected(sel ? null : node.id)}
                style={{ cursor: "pointer" }}>
                {/* Glow */}
                {!defeated && (
                  <circle cx={sz/2} cy={sz/2} r={sz/2 + (sel ? 10 : 6)}
                    fill="none" stroke={isBoss ? "#a855f7" : "#60a5fa"}
                    strokeWidth={sel ? 3 : 2} opacity={sel ? 0.9 : 0.4} />
                )}
                {/* Body */}
                <circle cx={sz/2} cy={sz/2} r={sz/2}
                  fill={defeated ? "#064e3b" : isBoss ? "#4c1d95" : "#1e3a8a"}
                  stroke={defeated ? "#34d399" : isBoss ? "#a855f7" : "#60a5fa"}
                  strokeWidth={2.5} />
                {/* Emoji */}
                <text x={sz/2} y={sz/2 + (isBoss ? 10 : 8)} textAnchor="middle" fontSize={isBoss ? 32 : 26}>
                  {defeated ? "💀" : node.emoji}
                </text>
                {/* HP bar */}
                {!defeated && (
                  <>
                    <rect x={2} y={sz + 8} width={sz - 4} height={7} rx={3.5} fill="#1e293b" />
                    <rect x={2} y={sz + 8} width={(sz - 4) * hpPct} height={7} rx={3.5} fill={hpColor} />
                    <text x={sz/2} y={sz + 24} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill="#94a3b8">
                      {hp}/{maxHp} HP
                    </text>
                  </>
                )}
                {/* Name */}
                <text x={sz/2} y={sz + (defeated ? 22 : 38)} textAnchor="middle"
                  fontSize={isBoss ? 11 : 10} fontWeight="bold"
                  fill={isBoss ? "#c084fc" : "#93c5fd"}>
                  {node.name.length > 16 ? node.name.slice(0, 15) + "…" : node.name}
                </text>
                {defeated && (
                  <text x={sz/2} y={sz + 36} textAnchor="middle" fontSize={9} fill="#34d399" fontWeight="bold">
                    ПОБЕЖДЁН ✓
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected detail */}
      {selected && (() => {
        const node = RPG_NODES.find(n => n.id === selected);
        const isBoss = node.type === "boss";
        const hp = getHp(node.topic, isBoss);
        const maxHp = isBoss ? 200 : 100;
        const dmg = maxHp - hp;
        const pct = Math.round((dmg / maxHp) * 100);
        return (
          <div style={{
            background: "#fff", borderRadius: 18, border: `2px solid ${isBoss ? "#a855f7" : "#2563eb"}`,
            padding: "22px 26px", boxShadow: "0 4px 24px #2563eb15"
          }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 44 }}>{node.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: "#1e3a8a" }}>
                  {node.name}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                  {isBoss ? "🏰 Серьёзный тест" : "⚔️ Навык для изучения"} · Раздел: {node.topic}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 900, fontSize: 26, color: hp > 60 ? "#ef4444" : hp > 30 ? "#f97316" : "#22c55e" }}>
                  ❤️ {hp}/{maxHp}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>HP осталось</div>
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Прогресс освоения</span>
                <span style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: "#2563eb" }}>{pct}%</span>
              </div>
              <div style={{ background: "#e0e7ff", borderRadius: 99, height: 12, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, background: "linear-gradient(90deg,#2563eb,#7c3aed)", height: "100%", borderRadius: 99, transition: "width 1s" }} />
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                {pct >= 100 ? "🎉 Отлично! Этот навык полностью освоен." :
                 pct >= 70 ? `💪 Хороший прогресс! Осталось ${100 - pct}% — ещё немного.` :
                 pct >= 40 ? `📚 Нужно проработать материал по теме "${node.topic}"` :
                 `🔴 Эта тема требует серьёзного внимания. Начни с базовых упражнений.`}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("intro");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [report, setReport] = useState(null);

  const handleAnswer = (data) => {
    const next = [...answers, data];
    setAnswers(next);
    if (qIndex + 1 < QUESTIONS.length) setQIndex(qIndex + 1);
    else setScreen("upload");
  };

  const handleAnalyze = async (imageData, hasPhoto) => {
    setScreen("analyzing");
    let aiAnalysis = "";
    try {
      const correct = answers.filter(a => a.correct).length;
      const score = Math.round((correct / answers.length) * 100);
      const weak = answers.filter(a => !a.correct).map(a => a.topic).join(", ") || "нет";
      const lowConf = answers.filter(a => a.correct && (a.confidence || 3) <= 2).map(a => a.topic).join(", ") || "нет";

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Ты репетитор по математике. Составь структурированный диагностический отчёт на русском языке для ученика.

Данные:
- Балл: ${score}% (${correct} из ${answers.length})
- Ошибки по темам: ${weak}
- Верно с низкой уверенностью: ${lowConf}
- Подсказки использованы: ${answers.filter(a=>a.hintLevel>0).length} вопросов
- Среднее время на вопрос: ${Math.round(answers.reduce((s,a)=>s+a.timeSpent,0)/answers.length)}с
${hasPhoto ? "- Ученик загрузил фото черновика" : "- Фото черновика не загружено"}

Напиши краткий структурированный отчёт (3-4 абзаца):
1. Общий вывод
2. Сильные стороны
3. Зоны роста с конкретными темами
4. Рекомендации на ближайшую неделю

Пиши мотивирующе и конкретно. Без лишних слов.`
          }]
        })
      });
      const d = await res.json();
      aiAnalysis = d.content?.[0]?.text || "";
    } catch {
      aiAnalysis = "Анализ временно недоступен. Ознакомьтесь с подробным отчётом выше.";
    }
    await new Promise(r => setTimeout(r, 600));
    setReport({ answers, aiAnalysis });
    setScreen("report");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Sora:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', sans-serif; background: #f0f4ff; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {["question","upload","analyzing","report","rpgmap"].includes(screen) && (
        <nav style={{
          background: "#fff", borderBottom: "1px solid #e0e7ff", padding: "12px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px #2563eb0a"
        }}>
          <span style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: "#1e3a8a" }}>⚡ EduSpace</span>
          {["report","rpgmap"].includes(screen) && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setScreen("report")} style={{
                padding: "8px 16px", borderRadius: 10, border: `2px solid ${screen==="report"?"#2563eb":"#e0e7ff"}`,
                background: screen==="report" ? "#eff6ff" : "#fff", color: screen==="report"?"#2563eb":"#64748b",
                fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer"
              }}>📊 Отчёт</button>
              <button onClick={() => setScreen("rpgmap")} style={{
                padding: "8px 16px", borderRadius: 10, border: `2px solid ${screen==="rpgmap"?"#7c3aed":"#e0e7ff"}`,
                background: screen==="rpgmap" ? "#f5f3ff" : "#fff", color: screen==="rpgmap"?"#7c3aed":"#64748b",
                fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer"
              }}>🗺️ Мой план</button>
            </div>
          )}
          {screen === "question" && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>
              Вопрос {qIndex + 1} из {QUESTIONS.length}
            </span>
          )}
        </nav>
      )}

      {screen === "intro" && <IntroScreen onStart={() => { setQIndex(0); setAnswers([]); setScreen("question"); }} />}
      {screen === "question" && (
        <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex+1} total={QUESTIONS.length} onComplete={handleAnswer} />
      )}
      {screen === "upload" && <UploadScreen answers={answers} onAnalyze={handleAnalyze} />}
      {screen === "analyzing" && <AnalyzingScreen />}
      {screen === "report" && report && <ReportScreen report={report} onViewPlan={() => setScreen("rpgmap")} />}
      {screen === "rpgmap" && <RPGMap answers={report?.answers || answers} />}
    </>
  );
}
