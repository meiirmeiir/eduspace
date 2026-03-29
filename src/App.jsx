import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

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

const THEME = { primary: "#0A192F", accent: "#FBBF24", bg: "#F8FAFC", surface: "#FFFFFF", text: "#1E293B", textLight: "#64748B", border: "#E2E8F0", success: "#10B981", warning: "#F59E0B", error: "#EF4444" };

// ── COMPONENTS ────────────────────────────────────────────────────────────────
const Logo = ({ size = 48 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
      <img src="/logo.jpg" alt="AAPA Logo" style={{ width: '120%', height: '120%', objectFit: 'cover', mixBlendMode: 'multiply' }} />
    </div>
    <div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: size * 0.6, color: THEME.primary, lineHeight: 1, letterSpacing: "1px" }}>AAPA</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: size * 0.25, color: THEME.accent, letterSpacing: "1.5px", marginTop: 4, textTransform: "uppercase" }}>Ad Astra Per Aspera</div>
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

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
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
    if (cleanPhone.length < 11) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", cleanPhone);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) onRegister(userSnap.data());
      else setStep(2);
    } catch (error) {
      console.error(error);
      alert("Ошибка доступа. Проверьте интернет.");
    }
    setLoading(false);
  };

  const registerNewUser = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !mainGoal || !specificGoal) return;
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      const userData = { 
        firstName, lastName, phone: cleanPhone, 
        goal: REG_GOALS[mainGoal], details: specificGoal, 
        progress: [], // Array to store answers
        lastQuestionIndex: 0,
        registeredAt: new Date().toISOString() 
      };
      await setDoc(doc(db, "users", cleanPhone), userData);
      onRegister(userData);
    } catch (error) {
      console.error(error);
      alert("Ошибка регистрации.");
    }
    setLoading(false);
  };

  return (
    <div className="split-layout">
      <div className="split-left">
        <div style={{ marginBottom: "60px" }}><Logo size={60} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 className="hero-title">Построй свой путь к <span style={{color: THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">Пройди независимую диагностику компетенций. Система <b>AAPA</b> построит точный маршрут подготовки.</p>
        </div>
      </div>
      <div className="split-right">
        <div className="form-card">
          <div className="form-header">
            <h2>{step === 1 ? "Вход" : "Регистрация"}</h2>
            <p>{step === 1 ? "Введите номер для входа" : "Заполните профиль"}</p>
          </div>
          <form onSubmit={step === 1 ? checkUserInDB : registerNewUser}>
            <div className="input-group">
              <label className="input-label">Номер WhatsApp</label>
              <input type="tel" className="input-field" value={phone} onChange={handlePhoneChange} disabled={step === 2 || loading} placeholder="+7 700 000 00 00" required />
            </div>
            {step === 2 && (
              <div className="scale-in">
                <div className="form-row">
                  <div className="input-group"><label className="input-label">Имя</label><input type="text" className="input-field" value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
                  <div className="input-group"><label className="input-label">Фамилия</label><input type="text" className="input-field" value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
                </div>
                <div className="input-group">
                  <label className="input-label">Цель обучения</label>
                  <select className="input-field" value={mainGoal} onChange={e => { setMainGoal(e.target.value); setSpecificGoal(""); }} required>
                    <option value="" disabled>Выберите...</option>
                    {Object.entries(REG_GOALS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                  </select>
                </div>
                {mainGoal && (
                  <div className="input-group scale-in">
                    <label className="input-label">{mainGoal === 'exam' ? 'Экзамен' : 'Класс'}</label>
                    <select className="input-field" value={specificGoal} onChange={e => setSpecificGoal(e.target.value)} required>
                      <option value="" disabled>Укажите...</option>
                      {(mainGoal === 'exam' ? EXAMS_LIST : GRADES_LIST).map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <button type="submit" className={`cta-button ${phone.length >= 12 ? 'active' : ''}`} disabled={loading}>
              {loading ? "..." : (step === 1 ? "Далее" : "Начать")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── QUESTION SCREEN ───────────────────────────────────────────────────────────
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

  return (
    <div className="question-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <Logo size={36} />
        <Timer seconds={elapsed} />
      </div>
      <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${(qNum / total) * 100}%` }} /></div>
      <div className="question-meta"><span className="badge">{question.section}</span><span className="step-text">Вопрос {qNum} из {total}</span></div>
      <h2 className="question-text">{question.text}</h2>
      <div className="options-grid">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === question.correct;
          let stateClass = isRevealed ? (isCorrect ? "correct" : isSelected ? "wrong" : "disabled") : (isSelected ? "selected" : "");
          return (
            <div key={i} className={`option-card ${stateClass}`} onClick={() => !isRevealed && setSelected(i)}>
              <div className="option-letter">{String.fromCharCode(65 + i)}</div>
              <div className="option-content">{opt}</div>
            </div>
          );
        })}
      </div>
      {selected !== null && (
        <div className="confidence-section scale-in">
          <h4>Уверенность в ответе:</h4>
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
      <button className={`cta-button ${isRevealed ? 'active' : ''}`} disabled={!isRevealed} 
        onClick={() => onComplete({ 
          questionId: question.id, topic: question.topic, section: question.section, 
          selectedAnswer: selected, correct: selected === question.correct, 
          confidence: confidence?.v, timeSpent: elapsed 
        })}>
        {qNum < total ? "Следующий вопрос" : "Завершить"}
      </button>
    </div>
  );
}

// ── UPLOAD, REPORT, MAP (Simplified) ──────────────────────────────────────────
function UploadScreen({ onAnalyze }) {
  return (
    <div style={{ maxWidth: 600, margin: "100px auto", padding: "0 20px" }}>
      <div className="form-card" style={{ maxWidth: '100%', textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 26, color: THEME.primary }}>Черновики</h2>
        <p style={{ color: THEME.textLight, margin: "16px 0 32px" }}>Загрузите фото решений для глубокого анализа.</p>
        <button onClick={() => onAnalyze()} className="cta-button active">Получить отчет →</button>
      </div>
    </div>
  );
}

function ReportScreen({ report, user, onViewPlan }) {
  const { answers } = report;
  const correct = answers.filter(a => a.correct).length;
  const score = Math.round((correct / answers.length) * 100);
  return (
    <div className="report-container">
      <div className="report-header-card">
        <h1>Результат: {score}%</h1>
        <p>{user?.firstName}, ваш трек готов.</p>
      </div>
      <button onClick={onViewPlan} className="cta-button active">Открыть Трек Развития</button>
    </div>
  );
}

function PathMap({ user, answers }) {
  return (
    <div className="path-container">
      <div className="path-header"><h1>Трек {user?.firstName}</h1></div>
      <div className="path-visualization-modern">
         <svg width="100%" height="450" viewBox="0 0 920 450">
            {RPG_NODES.map(node => (
              <circle key={node.id} cx={node.x} cy={node.y} r="20" fill={THEME.accent} />
            ))}
         </svg>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth"); 
  const [user, setUser] = useState(null); 
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [report, setReport] = useState(null);

  const handleRegister = (userData) => {
    setUser(userData);
    // If returning user has progress, restore it
    if (userData.progress && userData.progress.length > 0) {
      setAnswers(userData.progress);
      setQIndex(userData.lastQuestionIndex || 0);
      if (userData.lastQuestionIndex >= QUESTIONS.length) setScreen("report");
      else setScreen("question");
    } else {
      setScreen("intro");
    }
  };

  const handleAnswer = async (data) => {
    const nextAnswers = [...answers, data];
    setAnswers(nextAnswers);
    
    // Save progress to Firebase
    if (user?.phone) {
      const userRef = doc(db, "users", user.phone);
      await updateDoc(userRef, {
        progress: nextAnswers,
        lastQuestionIndex: qIndex + 1
      });
    }

    if (qIndex + 1 < QUESTIONS.length) setQIndex(qIndex + 1);
    else setScreen("upload");
  };

  const handleAnalyze = () => {
    setScreen("analyzing");
    setTimeout(() => { setReport({ answers }); setScreen("report"); }, 2000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&family=Sora:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; font-family: 'Inter', sans-serif; color: #0f172a; }
        .split-layout { display: flex; min-height: 100vh; }
        .split-left { flex: 1.1; background: #fff; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid #e2e8f0; }
        .split-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 60px; background: #f8fafc; }
        .hero-title { font-family: 'Sora', sans-serif; font-size: 40px; font-weight: 800; color: #0A192F; line-height: 1.2; }
        .input-field { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 16px; font-size: 15px; }
        .cta-button { width: 100%; padding: 16px; border-radius: 10px; border: none; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: 0.3s; }
        .cta-button.active { background: #0A192F; color: #FBBF24; }
        .question-container { max-width: 800px; margin: 40px auto; padding: 20px; }
        .option-card { padding: 18px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; cursor: pointer; display: flex; align-items: center; background: #fff; font-weight: 600; }
        .option-card.selected { border-color: #0A192F; background: #f1f5f9; }
        .option-card.correct { border-color: #10B981; background: #ecfdf5; }
        .option-card.wrong { border-color: #EF4444; background: #fef2f2; }
        .progress-bar-container { width: 100%; height: 6px; background: #e2e8f0; border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: #0A192F; transition: 0.4s; }
        .confidence-grid { display: flex; gap: 8px; margin-top: 10px; }
        .conf-btn { flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 12px; font-weight: 600; }
        .path-visualization-modern { background: #0A192F; border-radius: 20px; padding: 40px; }
        @media (max-width: 800px) { .split-layout { flex-direction: column; } .split-left, .split-right { padding: 30px 20px; } }
      `}</style>

      {screen !== "auth" && (
        <nav style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={AAPA_LOGO_BASE64} style={{ height: 32 }} alt="logo" />
            <span style={{ fontWeight: 800, color: '#0A192F' }}>AAPA</span>
          </div>
          {["report", "rpgmap"].includes(screen) && (
             <button onClick={() => setScreen("report")} style={{ background: '#0A192F', color: '#FBBF24', padding: '6px 15px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12 }}>ОТЧЕТ</button>
          )}
        </nav>
      )}

      {screen === "auth" && <AuthScreen onRegister={handleRegister} />}
      {screen === "intro" && <IntroScreen user={user} onStart={() => setScreen("question")} />}
      {screen === "question" && <QuestionScreen question={QUESTIONS[qIndex]} qNum={qIndex+1} total={QUESTIONS.length} onComplete={handleAnswer} />}
      {screen === "upload" && <UploadScreen onAnalyze={handleAnalyze} />}
      {screen === "report" && report && <ReportScreen report={report} user={user} onViewPlan={() => setScreen("rpgmap")} />}
      {screen === "rpgmap" && <RPGMap user={user} answers={report?.answers || answers} />}
    </>
  );
}
