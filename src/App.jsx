import { useState, useEffect } from "react";

// ── CONSTANTS & DATA ──────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1, section: "Алгебра", topic: "Линейные уравнения",
    text: "Решите уравнение: 3x + 7 = 22",
    options: ["x = 5", "x = 3", "x = 7", "x = 4"],
    correct: 0,
    hints: ["Перенесите 7 в правую часть.", "3x = 15.", "x = 15 / 3."]
  },
  {
    id: 2, section: "Геометрия", topic: "Площадь треугольника",
    text: "Основание треугольника 8 см, высота 5 см. Найдите площадь.",
    options: ["20 см²", "40 см²", "13 см²", "16 см²"],
    correct: 0,
    hints: ["Формула: S = (a * h) / 2.", "S = (8 * 5) / 2.", "S = 40 / 2."]
  },
  {
    id: 3, section: "Алгебра", topic: "Степени",
    text: "Вычислите: 2⁵ + 3² = ?",
    options: ["41", "32", "27", "39"],
    correct: 0,
    hints: ["2⁵ = 32.", "3² = 9.", "32 + 9 = 41."]
  },
  {
    id: 4, section: "Вероятность", topic: "Классическая вероятность",
    text: "В урне 3 красных и 7 синих шаров. Вероятность вытащить красный:",
    options: ["0.3", "0.7", "0.5", "0.03"],
    correct: 0,
    hints: ["P = благопр. / всего.", "Всего = 10.", "P = 3 / 10."]
  },
  {
    id: 5, section: "Геометрия", topic: "Теорема Пифагора",
    text: "Катеты прямоугольного треугольника: 6 см и 8 см. Найдите гипотенузу.",
    options: ["10 см", "12 см", "7 см", "14 см"],
    correct: 0,
    hints: ["c² = a² + b².", "c² = 36 + 64 = 100.", "c = √100."]
  }
];

const CONFIDENCE_LEVELS = [
  { v: 1, label: "Сомневаюсь", color: "#EF4444" }, // Red
  { v: 2, label: "Не уверен", color: "#F59E0B" },  // Orange
  { v: 3, label: "Нейтрально", color: "#94A3B8" }, // Grey
  { v: 4, label: "Уверен", color: "#10B981" },     // Green
  { v: 5, label: "Абсолютно уверен", color: "#059669" }, // Dark Green
];

// Defining RPG nodes and paths for the map
const RPG_NODES = [
  { id: 1, name: "Уравнения", topic: "Алгебра", x: 100, y: 350 },
  { id: 2, name: "Степени", topic: "Алгебра", x: 250, y: 250 },
  { id: 3, name: "Рубеж: Алгебра", topic: "Алгебра", x: 400, y: 150, type: "boss" },
  { id: 4, name: "Площадь", topic: "Геометрия", x: 550, y: 250 },
  { id: 5, name: "Пифагор", topic: "Геометрия", x: 700, y: 350 },
  { id: 6, name: "Рубеж: Геометрия", topic: "Геометрия", x: 850, y: 250, type: "boss" },
  { id: 7, name: "Вероятность", topic: "Вероятность", x: 700, y: 100 },
  { id: 8, name: "Цель: ЕНТ", topic: "Экзамен", x: 850, y: 50, type: "boss" },
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];

const REG_GOALS = {
  exam: "Подготовка к экзамену",
  gaps: "Закрытие пробелов",
  future: "Подготовка к следующему классу"
};

const EXAMS_LIST = ["ЕНТ", "SAT", "NUET", "Further Pure Math", "IGCSE"];
const GRADES_LIST = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс", "12 класс"];

// ── THEME & STYLES ─────────────────────────────────────────────────────────────
const THEME = {
  primary: "#0A192F",    // Deep Space Navy
  secondary: "#112240",  // Slightly lighter navy
  accent: "#FBBF24",     // Stellar Gold
  accentHover: "#F59E0B",
  bg: "#F8FAFC",         // Clean Light Gray
  surface: "#FFFFFF",
  text: "#1E293B",
  textLight: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

const InputStyle = {
  width: "100%", padding: "14px 18px", borderRadius: 8, border: `1px solid ${THEME.border}`,
  background: THEME.surface, fontSize: 15, color: THEME.text, fontFamily: "'Inter', sans-serif",
  transition: "all 0.2s ease", outline: "none", marginBottom: 20
};

const LabelStyle = {
  display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600, color: THEME.textLight, 
  textTransform: "uppercase", letterSpacing: "1px"
};

const ButtonStyle = (disabled, variant = "primary") => ({
  width: "100%", padding: "16px 0", marginTop: 10,
  background: disabled ? THEME.border : (variant === "primary" ? THEME.primary : THEME.accent),
  color: disabled ? THEME.textLight : (variant === "primary" ? THEME.accent : THEME.primary),
  border: "none", borderRadius: 8, fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700, fontSize: 15, letterSpacing: "1px", textTransform: "uppercase",
  cursor: disabled ? "not-allowed" : "pointer", 
  boxShadow: disabled ? "none" : `0 10px 20px -5px ${variant === 'primary' ? 'rgba(10, 25, 47, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
  transition: "all 0.3s ease",
  outline: "none"
});

// ── LOGO COMPONENT ─────────────────────────────────────────────────────────────
const Logo = ({ size = 40, light = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    {/* Base64 encoded logo image with white background removed */}
    <img src={AAPA_LOGO_BASE64} alt="AAPA Logo" style={{ width: size, height: size, objectFit: 'contain' }} />
    <div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: size * 0.6, color: light ? "#FFFFFF" : THEME.primary, lineHeight: 1, letterSpacing: "1px" }}>AAPA</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: size * 0.25, color: THEME.accent, letterSpacing: "1.5px", marginTop: 2, textTransform: "uppercase" }}>Ad Astra Per Aspera</div>
    </div>
  </div>
);

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function Timer({ seconds }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div className="modern-timer">
      <div className="pulse-dot"></div>
      <span>{mins > 0 ? `${mins}:${String(secs).padStart(2,"0")}` : `0:${String(secs).padStart(2,"0")}`}</span>
    </div>
  );
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
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
    <div className="split-layout">
      <div className="split-left">
        <div style={{ marginBottom: "60px" }}>
          <Logo size={54} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 className="hero-title">Твой путь к <span style={{color: THEME.accent}}>академическим высотам</span> начинается здесь.</h1>
          <p className="hero-subtitle">
            Пройди независимый аудит компетенций AAPA. Мы выявим скрытые пробелы и построим персональный маршрут обучения «Через тернии к звездам».
          </p>
          <div className="benefits-list">
            <div className="benefit-item">
              <span className="icon">🎯</span>
              <div>
                <strong>Когнитивная диагностика</strong>
                <p>Анализируем не только ответ, но и уверенность, время и ход решения.</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="icon">🗺️</span>
              <div>
                <strong>Персональный трек (RPG)</strong>
                <p>Получи визуальную карту обучения, адаптированную под твои дефициты.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="trust-badge">
          <span style={{ color: THEME.accent }}>★★★★★</span>
          <span style={{ fontSize: 13, color: THEME.textLight, fontWeight: 600 }}>Независимая оценка качества знаний</span>
        </div>
      </div>

      <div className="split-right">
        <div className="form-card">
          <div className="form-header">
            <h2>Создать профиль ученика</h2>
            <p>Внесите данные для начала диагностического аудита.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label style={LabelStyle}>Имя</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Алихан" style={InputStyle} required />
              </div>
              <div className="input-group">
                <label style={LabelStyle}>Фамилия</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Омаров" style={InputStyle} required />
              </div>
            </div>

            <div className="input-group">
              <label style={LabelStyle}>Номер WhatsApp</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 00 00" style={InputStyle} required />
            </div>

            <div className="input-group">
              <label style={LabelStyle}>Цель аудита</label>
              <select value={mainGoal} onChange={e => { setMainGoal(e.target.value); setSpecificGoal(""); }} style={InputStyle} required>
                <option value="" disabled>Выберите направление...</option>
                {Object.entries(REG_GOALS).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            {mainGoal === 'exam' && (
              <div className="input-group scale-in">
                <label style={LabelStyle}>Спецификация экзамена</label>
                <select value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} style={InputStyle} required>
                  <option value="" disabled>Укажите экзамен...</option>
                  {EXAMS_LIST.map(exam => <option key={exam} value={exam}>{exam}</option>)}
                </select>
              </div>
            )}

            {(mainGoal === 'gaps' || mainGoal === 'future') && (
              <div className="input-group scale-in">
                <label style={LabelStyle}>Уровень (Класс)</label>
                <select value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} style={InputStyle} required>
                  <option value="" disabled>Укажите класс...</option>
                  {GRADES_LIST.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </div>
            )}

            <button type="submit" className={`cta-button ${canSubmit ? 'active' : ''}`} disabled={!canSubmit} style={ButtonStyle(!canSubmit)}>
              Приступить к аудиту →
            </button>
          </form>
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

  useEffect(() => {
    setElapsed(0); setSelected(null); setConfidence(null);
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
      confidence: confidence?.v, timeSpent: elapsed
    });
  };

  const answered = selected !== null;

  return (
    <div className="question-container">
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${((qNum) / total) * 100}%` }} />
      </div>

      <div className="question-meta">
        <span className="badge">{question.section}</span>
        <span className="step-text">Вопрос {qNum} из {total}</span>
      </div>

      <h2 className="question-text">{question.text}</h2>

      <div className="options-grid">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === question.correct;
          let stateClass = "";
          
          if (answered) {
            if (isCorrect) stateClass = "correct";
            else if (isSelected) stateClass = "wrong";
            else stateClass = "disabled";
          } else if (isSelected) {
            stateClass = "selected";
          }

          return (
            <div key={i} className={`option-card ${stateClass}`} onClick={() => !answered && setSelected(i)}>
              <div className="option-letter">{String.fromCharCode(65 + i)}</div>
              <div className="option-content">{opt}</div>
              {answered && isCorrect && <div className="icon-status">M✅</div>}
              {answered && isSelected && !isCorrect && <div className="icon-status">❌</div>}
            </div>
          );
        })}
      </div>

      {answered && (
        <div className="confidence-section scale-in">
          <h4>Насколько вы уверены в ответе?</h4>
          <div className="confidence-grid">
            {CONFIDENCE_LEVELS.map(c => (
              <button 
                key={c.v} 
                className={`conf-btn ${confidence?.v === c.v ? 'active' : ''}`}
                style={confidence?.v === c.v ? { borderColor: c.color, background: c.color + "10", color: c.color } : {}}
                onClick={() => setConfidence(c)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="footer-action">
        <button className={`cta-button ${(answered && confidence) ? 'active' : ''}`} disabled={!answered || !confidence} onClick={handleNext} style={ButtonStyle(!answered || !confidence)}>
          {qNum < total ? "Продолжить аудит" : "Завершить и загрузить черновик"}
        </button>
      </div>
    </div>
  );
}

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen({ onAnalyze }) {
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ maxWidth: 640, margin: "100px auto", padding: "0 20px" }}>
      <div style={{ background: THEME.surface, borderRadius: 16, padding: "60px 48px", textAlign: "center", border: `1px solid ${THEME.border}`, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: THEME.bg, border: `1px solid ${THEME.accent}`, margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.accent }}>
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 26, color: THEME.primary, marginBottom: 16 }}>
          Анализ письменных вычислений
        </h2>
        <p style={{ color: THEME.textLight, fontSize: 16, lineHeight: 1.7, marginBottom: 40, maxWdith: 480, margin: "0 auto 40px" }}>
          Загрузите фотографию ваших черновиков. Алгоритмы <b>AAPA</b> проанализируют структуру решения и логику мышления для составления точного плана подготовки.
        </p>
        
        <label className="upload-zone">
          <span style={{ color: THEME.primary, fontWeight: 700, fontSize: 16 }}>Нажмите, чтобы выбрать файл</span>
          <br/><span style={{ color: THEME.textLight, fontSize: 14, marginTop: 4, display: 'block' }}>JPG, PNG или PDF</span>
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
function ReportScreen({ report, user, onViewPlan }) {
  const { answers } = report;
  const correct = answers.filter(a => a.correct).length;
  const total = answers.length;
  const score = Math.round((correct / total) * 100);

  // Analyze skills based on document rules
  const skillsAnalysis = answers.map(a => {
    let zone = "green";
    let statusText = "Твердый навык";
    let priority = 3; // Lowest priority for green

    // Rule: if wrong, it's red
    if (!a.correct) {
      zone = "red";
      statusText = "Фундаментальный пробел";
      priority = 1; // Highest priority for red
    } 
    // Rule: if correct but low confidence, it's yellow (fragile knowledge)
    else if (a.confidence <= 2) {
      zone = "yellow";
      statusText = "Хрупкое знание";
      priority = 2; // Medium priority for yellow
    }

    // Special Case: Illusion of knowledge (Wrong + High Confidence)
    let isIllusion = false;
    if (!a.correct && a.confidence >= 4) {
      isIllusion = true;
      statusText = "⚠️ Иллюзия знаний";
    }

    return { ...a, zone, statusText, priority, isIllusion };
  });

  // Sort skills by priority (Red -> Yellow -> Green)
  const sortedSkills = skillsAnalysis.sort((a, b) => a.priority - b.priority);

  return (
    <div className="report-container">
      <div className="report-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${THEME.border}` }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textLight, textTransform: 'uppercase', letterSpacing: '1px' }}>Академический аудит</div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 800, color: THEME.primary, marginTop: 4 }}>
              Ученик: {user?.firstName} {user?.lastName}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textLight, textTransform: 'uppercase', letterSpacing: '1px' }}>Цель</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: THEME.accent, marginTop: 4 }}>{user?.details}</div>
          </div>
        </div>

        <div className="report-hero-compact">
          <div className="score-badge" style={{ backgroundColor: score >= 80 ? THEME.success : score >= 60 ? THEME.primary : THEME.error }}>
            {score}%
          </div>
          <div className="report-hero-text">
            <h1>Аудит компетенций завершен</h1>
            <p>Ниже представлен детализированный анализ ваших навыков, разделенный по зонам приоритетности для подготовки.</p>
          </div>
        </div>
      </div>

      <div className="results-list-modern">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, color: THEME.primary }}>Карта навыков (по приоритету)</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="zone-legend red">Критично</span>
            <span className="zone-legend yellow">Внимание</span>
            <span className="zone-legend green">Освоено</span>
          </div>
        </div>

        {sortedSkills.map((a, i) => (
          <div key={i} className={`result-card-modern ${a.zone} ${a.isIllusion ? 'illusion' : ''}`}>
            <div className="card-main">
              <div className="topic-info">
                <span className="section-badget">{a.section}</span>
                <span className="topic-name">{a.topic}</span>
              </div>
              <div className="status-info">
                <span className="status-text">{a.statusText}</span>
                <span className="meta-text">{a.timeSpent} сек • Уверенность: {a.confidence}/5</span>
              </div>
            </div>
            {a.isIllusion && (
              <div className="illusion-warning">
                <strong>Критическая ошибка:</strong> Вы были уверены в ответе, но он неверен. Это сигнализирует о ложном понимании метода решения. Требуется немедленный разбор теории.
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={onViewPlan} className="cta-button active" style={{ marginTop: 40, padding: '18px 0' }}>
        Открыть Индивидуальный Трек Развития →
      </button>
    </div>
  );
}

// ── Path Map (Modern Learning Track) ──────────────────────────────────────────
function PathMap({ answers, user }) {
  return (
    <div className="path-container">
      <div className="path-header">
        <span style={{ fontSize: 13, fontWeight: 700, color: THEME.accent, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 8, display: 'block' }}>Ad Astra Per Aspera</span>
        <h1>Образовательный трек {user?.firstName}</h1>
        <p>Ваша персональная карта созвездий навыков для достижения цели: {user?.details}.</p>
      </div>

      <div className="path-visualization-modern">
        <svg width="100%" height={450} viewBox="0 0 920 450" preserveAspectRatio="xMidYMid meet">
          {/* Background Stars */}
          {Array.from({ length: 100 }).map((_, i) => (
            <circle key={i} cx={Math.random() * 920} cy={Math.random() * 450} r={Math.random() * 1.2} fill="#FFFFFF" opacity={Math.random() * 0.4} />
          ))}

          {/* Paths (Elegant Gold Lines) */}
          {RPG_PATHS.map(([a, b]) => {
            const na = RPG_NODES.find(n => n.id === a);
            const nb = RPG_NODES.find(n => n.id === b);
            return (
              <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={THEME.accent} strokeWidth={1} opacity={0.3} />
            );
          })}

          {/* Nodes (Planetary Style) */}
          {RPG_NODES.map(node => {
            const isBoss = node.type === "boss";
            const r = isBoss ? 24 : 16;
            
            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}>
                {/* Orbital Ring */}
                <circle cx={0} cy={0} r={r + 8} fill="none" stroke={THEME.accent} strokeWidth={0.5} opacity={0.2} />
                
                {/* Main Planet Node */}
                <circle cx={0} cy={0} r={r} fill={THEME.primary} stroke={THEME.accent} strokeWidth={isBoss ? 3 : 2} />
                
                {/* Core Light */}
                <circle cx={0} cy={0} r={r-6} fill={isBoss ? THEME.accent : "#FFF"} opacity={isBoss ? 0.8 : 0.1} />

                {/* Label */}
                <text x={0} y={r + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill="#cbd5e1" fontFamily="Inter">
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
  const [elapsed, setElapsed] = useState(0); // global timer for question screen

  const handleRegister = (userData) => { setUser(userData); setScreen("question"); };

  const handleAnswer = (data) => {
    const next = [...answers, data];
    setAnswers(next);
    if (qIndex + 1 < QUESTIONS.length) setQIndex(qIndex + 1);
    else {
      setReport({ answers: next });
      setScreen("report");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${THEME.bg}; -webkit-font-smoothing: antialiased; color: ${THEME.text}; font-family: 'Inter', sans-serif; }
        
        /* Layouts */
        .split-layout { display: flex; min-height: 100vh; }
        .split-left { flex: 1.1; background: ${THEME.surface}; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid ${THEME.border}; }
        .split-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 60px; background: ${THEME.bg}; }
        
        /* Typography */
        .hero-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 800; line-height: 1.15; margin-bottom: 24px; color: ${THEME.primary}; letter-spacing: -1.5px; }
        .hero-subtitle { font-size: 17px; line-height: 1.7; color: ${THEME.textLight}; margin-bottom: 50px; max-width: 520px; }
        
        /* Form & Cards */
        .form-card { width: 100%; max-width: 460px; background: #fff; padding: 40px; borderRadius: 16px; border: 1px solid ${THEME.border}; boxShadow: 0 15px 35px -5px rgba(10,25,47,0.03); }
        .form-header { margin-bottom: 32px; text-align: center; }
        .form-header h2 { font-family: 'Montserrat', sans-serif; fontSize: 24px; fontWeight: 700; color: ${THEME.primary}; }
        .form-header p { color: ${THEME.textLight}; fontSize: 14px; marginTop: 6px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        
        /* Buttons */
        .cta-button { text-align: center; text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s ease; }
        .cta-button.active:hover { background: ${THEME.accentHover}; transform: translateY(-1px); }

        /* Benefits */
        .benefits-list { display: flex; flex-direction: column; gap: 28px; margin-bottom: 60px; }
        .benefit-item { display: flex; gap: 20px; align-items: flex-start; }
        .benefit-item .icon { font-size: 24px; background: ${THEME.bg}; padding: 14px; border-radius: 12px; border: 1px solid ${THEME.border}; color: ${THEME.primary}; }
        .benefit-item strong { display: block; font-size: 16px; font-weight: 700; margin-bottom: 6px; color: ${THEME.primary}; }
        .benefit-item p { font-size: 14px; color: ${THEME.textLight}; line-height: 1.6; }

        /* Trust Badge */
        .trust-badge { display: inline-flex; align-items: center; gap: 12px; background: ${THEME.bg}; padding: 12px 24px; border-radius: 99px; border: 1px solid ${THEME.border}; }

        /* Quiz Layout */
        .question-container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .modern-timer { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 99px; font-weight: 700; font-family: 'Montserrat', sans-serif; font-size: 15px; color: ${THEME.primary}; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .pulse-dot { width: 8px; height: 8px; background: ${THEME.error}; border-radius: 50%; animation: pulse 2s infinite; }
        .progress-bar-container { width: 100%; height: 6px; background: ${THEME.border}; border-radius: 99px; overflow: hidden; margin-bottom: 32px; }
        .progress-bar-fill { height: 100%; background: ${THEME.primary}; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .question-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .badge { background: ${THEME.primary}; color: ${THEME.accent}; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .step-text { color: ${THEME.textLight}; font-size: 14px; font-weight: 600; }
        .question-text { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 700; line-height: 1.4; margin-bottom: 40px; color: ${THEME.primary}; }
        
        .options-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }
        .option-card { display: flex; align-items: center; padding: 20px 24px; background: #ffffff; border: 1px solid ${THEME.border}; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .option-card:hover { border-color: ${THEME.textLight}; background: ${THEME.bg}; }
        .option-letter { width: 36px; height: 36px; background: ${THEME.bg}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: ${THEME.primary}; margin-right: 20px; font-family: 'Montserrat', sans-serif; font-size: 15px; }
        .option-content { font-size: 16px; font-weight: 500; flex: 1; color: ${THEME.text}; }
        .option-card.selected { border-color: ${THEME.primary}; background: ${THEME.primary}05; border-width: 2px;}
        .option-card.correct { border-color: ${THEME.success}; background: #ecfdf5; cursor: default; border-width: 2px; }
        .option-card.correct .option-content { color: ${THEME.success}; fontWeight: 600; }
        .option-card.wrong { border-color: ${THEME.error}; background: #fef2f2; cursor: default; border-width: 2px; }
        .option-card.wrong .option-content { color: ${THEME.error}; fontWeight: 600; }
        .option-card.disabled { opacity: 0.5; cursor: default; pointer-events: none; }
        .icon-status { font-size: 20px; margin-left: 12px; }

        /* Confidence */
        .confidence-section { background: #ffffff; border: 1px solid ${THEME.border}; padding: 32px; border-radius: 16px; margin-bottom: 40px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.02); }
        .confidence-section h4 { font-size: 15px; color: ${THEME.primary}; margin-bottom: 20px; fontWeight: 600; text-align: center;}
        .confidence-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .conf-btn { flex: 1; min-width: 110px; padding: 14px 10px; border: 1px solid ${THEME.border}; border-radius: 10px; background: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: ${THEME.textLight}; cursor: pointer; transition: all 0.2s; text-align: center;}
        .conf-btn:hover { background: ${THEME.bg}; border-color: ${THEME.textLight}; }
        
        /* Upload Zone */
        .upload-zone { display: block; border: 2px dashed ${THEME.border}; borderRadius: 12px; padding: 48px 24px; background: ${THEME.bg}; cursor: pointer; marginBottom: 32px; transition: all 0.3s; }
        .upload-zone:hover { border-color: ${THEME.accent}; background: #FFF; }

        /* Report Modern */
        .report-container { max-width: 760px; margin: 40px auto; padding: 0 20px; }
        .report-header-card { background: #fff; padding: 32px; border-radius: 16px; border: 1px solid ${THEME.border}; margin-bottom: 32px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.02); }
        .report-hero-compact { display: flex; align-items: center; gap: 24px; margin-top: 16px;}
        .score-badge { width: 90px; height: 90px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 800; color: #fff; flex-shrink: 0; }
        .report-hero-text h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; fontWeight: 800; color: ${THEME.primary}; margin-bottom: 6px; }
        .report-hero-text p { color: ${THEME.textLight}; line-height: 1.6; font-size: 14px; }
        
        .results-list-modern { background: #ffffff; border-radius: 16px; border: 1px solid ${THEME.border}; padding: 32px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.02); }
        .zone-legend { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 4px; }
        .zone-legend.red { background: #fee2e2; color: ${THEME.error}; }
        .zone-legend.yellow { background: #fff7ed; color: ${THEME.warning}; }
        .zone-legend.green { background: #ecfdf5; color: ${THEME.success}; }

        .result-card-modern { border-radius: 12px; border: 1px solid ${THEME.border}; background: ${THEME.bg}; margin-bottom: 12px; padding: 16px 20px; transition: all 0.2s; }
        .result-card-modern.red { border-left: 4px solid ${THEME.error}; }
        .result-card-modern.yellow { border-left: 4px solid ${THEME.warning}; }
        .result-card-modern.green { border-left: 4px solid ${THEME.success}; }
        .result-card-modern.illusion { background: #FFFbeb; border-color: ${THEME.warning}; border-left-color: ${THEME.error}; }
        
        .card-main { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .topic-info { flex: 1; }
        .section-badget { font-size: 10px; font-weight: 700; color: ${THEME.textLight}; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;}
        .topic-name { font-size: 15px; font-weight: 700; color: ${THEME.primary}; }
        .status-info { text-align: right; flex-shrink: 0; }
        .status-text { display: block; font-size: 13px; font-weight: 700; margin-bottom: 4px; }
        .result-card-modern.red .status-text { color: ${THEME.error}; }
        .result-card-modern.yellow .status-text { color: ${THEME.warning}; }
        .result-card-modern.green .status-text { color: ${THEME.success}; }
        .meta-text { font-size: 11px; color: ${THEME.textLight}; }
        .illusion-warning { margin-top: 12px; padding: 10px 14px; background: #FFF; border-radius: 8px; border: 1px solid ${THEME.warning}; color: ${THEME.text}; fontSize: 13px; line-height: 1.5;}

        /* Path Map */
        .path-container { max-width: 1000px; margin: 40px auto; padding: 0 20px; }
        .path-header { text-align: center; margin-bottom: 48px; }
        .path-header h1 { font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 800; margin-bottom: 12px; color: ${THEME.primary}; letter-spacing: -1px; }
        .path-header p { color: ${THEME.textLight}; font-size: 16px; max-width: 500px; margin: 0 auto; }
        .path-visualization-modern { background: ${THEME.primary}; border-radius: 24px; padding: 50px 40px; box-shadow: 0 20px 50px -10px rgba(10,25,47,0.5); overflow-x: auto; position: relative;}

        /* Animations & Utils */
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .scale-in { animation: scale-in 0.3s ease forwards; }

        /* Responsive */
        @media (max-width: 900px) {
          .split-layout { flex-direction: column; }
          .split-left { padding: 40px 30px; border-right: none; border-bottom: 1px solid ${THEME.border}; }
          .split-right { padding: 40px 20px; background: #fff; }
          .hero-title { font-size: 32px; }
          .hero-subtitle { font-size: 15px; margin-bottom: 30px;}
          .report-hero-compact { flex-direction: column; text-align: center; gap: 16px; }
          .form-row { grid-template-columns: 1fr; gap: 0; }
          .form-card { padding: 20px; border: none; box-shadow: none;}
          .card-main { flex-direction: column; align-items: flex-start; gap: 8px;}
          .status-info { text-align: left; }
        }
      `}</style>

      {/* Conditional Header for Nav */}
      {screen !== "auth" && (
        <nav style={{ background: THEME.surface, borderBottom: `1px solid ${THEME.border}`, color: THEME.text, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", position: 'sticky', top: 0, zIndex: 1000 }}>
          <Logo size={36} />
          {["report","rpgmap"].includes(screen) && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setScreen("report")} style={{ background: screen === 'report' ? THEME.bg : "transparent", border: `1px solid ${screen === 'report' ? THEME.border : 'transparent'}`, color: THEME.primary, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, transition: 'all 0.2s' }}>Отчет</button>
              <button onClick={() => setScreen("rpgmap")} style={{ background: screen === 'rpgmap' ? THEME.primary : "transparent", border: "none", color: screen === 'rpgmap' ? THEME.accent : THEME.textLight, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, transition: 'all 0.2s' }}>Трек</button>
            </div>
          )}
        </nav>
      )}

      {/* Screen Render */}
      {screen === "auth" && <AuthScreen onRegister={handleRegister} />}
      {screen === "question" && <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex+1} total={QUESTIONS.length} onComplete={handleAnswer} />}
      {screen === "upload" && <UploadScreen onAnalyze={handleAnalyze} />}
      {screen === "analyzing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", color: THEME.primary, textAlign: 'center', padding: 20 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${THEME.border}`, borderTopColor: THEME.accent, borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 24 }} />
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' }}>Обработка данных AAPA</h2>
          <p style={{color: THEME.textLight, marginTop: 8, fontSize: 15}}>ИИ формирует ваш академический профиль...</p>
        </div>
      )}
      {screen === "report" && report && <ReportScreen report={report} user={user} onViewPlan={() => setScreen("rpgmap")} />}
      {screen === "rpgmap" && <PathMap answers={report?.answers || answers} user={user} />}
    </>
  );
}
