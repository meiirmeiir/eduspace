import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, query, orderBy, deleteDoc } from "firebase/firestore";

// ── FIREBASE КОНФИГ ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC8c_Y4O2V7DV5bwMU5wJSJj87BoOygjYw",
  authDomain: "aapa-79307.firebaseapp.com",
  projectId: "aapa-79307",
  storageBucket: "aapa-79307.firebasestorage.app",
  messagingSenderId: "317714759645",
  appId: "1:317714759645:web:94110a1f69baf4a2e80034",
  measurementId: "G-5Y0SD4H6FM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── ДАННЫЕ ────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 1, section: "Алгебра", topic: "Линейные уравнения", text: "Решите уравнение: 3x + 7 = 22", options: ["x = 5", "x = 3", "x = 7", "x = 4"], correct: 0 },
  { id: 2, section: "Геометрия", topic: "Площадь треугольника", text: "Основание треугольника 8 см, высота 5 см. Найдите площадь.", options: ["20 см²", "40 см²", "13 см²", "16 см²"], correct: 0 },
  { id: 3, section: "Алгебра", topic: "Степени", text: "Вычислите: 2⁵ + 3² = ?", options: ["41", "32", "27", "39"], correct: 0 },
  { id: 4, section: "Вероятность", topic: "Классическая вероятность", text: "В урне 3 красных и 7 синих шаров. Вероятность вытащить красный:", options: ["0.3", "0.7", "0.5", "0.03"], correct: 0 },
  { id: 5, section: "Геометрия", topic: "Теорема Пифагора", text: "Катеты прямоугольного треугольника: 6 см и 8 см. Найдите гипотенузу.", options: ["10 см", "12 см", "7 см", "14 см"], correct: 0 }
];

const CONFIDENCE_LEVELS = [
  { v: 1, label: "Сомневаюсь", color: "#EF4444" }, { v: 2, label: "Не уверен", color: "#F59E0B" },
  { v: 3, label: "Нейтрально", color: "#94A3B8" }, { v: 4, label: "Уверен", color: "#10B981" },
  { v: 5, label: "Абсолютно уверен", color: "#059669" }
];

const RPG_NODES = [
  { id: 1, name: "Уравнения", topic: "Алгебра", x: 100, y: 350 }, { id: 2, name: "Степени", topic: "Алгебра", x: 250, y: 250 },
  { id: 3, name: "Рубеж: Алгебра", topic: "Алгебра", x: 400, y: 150, type: "boss" }, { id: 4, name: "Площадь", topic: "Геометрия", x: 550, y: 250 },
  { id: 5, name: "Пифагор", topic: "Геометрия", x: 700, y: 350 }, { id: 6, name: "Рубеж: Геометрия", topic: "Геометрия", x: 850, y: 250, type: "boss" },
  { id: 7, name: "Вероятность", topic: "Вероятность", x: 700, y: 100 }, { id: 8, name: "Цель: ЕНТ", topic: "Экзамен", x: 850, y: 50, type: "boss" }
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];

const REG_GOALS = { exam: "Подготовка к экзамену", gaps: "Закрытие пробелов", future: "Подготовка к следующему классу" };
const EXAMS_LIST = ["ЕНТ", "SAT", "NUET", "Further Pure Math", "IGCSE"];
const GRADES_LIST = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс", "12 класс"];

const THEME = { primary: "#0f172a", accent: "#d4af37", bg: "#f8fafc", surface: "#ffffff", text: "#334155", textLight: "#64748b", border: "#e2e8f0", success: "#10B981", warning: "#F59E0B", error: "#EF4444" };

const DAY_NAMES_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_NAMES_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

// ── ВЕКТОРНЫЙ ЛОГОТИП ─────────────────────────────────────────────────────────
const Logo = ({ size = 48 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="50" fill="#0A2463"/>
      <path d="M45 35 L85 15 L78 28 L95 35 L78 40 L85 55 L65 40 Z" fill="#FBBF24"/>
      <path d="M50 75 Q 35 60 15 65 L15 75 Q 35 70 50 85 Q 65 70 85 75 L85 65 Q 65 60 50 75 Z" fill="#E2E8F0"/>
      <path d="M50 65 Q 35 50 15 55 L15 65 Q 35 60 50 75 Q 65 60 85 65 L85 55 Q 65 50 50 65 Z" fill="#FFFFFF"/>
      <path d="M50 30 L15 45 L50 60 L85 45 Z" fill="#1E3A8A"/>
      <path d="M50 35 L22 47 L50 55 L78 47 Z" fill="#2563EB"/>
      <path d="M50 45 L70 50 L72 65" stroke="#FBBF24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="72" cy="68" r="3.5" fill="#FBBF24"/>
    </svg>
    <div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: size * 0.6, color: THEME.primary, lineHeight: 1, letterSpacing: "1px" }}>AAPA</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: Math.max(size * 0.2, 9), color: THEME.accent, letterSpacing: "1px", marginTop: 4, textTransform: "uppercase" }}>Ad Astra Per Aspera</div>
    </div>
  </div>
);

const LogoLight = ({ size = 48 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="50" fill="#0A2463"/>
      <path d="M45 35 L85 15 L78 28 L95 35 L78 40 L85 55 L65 40 Z" fill="#FBBF24"/>
      <path d="M50 75 Q 35 60 15 65 L15 75 Q 35 70 50 85 Q 65 70 85 75 L85 65 Q 65 60 50 75 Z" fill="#E2E8F0"/>
      <path d="M50 65 Q 35 50 15 55 L15 65 Q 35 60 50 75 Q 65 60 85 65 L85 55 Q 65 50 50 65 Z" fill="#FFFFFF"/>
      <path d="M50 30 L15 45 L50 60 L85 45 Z" fill="#1E3A8A"/>
      <path d="M50 35 L22 47 L50 55 L78 47 Z" fill="#2563EB"/>
      <path d="M50 45 L70 50 L72 65" stroke="#FBBF24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="72" cy="68" r="3.5" fill="#FBBF24"/>
    </svg>
    <div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: size * 0.6, color: "#ffffff", lineHeight: 1, letterSpacing: "1px" }}>AAPA</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: Math.max(size * 0.2, 9), color: THEME.accent, letterSpacing: "1px", marginTop: 4, textTransform: "uppercase" }}>Ad Astra Per Aspera</div>
    </div>
  </div>
);

function Timer({ seconds }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div className="modern-timer"><div className="pulse-dot"></div><span>{mins > 0 ? `${mins}:${String(secs).padStart(2,"0")}` : `0:${String(secs).padStart(2,"0")}`}</span></div>
  );
}

// ── ЭКРАН АВТОРИЗАЦИИ ─────────────────────────────────────────────────────────
function AuthScreen({ onRegister }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("+7 ");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [specificGoal, setSpecificGoal] = useState("");

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    if (val.length < 3 || !val.startsWith("+7 ")) setPhone("+7 ");
    else setPhone(val);
  };

  const checkUserInDB = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.length < 11) { alert("Пожалуйста, введите корректный номер телефона."); return; }
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", cleanPhone));
      if (userSnap.exists()) onRegister(userSnap.data());
      else setStep(2);
    } catch (error) {
      console.error(error); alert("Не удалось связаться с базой данных.");
    }
    setLoading(false);
  };

  const registerNewUser = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !mainGoal || !specificGoal) return;
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      const userData = { firstName, lastName, phone: cleanPhone, goal: REG_GOALS[mainGoal], details: specificGoal, registeredAt: new Date().toISOString() };
      await setDoc(doc(db, "users", cleanPhone), userData);
      onRegister(userData);
    } catch (error) {
      console.error(error); alert("Ошибка при сохранении профиля.");
    }
    setLoading(false);
  };

  return (
    <div className="split-layout">
      <div className="split-left">
        <div style={{ marginBottom: "60px" }}><Logo size={60} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 className="hero-title">Построй свой путь к <span style={{color: THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">Пройди независимую диагностику компетенций. Система <b>AAPA</b> выявит скрытые пробелы и построит точный маршрут подготовки.</p>
          <div className="benefits-list">
            <div className="benefit-item"><span className="icon">🎯</span><div><strong>Когнитивная диагностика</strong><p>Анализируем не только верные ответы, но и вашу уверенность в них.</p></div></div>
            <div className="benefit-item"><span className="icon">🗺️</span><div><strong>Индивидуальный трек</strong><p>Вы получаете пошаговую Карту Навыков для достижения вашей цели.</p></div></div>
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
            <h2>{step === 1 ? "Начать диагностику" : "Создать профиль"}</h2>
            <p>{step === 1 ? "Введите номер WhatsApp для проверки аккаунта." : "Мы вас не нашли. Давайте познакомимся!"}</p>
          </div>
          <form onSubmit={step === 1 ? checkUserInDB : registerNewUser}>
            <div className="input-group">
              <label className="input-label">Номер WhatsApp</label>
              <input type="tel" className="input-field" value={phone} onChange={handlePhoneChange} disabled={step === 2 || loading} placeholder="+7 700 000 00 00" required />
            </div>
            {step === 2 && (
              <div className="scale-in">
                <div className="form-row">
                  <div className="input-group" style={{marginBottom: 0}}><label className="input-label">Имя</label><input type="text" className="input-field" value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
                  <div className="input-group" style={{marginBottom: 0}}><label className="input-label">Фамилия</label><input type="text" className="input-field" value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
                </div>
                <div className="input-group" style={{marginTop: 20}}>
                  <label className="input-label">Цель обучения</label>
                  <select className="input-field" value={mainGoal} onChange={e => { setMainGoal(e.target.value); setSpecificGoal(""); }} required>
                    <option value="" disabled>Выберите из списка...</option>
                    {Object.entries(REG_GOALS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
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
              </div>
            )}
            <button type="submit" className={`cta-button ${phone.replace(/\s+/g, '').length >= 11 ? 'active' : ''}`} disabled={loading || phone.replace(/\s+/g, '').length < 11}>
              {loading ? "Проверка..." : (step === 1 ? "Далее →" : "Войти →")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── ЭКРАН ВОПРОСА ─────────────────────────────────────────────────────────────
function QuestionScreen({ question, qNum, total, onComplete }) {
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState(null);
  const [confidence, setConfidence] = useState(null);

  useEffect(() => { setElapsed(0); setSelected(null); setConfidence(null); }, [question.id]);

  const isRevealed = selected !== null && confidence !== null;

  useEffect(() => {
    if (isRevealed) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRevealed]);

  const handleNext = () => {
    onComplete({ questionId: question.id, topic: question.topic, section: question.section, selectedAnswer: selected, correct: selected === question.correct, confidence: confidence?.v, timeSpent: elapsed });
  };

  return (
    <div className="question-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <Logo size={36} />
        <Timer seconds={elapsed} />
      </div>
      <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${((qNum) / total) * 100}%` }} /></div>
      <div className="question-meta"><span className="badge">{question.section}</span><span className="step-text">Вопрос {qNum} из {total}</span></div>
      <h2 className="question-text">{question.text}</h2>
      <div className="options-grid">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === question.correct;
          let stateClass = "";
          if (isRevealed) {
            if (isCorrect) stateClass = "correct";
            else if (isSelected) stateClass = "wrong";
            else stateClass = "disabled";
          } else {
            if (isSelected) stateClass = "selected";
            else if (selected !== null) stateClass = "disabled";
          }
          return (
            <div key={i} className={`option-card ${stateClass}`} onClick={() => !isRevealed && setSelected(i)}>
              <div className="option-letter">{String.fromCharCode(65 + i)}</div>
              <div className="option-content">{opt}</div>
              {isRevealed && isCorrect && <div className="icon-status">✅</div>}
              {isRevealed && isSelected && !isCorrect && <div className="icon-status">❌</div>}
            </div>
          );
        })}
      </div>
      {selected !== null && (
        <div className="confidence-section scale-in">
          <h4>Насколько вы уверены в ответе?</h4>
          <div className="confidence-grid">
            {CONFIDENCE_LEVELS.map(c => (
              <button key={c.v} className={`conf-btn ${confidence?.v === c.v ? 'active' : ''}`}
                style={confidence?.v === c.v ? { borderColor: c.color, background: c.color + "10", color: c.color } : {}}
                onClick={() => !isRevealed && setConfidence(c)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 40 }}>
        <button className={`cta-button ${isRevealed ? 'active' : ''}`} disabled={!isRevealed} onClick={handleNext}>
          {qNum < total ? "Следующий вопрос" : "Завершить аудит"}
        </button>
      </div>
    </div>
  );
}

// ── ОСТАЛЬНЫЕ ЭКРАНЫ ──────────────────────────────────────────────────────────
function UploadScreen({ onAnalyze }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ maxWidth: 640, margin: "100px auto", padding: "0 20px" }}>
      <div className="form-card" style={{ maxWidth: '100%', textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 26, color: THEME.primary, marginBottom: 16 }}>Черновик вычислений</h2>
        <p style={{ color: THEME.textLight, fontSize: 16, marginBottom: 40 }}>Загрузите фотографию ваших черновиков.</p>
        <label className="upload-zone">
          <span style={{ color: THEME.primary, fontWeight: 700, fontSize: 16 }}>Выбрать файл (JPG, PNG)</span>
          <input type="file" style={{ display: "none" }} onChange={() => setLoading(true)} />
        </label>
        <button onClick={onAnalyze} disabled={loading} className={`cta-button ${loading ? '' : 'active'}`}>
          {loading ? "Загрузка..." : "Пропустить загрузку →"}
        </button>
      </div>
    </div>
  );
}

function ReportScreen({ report, user, onViewPlan, onBack }) {
  const { answers } = report;
  const correct = answers.filter(a => a.correct).length;
  const score = Math.round((correct / answers.length) * 100);
  const sortedSkills = answers.map(a => {
    let zone = "green", statusText = "Твердый навык", priority = 3;
    if (!a.correct) { zone = "red"; statusText = "Пробел"; priority = 1; }
    else if (a.confidence <= 2) { zone = "yellow"; statusText = "Хрупкое знание"; priority = 2; }
    let isIllusion = (!a.correct && a.confidence >= 4);
    if (isIllusion) statusText = "⚠️ Иллюзия знаний";
    return { ...a, zone, statusText, priority, isIllusion };
  }).sort((a, b) => a.priority - b.priority);

  return (
    <div className="report-container">
      <div className="report-header-card">
        <div className="report-hero-compact">
          <div className="score-badge" style={{ backgroundColor: score >= 80 ? THEME.success : score >= 60 ? THEME.warning : THEME.error }}>{score}%</div>
          <div className="report-hero-text">
            <h1>Аудит компетенций завершен</h1>
            <p>Ученик: {user?.firstName} {user?.lastName} • Цель: {user?.details}</p>
          </div>
        </div>
      </div>
      <div className="results-list-modern">
        <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 20, fontWeight: 800, color: THEME.primary, marginBottom: 24 }}>Карта навыков</h3>
        {sortedSkills.map((a, i) => (
          <div key={i} className={`result-card-modern ${a.zone}`}>
            <div className="card-main">
              <div className="topic-info"><span className="section-badge">{a.section}</span><span className="topic-name">{a.topic}</span></div>
              <div className="status-info"><span className="status-text">{a.statusText}</span><span className="meta-text">{a.timeSpent} сек • Уверенность: {a.confidence}/5</span></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
        {onBack && <button onClick={onBack} className="cta-button active" style={{ background: "#fff", color: THEME.primary, border: `1px solid ${THEME.border}`, boxShadow: "none" }}>← Главная</button>}
        <button onClick={onViewPlan} className="cta-button active">Открыть Трек Развития →</button>
      </div>
    </div>
  );
}

function PathMap({ user, onBack }) {
  return (
    <div className="path-container">
      <div className="path-header">
        <h1>Образовательный трек {user?.firstName}</h1>
        {onBack && <button onClick={onBack} className="cta-button active" style={{ background: "transparent", border: `1px solid ${THEME.border}`, color: THEME.primary, boxShadow: "none", marginTop: 16, width: "auto", padding: "10px 24px" }}>← Назад</button>}
      </div>
      <div className="path-visualization-modern">
        <svg width="100%" height={450} viewBox="0 0 920 450" preserveAspectRatio="xMidYMid meet">
          {RPG_PATHS.map(([a, b]) => {
            const na = RPG_NODES.find(n => n.id === a); const nb = RPG_NODES.find(n => n.id === b);
            return <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={THEME.accent} strokeWidth={1} opacity={0.4} />;
          })}
          {RPG_NODES.map(node => {
            const isBoss = node.type === "boss";
            return (
              <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ cursor: "pointer" }}>
                <circle cx={0} cy={0} r={isBoss ? 24 : 16} fill={THEME.primary} stroke={THEME.accent} strokeWidth={isBoss ? 3 : 2} />
                <text x={0} y={40} textAnchor="middle" fontSize={12} fontWeight={600} fill="#cbd5e1" fontFamily="Inter">{node.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── ГЛАВНЫЙ ДАШБОРД ───────────────────────────────────────────────────────────
function DashboardScreen({ user, onStartDiagnostics, onViewPlan }) {
  const [activeSection, setActiveSection] = useState("home");
  const [schedule, setSchedule] = useState([]);
  const [homework, setHomework] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showHwForm, setShowHwForm] = useState(false);
  const [showSchedForm, setShowSchedForm] = useState(false);
  const [hwForm, setHwForm] = useState({ title: "", description: "", dueDate: "" });
  const [schedForm, setSchedForm] = useState({ dayOfWeek: "1", time: "10:00", subject: "Математика", duration: "60" });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isTeacher = user?.role === "teacher";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedSnap, hwSnap] = await Promise.all([
          getDocs(collection(db, "schedule")),
          getDocs(collection(db, "homework"))
        ]);
        const schedData = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const hwData = hwSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        schedData.sort((a, b) => a.time?.localeCompare(b.time));
        hwData.sort((a, b) => a.dueDate?.localeCompare(b.dueDate));
        setSchedule(schedData);
        setHomework(hwData);
      } catch (e) { console.error(e); }
      setLoadingData(false);
    };
    fetchData();
  }, []);

  const addHomework = async (e) => {
    e.preventDefault();
    try {
      const data = { ...hwForm, createdAt: new Date().toISOString() };
      const docRef = await addDoc(collection(db, "homework"), data);
      setHomework(prev => [...prev, { id: docRef.id, ...data }].sort((a, b) => a.dueDate?.localeCompare(b.dueDate)));
      setHwForm({ title: "", description: "", dueDate: "" });
      setShowHwForm(false);
    } catch (e) { alert("Ошибка при добавлении ДЗ."); }
  };

  const addSchedule = async (e) => {
    e.preventDefault();
    try {
      const data = { ...schedForm };
      const docRef = await addDoc(collection(db, "schedule"), data);
      setSchedule(prev => [...prev, { id: docRef.id, ...data }].sort((a, b) => a.time?.localeCompare(b.time)));
      setSchedForm({ dayOfWeek: "1", time: "10:00", subject: "Математика", duration: "60" });
      setShowSchedForm(false);
    } catch (e) { alert("Ошибка при добавлении занятия."); }
  };

  const deleteHomework = async (id) => {
    try {
      await deleteDoc(doc(db, "homework", id));
      setHomework(prev => prev.filter(h => h.id !== id));
    } catch (e) { alert("Ошибка при удалении."); }
  };

  const deleteSchedule = async (id) => {
    try {
      await deleteDoc(doc(db, "schedule", id));
      setSchedule(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("Ошибка при удалении."); }
  };

  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates();
  const today = new Date();

  const navItems = [
    { id: "home", icon: "🏠", label: "Главная" },
    { id: "diagnostics", icon: "🎯", label: "Диагностика" },
    { id: "plan", icon: "🗺️", label: "Индивидуальный план обучения" },
    { id: "profile", icon: "👤", label: "Личный кабинет ученика" },
  ];

  const handleNavClick = (id) => {
    setSidebarOpen(false);
    if (id === "diagnostics") { onStartDiagnostics(); return; }
    if (id === "plan") { onViewPlan(); return; }
    setActiveSection(id);
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo"><LogoLight size={36} /></div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`sidebar-nav-item ${activeSection === item.id ? "active" : ""}`} onClick={() => handleNavClick(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div>
            <div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div>
            <div className="sidebar-user-role">{isTeacher ? "Преподаватель" : "Ученик"}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="burger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <Logo size={28} />
        </div>

        {/* ── HOME ── */}
        {activeSection === "home" && (
          <>
            <div className="dashboard-header">
              <h1>Добро пожаловать, <span style={{ color: THEME.accent }}>{user?.firstName}</span>!</h1>
              <p style={{ color: THEME.textLight, marginTop: 6 }}>{today.toLocaleDateString("ru-RU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>

            {/* Quick stats */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div>
                  <div className="stat-value">{schedule.length}</div>
                  <div className="stat-label">занятий в неделю</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div>
                  <div className="stat-value">{homework.filter(h => new Date(h.dueDate) >= today).length}</div>
                  <div className="stat-label">активных ДЗ</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div>
                  <div className="stat-value">{user?.details || "—"}</div>
                  <div className="stat-label">цель</div>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="dashboard-section">
              <div className="section-title-row">
                <h2 className="section-title">📅 Расписание занятий</h2>
                {isTeacher && (
                  <button className="add-btn" onClick={() => setShowSchedForm(true)}>+ Добавить занятие</button>
                )}
              </div>
              <div className="week-calendar">
                {weekDates.map((date, idx) => {
                  const dayNum = String(idx + 1);
                  const dayLessons = schedule.filter(s => s.dayOfWeek === dayNum);
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div key={idx} className={`week-day ${isToday ? "today" : ""}`}>
                      <div className="week-day-header">
                        <span className="day-name">{DAY_NAMES_SHORT[idx]}</span>
                        <span className={`day-date ${isToday ? "today-dot" : ""}`}>{date.getDate()}</span>
                      </div>
                      <div className="day-lessons">
                        {dayLessons.length === 0 ? (
                          <div className="no-lessons">—</div>
                        ) : (
                          dayLessons.map((lesson, li) => (
                            <div key={li} className="lesson-block">
                              <span className="lesson-time">{lesson.time}</span>
                              <span className="lesson-subject">{lesson.subject}</span>
                              <span className="lesson-duration">{lesson.duration} мин</span>
                              {isTeacher && (
                                <button className="del-btn" onClick={() => deleteSchedule(lesson.id)} title="Удалить">×</button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Homework */}
            <div className="dashboard-section">
              <div className="section-title-row">
                <h2 className="section-title">📚 Домашние задания</h2>
                {isTeacher && (
                  <button className="add-btn" onClick={() => setShowHwForm(true)}>+ Добавить ДЗ</button>
                )}
              </div>
              {loadingData ? (
                <div className="empty-state">Загрузка...</div>
              ) : homework.length === 0 ? (
                <div className="empty-state">
                  {isTeacher ? "Домашних заданий нет. Нажмите «+ Добавить ДЗ»." : "Домашних заданий пока нет."}
                </div>
              ) : (
                <div className="homework-list">
                  {homework.map((hw, i) => {
                    const due = new Date(hw.dueDate + "T23:59:59");
                    const isOverdue = due < today;
                    const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={i} className={`hw-card ${isOverdue ? "overdue" : ""}`}>
                        <div className="hw-card-left">
                          <div className="hw-title">{hw.title}</div>
                          {hw.description && <div className="hw-desc">{hw.description}</div>}
                        </div>
                        <div className="hw-card-right">
                          <span className={`due-badge ${isOverdue ? "overdue" : daysLeft <= 2 ? "soon" : ""}`}>
                            {isOverdue ? "Просрочено" : daysLeft === 0 ? "Сегодня" : daysLeft === 1 ? "Завтра" : `До ${due.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`}
                          </span>
                          {isTeacher && (
                            <button className="del-btn-hw" onClick={() => deleteHomework(hw.id)} title="Удалить">×</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── PROFILE ── */}
        {activeSection === "profile" && (
          <div>
            <div className="dashboard-header">
              <h1>Личный кабинет</h1>
            </div>
            <div className="dashboard-section">
              <div className="profile-card">
                <div className="profile-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
                <div className="profile-info">
                  <div className="profile-name">{user?.firstName} {user?.lastName}</div>
                  <div className="profile-phone">{user?.phone}</div>
                  <div className="profile-goal-tag">{user?.goal}</div>
                  <div className="profile-detail">{user?.details}</div>
                  <div className="profile-date">Зарегистрирован: {user?.registeredAt ? new Date(user.registeredAt).toLocaleDateString("ru-RU") : "—"}</div>
                </div>
              </div>
              <div className="profile-actions">
                <button className="cta-button active" style={{ width: "auto", padding: "14px 28px" }} onClick={onStartDiagnostics}>
                  🎯 Пройти диагностику
                </button>
                <button className="cta-button active" style={{ width: "auto", padding: "14px 28px", background: THEME.surface, color: THEME.primary, border: `1px solid ${THEME.border}`, boxShadow: "none" }} onClick={onViewPlan}>
                  🗺️ Мой план обучения
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add Schedule */}
      {showSchedForm && (
        <div className="modal-overlay" onClick={() => setShowSchedForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Добавить занятие</div>
            <form onSubmit={addSchedule}>
              <div className="input-group">
                <label className="input-label">День недели</label>
                <select className="input-field" value={schedForm.dayOfWeek} onChange={e => setSchedForm(p => ({ ...p, dayOfWeek: e.target.value }))}>
                  {DAY_NAMES_FULL.map((d, i) => <option key={i} value={String(i + 1)}>{d}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Время начала</label>
                <input type="time" className="input-field" value={schedForm.time} onChange={e => setSchedForm(p => ({ ...p, time: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Предмет / тема</label>
                <input type="text" className="input-field" value={schedForm.subject} onChange={e => setSchedForm(p => ({ ...p, subject: e.target.value }))} placeholder="Математика" required />
              </div>
              <div className="input-group">
                <label className="input-label">Длительность (мин)</label>
                <input type="number" className="input-field" value={schedForm.duration} onChange={e => setSchedForm(p => ({ ...p, duration: e.target.value }))} min="15" max="240" required />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" className="cta-button" style={{ background: "#fff", border: `1px solid ${THEME.border}`, color: THEME.text }} onClick={() => setShowSchedForm(false)}>Отмена</button>
                <button type="submit" className="cta-button active">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Homework */}
      {showHwForm && (
        <div className="modal-overlay" onClick={() => setShowHwForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Добавить домашнее задание</div>
            <form onSubmit={addHomework}>
              <div className="input-group">
                <label className="input-label">Название задания</label>
                <input type="text" className="input-field" value={hwForm.title} onChange={e => setHwForm(p => ({ ...p, title: e.target.value }))} placeholder="Алгебра: задачи 1–10" required />
              </div>
              <div className="input-group">
                <label className="input-label">Описание (необязательно)</label>
                <textarea className="input-field" value={hwForm.description} onChange={e => setHwForm(p => ({ ...p, description: e.target.value }))} placeholder="Подробности задания..." rows={3} style={{ resize: "vertical" }} />
              </div>
              <div className="input-group">
                <label className="input-label">Срок сдачи</label>
                <input type="date" className="input-field" value={hwForm.dueDate} onChange={e => setHwForm(p => ({ ...p, dueDate: e.target.value }))} required />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" className="cta-button" style={{ background: "#fff", border: `1px solid ${THEME.border}`, color: THEME.text }} onClick={() => setShowHwForm(false)}>Отмена</button>
                <button type="submit" className="cta-button active">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ГЛАВНЫЙ КОМПОНЕНТ ─────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth");
  const [user, setUser] = useState(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [report, setReport] = useState(null);

  const handleRegister = (userData) => { setUser(userData); setScreen("dashboard"); };
  const handleAnswer = (data) => {
    const next = [...answers, data];
    setAnswers(next);
    if (qIndex + 1 < QUESTIONS.length) setQIndex(qIndex + 1);
    else { setReport({ answers: next }); setScreen("report"); }
  };
  const handleAnalyze = () => {
    setScreen("analyzing");
    setTimeout(() => { setReport({ answers }); setScreen("report"); }, 2000);
  };

  const goToDashboard = () => setScreen("dashboard");
  const startDiagnostics = () => { setQIndex(0); setAnswers([]); setScreen("question"); };
  const viewPlan = () => setScreen("rpgmap");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${THEME.bg}; -webkit-font-smoothing: antialiased; color: ${THEME.text}; font-family: 'Inter', sans-serif; }

        /* ── AUTH ── */
        .split-layout { display: flex; min-height: 100vh; }
        .split-left { flex: 1.1; background: ${THEME.surface}; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid ${THEME.border}; }
        .split-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 60px; background: ${THEME.bg}; }
        .hero-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 800; line-height: 1.15; margin-bottom: 24px; color: ${THEME.primary}; letter-spacing: -1.5px; }
        .hero-subtitle { font-size: 17px; line-height: 1.7; color: ${THEME.textLight}; margin-bottom: 50px; max-width: 520px; }
        .form-card { width: 100%; max-width: 480px; background: #fff; padding: 40px; border-radius: 16px; border: 1px solid ${THEME.border}; box-shadow: 0 15px 35px -5px rgba(10,25,47,0.03); }
        .form-header { margin-bottom: 32px; text-align: center; }
        .form-header h2 { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; color: ${THEME.primary}; }
        .form-header p { color: ${THEME.textLight}; font-size: 14px; margin-top: 6px; }
        .form-row { display: flex; gap: 16px; margin-bottom: 20px; }
        .input-group { margin-bottom: 20px; flex: 1; }
        .input-label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; color: ${THEME.textLight}; text-transform: uppercase; letter-spacing: 1px; }
        .input-field { width: 100%; padding: 14px 16px; border-radius: 8px; border: 1px solid ${THEME.border}; background: ${THEME.bg}; font-size: 15px; outline: none; transition: all 0.2s; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        .input-field:focus { border-color: ${THEME.primary}; background: #ffffff; }
        .cta-button { width: 100%; padding: 16px 24px; border-radius: 8px; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 15px; text-align: center; border: none; background: ${THEME.border}; color: ${THEME.textLight}; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px; cursor: default; }
        .cta-button.active { background: ${THEME.primary}; color: ${THEME.accent}; cursor: pointer; box-shadow: 0 10px 20px -5px rgba(10, 25, 47, 0.3); }
        .cta-button.active:hover { transform: translateY(-1px); }
        .benefits-list { display: flex; flex-direction: column; gap: 28px; margin-bottom: 60px; }
        .benefit-item { display: flex; gap: 20px; align-items: flex-start; }
        .benefit-item .icon { font-size: 24px; background: ${THEME.bg}; padding: 14px; border-radius: 12px; border: 1px solid ${THEME.border}; }
        .trust-badge { display: inline-flex; align-items: center; gap: 12px; background: ${THEME.bg}; padding: 12px 24px; border-radius: 99px; border: 1px solid ${THEME.border}; }

        /* ── QUIZ ── */
        .question-container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .modern-timer { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid ${THEME.border}; padding: 10px 20px; border-radius: 99px; font-weight: 700; font-family: 'Montserrat', sans-serif; font-size: 15px; }
        .pulse-dot { width: 8px; height: 8px; background: ${THEME.error}; border-radius: 50%; animation: pulse 2s infinite; }
        .progress-bar-container { width: 100%; height: 6px; background: ${THEME.border}; border-radius: 99px; overflow: hidden; margin-bottom: 32px; }
        .progress-bar-fill { height: 100%; background: ${THEME.primary}; transition: width 0.4s; }
        .question-meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .badge { background: ${THEME.primary}; color: ${THEME.accent}; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .question-text { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; line-height: 1.4; margin-bottom: 40px; color: ${THEME.primary}; }
        .options-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }
        .option-card { display: flex; align-items: center; padding: 20px 24px; background: #ffffff; border: 1px solid ${THEME.border}; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .option-card.selected { border-color: ${THEME.primary}; background: #f1f5f9; border-width: 2px; }
        .option-card.correct { border-color: ${THEME.success}; background: #ecfdf5; border-width: 2px; }
        .option-card.wrong { border-color: ${THEME.error}; background: #fef2f2; border-width: 2px; }
        .option-card.disabled { opacity: 0.5; pointer-events: none; }
        .option-letter { width: 36px; height: 36px; background: ${THEME.bg}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; margin-right: 20px; flex-shrink: 0; }
        .option-content { font-size: 16px; font-weight: 600; flex: 1; }
        .confidence-section { background: #ffffff; border: 1px solid ${THEME.border}; padding: 32px; border-radius: 16px; margin-bottom: 40px; }
        .confidence-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
        .conf-btn { flex: 1; padding: 14px 10px; border: 1px solid ${THEME.border}; border-radius: 10px; background: #fff; cursor: pointer; font-weight: 600; }
        .upload-zone { display: block; border: 2px dashed ${THEME.border}; border-radius: 12px; padding: 48px 24px; background: ${THEME.bg}; cursor: pointer; margin-bottom: 32px; }

        /* ── REPORT ── */
        .report-container { max-width: 760px; margin: 40px auto; padding: 0 20px; }
        .report-header-card { background: #fff; padding: 32px; border-radius: 16px; border: 1px solid ${THEME.border}; margin-bottom: 32px; }
        .report-hero-compact { display: flex; align-items: center; gap: 24px; }
        .score-badge { width: 90px; height: 90px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: #fff; flex-shrink: 0; }
        .results-list-modern { background: #ffffff; border-radius: 16px; border: 1px solid ${THEME.border}; padding: 32px; }
        .result-card-modern { border-radius: 12px; border: 1px solid ${THEME.border}; background: ${THEME.bg}; margin-bottom: 12px; padding: 16px 20px; }
        .result-card-modern.red { border-left: 4px solid ${THEME.error}; }
        .result-card-modern.yellow { border-left: 4px solid ${THEME.warning}; }
        .result-card-modern.green { border-left: 4px solid ${THEME.success}; }
        .card-main { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .topic-info { flex: 1; }
        .topic-name { font-size: 16px; font-weight: 700; color: ${THEME.primary}; }
        .status-text { display: block; font-size: 14px; font-weight: 700; margin-bottom: 4px; }
        .meta-text { font-size: 12px; color: ${THEME.textLight}; }
        .section-badge { background: ${THEME.primary}; color: ${THEME.accent}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-right: 10px; text-transform: uppercase; }

        /* ── PATH MAP ── */
        .path-container { max-width: 1000px; margin: 40px auto; padding: 0 20px; }
        .path-header { text-align: center; margin-bottom: 48px; }
        .path-visualization-modern { background: ${THEME.primary}; border-radius: 24px; padding: 50px 40px; overflow-x: auto; }

        /* ── DASHBOARD ── */
        .dashboard-layout { display: flex; min-height: 100vh; background: ${THEME.bg}; }
        .dashboard-sidebar { width: 268px; background: ${THEME.primary}; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 20; transition: transform 0.3s ease; overflow-y: auto; }
        .sidebar-logo { padding: 28px 24px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
        .sidebar-nav-item { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-radius: 10px; border: none; background: transparent; color: rgba(255,255,255,0.55); font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; text-align: left; width: 100%; transition: all 0.2s; line-height: 1.4; }
        .sidebar-nav-item:hover { background: rgba(255,255,255,0.09); color: #fff; }
        .sidebar-nav-item.active { background: rgba(212,175,55,0.18); color: ${THEME.accent}; font-weight: 700; }
        .nav-icon { font-size: 18px; flex-shrink: 0; }
        .sidebar-user { padding: 20px 24px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 12px; }
        .sidebar-user-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(212,175,55,0.2); color: ${THEME.accent}; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 14px; flex-shrink: 0; }
        .sidebar-user-name { color: #fff; font-weight: 600; font-size: 13px; }
        .sidebar-user-role { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 2px; }
        .dashboard-main { margin-left: 268px; flex: 1; padding: 40px 48px; min-height: 100vh; }
        .dashboard-header { margin-bottom: 32px; }
        .dashboard-header h1 { font-family: 'Montserrat', sans-serif; font-size: 30px; font-weight: 800; color: ${THEME.primary}; }
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card { background: #fff; border-radius: 14px; border: 1px solid ${THEME.border}; padding: 20px 24px; display: flex; align-items: center; gap: 16px; }
        .stat-icon { font-size: 28px; }
        .stat-value { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; color: ${THEME.primary}; line-height: 1; }
        .stat-label { font-size: 12px; color: ${THEME.textLight}; margin-top: 4px; }
        .dashboard-section { background: #fff; border-radius: 16px; border: 1px solid ${THEME.border}; padding: 28px 32px; margin-bottom: 28px; }
        .section-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .section-title { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: ${THEME.primary}; }
        .add-btn { padding: 9px 18px; border-radius: 8px; border: none; background: ${THEME.primary}; color: ${THEME.accent}; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; letter-spacing: 0.5px; transition: opacity 0.2s; }
        .add-btn:hover { opacity: 0.85; }

        /* Calendar */
        .week-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .week-day { background: ${THEME.bg}; border-radius: 12px; border: 1px solid ${THEME.border}; padding: 12px 10px; min-height: 110px; }
        .week-day.today { border-color: ${THEME.accent}; background: rgba(212,175,55,0.04); }
        .week-day-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; gap: 4px; }
        .day-name { font-size: 11px; font-weight: 700; color: ${THEME.textLight}; text-transform: uppercase; letter-spacing: 0.5px; }
        .day-date { font-size: 18px; font-weight: 800; color: ${THEME.primary}; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .day-date.today-dot { background: ${THEME.accent}; color: ${THEME.primary}; }
        .day-lessons { display: flex; flex-direction: column; gap: 6px; }
        .lesson-block { background: ${THEME.primary}; border-radius: 8px; padding: 7px 9px; position: relative; }
        .lesson-time { display: block; font-size: 11px; color: ${THEME.accent}; font-weight: 700; }
        .lesson-subject { display: block; font-size: 12px; color: #fff; font-weight: 600; margin-top: 2px; word-break: break-word; }
        .lesson-duration { display: block; font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 2px; }
        .no-lessons { color: ${THEME.border}; font-size: 20px; text-align: center; padding-top: 8px; }
        .del-btn { position: absolute; top: 4px; right: 4px; background: transparent; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
        .del-btn:hover { color: ${THEME.error}; }

        /* Homework */
        .homework-list { display: flex; flex-direction: column; gap: 12px; }
        .hw-card { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: ${THEME.bg}; border-radius: 12px; border: 1px solid ${THEME.border}; border-left: 4px solid ${THEME.primary}; gap: 16px; }
        .hw-card.overdue { border-left-color: ${THEME.error}; }
        .hw-card-left { flex: 1; }
        .hw-title { font-size: 15px; font-weight: 700; color: ${THEME.primary}; margin-bottom: 4px; }
        .hw-desc { font-size: 13px; color: ${THEME.textLight}; line-height: 1.5; }
        .hw-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .due-badge { padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700; background: rgba(15,23,42,0.07); color: ${THEME.primary}; white-space: nowrap; }
        .due-badge.overdue { background: rgba(239,68,68,0.1); color: ${THEME.error}; }
        .due-badge.soon { background: rgba(245,158,11,0.12); color: #b45309; }
        .del-btn-hw { background: transparent; border: none; color: ${THEME.textLight}; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 4px; transition: color 0.2s; }
        .del-btn-hw:hover { color: ${THEME.error}; }
        .empty-state { text-align: center; color: ${THEME.textLight}; padding: 40px 20px; font-size: 15px; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal-card { background: #fff; border-radius: 16px; padding: 32px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 60px rgba(0,0,0,0.2); }
        .modal-title { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 20px; color: ${THEME.primary}; margin-bottom: 24px; }

        /* Profile */
        .profile-card { display: flex; align-items: flex-start; gap: 28px; padding: 28px; background: ${THEME.bg}; border-radius: 14px; border: 1px solid ${THEME.border}; margin-bottom: 24px; }
        .profile-avatar { width: 80px; height: 80px; border-radius: 50%; background: ${THEME.primary}; color: ${THEME.accent}; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 28px; flex-shrink: 0; }
        .profile-info { flex: 1; }
        .profile-name { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; color: ${THEME.primary}; margin-bottom: 6px; }
        .profile-phone { color: ${THEME.textLight}; font-size: 14px; margin-bottom: 10px; }
        .profile-goal-tag { display: inline-block; background: rgba(212,175,55,0.15); color: #92680e; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 99px; margin-bottom: 6px; }
        .profile-detail { font-size: 15px; font-weight: 600; color: ${THEME.text}; margin-bottom: 8px; }
        .profile-date { font-size: 12px; color: ${THEME.textLight}; }
        .profile-actions { display: flex; gap: 16px; flex-wrap: wrap; }

        /* Mobile */
        .mobile-topbar { display: none; align-items: center; justify-content: space-between; padding: 16px 20px; background: #fff; border-bottom: 1px solid ${THEME.border}; margin-bottom: 24px; }
        .burger-btn { background: transparent; border: none; font-size: 24px; cursor: pointer; color: ${THEME.primary}; padding: 4px 8px; }
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 19; }

        /* Animations */
        .scale-in { animation: scale-in 0.3s ease forwards; }
        @keyframes scale-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }

        /* Responsive */
        @media (max-width: 1100px) {
          .stats-row { grid-template-columns: repeat(3, 1fr); }
          .dashboard-main { padding: 32px 28px; }
        }
        @media (max-width: 900px) {
          .split-layout { flex-direction: column; }
          .split-left, .split-right { padding: 40px 20px; }
          .form-row { flex-direction: column; gap: 0; }
          .dashboard-sidebar { transform: translateX(-100%); }
          .dashboard-sidebar.open { transform: translateX(0); }
          .sidebar-overlay { display: block; }
          .dashboard-main { margin-left: 0; padding: 0 16px 40px; }
          .mobile-topbar { display: flex; }
          .stats-row { grid-template-columns: 1fr 1fr; }
          .week-calendar { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 600px) {
          .stats-row { grid-template-columns: 1fr; }
          .week-calendar { grid-template-columns: repeat(2, 1fr); }
          .hw-card { flex-direction: column; align-items: flex-start; }
          .dashboard-section { padding: 20px 16px; }
        }
      `}</style>

      {screen === "auth" && <AuthScreen onRegister={handleRegister} />}

      {screen === "dashboard" && (
        <DashboardScreen
          user={user}
          onStartDiagnostics={startDiagnostics}
          onViewPlan={viewPlan}
        />
      )}

      {screen === "question" && (
        <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex + 1} total={QUESTIONS.length} onComplete={handleAnswer} />
      )}

      {screen === "upload" && <UploadScreen onAnalyze={handleAnalyze} />}

      {screen === "analyzing" && (
        <div style={{ minHeight: "80vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", color: THEME.primary }}>Анализ данных...</h2>
        </div>
      )}

      {screen === "report" && report && (
        <>
          <nav style={{ background: THEME.surface, borderBottom: `1px solid ${THEME.border}`, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo size={32} />
            <button onClick={goToDashboard} className="cta-button active" style={{ width: "auto", padding: "10px 20px" }}>← Главная</button>
          </nav>
          <ReportScreen report={report} user={user} onViewPlan={viewPlan} onBack={goToDashboard} />
        </>
      )}

      {screen === "rpgmap" && (
        <>
          <nav style={{ background: THEME.surface, borderBottom: `1px solid ${THEME.border}`, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo size={32} />
            <button onClick={goToDashboard} className="cta-button active" style={{ width: "auto", padding: "10px 20px" }}>← Главная</button>
          </nav>
          <PathMap user={user} onBack={goToDashboard} />
        </>
      )}
    </>
  );
}
