import { useState, useEffect } from "react";

// ── CONSTANTS & DATA ──────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1, section: "Алгебра", topic: "Линейные уравнения",
    text: "Решите уравнение: 3x + 7 = 22",
    options: ["x = 5", "x = 3", "x = 7", "x = 4"],
    correct: 0
  },
  {
    id: 2, section: "Геометрия", topic: "Площадь треугольника",
    text: "Основание треугольника 8 см, высота 5 см. Найдите площадь.",
    options: ["20 см²", "40 см²", "13 см²", "16 см²"],
    correct: 0
  },
  {
    id: 3, section: "Алгебра", topic: "Степени",
    text: "Вычислите: 2⁵ + 3² = ?",
    options: ["41", "32", "27", "39"],
    correct: 0
  },
  {
    id: 4, section: "Вероятность", topic: "Классическая вероятность",
    text: "В урне 3 красных и 7 синих шаров. Вероятность вытащить красный:",
    options: ["0.3", "0.7", "0.5", "0.03"],
    correct: 0
  },
  {
    id: 5, section: "Геометрия", topic: "Теорема Пифагора",
    text: "Катеты прямоугольного треугольника: 6 см и 8 см. Найдите гипотенузу.",
    options: ["10 см", "12 см", "7 см", "14 см"],
    correct: 0
  }
];

const CONFIDENCE_LEVELS = [
  { v: 1, label: "Сомневаюсь", color: "#EF4444" }, 
  { v: 2, label: "Не уверен", color: "#F59E0B" },  
  { v: 3, label: "Нейтрально", color: "#94A3B8" }, 
  { v: 4, label: "Уверен", color: "#10B981" },     
  { v: 5, label: "Абсолютно уверен", color: "#059669" }, 
];

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

// ── THEME ──────────────────────────────────────────────────────────────────────
const THEME = {
  primary: "#0f172a",    
  secondary: "#1e293b",  
  accent: "#d4af37",     
  accentHover: "#b48c26",
  bg: "#f8fafc",         
  surface: "#ffffff",
  text: "#334155",
  textLight: "#64748b",
  border: "#e2e8f0",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

// ── VECTOR LOGO (No external files needed) ───────────────────────────────────
const Logo = ({ size = 48 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Background Circle */}
      <circle cx="50" cy="50" r="50" fill="#0A2463"/>
      
      {/* Golden Star/Comet */}
      <path d="M45 35 L85 15 L78 28 L95 35 L78 40 L85 55 L65 40 Z" fill="#FBBF24"/>
      
      {/* Academic Book */}
      <path d="M50 75 Q 35 60 15 65 L15 75 Q 35 70 50 85 Q 65 70 85 75 L85 65 Q 65 60 50 75 Z" fill="#E2E8F0"/>
      <path d="M50 65 Q 35 50 15 55 L15 65 Q 35 60 50 75 Q 65 60 85 65 L85 55 Q 65 50 50 65 Z" fill="#FFFFFF"/>
      
      {/* Graduation Cap */}
      <path d="M50 30 L15 45 L50 60 L85 45 Z" fill="#1E3A8A"/>
      <path d="M50 35 L22 47 L50 55 L78 47 Z" fill="#2563EB"/>
      
      {/* Tassel */}
      <path d="M50 45 L70 50 L72 65" stroke="#FBBF24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="72" cy="68" r="3.5" fill="#FBBF24"/>
    </svg>
    <div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: size * 0.6, color: THEME.primary, lineHeight: 1, letterSpacing: "1px" }}>AAPA</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: Math.max(size * 0.2, 9), color: THEME.accent, letterSpacing: "1px", marginTop: 4, textTransform: "uppercase" }}>Ad Astra Per Aspera</div>
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
  // Phone starts with +7 by default
  const [phone, setPhone] = useState("+7 "); 
  const [mainGoal, setMainGoal] = useState("");
  const [specificGoal, setSpecificGoal] = useState("");

  const canSubmit = firstName && lastName && phone.length > 5 && mainGoal && specificGoal;

  // Phone input handler to prevent deleting +7
  const handlePhoneChange = (e) => {
    let val = e.target.value;
    if (val.length < 3 || !val.startsWith("+7 ")) {
      setPhone("+7 "); // Force it back if user tries to delete it
    } else {
      setPhone(val);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onRegister({ firstName, lastName, phone, goal: REG_GOALS[mainGoal], details: specificGoal });
  };

  return (
    <div className="split-layout">
      <div className="split-left">
        <div style={{ marginBottom: "60px" }}>
          <Logo size={60} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 className="hero-title">Построй свой путь к <span style={{color: THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">
            Пройди независимую диагностику компетенций. Система <b>AAPA</b> выявит скрытые пробелы и построит точный маршрут подготовки к {EXAMS_LIST.join(", ")}.
          </p>
          <div className="benefits-list">
            <div className="benefit-item">
              <span className="icon">🎯</span>
              <div>
                <strong>Когнитивная диагностика</strong>
                <p>Анализируем не только верные ответы, но и вашу уверенность в них.</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="icon">🗺️</span>
              <div>
                <strong>Индивидуальный трек</strong>
                <p>Вы получаете пошаговую Карту Навыков для достижения вашей цели.</p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="trust-badge">
            <span style={{ color: THEME.accent, letterSpacing: "2px", fontSize: 18 }}>★★★★★</span>
            <span style={{ fontSize: 13, color: THEME.textLight, fontWeight: 600 }}>Нам доверяют подготовку к будущему</span>
          </div>
        </div>
      </div>

      <div className="split-right">
        <div className="form-card">
          <div className="form-header">
            <h2>Начать диагностику</h2>
            <p>Заполните данные для создания профиля ученика.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Имя</label>
                <input type="text" className="input-field" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Алихан" required />
              </div>
              <div className="input-group">
                <label className="input-label">Фамилия</label>
                <input type="text" className="input-field" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Омаров" required />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Номер WhatsApp</label>
              <input 
                type="tel" 
                className="input-field" 
                value={phone} 
                onChange={handlePhoneChange} 
                placeholder="+7 700 000 00 00" 
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Цель обучения</label>
              <select className="input-field" value={mainGoal} onChange={e => { setMainGoal(e.target.value); setSpecificGoal(""); }} required>
                <option value="" disabled>Выберите из списка...</option>
                {Object.entries(REG_GOALS).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            {mainGoal === 'exam' && (
              <div className="input-group scale-in">
                <label className="input-label">Какой экзамен?</label>
                <select className="input-field" value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} required>
                  <option value="" disabled>Выберите экзамен...</option>
                  {EXAMS_LIST.map(exam => <option key={exam} value={exam}>{exam}</option>)}
                </select>
              </div>
            )}

            {(mainGoal === 'gaps' || mainGoal === 'future') && (
              <div className="input-group scale-in">
                <label className="input-label">Класс</label>
                <select className="input-field" value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} required>
                  <option value="" disabled>Выберите класс...</option>
                  {GRADES_LIST.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </div>
            )}

            <button type="submit" className={`cta-button ${canSubmit ? 'active' : ''}`} disabled={!canSubmit}>
              Перейти к тесту →
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
              {answered && isCorrect && <div className="icon-status">✅</div>}
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
        <button className={`cta-button ${(answered && confidence) ? 'active' : ''}`} disabled={!answered || !confidence} onClick={handleNext}>
          {qNum < total ? "Следующий вопрос" : "Завершить аудит"}
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
      <div className="form-card" style={{ maxWidth: '100%', textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: THEME.bg, border: `1px solid ${THEME.accent}`, margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.accent }}>
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        </div>
        <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 26, color: THEME.primary, marginBottom: 16 }}>
          Анализ письменных вычислений
        </h2>
        <p style={{ color: THEME.textLight, fontSize: 16, lineHeight: 1.7, marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
          Загрузите фотографию ваших черновиков. Алгоритмы <b>AAPA</b> проанализируют структуру решения и логику мышления для составления точного плана подготовки.
        </p>
        
        <label className="upload-zone">
          <span style={{ color: THEME.primary, fontWeight: 700, fontSize: 16 }}>Нажмите, чтобы выбрать файл</span>
          <br/><span style={{ color: THEME.textLight, fontSize: 14, marginTop: 4, display: 'block' }}>JPG, PNG или PDF</span>
          <input type="file" style={{ display: "none" }} onChange={() => setLoading(true)} />
        </label>

        <button onClick={() => onAnalyze()} disabled={loading} className={`cta-button ${loading ? '' : 'active'}`}>
          {loading ? "Идет загрузка..." : "Сформировать отчет (Пропустить)"}
        </button>
      </div>
    </div>
  );
}

// ── Report Screen ──────────────────────────────
function ReportScreen({ report, user, onViewPlan }) {
  const { answers } = report;
  const correct = answers.filter(a => a.correct).length;
  const total = answers.length;
  const score = Math.round((correct / total) * 100);

  const skillsAnalysis = answers.map(a => {
    let zone = "green";
    let statusText = "Твердый навык";
    let priority = 3; 

    if (!a.correct) {
      zone = "red";
      statusText = "Фундаментальный пробел";
      priority = 1; 
    } 
    else if (a.confidence <= 2) {
      zone = "yellow";
      statusText = "Хрупкое знание";
      priority = 2; 
    }

    let isIllusion = false;
    if (!a.correct && a.confidence >= 4) {
      isIllusion = true;
      statusText = "⚠️ Иллюзия знаний";
    }

    return { ...a, zone, statusText, priority, isIllusion };
  });

  const sortedSkills = skillsAnalysis.sort((a, b) => a.priority - b.priority);

  return (
    <div className="report-container">
      <div className="report-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${THEME.border}` }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textLight, textTransform: 'uppercase', letterSpacing: '1px' }}>Академический аудит</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 20, fontWeight: 800, color: THEME.primary, marginTop: 4 }}>
              Ученик: {user?.firstName} {user?.lastName}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textLight, textTransform: 'uppercase', letterSpacing: '1px' }}>Цель</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: THEME.accent, marginTop: 4 }}>{user?.details}</div>
          </div>
        </div>

        <div className="report-hero-compact">
          <div className="score-badge" style={{ backgroundColor: score >= 80 ? THEME.success : score >= 60 ? THEME.warning : THEME.error }}>
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
          <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 20, fontWeight: 800, color: THEME.primary }}>Карта навыков</h3>
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
                <span className="section-badge">{a.section}</span>
                <span className="topic-name">{a.topic}</span>
              </div>
              <div className="status-info">
                <span className="status-text">{a.statusText}</span>
                <span className="meta-text">{a.timeSpent} сек • Уверенность: {a.confidence}/5</span>
              </div>
            </div>
            {a.isIllusion && (
              <div className="illusion-warning">
                <strong>Критическая ошибка:</strong> Вы были уверены в ответе, но он неверен. Это сигнализирует о ложном понимании метода решения.
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={onViewPlan} className="cta-button active" style={{ marginTop: 40, width: '100%' }}>
        Открыть Трек Развития →
      </button>
    </div>
  );
}

// ── Path Map ──────────────────────────────────────────
function PathMap({ user }) {
  return (
    <div className="path-container">
      <div className="path-header">
        <span style={{ fontSize: 13, fontWeight: 700, color: THEME.accent, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 8, display: 'block' }}>Ad Astra Per Aspera</span>
        <h1>Образовательный трек {user?.firstName}</h1>
        <p>Ваша персональная карта созвездий навыков для достижения цели: {user?.details}.</p>
      </div>

      <div className="path-visualization-modern">
        <svg width="100%" height={450} viewBox="0 0 920 450" preserveAspectRatio="xMidYMid meet">
          {Array.from({ length: 80 }).map((_, i) => (
            <circle key={i} cx={Math.random() * 920} cy={Math.random() * 450} r={Math.random() * 1.5} fill="#FFFFFF" opacity={Math.random() * 0.4} />
          ))}

          {RPG_PATHS.map(([a, b]) => {
            const na = RPG_NODES.find(n => n.id === a);
            const nb = RPG_NODES.find(n => n.id === b);
            return (
              <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={THEME.accent} strokeWidth={1} opacity={0.4} />
            );
          })}

          {RPG_NODES.map(node => {
            const isBoss = node.type === "boss";
            const r = isBoss ? 24 : 16;
            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}>
                <circle cx={0} cy={0} r={r + 8} fill="none" stroke={THEME.accent} strokeWidth={0.5} opacity={0.2} />
                <circle cx={0} cy={0} r={r} fill={THEME.primary} stroke={THEME.accent} strokeWidth={isBoss ? 3 : 2} />
                <circle cx={0} cy={0} r={r-6} fill={isBoss ? THEME.accent : "#FFF"} opacity={isBoss ? 0.8 : 0.1} />
                <text x={0} y={r + 28} textAnchor="middle" fontSize={12} fontWeight={600} fill="#cbd5e1" fontFamily="Inter">
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${THEME.bg}; -webkit-font-smoothing: antialiased; color: ${THEME.text}; font-family: 'Inter', sans-serif; }
        
        /* Layouts */
        .split-layout { display: flex; min-height: 100vh; }
        .split-left { flex: 1.1; background: ${THEME.surface}; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid ${THEME.border}; }
        .split-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 60px; background: ${THEME.bg}; }
        
        /* Typography */
        .hero-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 800; line-height: 1.15; margin-bottom: 24px; color: ${THEME.primary}; letter-spacing: -1px; }
        .hero-subtitle { font-size: 17px; line-height: 1.7; color: ${THEME.textLight}; margin-bottom: 50px; max-width: 520px; }
        
        /* Form & Cards */
        .form-card { width: 100%; max-width: 480px; background: #fff; padding: 40px; border-radius: 16px; border: 1px solid ${THEME.border}; box-shadow: 0 15px 35px -5px rgba(10,25,47,0.03); }
        .form-header { margin-bottom: 32px; text-align: center; }
        .form-header h2 { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; color: ${THEME.primary}; }
        .form-header p { color: ${THEME.textLight}; font-size: 14px; margin-top: 6px; }
        
        /* NEW FORM LAYOUT */
        .form-row { display: flex; gap: 16px; margin-bottom: 20px; }
        .form-row .input-group { flex: 1; margin-bottom: 0; }
        .input-group { margin-bottom: 20px; }
        .input-label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; color: ${THEME.textLight}; text-transform: uppercase; letter-spacing: 1px; }
        .input-field { width: 100%; padding: 14px 16px; border-radius: 8px; border: 1px solid ${THEME.border}; background: ${THEME.bg}; font-size: 15px; color: ${THEME.text}; font-family: 'Inter', sans-serif; outline: none; transition: all 0.2s; box-sizing: border-box; }
        .input-field:focus { border-color: ${THEME.primary}; background: #ffffff; box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05); }
        select.input-field { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 16px center; background-size: 16px; padding-right: 40px; }
        
        /* Buttons */
        .cta-button { width: 100%; padding: 16px 24px; border-radius: 8px; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 15px; text-align: center; cursor: not-allowed; border: none; background: ${THEME.border}; color: ${THEME.textLight}; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px; }
        .cta-button.active { background: ${THEME.primary}; color: ${THEME.accent}; cursor: pointer; box-shadow: 0 10px 20px -5px rgba(10, 25, 47, 0.3); }
        .cta-button.active:hover { background: ${THEME.secondary}; transform: translateY(-1px); }

        /* Benefits */
        .benefits-list { display: flex; flex-direction: column; gap: 28px; margin-bottom: 60px; }
        .benefit-item { display: flex; gap: 20px; align-items: flex-start; }
        .benefit-item .icon { font-size: 24px; background: ${THEME.bg}; padding: 14px; border-radius: 12px; border: 1px solid ${THEME.border}; }
        .benefit-item strong { display: block; font-size: 16px; font-weight: 700; margin-bottom: 6px; color: ${THEME.primary}; }
        .benefit-item p { font-size: 14px; color: ${THEME.textLight}; line-height: 1.6; }

        .trust-badge { display: inline-flex; align-items: center; gap: 12px; background: ${THEME.bg}; padding: 12px 24px; border-radius: 99px; border: 1px solid ${THEME.border}; }

        /* Quiz Layout */
        .question-container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .modern-timer { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid ${THEME.border}; padding: 10px 20px; border-radius: 99px; font-weight: 700; font-family: 'Montserrat', sans-serif; font-size: 15px; color: ${THEME.primary}; }
        .pulse-dot { width: 8px; height: 8px; background: ${THEME.error}; border-radius: 50%; animation: pulse 2s infinite; }
        .progress-bar-container { width: 100%; height: 6px; background: ${THEME.border}; border-radius: 99px; overflow: hidden; margin-bottom: 32px; }
        .progress-bar-fill { height: 100%; background: ${THEME.primary}; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .question-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .badge { background: ${THEME.primary}; color: ${THEME.accent}; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .step-text { color: ${THEME.textLight}; font-size: 14px; font-weight: 600; }
        .question-text { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; line-height: 1.4; margin-bottom: 40px; color: ${THEME.primary}; }
        
        .options-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }
        .option-card { display: flex; align-items: center; padding: 20px 24px; background: #ffffff; border: 1px solid ${THEME.border}; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-sizing: border-box; }
        .option-card:hover { border-color: ${THEME.textLight}; background: ${THEME.bg}; }
        .option-letter { width: 36px; height: 36px; background: ${THEME.bg}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: ${THEME.primary}; margin-right: 20px; font-family: 'Montserrat', sans-serif; font-size: 15px; flex-shrink: 0;}
        .option-content { font-size: 16px; font-weight: 600; flex: 1; color: ${THEME.text}; }
        .option-card.selected { border-color: ${THEME.primary}; background: #f1f5f9; border-width: 2px; padding: 19px 23px;}
        .option-card.correct { border-color: ${THEME.success}; background: #ecfdf5; cursor: default; border-width: 2px; padding: 19px 23px;}
        .option-card.correct .option-content { color: ${THEME.success}; }
        .option-card.wrong { border-color: ${THEME.error}; background: #fef2f2; cursor: default; border-width: 2px; padding: 19px 23px;}
        .option-card.wrong .option-content { color: ${THEME.error}; }
        .option-card.disabled { opacity: 0.5; cursor: default; pointer-events: none; }
        .icon-status { font-size: 20px; margin-left: 12px; flex-shrink: 0; }

        .confidence-section { background: #ffffff; border: 1px solid ${THEME.border}; padding: 32px; border-radius: 16px; margin-bottom: 40px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.02); }
        .confidence-section h4 { font-size: 16px; color: ${THEME.primary}; margin-bottom: 20px; font-weight: 700; text-align: center; }
        .confidence-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .conf-btn { flex: 1; min-width: 110px; padding: 14px 10px; border: 1px solid ${THEME.border}; border-radius: 10px; background: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: ${THEME.textLight}; cursor: pointer; transition: all 0.2s; text-align: center;}
        .conf-btn:hover { background: ${THEME.bg}; border-color: ${THEME.textLight}; }
        
        .upload-zone { display: block; border: 2px dashed ${THEME.border}; border-radius: 12px; padding: 48px 24px; background: ${THEME.bg}; cursor: pointer; margin-bottom: 32px; transition: all 0.3s; }
        .upload-zone:hover { border-color: ${THEME.accent}; background: #FFF; }

        .report-container { max-width: 760px; margin: 40px auto; padding: 0 20px; }
        .report-header-card { background: #fff; padding: 32px; border-radius: 16px; border: 1px solid ${THEME.border}; margin-bottom: 32px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.02); }
        .report-hero-compact { display: flex; align-items: center; gap: 24px; margin-top: 16px;}
        .score-badge { width: 90px; height: 90px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 800; color: #fff; flex-shrink: 0; }
        .report-hero-text h1 { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; color: ${THEME.primary}; margin-bottom: 6px; }
        .report-hero-text p { color: ${THEME.textLight}; line-height: 1.6; font-size: 15px; }
        
        .results-list-modern { background: #ffffff; border-radius: 16px; border: 1px solid ${THEME.border}; padding: 32px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.02); }
        .zone-legend { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 4px; }
        .zone-legend.red { background: #fee2e2; color: ${THEME.error}; }
        .zone-legend.yellow { background: #fff7ed; color: ${THEME.warning}; }
        .zone-legend.green { background: #ecfdf5; color: ${THEME.success}; }

        .result-card-modern { border-radius: 12px; border: 1px solid ${THEME.border}; background: ${THEME.bg}; margin-bottom: 12px; padding: 16px 20px; transition: all 0.2s; box-sizing: border-box; }
        .result-card-modern.red { border-left: 4px solid ${THEME.error}; }
        .result-card-modern.yellow { border-left: 4px solid ${THEME.warning}; }
        .result-card-modern.green { border-left: 4px solid ${THEME.success}; }
        .result-card-modern.illusion { background: #FFFbeb; border-color: ${THEME.warning}; border-left-color: ${THEME.error}; }
        
        .card-main { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .topic-info { flex: 1; }
        .section-badge { font-size: 11px; font-weight: 700; color: ${THEME.textLight}; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;}
        .topic-name { font-size: 16px; font-weight: 700; color: ${THEME.primary}; }
        .status-info { text-align: right; flex-shrink: 0; }
        .status-text { display: block; font-size: 14px; font-weight: 700; margin-bottom: 4px; }
        .result-card-modern.red .status-text { color: ${THEME.error}; }
        .result-card-modern.yellow .status-text { color: ${THEME.warning}; }
        .result-card-modern.green .status-text { color: ${THEME.success}; }
        .meta-text { font-size: 12px; color: ${THEME.textLight}; font-weight: 500;}
        .illusion-warning { margin-top: 16px; padding: 12px 16px; background: #FFF; border-radius: 8px; border: 1px solid ${THEME.warning}; color: ${THEME.text}; font-size: 14px; line-height: 1.6;}

        .path-container { max-width: 1000px; margin: 40px auto; padding: 0 20px; }
        .path-header { text-align: center; margin-bottom: 48px; }
        .path-header h1 { font-family: 'Montserrat', sans-serif; font-size: 36px; font-weight: 800; margin-bottom: 12px; color: ${THEME.primary}; letter-spacing: -1px; }
        .path-header p { color: ${THEME.textLight}; font-size: 16px; max-width: 500px; margin: 0 auto; line-height: 1.6; }
        .path-visualization-modern { background: ${THEME.primary}; border-radius: 24px; padding: 50px 40px; box-shadow: 0 20px 50px -10px rgba(10,25,47,0.3); overflow-x: auto; position: relative;}

        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .scale-in { animation: scale-in 0.3s ease forwards; }

        @media (max-width: 900px) {
          .split-layout { flex-direction: column; }
          .split-left { padding: 40px 20px; }
          .split-right { padding: 40px 20px; background: #fff; }
          .hero-title { font-size: 32px; }
          .form-row { flex-direction: column; gap: 0; }
          .form-card { padding: 24px; }
          .card-main { flex-direction: column; align-items: flex-start; gap: 12px;}
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
      {screen === "question" && (
        <>
          <div style={{ maxWidth: 840, margin: "20px auto 0", padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo size={36} />
            <Timer seconds={elapsed} />
          </div>
          <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex+1} total={QUESTIONS.length} onComplete={handleAnswer} />
        </>
      )}
      {screen === "upload" && <UploadScreen onAnalyze={handleAnalyze} />}
      {screen === "analyzing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", color: THEME.primary, textAlign: 'center', padding: 20 }}>
          <div style={{ width: 48, height: 48, border: `4px solid ${THEME.border}`, borderTopColor: THEME.accent, borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 24 }} />
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 24 }}>Анализ данных AAPA</h2>
          <p style={{color: THEME.textLight, marginTop: 12, fontSize: 16}}>Формируем карту когнитивных дефицитов...</p>
        </div>
      )}
      {screen === "report" && report && <ReportScreen report={report} user={user} onViewPlan={() => setScreen("rpgmap")} />}
      {screen === "rpgmap" && <PathMap user={user} />}
    </>
  );
}
