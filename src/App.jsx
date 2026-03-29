import { useState, useEffect, useRef } from "react";

// ── CONSTANTS & DATA ──────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1, section: "Алгебра", topic: "Линейные уравнения",
    text: "Решите уравнение: 3x + 7 = 22",
    options: ["x = 5", "x = 3", "x = 7", "x = 4"],
    correct: 0,
    hints: [
      "Перенесите свободный член в правую часть уравнения.",
      "Вычтите 7 из обеих частей: 3x = 22 − 7 = 15.",
      "Разделите обе части на 3: x = 15 ÷ 3 = 5."
    ]
  },
  {
    id: 2, section: "Геометрия", topic: "Площадь треугольника",
    text: "Основание треугольника 8 см, высота 5 см. Найдите площадь.",
    options: ["20 см²", "40 см²", "13 см²", "16 см²"],
    correct: 0,
    hints: [
      "Вспомните формулу площади треугольника.",
      "S = (основание × высота) ÷ 2.",
      "S = (8 × 5) ÷ 2 = 40 ÷ 2 = 20 см²."
    ]
  },
  {
    id: 3, section: "Алгебра", topic: "Степени",
    text: "Вычислите: 2⁵ + 3² = ?",
    options: ["41", "32", "27", "39"],
    correct: 0,
    hints: [
      "Вычислите каждую степень по отдельности.",
      "2⁵ = 2×2×2×2×2 = 32.",
      "3² = 9; итого: 32 + 9 = 41."
    ]
  },
  {
    id: 4, section: "Вероятность", topic: "Классическая вероятность",
    text: "В урне 3 красных и 7 синих шаров. Вероятность вытащить красный:",
    options: ["0.3", "0.7", "0.5", "0.03"],
    correct: 0,
    hints: [
      "Формула: P = (число благоприятных исходов) ÷ (общее число исходов).",
      "Всего шаров: 3 + 7 = 10.",
      "P = 3 ÷ 10 = 0.3."
    ]
  },
  {
    id: 5, section: "Геометрия", topic: "Теорема Пифагора",
    text: "Катеты прямоугольного треугольника: 6 см и 8 см. Найдите гипотенузу.",
    options: ["10 см", "12 см", "7 см", "14 см"],
    correct: 0,
    hints: [
      "Используйте теорему Пифагора: c² = a² + b².",
      "c² = 6² + 8² = 36 + 64 = 100.",
      "c = √100 = 10 см."
    ]
  }
];

const CONFIDENCE = [
  { v: 1, label: "Сомневаюсь", color: "#94a3b8" },
  { v: 2, label: "Не уверен", color: "#64748b" },
  { v: 3, label: "Нейтрально", color: "#475569" },
  { v: 4, label: "Уверен", color: "#d4af37" },
  { v: 5, label: "Абсолютно уверен", color: "#b48c26" },
];

const RPG_NODES = [
  { id: 1, type: "npc", name: "Линейные уравнения", topic: "Алгебра", x: 60, y: 390 },
  { id: 2, type: "npc", name: "Степени и корни", topic: "Алгебра", x: 170, y: 280 },
  { id: 3, type: "boss", name: "Аудит: Алгебра", topic: "Алгебра", x: 290, y: 180 },
  { id: 4, type: "npc", name: "Площадь фигур", topic: "Геометрия", x: 410, y: 270 },
  { id: 5, type: "npc", name: "Теорема Пифагора", topic: "Геометрия", x: 510, y: 380 },
  { id: 6, type: "boss", name: "Аудит: Геометрия", topic: "Геометрия", x: 620, y: 240 },
  { id: 7, type: "npc", name: "Вероятность", topic: "Вероятность", x: 710, y: 140 },
  { id: 8, type: "boss", name: "ФИНАЛ", topic: "Экзамен", x: 820, y: 60 },
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];

const REG_GOALS = {
  exam: "Подготовка к экзамену",
  gaps: "Закрытие пробелов за предыдущие классы",
  future: "Подготовка к будущему классу"
};

const EXAMS_LIST = ["ЕНТ", "SAT", "NUET", "Further Pure Math", "IGCSE"];
const GRADES_LIST = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс", "12 класс"];

// ── THEME CONSTANTS ───────────────────────────────────────────────────────────
const THEME = {
  primary: "#0f172a", // Deep Navy
  secondary: "#1e293b",
  accent: "#d4af37", // Elegant Gold
  accentHover: "#b48c26",
  bg: "#f8fafc",
  surface: "#ffffff",
  text: "#334155",
  textLight: "#64748b",
  border: "#e2e8f0"
};

// ── Shared UI Elements ────────────────────────────────────────────────────────
const InputStyle = {
  width: "100%", padding: "14px 18px", borderRadius: 8, border: `1px solid ${THEME.border}`,
  background: THEME.bg, fontSize: 15, color: THEME.primary, fontFamily: "'Inter', sans-serif",
  transition: "all 0.3s ease", outline: "none", marginBottom: 20
};

const LabelStyle = {
  display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: THEME.textLight, 
  textTransform: "uppercase", letterSpacing: "0.5px"
};

const ButtonStyle = (disabled) => ({
  width: "100%", padding: "16px 0", marginTop: 10,
  background: disabled ? THEME.border : THEME.primary,
  color: disabled ? THEME.textLight : THEME.accent,
  border: "none", borderRadius: 8, fontFamily: "'Montserrat', sans-serif",
  fontWeight: 600, fontSize: 15, letterSpacing: "1px", textTransform: "uppercase",
  cursor: disabled ? "not-allowed" : "pointer", 
  boxShadow: disabled ? "none" : "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
  transition: "all 0.3s ease"
});

const LogoIcon = () => (
  <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill={THEME.primary}/>
    <path d="M25 55 L50 65 L75 55 L50 45 Z" fill={THEME.accent}/>
    <path d="M50 45 L25 55 L25 65 L50 75 L75 65 L75 55 Z" fill="rgba(212, 175, 55, 0.4)"/>
    <path d="M50 15 L55 35 L75 40 L55 45 L50 65 L45 45 L25 40 L45 35 Z" fill={THEME.accent}/>
    <rect x="70" y="58" width="2" height="15" fill={THEME.accent} />
    <circle cx="71" cy="74" r="3" fill={THEME.accent} />
  </svg>
);

function Timer({ seconds }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: THEME.bg, padding: "8px 16px", borderRadius: 8, border: `1px solid ${THEME.border}` }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.accent, animation: "pulse 2s infinite" }} />
      <div style={{ fontWeight: 600, fontSize: 16, color: THEME.primary, fontFamily: "'Montserrat', sans-serif" }}>
        {mins > 0 ? `${mins}:${String(secs).padStart(2,"0")}` : `0:${String(secs).padStart(2,"0")}`}
      </div>
    </div>
  );
}

// ── Auth Screen ───────────────────────────────────────────────────────────
function AuthScreen({ onRegister }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [specificGoal, setSpecificGoal] = useState("");

  const canSubmit = firstName && lastName && phone && mainGoal && specificGoal;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onRegister({ firstName, lastName, phone, goal: REG_GOALS[mainGoal], details: specificGoal });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg, padding: 24 }}>
      <div style={{ maxWidth: 500, width: "100%", background: THEME.surface, borderRadius: 16, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)", padding: "48px" }}>
        
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <LogoIcon />
          </div>
          <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 32, color: THEME.primary, letterSpacing: "-0.5px" }}>
            AAPA
          </h1>
          <p style={{ color: THEME.accent, fontWeight: 600, fontSize: 13, letterSpacing: "2px", textTransform: "uppercase", marginTop: 8 }}>
            Ad Astra Per Aspera
          </p>
          <div style={{ height: 1, width: 40, background: THEME.accent, margin: "20px auto" }} />
          <p style={{ color: THEME.textLight, fontSize: 15, lineHeight: 1.6 }}>
            Академический аудит и персонализированная программа подготовки.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={LabelStyle}>Имя</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Алихан" style={InputStyle} required />
            </div>
            <div>
              <label style={LabelStyle}>Фамилия</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Омаров" style={InputStyle} required />
            </div>
          </div>

          <label style={LabelStyle}>Телефон (WhatsApp)</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 00 00" style={InputStyle} required />

          <label style={LabelStyle}>Цель академической оценки</label>
          <select value={mainGoal} onChange={e => { setMainGoal(e.target.value); setSpecificGoal(""); }} style={InputStyle} required>
            <option value="" disabled>Выберите направление...</option>
            {Object.entries(REG_GOALS).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>

          {mainGoal === 'exam' && (
            <>
              <label style={LabelStyle}>Спецификация экзамена</label>
              <select value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} style={InputStyle} required>
                <option value="" disabled>Укажите экзамен...</option>
                {EXAMS_LIST.map(exam => <option key={exam} value={exam}>{exam}</option>)}
              </select>
            </>
          )}

          {(mainGoal === 'gaps' || mainGoal === 'future') && (
            <>
              <label style={LabelStyle}>Уровень (Класс)</label>
              <select value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} style={InputStyle} required>
                <option value="" disabled>Укажите класс...</option>
                {GRADES_LIST.map(grade => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </>
          )}

          <button type="submit" disabled={!canSubmit} style={ButtonStyle(!canSubmit)}>
            Войти в систему
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Intro Screen ─────────────────────────────────────────────────────────────
function IntroScreen({ user, onStart }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg, padding: 24 }}>
      <div style={{ maxWidth: 640, width: "100%" }}>
        <div style={{ background: THEME.surface, borderRadius: 16, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)", padding: "48px" }}>
          
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: THEME.accent, fontSize: 14, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
              Приветствуем, {user?.firstName}
            </p>
            <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 28, color: THEME.primary, lineHeight: 1.3 }}>
              Академическая диагностика:<br />{user?.details}
            </h1>
            <div style={{ height: 2, width: 60, background: THEME.accent, margin: "24px auto" }} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 16, color: THEME.primary, marginBottom: 16, fontWeight: 600 }}>Регламент тестирования:</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: THEME.text, fontSize: 15, lineHeight: 1.8 }}>
              <li style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ color: THEME.accent }}>✦</span> Учет времени ведется, но жестких лимитов нет. Фокус на качестве.
              </li>
              <li style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ color: THEME.accent }}>✦</span> Доступны академические подсказки. Их использование фиксируется системой.
              </li>
              <li style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ color: THEME.accent }}>✦</span> Важно: обязательно ведите письменный черновик. В конце система запросит фото для глубокого анализа хода ваших мыслей.
              </li>
            </ul>
          </div>

          <button onClick={onStart} style={ButtonStyle(false)}>
            Приступить к аудиту
          </button>
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

  useEffect(() => {
    setElapsed(0); setSelected(null); setConfidence(null); setHintsOpen(0);
  }, [question.id]);

  useEffect(() => {
    if (selected !== null) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [selected]);

  const handleNext = () => {
    onComplete({
      questionId: question.id, topic: question.topic, section: question.section,
      selectedAnswer: selected, correct: selected === question.correct,
      confidence: confidence?.v, timeSpent: elapsed, hintLevel: hintsOpen,
    });
  };

  const answered = selected !== null;

  return (
    <div style={{ maxWidth: 740, margin: "40px auto", padding: "0 20px" }}>
      {/* Progress & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textLight, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
            Вопрос {qNum} из {total}
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 24, color: THEME.primary }}>
            {question.section}: <span style={{ color: THEME.accent }}>{question.topic}</span>
          </div>
        </div>
        <Timer seconds={elapsed} />
      </div>

      <div style={{ background: THEME.border, height: 4, borderRadius: 2, marginBottom: 32, overflow: "hidden" }}>
        <div style={{ width: `${((qNum - 1) / total) * 100}%`, background: THEME.primary, height: "100%", transition: "width 0.4s ease" }} />
      </div>

      {/* Question Card */}
      <div style={{ background: THEME.surface, borderRadius: 16, border: `1px solid ${THEME.border}`, padding: "32px", marginBottom: 24, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.03)" }}>
        <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.7, color: THEME.primary, marginBottom: 32 }}>
          {question.text}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {question.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === question.correct;
            let bg = THEME.bg, border = THEME.border, textCol = THEME.text;
            
            if (answered) {
              if (isCorrect) { bg = "#f0fdf4"; border = "#16a34a"; textCol = "#15803d"; }
              else if (isSelected) { bg = "#fef2f2"; border = "#ef4444"; textCol = "#dc2626"; }
            } else if (isSelected) {
              bg = THEME.primary; border = THEME.primary; textCol = THEME.accent;
            }

            return (
              <div key={i} onClick={() => !answered && setSelected(i)} style={{
                padding: "16px 20px", borderRadius: 8, border: `1px solid ${border}`,
                background: bg, color: textCol, fontSize: 16, fontWeight: 500,
                cursor: answered ? "default" : "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center"
              }}>
                <span style={{ width: 30, color: answered ? textCol : (isSelected ? THEME.accent : THEME.textLight), fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </div>
            );
          })}
        </div>
      </div>

      {/* Post-Answer Controls */}
      {answered && (
        <div style={{ background: THEME.surface, borderRadius: 16, border: `1px solid ${THEME.border}`, padding: "24px 32px", marginBottom: 24, animation: "fade-in 0.5s" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Уровень уверенности в ответе:
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {CONFIDENCE.map(c => (
              <button key={c.v} onClick={() => setConfidence(c)} style={{
                flex: 1, padding: "12px 0", borderRadius: 8, 
                border: `1px solid ${confidence?.v === c.v ? THEME.primary : THEME.border}`,
                background: confidence?.v === c.v ? THEME.primary : THEME.bg,
                color: confidence?.v === c.v ? THEME.accent : THEME.textLight,
                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
              }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button disabled={!answered || !confidence} onClick={handleNext} style={ButtonStyle(!answered || !confidence)}>
        {qNum < total ? "Продолжить аудит" : "Завершить и загрузить черновик"}
      </button>
    </div>
  );
}

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen({ onAnalyze }) {
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 20px" }}>
      <div style={{ background: THEME.surface, borderRadius: 16, padding: "48px", textAlign: "center", border: `1px solid ${THEME.border}`, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: THEME.bg, border: `1px solid ${THEME.accent}`, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.accent }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        </div>
        <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 24, color: THEME.primary, marginBottom: 12 }}>
          Анализ письменных вычислений
        </h2>
        <p style={{ color: THEME.textLight, fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Загрузите фотографию ваших черновиков. Алгоритмы AAPA проанализируют структуру решения и логику мышления для составления точного плана подготовки.
        </p>
        
        <label style={{ display: "block", border: `2px dashed ${THEME.border}`, borderRadius: 12, padding: "40px 20px", background: THEME.bg, cursor: "pointer", marginBottom: 24, transition: "border 0.3s" }}>
          <span style={{ color: THEME.primary, fontWeight: 600, fontSize: 15 }}>Нажмите, чтобы выбрать файл</span>
          <br/><span style={{ color: THEME.textLight, fontSize: 13 }}>JPG, PNG или PDF</span>
          <input type="file" style={{ display: "none" }} onChange={() => setLoading(true)} />
        </label>

        <button onClick={() => onAnalyze()} disabled={loading} style={ButtonStyle(loading)}>
          {loading ? "Идет загрузка..." : "Сформировать отчет (Пропустить)"}
        </button>
      </div>
    </div>
  );
}

// ── Report Screen ─────────────────────────────────────────────────────────────
function ReportScreen({ report, onViewPlan }) {
  const { answers } = report;
  const correct = answers.filter(a => a.correct).length;
  const score = Math.round((correct / answers.length) * 100);

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 20px" }}>
      <div style={{ background: THEME.primary, borderRadius: 16, padding: "48px 40px", color: THEME.surface, textAlign: "center", marginBottom: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -50, opacity: 0.1 }}><LogoIcon /></div>
        
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: THEME.accent, fontSize: 14, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 16 }}>
          Академический статус
        </p>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 80, fontWeight: 700, lineHeight: 1, marginBottom: 16 }}>
          {score}%
        </div>
        <p style={{ fontSize: 18, color: "#cbd5e1", fontWeight: 300 }}>
          Абсолютный показатель успешности: {correct} из {answers.length}
        </p>
      </div>

      <div style={{ background: THEME.surface, borderRadius: 16, border: `1px solid ${THEME.border}`, padding: "32px", marginBottom: 32 }}>
        <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 20, color: THEME.primary, marginBottom: 24, fontWeight: 600 }}>Детализация результатов</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {answers.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: THEME.bg, borderRadius: 8, borderLeft: `4px solid ${a.correct ? "#16a34a" : "#ef4444"}` }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: THEME.primary, marginBottom: 4 }}>{a.topic}</div>
                <div style={{ fontSize: 13, color: THEME.textLight }}>Секция: {a.section} • Время: {a.timeSpent}с</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: a.correct ? "#16a34a" : "#ef4444" }}>
                {a.correct ? "Освоено" : "Требует внимания"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onViewPlan} style={ButtonStyle(false)}>
        Открыть карту компетенций
      </button>
    </div>
  );
}

// ── RPG Map (Constellation Design) ────────────────────────────────────────────
function RPGMap({ answers }) {
  return (
    <div style={{ padding: "40px 20px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 28, fontWeight: 700, color: THEME.primary, marginBottom: 12 }}>
          Карта компетенций AAPA
        </h1>
        <p style={{ color: THEME.textLight, fontSize: 15 }}>
          Ваш индивидуальный академический маршрут (Ad Astra Per Aspera).
        </p>
      </div>

      <div style={{ background: THEME.primary, borderRadius: 16, padding: 40, overflowX: "auto", boxShadow: "0 20px 40px -10px rgba(15,23,42,0.4)" }}>
        <svg width={920} height={450} style={{ display: "block" }}>
          {/* Subtle grid/stars */}
          {Array.from({ length: 50 }).map((_, i) => (
            <circle key={i} cx={Math.random() * 920} cy={Math.random() * 450} r={Math.random() * 1.5} fill="#ffffff" opacity={Math.random() * 0.3} />
          ))}

          {/* Paths (Gold lines) */}
          {RPG_PATHS.map(([a, b]) => {
            const na = RPG_NODES.find(n => n.id === a);
            const nb = RPG_NODES.find(n => n.id === b);
            return (
              <line key={`${a}-${b}`} x1={na.x + 30} y1={na.y + 30} x2={nb.x + 30} y2={nb.y + 30}
                stroke={THEME.accent} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
            );
          })}

          {/* Nodes (Planets/Stars) */}
          {RPG_NODES.map(node => {
            const isBoss = node.type === "boss";
            const isFinal = node.id === 8;
            const r = isBoss ? 24 : 16;
            
            return (
              <g key={node.id} transform={`translate(${node.x + 30},${node.y + 30})`} style={{ cursor: "pointer" }}>
                {/* Glow for boss/final */}
                {isBoss && <circle cx={0} cy={0} r={r + 8} fill="none" stroke={THEME.accent} strokeWidth={1} opacity={0.3} />}
                
                {/* Main Node */}
                <circle cx={0} cy={0} r={r} fill={isFinal ? THEME.accent : "#1e293b"} stroke={THEME.accent} strokeWidth={2} />
                
                {/* Label */}
                <text x={0} y={r + 20} textAnchor="middle" fontSize={11} fontWeight={600} fill={isFinal ? THEME.accent : "#cbd5e1"} fontFamily="Inter">
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth"); 
  const [user, setUser] = useState(null); 
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [report, setReport] = useState(null);

  const handleRegister = (userData) => { setUser(userData); setScreen("intro"); };

  const handleAnswer = (data) => {
    const next = [...answers, data];
    setAnswers(next);
    if (qIndex + 1 < QUESTIONS.length) setQIndex(qIndex + 1);
    else setScreen("upload");
  };

  const handleAnalyze = () => {
    setScreen("analyzing");
    setTimeout(() => {
      setReport({ answers });
      setScreen("report");
    }, 2000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${THEME.bg}; -webkit-font-smoothing: antialiased; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {screen !== "auth" && (
        <nav style={{ background: THEME.primary, color: THEME.surface, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LogoIcon />
            <div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "1px" }}>AAPA</div>
              <div style={{ fontSize: 10, color: THEME.accent, letterSpacing: "1px", textTransform: "uppercase" }}>Ad Astra Per Aspera</div>
            </div>
          </div>
          {["report","rpgmap"].includes(screen) && (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setScreen("report")} style={{ background: "transparent", border: `1px solid ${THEME.accent}`, color: THEME.accent, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>Отчет</button>
              <button onClick={() => setScreen("rpgmap")} style={{ background: THEME.accent, border: "none", color: THEME.primary, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>Карта</button>
            </div>
          )}
        </nav>
      )}

      {screen === "auth" && <AuthScreen onRegister={handleRegister} />}
      {screen === "intro" && <IntroScreen user={user} onStart={() => { setQIndex(0); setAnswers([]); setScreen("question"); }} />}
      {screen === "question" && <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex+1} total={QUESTIONS.length} onComplete={handleAnswer} />}
      {screen === "upload" && <UploadScreen onAnalyze={handleAnalyze} />}
      {screen === "analyzing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", color: THEME.primary }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${THEME.border}`, borderTopColor: THEME.accent, borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 24 }} />
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 20 }}>Обработка данных AAPA...</h2>
        </div>
      )}
      {screen === "report" && report && <ReportScreen report={report} onViewPlan={() => setScreen("rpgmap")} />}
      {screen === "rpgmap" && <RPGMap answers={report?.answers || answers} />}
    </>
  );
}
