import { useState, useEffect } from "react";

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
  { v: 1, label: "Сомневаюсь", color: "#f87171", bg: "#fef2f2" },
  { v: 2, label: "Не уверен", color: "#fb923c", bg: "#fff7ed" },
  { v: 3, label: "Нейтрально", color: "#94a3b8", bg: "#f8fafc" },
  { v: 4, label: "Уверен", color: "#34d399", bg: "#ecfdf5" },
  { v: 5, label: "Абсолютно уверен", color: "#10b981", bg: "#d1fae5" },
];

const RPG_NODES = [
  { id: 1, type: "npc", name: "Уравнения", topic: "Алгебра", x: 100, y: 350 },
  { id: 2, type: "npc", name: "Степени", topic: "Алгебра", x: 250, y: 250 },
  { id: 3, type: "boss", name: "Рубеж: Алгебра", topic: "Алгебра", x: 400, y: 150 },
  { id: 4, type: "npc", name: "Площадь", topic: "Геометрия", x: 550, y: 250 },
  { id: 5, type: "npc", name: "Пифагор", topic: "Геометрия", x: 700, y: 350 },
  { id: 6, type: "boss", name: "Рубеж: Геометрия", topic: "Геометрия", x: 850, y: 250 },
  { id: 7, type: "npc", name: "Вероятность", topic: "Вероятность", x: 700, y: 100 },
  { id: 8, type: "boss", name: "Цель: ЕНТ", topic: "Экзамен", x: 850, y: 50 },
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];

const REG_GOALS = {
  exam: "Подготовка к экзамену",
  gaps: "Закрытие пробелов",
  future: "Подготовка к следующему классу"
};

const EXAMS_LIST = ["ЕНТ", "SAT", "NUET", "Further Pure Math", "IGCSE"];
const GRADES_LIST = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс", "12 класс"];

// ── MODERN LOGO COMPONENT ─────────────────────────────────────────────────────
const Logo = ({ size = 40 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="24" fill="#2563EB"/>
      <path d="M50 20 L20 60 L80 60 Z" fill="#FFFFFF" fillOpacity="0.2"/>
      <path d="M50 35 L30 75 L70 75 Z" fill="#FFFFFF"/>
      <path d="M50 15 L53 25 L63 28 L53 31 L50 41 L47 31 L37 28 L47 25 Z" fill="#FBBF24"/>
    </svg>
    <div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: size * 0.55, color: "#0f172a", lineHeight: 1 }}>AAPA</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: size * 0.22, color: "#2563EB", letterSpacing: "0.5px", marginTop: 2 }}>AD ASTRA PER ASPERA</div>
    </div>
  </div>
);

// ── UI COMPONENTS ─────────────────────────────────────────────────────────────
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

// ── AUTH SCREEN (High Conversion Layout) ──────────────────────────────────────
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
      {/* Left Side - Value Proposition */}
      <div className="split-left">
        <div style={{ marginBottom: "auto" }}>
          <Logo size={48} />
        </div>
        <div>
          <h1 className="hero-title">Построй свой путь к звездам.</h1>
          <p className="hero-subtitle">
            Пройди стартовую диагностику, чтобы система <b>AAPA</b> построила твой персональный трек подготовки к {EXAMS_LIST.join(", ")} и школьным предметам.
          </p>
          <div className="benefits-list">
            <div className="benefit-item">
              <span className="icon">🎯</span>
              <div>
                <strong>Точечный анализ</strong>
                <p>Выявляем конкретные пробелы, а не просто ставим оценку.</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="icon">🗺️</span>
              <div>
                <strong>Индивидуальный план</strong>
                <p>Получи карту компетенций для достижения цели.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="trust-badge">
          <span style={{ color: "#FBBF24" }}>★★★★★</span>
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Нам доверяют подготовку к будущему</span>
        </div>
      </div>

      {/* Right Side - Conversion Form */}
      <div className="split-right">
        <div className="form-card">
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>Начать диагностику</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Заполни данные для создания профиля ученика.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label>Имя</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Алихан" required />
              </div>
              <div className="input-group">
                <label>Фамилия</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Омаров" required />
              </div>
            </div>

            <div className="input-group">
              <label>Номер WhatsApp</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 00 00" required />
            </div>

            <div className="input-group">
              <label>Цель обучения</label>
              <select value={mainGoal} onChange={e => { setMainGoal(e.target.value); setSpecificGoal(""); }} required>
                <option value="" disabled>Выберите из списка...</option>
                {Object.entries(REG_GOALS).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            {mainGoal === 'exam' && (
              <div className="input-group scale-in">
                <label>Какой экзамен?</label>
                <select value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} required>
                  <option value="" disabled>Выберите экзамен...</option>
                  {EXAMS_LIST.map(exam => <option key={exam} value={exam}>{exam}</option>)}
                </select>
              </div>
            )}

            {(mainGoal === 'gaps' || mainGoal === 'future') && (
              <div className="input-group scale-in">
                <label>Класс</label>
                <select value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} required>
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
      <div className="header-nav">
        <Logo size={32} />
        <Timer seconds={elapsed} />
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${((qNum - 1) / total) * 100}%` }} />
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
            {CONFIDENCE.map(c => (
              <button 
                key={c.v} 
                className={`conf-btn ${confidence?.v === c.v ? 'active' : ''}`}
                style={confidence?.v === c.v ? { borderColor: c.color, background: c.bg, color: c.color } : {}}
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

// ── Report Screen ─────────────────────────────────────────────────────────────
function ReportScreen({ report, onViewPlan }) {
  const { answers } = report;
  const correct = answers.filter(a => a.correct).length;
  const score = Math.round((correct / answers.length) * 100);

  return (
    <div className="report-container">
      <div className="header-nav" style={{ marginBottom: 32 }}>
        <Logo size={32} />
      </div>

      <div className="report-hero">
        <div className="score-circle">
          <svg viewBox="0 0 36 36" className="circular-chart">
            <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="circle" strokeDasharray={`${score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <text x="18" y="20.35" className="percentage">{score}%</text>
          </svg>
        </div>
        <div className="report-hero-text">
          <h1>Аудит завершен</h1>
          <p>Вы правильно решили {correct} из {answers.length} задач. Алгоритм AAPA проанализировал ваши ответы и сформировал план подготовки.</p>
        </div>
      </div>

      <div className="results-list">
        <h3>Детализация по темам</h3>
        {answers.map((a, i) => (
          <div key={i} className={`result-row ${a.correct ? 'correct' : 'wrong'}`}>
            <div className="result-info">
              <span className="topic">{a.topic}</span>
              <span className="meta">{a.section} • {a.timeSpent} сек</span>
            </div>
            <div className="result-badge">{a.correct ? "Освоено" : "Требует внимания"}</div>
          </div>
        ))}
      </div>

      <button onClick={onViewPlan} className="cta-button active" style={{ marginTop: 32 }}>
        Перейти к Карте Компетенций →
      </button>
    </div>
  );
}

// ── Path Map (Modern Tech Tree) ───────────────────────────────────────────────
function PathMap({ answers }) {
  return (
    <div className="path-container">
      <div className="header-nav" style={{ marginBottom: 40 }}>
        <Logo size={32} />
      </div>

      <div className="path-header">
        <h1>Трек подготовки</h1>
        <p>Ваша индивидуальная дорожная карта к высоким баллам.</p>
      </div>

      <div className="path-visualization">
        <svg width="100%" height={450} viewBox="0 0 920 450" preserveAspectRatio="xMidYMid meet">
          {/* Paths (Smooth curves) */}
          {RPG_PATHS.map(([a, b]) => {
            const na = RPG_NODES.find(n => n.id === a);
            const nb = RPG_NODES.find(n => n.id === b);
            return (
              <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#e2e8f0" strokeWidth={4} strokeLinecap="round" />
            );
          })}

          {/* Nodes */}
          {RPG_NODES.map(node => {
            const isBoss = node.type === "boss";
            const r = isBoss ? 28 : 20;
            const fill = isBoss ? "#2563EB" : "#FFFFFF";
            const stroke = isBoss ? "#2563EB" : "#cbd5e1";
            const textColor = isBoss ? "#1e293b" : "#64748b";
            
            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}>
                <circle cx={0} cy={0} r={r} fill={fill} stroke={stroke} strokeWidth={4} />
                {isBoss && <path d="M-6-2 L0 6 L8-4" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
                <text x={0} y={r + 24} textAnchor="middle" fontSize={14} fontWeight={600} fill={textColor} fontFamily="Inter">
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; font-family: 'Inter', sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased; }
        
        /* Layouts */
        .split-layout { display: flex; min-height: 100vh; }
        .split-left { flex: 1; background: #f8fafc; padding: 60px; display: flex; flexDirection: column; justify-content: space-between; border-right: 1px solid #e2e8f0; }
        .split-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; background: #ffffff; }
        
        /* Typography */
        .hero-title { font-family: 'Montserrat', sans-serif; font-size: 48px; font-weight: 800; line-height: 1.1; margin-bottom: 20px; color: #0f172a; letter-spacing: -1px; }
        .hero-subtitle { font-size: 18px; line-height: 1.6; color: #475569; margin-bottom: 40px; max-width: 480px; }
        
        /* Form & Cards */
        .form-card { width: 100%; max-width: 440px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px; }
        .input-group input, .input-group select { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-family: 'Inter', sans-serif; font-size: 15px; color: #0f172a; outline: none; transition: all 0.2s; }
        .input-group input:focus, .input-group select:focus { border-color: #2563EB; background: #ffffff; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
        select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 16px center; background-size: 16px; }
        
        /* Buttons */
        .cta-button { width: 100%; padding: 16px 24px; border-radius: 12px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; text-align: center; cursor: not-allowed; border: none; background: #f1f5f9; color: #94a3b8; transition: all 0.3s; }
        .cta-button.active { background: #2563EB; color: #ffffff; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
        .cta-button.active:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3); }

        /* Benefits */
        .benefits-list { display: flex; flex-direction: column; gap: 24px; }
        .benefit-item { display: flex; gap: 16px; align-items: flex-start; }
        .benefit-item .icon { font-size: 24px; background: #ffffff; padding: 12px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .benefit-item strong { display: block; font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .benefit-item p { font-size: 14px; color: #64748b; line-height: 1.5; }

        /* Trust Badge */
        .trust-badge { display: inline-flex; align-items: center; gap: 12px; background: #ffffff; padding: 12px 20px; border-radius: 99px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }

        /* Quiz Layout */
        .question-container { max-width: 760px; margin: 0 auto; padding: 40px 20px; }
        .header-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .modern-timer { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-family: 'Montserrat', sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .pulse-dot { width: 8px; height: 8px; background: #EF4444; border-radius: 50%; animation: pulse 2s infinite; }
        .progress-bar-container { width: 100%; height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-bottom: 32px; }
        .progress-bar-fill { height: 100%; background: #2563EB; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .question-meta { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
        .badge { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; }
        .step-text { color: #64748b; font-size: 14px; font-weight: 500; }
        .question-text { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 700; line-height: 1.4; margin-bottom: 32px; }
        
        .options-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
        .option-card { display: flex; align-items: center; padding: 16px 20px; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .option-card:hover { border-color: #cbd5e1; background: #f8fafc; }
        .option-letter { width: 32px; height: 32px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #64748b; margin-right: 16px; font-family: 'Montserrat', sans-serif; }
        .option-content { font-size: 16px; font-weight: 500; flex: 1; }
        .option-card.selected { border-color: #2563EB; background: #eff6ff; }
        .option-card.selected .option-letter { background: #2563EB; color: #fff; }
        .option-card.correct { border-color: #10B981; background: #ecfdf5; cursor: default; }
        .option-card.correct .option-letter { background: #10B981; color: #fff; }
        .option-card.wrong { border-color: #EF4444; background: #fef2f2; cursor: default; }
        .option-card.wrong .option-letter { background: #EF4444; color: #fff; }
        .option-card.disabled { opacity: 0.6; cursor: default; pointer-events: none; }
        .icon-status { font-size: 20px; }

        /* Confidence */
        .confidence-section { background: #ffffff; border: 1px solid #e2e8f0; padding: 24px; border-radius: 16px; margin-bottom: 32px; }
        .confidence-section h4 { font-size: 15px; color: #475569; margin-bottom: 16px; }
        .confidence-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .conf-btn { flex: 1; min-width: 100px; padding: 12px 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s; }
        .conf-btn:hover { background: #f8fafc; }
        
        /* Report */
        .report-container { max-width: 640px; margin: 40px auto; padding: 0 20px; }
        .report-hero { display: flex; align-items: center; gap: 32px; background: #ffffff; padding: 32px; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05); margin-bottom: 32px; }
        .score-circle { width: 120px; height: 120px; flex-shrink: 0; }
        .circular-chart { display: block; margin: 0 auto; max-width: 100%; max-height: 250px; }
        .circle-bg { fill: none; stroke: #f1f5f9; stroke-width: 3.8; }
        .circle { fill: none; stroke-width: 3.8; stroke-linecap: round; animation: progress 1s ease-out forwards; stroke: #2563EB; }
        .percentage { fill: #0f172a; font-family: 'Montserrat', sans-serif; font-size: 8px; font-weight: 800; text-anchor: middle; }
        .report-hero-text h1 { font-family: 'Montserrat', sans-serif; font-size: 28px; margin-bottom: 8px; }
        .report-hero-text p { color: #64748b; line-height: 1.5; font-size: 15px; }
        
        .results-list { background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 24px; }
        .results-list h3 { font-family: 'Montserrat', sans-serif; font-size: 18px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
        .result-row { display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 8px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .result-row.correct { border-left: 4px solid #10B981; }
        .result-row.wrong { border-left: 4px solid #F59E0B; }
        .result-info .topic { display: block; font-weight: 600; margin-bottom: 4px; }
        .result-info .meta { font-size: 13px; color: #64748b; }
        .result-badge { font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
        .result-row.correct .result-badge { background: #ecfdf5; color: #10B981; }
        .result-row.wrong .result-badge { background: #fff7ed; color: #F59E0B; }

        /* Path Map */
        .path-container { max-width: 920px; margin: 40px auto; padding: 0 20px; }
        .path-header { text-align: center; margin-bottom: 40px; }
        .path-header h1 { font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 800; margin-bottom: 12px; }
        .path-visualization { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px -20px rgba(0,0,0,0.05); overflow-x: auto; }

        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .scale-in { animation: scale-in 0.3s ease forwards; }

        /* Responsive */
        @media (max-width: 800px) {
          .split-layout { flex-direction: column; }
          .split-left { padding: 40px 20px; border-right: none; border-bottom: 1px solid #e2e8f0; }
          .split-right { padding: 40px 20px; align-items: flex-start; }
          .hero-title { font-size: 36px; }
          .report-hero { flex-direction: column; text-align: center; gap: 24px; }
          .form-row { grid-template-columns: 1fr; gap: 0; }
        }
      `}</style>

      {screen === "auth" && <AuthScreen onRegister={handleRegister} />}
      {screen === "question" && <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex+1} total={QUESTIONS.length} onComplete={handleAnswer} />}
      {screen === "report" && report && <ReportScreen report={report} onViewPlan={() => setScreen("rpgmap")} />}
      {screen === "rpgmap" && <PathMap answers={report?.answers || answers} />}
    </>
  );
}
