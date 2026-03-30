import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, addDoc, deleteDoc
} from "firebase/firestore";

// ── FIREBASE ──────────────────────────────────────────────────────────────────
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

// ── КОНСТАНТЫ ─────────────────────────────────────────────────────────────────
const FALLBACK_QUESTIONS = [
  { id: 1, sectionName: "Алгебра", topic: "Линейные уравнения", text: "Решите уравнение: 3x + 7 = 22", options: ["x = 5", "x = 3", "x = 7", "x = 4"], correct: 0, goals: ["exam", "gaps", "future"] },
  { id: 2, sectionName: "Геометрия", topic: "Площадь треугольника", text: "Основание треугольника 8 см, высота 5 см. Найдите площадь.", options: ["20 см²", "40 см²", "13 см²", "16 см²"], correct: 0, goals: ["exam", "gaps", "future"] },
  { id: 3, sectionName: "Алгебра", topic: "Степени", text: "Вычислите: 2⁵ + 3² = ?", options: ["41", "32", "27", "39"], correct: 0, goals: ["exam", "gaps", "future"] },
  { id: 4, sectionName: "Вероятность", topic: "Классическая вероятность", text: "В урне 3 красных и 7 синих шаров. Вероятность вытащить красный:", options: ["0.3", "0.7", "0.5", "0.03"], correct: 0, goals: ["exam", "gaps", "future"] },
  { id: 5, sectionName: "Геометрия", topic: "Теорема Пифагора", text: "Катеты прямоугольного треугольника: 6 см и 8 см. Найдите гипотенузу.", options: ["10 см", "12 см", "7 см", "14 см"], correct: 0, goals: ["exam", "gaps", "future"] }
];
const CONFIDENCE_LEVELS = [
  { v: 1, label: "Сомневаюсь", color: "#EF4444" }, { v: 2, label: "Не уверен", color: "#F59E0B" },
  { v: 3, label: "Нейтрально", color: "#94A3B8" }, { v: 4, label: "Уверен", color: "#10B981" },
  { v: 5, label: "Абсолютно уверен", color: "#059669" }
];
const RPG_NODES = [
  { id: 1, name: "Уравнения", x: 100, y: 350 }, { id: 2, name: "Степени", x: 250, y: 250 },
  { id: 3, name: "Рубеж: Алгебра", x: 400, y: 150, type: "boss" }, { id: 4, name: "Площадь", x: 550, y: 250 },
  { id: 5, name: "Пифагор", x: 700, y: 350 }, { id: 6, name: "Рубеж: Геометрия", x: 850, y: 250, type: "boss" },
  { id: 7, name: "Вероятность", x: 700, y: 100 }, { id: 8, name: "Цель: ЕНТ", x: 850, y: 50, type: "boss" }
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];
const REG_GOALS = { exam: "Подготовка к экзамену", gaps: "Закрытие пробелов", future: "Подготовка к следующему классу" };
const EXAMS_LIST = ["ЕНТ", "SAT", "NUET", "Further Pure Math", "IGCSE"];
const GRADES_LIST = ["5 класс","6 класс","7 класс","8 класс","9 класс","10 класс","11 класс","12 класс"];
const STUDENT_STATUSES = [
  { value: "active",    label: "Активный",        color: "#10B981" },
  { value: "trial",     label: "Пробный",          color: "#F59E0B" },
  { value: "inactive",  label: "Неактивный",       color: "#94A3B8" },
  { value: "paused",    label: "Приостановлен",    color: "#EF4444" },
  { value: "graduated", label: "Выпускник",        color: "#6366F1" },
];
const DAY_NAMES_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DAY_NAMES_FULL  = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const THEME = { primary:"#0f172a", accent:"#d4af37", bg:"#f8fafc", surface:"#ffffff", text:"#334155", textLight:"#64748b", border:"#e2e8f0", success:"#10B981", warning:"#F59E0B", error:"#EF4444" };

// ── ЛОГОТИПЫ ──────────────────────────────────────────────────────────────────
const LogoSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#0A2463"/>
    <path d="M45 35 L85 15 L78 28 L95 35 L78 40 L85 55 L65 40 Z" fill="#FBBF24"/>
    <path d="M50 75 Q 35 60 15 65 L15 75 Q 35 70 50 85 Q 65 70 85 75 L85 65 Q 65 60 50 75 Z" fill="#E2E8F0"/>
    <path d="M50 65 Q 35 50 15 55 L15 65 Q 35 60 50 75 Q 65 60 85 65 L85 55 Q 65 50 50 65 Z" fill="#FFFFFF"/>
    <path d="M50 30 L15 45 L50 60 L85 45 Z" fill="#1E3A8A"/>
    <path d="M50 35 L22 47 L50 55 L78 47 Z" fill="#2563EB"/>
    <path d="M50 45 L70 50 L72 65" stroke="#FBBF24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <circle cx="72" cy="68" r="3.5" fill="#FBBF24"/>
  </svg>
);
const Logo = ({ size = 48, light = false }) => (
  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
    <div style={{ width:size, height:size, flexShrink:0 }}><LogoSVG /></div>
    <div>
      <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:size*0.6, color: light?"#fff":THEME.primary, lineHeight:1, letterSpacing:"1px" }}>AAPA</div>
      <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:Math.max(size*0.2,9), color:THEME.accent, letterSpacing:"1px", marginTop:4, textTransform:"uppercase" }}>Ad Astra Per Aspera</div>
    </div>
  </div>
);

function Timer({ seconds }) {
  const mins = Math.floor(seconds/60), secs = seconds%60;
  return <div className="modern-timer"><div className="pulse-dot"/><span>{mins>0?`${mins}:${String(secs).padStart(2,"0")}`:` 0:${String(secs).padStart(2,"0")}`}</span></div>;
}

// ── АВТОРИЗАЦИЯ ───────────────────────────────────────────────────────────────
function AuthScreen({ onRegister }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("+7 ");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [specificGoal, setSpecificGoal] = useState("");

  const handlePhoneChange = (e) => {
    let v = e.target.value;
    if (v.length < 3 || !v.startsWith("+7 ")) v = "+7 ";
    setPhone(v);
  };

  const checkUser = async (e) => {
    e.preventDefault();
    const cp = phone.replace(/\s+/g,"");
    if (cp.length < 11) { alert("Введите корректный номер."); return; }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db,"users",cp));
      if (snap.exists()) onRegister(snap.data());
      else setStep(2);
    } catch { alert("Ошибка соединения с базой данных."); }
    setLoading(false);
  };

  const registerUser = async (e) => {
    e.preventDefault();
    if (!firstName||!lastName||!mainGoal||!specificGoal) return;
    setLoading(true);
    try {
      const cp = phone.replace(/\s+/g,"");
      const data = { firstName, lastName, phone:cp, goalKey:mainGoal, goal:REG_GOALS[mainGoal], details:specificGoal, registeredAt:new Date().toISOString(), status:"trial" };
      await setDoc(doc(db,"users",cp), data);
      onRegister(data);
    } catch { alert("Ошибка при сохранении."); }
    setLoading(false);
  };

  const phoneOk = phone.replace(/\s+/g,"").length >= 11;

  return (
    <div className="split-layout">
      <div className="split-left">
        <div style={{marginBottom:60}}><Logo size={60}/></div>
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <h1 className="hero-title">Построй свой путь к <span style={{color:THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">Пройди независимую диагностику компетенций. Система <b>AAPA</b> выявит скрытые пробелы и построит точный маршрут подготовки.</p>
          <div className="benefits-list">
            <div className="benefit-item"><span className="icon">🎯</span><div><strong>Когнитивная диагностика</strong><p>Анализируем не только верные ответы, но и вашу уверенность в них.</p></div></div>
            <div className="benefit-item"><span className="icon">🗺️</span><div><strong>Индивидуальный трек</strong><p>Вы получаете пошаговую Карту Навыков для достижения вашей цели.</p></div></div>
          </div>
        </div>
        <div className="trust-badge"><span style={{color:THEME.accent,letterSpacing:"2px",fontSize:18}}>★★★★★</span><span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>Нам доверяют подготовку к будущему</span></div>
      </div>
      <div className="split-right">
        <div className="form-card">
          <div className="form-header">
            <h2>{step===1?"Войти в систему":"Создать профиль"}</h2>
            <p>{step===1?"Введите номер WhatsApp для входа.":"Мы вас не нашли. Давайте познакомимся!"}</p>
          </div>
          <form onSubmit={step===1?checkUser:registerUser}>
            <div className="input-group">
              <label className="input-label">Номер WhatsApp</label>
              <input type="tel" className="input-field" value={phone} onChange={handlePhoneChange} disabled={step===2||loading} placeholder="+7 700 000 00 00" required/>
            </div>
            {step===2 && (
              <div className="scale-in">
                <div className="form-row">
                  <div className="input-group" style={{marginBottom:0}}><label className="input-label">Имя</label><input type="text" className="input-field" value={firstName} onChange={e=>setFirstName(e.target.value)} required/></div>
                  <div className="input-group" style={{marginBottom:0}}><label className="input-label">Фамилия</label><input type="text" className="input-field" value={lastName} onChange={e=>setLastName(e.target.value)} required/></div>
                </div>
                <div className="input-group" style={{marginTop:20}}>
                  <label className="input-label">Цель обучения</label>
                  <select className="input-field" value={mainGoal} onChange={e=>{setMainGoal(e.target.value);setSpecificGoal("");}} required>
                    <option value="" disabled>Выберите...</option>
                    {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {mainGoal==="exam" && <div className="input-group scale-in"><label className="input-label">Какой экзамен?</label><select className="input-field" value={specificGoal} onChange={e=>setSpecificGoal(e.target.value)} required><option value="" disabled>Выберите...</option>{EXAMS_LIST.map(x=><option key={x} value={x}>{x}</option>)}</select></div>}
                {(mainGoal==="gaps"||mainGoal==="future") && <div className="input-group scale-in"><label className="input-label">Класс</label><select className="input-field" value={specificGoal} onChange={e=>setSpecificGoal(e.target.value)} required><option value="" disabled>Выберите...</option>{GRADES_LIST.map(x=><option key={x} value={x}>{x}</option>)}</select></div>}
              </div>
            )}
            <button type="submit" className={`cta-button ${phoneOk?"active":""}`} disabled={loading||!phoneOk}>
              {loading?"Загрузка...":(step===1?"Войти →":"Создать аккаунт →")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── ВОПРОС ────────────────────────────────────────────────────────────────────
function QuestionScreen({ question, qNum, total, onComplete }) {
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState(null);
  const [confidence, setConfidence] = useState(null);
  useEffect(()=>{setElapsed(0);setSelected(null);setConfidence(null);},[question.id||question.text]);
  const isRevealed = selected!==null && confidence!==null;
  useEffect(()=>{
    if (isRevealed) return;
    const t = setInterval(()=>setElapsed(s=>s+1),1000);
    return ()=>clearInterval(t);
  },[isRevealed]);
  const handleNext = ()=>onComplete({ questionId:question.id||qNum, topic:question.topic, section:question.sectionName||question.section, selectedAnswer:selected, correct:selected===question.correct, confidence:confidence?.v, timeSpent:elapsed });
  return (
    <div className="question-container">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32}}><Logo size={36}/><Timer seconds={elapsed}/></div>
      <div className="progress-bar-container"><div className="progress-bar-fill" style={{width:`${(qNum/total)*100}%`}}/></div>
      <div className="question-meta"><span className="badge">{question.sectionName||question.section}</span><span>Вопрос {qNum} из {total}</span></div>
      <h2 className="question-text">{question.text}</h2>
      <div className="options-grid">
        {question.options.map((opt,i)=>{
          const isSelected=selected===i, isCorrect=i===question.correct;
          let cls="";
          if(isRevealed){ if(isCorrect) cls="correct"; else if(isSelected) cls="wrong"; else cls="disabled"; }
          else { if(isSelected) cls="selected"; else if(selected!==null) cls="disabled"; }
          return (
            <div key={i} className={`option-card ${cls}`} onClick={()=>!isRevealed&&setSelected(i)}>
              <div className="option-letter">{String.fromCharCode(65+i)}</div>
              <div className="option-content">{opt}</div>
              {isRevealed&&isCorrect&&<div className="icon-status">✅</div>}
              {isRevealed&&isSelected&&!isCorrect&&<div className="icon-status">❌</div>}
            </div>
          );
        })}
      </div>
      {selected!==null&&(
        <div className="confidence-section scale-in">
          <h4>Насколько вы уверены в ответе?</h4>
          <div className="confidence-grid">
            {CONFIDENCE_LEVELS.map(c=>(
              <button key={c.v} className={`conf-btn ${confidence?.v===c.v?"active":""}`}
                style={confidence?.v===c.v?{borderColor:c.color,background:c.color+"10",color:c.color}:{}}
                onClick={()=>!isRevealed&&setConfidence(c)}>{c.label}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{marginTop:40}}>
        <button className={`cta-button ${isRevealed?"active":""}`} disabled={!isRevealed} onClick={handleNext}>
          {qNum<total?"Следующий вопрос":"Завершить аудит"}
        </button>
      </div>
    </div>
  );
}

// ── ОТЧЁТ ─────────────────────────────────────────────────────────────────────
function ReportScreen({ report, user, onViewPlan, onBack }) {
  const { answers } = report;
  const correct = answers.filter(a=>a.correct).length;
  const score = Math.round((correct/answers.length)*100);
  const skills = answers.map(a=>{
    let zone="green",statusText="Твердый навык",priority=3;
    if(!a.correct){zone="red";statusText="Пробел";priority=1;}
    else if(a.confidence<=2){zone="yellow";statusText="Хрупкое знание";priority=2;}
    if(!a.correct&&a.confidence>=4) statusText="⚠️ Иллюзия знаний";
    return {...a,zone,statusText,priority};
  }).sort((a,b)=>a.priority-b.priority);
  return (
    <div className="report-container">
      <div className="report-header-card">
        <div className="report-hero-compact">
          <div className="score-badge" style={{backgroundColor:score>=80?THEME.success:score>=60?THEME.warning:THEME.error}}>{score}%</div>
          <div><h1>Аудит компетенций завершен</h1><p>{user?.firstName} {user?.lastName} • {user?.details}</p></div>
        </div>
      </div>
      <div className="results-list-modern">
        <h3 style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:800,color:THEME.primary,marginBottom:24}}>Карта навыков</h3>
        {skills.map((a,i)=>(
          <div key={i} className={`result-card-modern ${a.zone}`}>
            <div className="card-main">
              <div><span className="section-badge">{a.section}</span><span className="topic-name">{a.topic}</span></div>
              <div className="status-info"><span className="status-text">{a.statusText}</span><span className="meta-text">{a.timeSpent}с • Уверенность: {a.confidence}/5</span></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:16,marginTop:40,flexWrap:"wrap"}}>
        <button onClick={onBack} className="cta-button active" style={{background:"#fff",color:THEME.primary,border:`1px solid ${THEME.border}`,boxShadow:"none"}}>← Главная</button>
        <button onClick={onViewPlan} className="cta-button active">Открыть Трек Развития →</button>
      </div>
    </div>
  );
}

function PathMap({ user, onBack }) {
  return (
    <div className="path-container">
      <div className="path-header"><h1>Образовательный трек {user?.firstName}</h1></div>
      <div className="path-visualization-modern">
        <svg width="100%" height={450} viewBox="0 0 920 450" preserveAspectRatio="xMidYMid meet">
          {RPG_PATHS.map(([a,b])=>{ const na=RPG_NODES.find(n=>n.id===a),nb=RPG_NODES.find(n=>n.id===b); return <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={THEME.accent} strokeWidth={1} opacity={0.4}/>; })}
          {RPG_NODES.map(node=>{ const boss=node.type==="boss"; return (<g key={node.id} transform={`translate(${node.x},${node.y})`}><circle r={boss?24:16} fill={THEME.primary} stroke={THEME.accent} strokeWidth={boss?3:2}/><text y={40} textAnchor="middle" fontSize={12} fontWeight={600} fill="#cbd5e1" fontFamily="Inter">{node.name}</text></g>); })}
        </svg>
      </div>
      <div style={{textAlign:"center",marginTop:32}}><button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"12px 28px"}}>← Вернуться</button></div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function AdminScreen({ user, onBack }) {
  const [tab, setTab] = useState("sections");
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Section form
  const [secForm, setSecForm] = useState({ name:"", goals:[] });
  const [showSecForm, setShowSecForm] = useState(false);

  // Question form
  const [qForm, setQForm] = useState({ sectionId:"", sectionName:"", topic:"", text:"", options:["","","",""], correct:0, goals:[] });
  const [showQForm, setShowQForm] = useState(false);
  const [filterSec, setFilterSec] = useState("all");
  const [filterGoal, setFilterGoal] = useState("all");

  useEffect(()=>{
    const load = async ()=>{
      try {
        const [secSnap,qSnap,stuSnap] = await Promise.all([
          getDocs(collection(db,"sections")),
          getDocs(collection(db,"questions")),
          getDocs(collection(db,"users"))
        ]);
        setSections(secSnap.docs.map(d=>({id:d.id,...d.data()})));
        setQuestions(qSnap.docs.map(d=>({id:d.id,...d.data()})));
        setStudents(stuSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.lastName?.localeCompare(b.lastName)||0));
      } catch(e){ console.error(e); }
      setLoading(false);
    };
    load();
  },[]);

  // ─ Sections ─
  const toggleGoal = (arr,setFn,val) => setFn(p=>({ ...p, goals: p.goals.includes(val)?p.goals.filter(g=>g!==val):[...p.goals,val] }));

  const addSection = async (e)=>{
    e.preventDefault();
    if(!secForm.name.trim()) return;
    try {
      const data = { name:secForm.name.trim(), goals:secForm.goals, createdAt:new Date().toISOString() };
      const ref = await addDoc(collection(db,"sections"),data);
      setSections(p=>[...p,{id:ref.id,...data}]);
      setSecForm({name:"",goals:[]});
      setShowSecForm(false);
    } catch{ alert("Ошибка при добавлении."); }
  };

  const deleteSection = async (id)=>{
    if(!confirm("Удалить раздел? Вопросы этого раздела останутся.")) return;
    try { await deleteDoc(doc(db,"sections",id)); setSections(p=>p.filter(s=>s.id!==id)); }
    catch{ alert("Ошибка."); }
  };

  // ─ Questions ─
  const addQuestion = async (e)=>{
    e.preventDefault();
    const opts = qForm.options.map(o=>o.trim());
    if(!qForm.sectionId||!qForm.topic.trim()||!qForm.text.trim()||opts.some(o=>!o)||!qForm.goals.length){ alert("Заполните все поля и выберите хотя бы одну цель."); return; }
    try {
      const data = { ...qForm, options:opts, createdAt:new Date().toISOString() };
      const ref = await addDoc(collection(db,"questions"),data);
      setQuestions(p=>[...p,{id:ref.id,...data}]);
      setQForm({sectionId:"",sectionName:"",topic:"",text:"",options:["","","",""],correct:0,goals:[]});
      setShowQForm(false);
    } catch{ alert("Ошибка при добавлении."); }
  };

  const deleteQuestion = async (id)=>{
    if(!confirm("Удалить вопрос?")) return;
    try { await deleteDoc(doc(db,"questions",id)); setQuestions(p=>p.filter(q=>q.id!==id)); }
    catch{ alert("Ошибка."); }
  };

  const filteredQuestions = questions.filter(q=>{
    const secOk = filterSec==="all"||q.sectionId===filterSec;
    const goalOk = filterGoal==="all"||(q.goals||[]).includes(filterGoal);
    return secOk&&goalOk;
  });

  // ─ Students ─
  const updateStatus = async (phone, status)=>{
    try {
      await updateDoc(doc(db,"users",phone),{ status });
      setStudents(p=>p.map(s=>s.id===phone?{...s,status}:s));
    } catch{ alert("Ошибка."); }
  };

  const tabs = [
    { id:"sections", label:"📂 Разделы диагностики" },
    { id:"questions", label:"❓ Вопросы" },
    { id:"students", label:"👥 Ученики" },
  ];

  return (
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      {/* Header */}
      <div style={{background:THEME.primary,padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <Logo size={32} light/>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <span style={{color:THEME.accent,fontWeight:700,fontSize:13,background:"rgba(212,175,55,0.15)",padding:"4px 12px",borderRadius:99}}>Администратор</span>
          <button onClick={onBack} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif"}}>← Выйти из панели</button>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"36px 24px"}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,color:THEME.primary,marginBottom:8}}>Панель администратора</h1>
        <p style={{color:THEME.textLight,marginBottom:32}}>Управление диагностикой, вопросами и учениками</p>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:12,padding:6,marginBottom:32,width:"fit-content"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 20px",borderRadius:8,border:"none",background:tab===t.id?THEME.primary:"transparent",color:tab===t.id?"#fff":THEME.textLight,fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s"}}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загрузка данных...</div>}

        {/* ── SECTIONS ── */}
        {!loading && tab==="sections" && (
          <div>
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Разделы диагностики</h2>
                <p style={{color:THEME.textLight,fontSize:14}}>Разделы — это категории, по которым группируются вопросы теста</p>
              </div>
              <button className="add-btn" onClick={()=>setShowSecForm(true)}>+ Добавить раздел</button>
            </div>

            {showSecForm && (
              <div className="admin-form-card">
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>Новый раздел</h3>
                <form onSubmit={addSection}>
                  <div className="input-group">
                    <label className="input-label">Название раздела</label>
                    <input type="text" className="input-field" value={secForm.name} onChange={e=>setSecForm(p=>({...p,name:e.target.value}))} placeholder="Например: Алгебра, Геометрия, Физика..." required/>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Для каких целей подходит</label>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
                      {Object.entries(REG_GOALS).map(([k,v])=>(
                        <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 16px",borderRadius:8,border:`1px solid ${secForm.goals.includes(k)?THEME.primary:THEME.border}`,background:secForm.goals.includes(k)?"#f1f5f9":"#fff",fontSize:14,fontWeight:500}}>
                          <input type="checkbox" checked={secForm.goals.includes(k)} onChange={()=>toggleGoal(secForm,setSecForm,k)} style={{accentColor:THEME.primary}}/>{v}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>setShowSecForm(false)}>Отмена</button>
                    <button type="submit" className="cta-button active">Добавить</button>
                  </div>
                </form>
              </div>
            )}

            {sections.length===0?(
              <div className="empty-state">Разделов пока нет. Добавьте первый раздел.</div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                {sections.map(s=>(
                  <div key={s.id} className="admin-card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:17,color:THEME.primary,marginBottom:8}}>{s.name}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {(s.goals||[]).map(g=><span key={g} style={{background:"rgba(15,23,42,0.07)",color:THEME.primary,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{REG_GOALS[g]||g}</span>)}
                        </div>
                        <div style={{marginTop:10,fontSize:12,color:THEME.textLight}}>{questions.filter(q=>q.sectionId===s.id).length} вопросов</div>
                      </div>
                      <button onClick={()=>deleteSection(s.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 4px"}} title="Удалить">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QUESTIONS ── */}
        {!loading && tab==="questions" && (
          <div>
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Вопросы для диагностики</h2>
                <p style={{color:THEME.textLight,fontSize:14}}>Вопросы добавляются по разделам и целям. Показано: {filteredQuestions.length} из {questions.length}</p>
              </div>
              <button className="add-btn" onClick={()=>setShowQForm(true)} disabled={sections.length===0} title={sections.length===0?"Сначала добавьте раздел":""}>+ Добавить вопрос</button>
            </div>

            {/* Filters */}
            <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
              <select className="input-field" style={{width:"auto",minWidth:180}} value={filterSec} onChange={e=>setFilterSec(e.target.value)}>
                <option value="all">Все разделы</option>
                {sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input-field" style={{width:"auto",minWidth:200}} value={filterGoal} onChange={e=>setFilterGoal(e.target.value)}>
                <option value="all">Все цели</option>
                {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {showQForm && (
              <div className="admin-form-card">
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>Новый вопрос</h3>
                <form onSubmit={addQuestion}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Раздел</label>
                      <select className="input-field" value={qForm.sectionId} onChange={e=>{const s=sections.find(x=>x.id===e.target.value); setQForm(p=>({...p,sectionId:e.target.value,sectionName:s?.name||""}));}} required>
                        <option value="" disabled>Выберите раздел...</option>
                        {sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Тема / подтема</label>
                      <input type="text" className="input-field" value={qForm.topic} onChange={e=>setQForm(p=>({...p,topic:e.target.value}))} placeholder="Линейные уравнения" required/>
                    </div>
                  </div>
                  <div className="input-group" style={{marginTop:16}}>
                    <label className="input-label">Текст вопроса</label>
                    <textarea className="input-field" value={qForm.text} onChange={e=>setQForm(p=>({...p,text:e.target.value}))} placeholder="Введите вопрос..." rows={3} style={{resize:"vertical"}} required/>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Варианты ответов (отметьте правильный)</label>
                    {qForm.options.map((opt,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <input type="radio" name="correct" checked={qForm.correct===i} onChange={()=>setQForm(p=>({...p,correct:i}))} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>
                        <span style={{width:24,height:24,borderRadius:6,background:qForm.correct===i?THEME.primary:THEME.bg,border:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:qForm.correct===i?THEME.accent:THEME.textLight,flexShrink:0}}>{String.fromCharCode(65+i)}</span>
                        <input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={opt} onChange={e=>setQForm(p=>({...p,options:p.options.map((o,j)=>j===i?e.target.value:o)}))} placeholder={`Вариант ${String.fromCharCode(65+i)}`} required/>
                      </div>
                    ))}
                  </div>
                  <div className="input-group">
                    <label className="input-label">Для каких целей этот вопрос</label>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
                      {Object.entries(REG_GOALS).map(([k,v])=>(
                        <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 16px",borderRadius:8,border:`1px solid ${qForm.goals.includes(k)?THEME.primary:THEME.border}`,background:qForm.goals.includes(k)?"#f1f5f9":"#fff",fontSize:14,fontWeight:500}}>
                          <input type="checkbox" checked={qForm.goals.includes(k)} onChange={()=>setQForm(p=>({...p,goals:p.goals.includes(k)?p.goals.filter(g=>g!==k):[...p.goals,k]}))} style={{accentColor:THEME.primary}}/>{v}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>setShowQForm(false)}>Отмена</button>
                    <button type="submit" className="cta-button active">Добавить вопрос</button>
                  </div>
                </form>
              </div>
            )}

            {filteredQuestions.length===0?(
              <div className="empty-state">{questions.length===0?"Вопросов пока нет. Добавьте первый вопрос.":"Нет вопросов по выбранным фильтрам."}</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {filteredQuestions.map((q,i)=>(
                  <div key={q.id} className="admin-card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                          <span style={{background:THEME.primary,color:THEME.accent,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{q.sectionName}</span>
                          <span style={{background:THEME.bg,color:THEME.textLight,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,border:`1px solid ${THEME.border}`}}>{q.topic}</span>
                          {(q.goals||[]).map(g=><span key={g} style={{background:"rgba(16,185,129,0.1)",color:"#065f46",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{REG_GOALS[g]||g}</span>)}
                        </div>
                        <div style={{fontWeight:600,color:THEME.primary,fontSize:15,marginBottom:10}}>{q.text}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                          {(q.options||[]).map((o,oi)=>(
                            <div key={oi} style={{fontSize:13,padding:"6px 10px",borderRadius:6,background:oi===q.correct?"#ecfdf5":THEME.bg,border:`1px solid ${oi===q.correct?THEME.success:THEME.border}`,color:oi===q.correct?"#065f46":THEME.text,fontWeight:oi===q.correct?700:400}}>
                              {String.fromCharCode(65+oi)}. {o} {oi===q.correct&&"✓"}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={()=>deleteQuestion(q.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,flexShrink:0}} title="Удалить">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {!loading && tab==="students" && (
          <div>
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Ученики</h2>
                <p style={{color:THEME.textLight,fontSize:14}}>Всего: {students.length} учеников</p>
              </div>
            </div>
            {students.length===0?(
              <div className="empty-state">Учеников пока нет.</div>
            ):(
              <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:THEME.bg,borderBottom:`1px solid ${THEME.border}`}}>
                      {["Ученик","Телефон","Цель","Детали","Статус"].map(h=>(
                        <th key={h} style={{padding:"12px 20px",textAlign:"left",fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:"uppercase",letterSpacing:"0.5px"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s,i)=>{
                      const st = STUDENT_STATUSES.find(x=>x.value===s.status)||STUDENT_STATUSES[0];
                      return (
                        <tr key={s.id} style={{borderBottom:`1px solid ${THEME.border}`,background:i%2===0?"#fff":THEME.bg+"80"}}>
                          <td style={{padding:"14px 20px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:36,height:36,borderRadius:"50%",background:THEME.primary,color:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,flexShrink:0}}>
                                {s.firstName?.[0]}{s.lastName?.[0]}
                              </div>
                              <div>
                                <div style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{s.firstName} {s.lastName}</div>
                                <div style={{fontSize:11,color:THEME.textLight}}>{s.registeredAt?new Date(s.registeredAt).toLocaleDateString("ru-RU"):""}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:"14px 20px",fontSize:13,color:THEME.textLight}}>{s.phone}</td>
                          <td style={{padding:"14px 20px",fontSize:13,color:THEME.text}}>{s.goal}</td>
                          <td style={{padding:"14px 20px",fontSize:13,color:THEME.text}}>{s.details}</td>
                          <td style={{padding:"14px 20px"}}>
                            <select
                              value={s.status||"trial"}
                              onChange={e=>updateStatus(s.id,e.target.value)}
                              style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${st.color}`,background:st.color+"18",color:st.color,fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",outline:"none",appearance:"auto"}}
                            >
                              {STUDENT_STATUSES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ДАШБОРД ───────────────────────────────────────────────────────────────────
function DashboardScreen({ user, onStartDiagnostics, onViewPlan, onOpenAdmin }) {
  const [activeSection, setActiveSection] = useState("home");
  const [schedule, setSchedule] = useState([]);
  const [homework, setHomework] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showHwForm, setShowHwForm] = useState(false);
  const [showSchedForm, setShowSchedForm] = useState(false);
  const [hwForm, setHwForm] = useState({title:"",description:"",dueDate:""});
  const [schedForm, setSchedForm] = useState({dayOfWeek:"1",time:"10:00",subject:"Математика",duration:"60"});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isTeacher = user?.role==="teacher"||user?.role==="admin";
  const isAdmin   = user?.role==="admin";

  useEffect(()=>{
    const load = async ()=>{
      try {
        const [scSnap,hwSnap] = await Promise.all([getDocs(collection(db,"schedule")),getDocs(collection(db,"homework"))]);
        const sc = scSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.time?.localeCompare(b.time));
        const hw = hwSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.dueDate?.localeCompare(b.dueDate));
        setSchedule(sc); setHomework(hw);
      } catch(e){ console.error(e); }
      setLoadingData(false);
    };
    load();
  },[]);

  const addHomework = async (e)=>{
    e.preventDefault();
    try {
      const data={...hwForm,createdAt:new Date().toISOString()};
      const ref = await addDoc(collection(db,"homework"),data);
      setHomework(p=>[...p,{id:ref.id,...data}].sort((a,b)=>a.dueDate?.localeCompare(b.dueDate)));
      setHwForm({title:"",description:"",dueDate:""}); setShowHwForm(false);
    } catch{ alert("Ошибка."); }
  };

  const addSchedule = async (e)=>{
    e.preventDefault();
    try {
      const ref = await addDoc(collection(db,"schedule"),schedForm);
      setSchedule(p=>[...p,{id:ref.id,...schedForm}].sort((a,b)=>a.time?.localeCompare(b.time)));
      setSchedForm({dayOfWeek:"1",time:"10:00",subject:"Математика",duration:"60"}); setShowSchedForm(false);
    } catch{ alert("Ошибка."); }
  };

  const delHw = async (id)=>{ try{ await deleteDoc(doc(db,"homework",id)); setHomework(p=>p.filter(h=>h.id!==id)); }catch{ alert("Ошибка."); } };
  const delSc = async (id)=>{ try{ await deleteDoc(doc(db,"schedule",id)); setSchedule(p=>p.filter(s=>s.id!==id)); }catch{ alert("Ошибка."); } };

  const getWeekDates = ()=>{
    const today=new Date(), dow=today.getDay(), monday=new Date(today);
    monday.setDate(today.getDate()-(dow===0?6:dow-1));
    return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d; });
  };
  const weekDates = getWeekDates();
  const today = new Date();

  const navItems = [
    { id:"home", icon:"🏠", label:"Главная" },
    { id:"diagnostics", icon:"🎯", label:"Диагностика" },
    { id:"plan", icon:"🗺️", label:"Индивидуальный план обучения" },
    { id:"profile", icon:"👤", label:"Личный кабинет ученика" },
    ...(isAdmin?[{ id:"admin", icon:"⚙️", label:"Администрирование" }]:[]),
  ];

  const handleNav = (id)=>{
    setSidebarOpen(false);
    if(id==="diagnostics"){ onStartDiagnostics(); return; }
    if(id==="plan"){ onViewPlan(); return; }
    if(id==="admin"){ onOpenAdmin(); return; }
    setActiveSection(id);
  };

  const statusObj = STUDENT_STATUSES.find(s=>s.value===user?.status)||STUDENT_STATUSES.find(s=>s.value==="trial");

  return (
    <div className="dashboard-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}
      <aside className={`dashboard-sidebar ${sidebarOpen?"open":""}`}>
        <div className="sidebar-logo"><Logo size={36} light/></div>
        <nav className="sidebar-nav">
          {navItems.map(item=>(
            <button key={item.id} className={`sidebar-nav-item ${activeSection===item.id?"active":""}`} onClick={()=>handleNav(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div>
            <div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div>
            <div className="sidebar-user-role" style={{color:statusObj?.color+"cc"}}>{isAdmin?"Администратор":isTeacher?"Преподаватель":statusObj?.label||"Ученик"}</div>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="mobile-topbar">
          <button className="burger-btn" onClick={()=>setSidebarOpen(true)}>☰</button>
          <Logo size={28}/>
        </div>

        {/* HOME */}
        {activeSection==="home" && (
          <>
            <div className="dashboard-header">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div>
                  <h1>Добро пожаловать, <span style={{color:THEME.accent}}>{user?.firstName}</span>!</h1>
                  <p style={{color:THEME.textLight,marginTop:6}}>{today.toLocaleDateString("ru-RU",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
                </div>
                {user?.status && (
                  <span style={{background:statusObj?.color+"18",color:statusObj?.color,fontWeight:700,fontSize:13,padding:"6px 16px",borderRadius:99,border:`1px solid ${statusObj?.color}30`,alignSelf:"center"}}>
                    {statusObj?.label}
                  </span>
                )}
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-card"><div className="stat-icon">📅</div><div><div className="stat-value">{schedule.length}</div><div className="stat-label">занятий в неделю</div></div></div>
              <div className="stat-card"><div className="stat-icon">📚</div><div><div className="stat-value">{homework.filter(h=>new Date(h.dueDate+"T23:59:59")>=today).length}</div><div className="stat-label">активных ДЗ</div></div></div>
              <div className="stat-card"><div className="stat-icon">🎯</div><div><div className="stat-value" style={{fontSize:16}}>{user?.details||"—"}</div><div className="stat-label">цель</div></div></div>
            </div>

            {/* Schedule */}
            <div className="dashboard-section">
              <div className="section-title-row">
                <h2 className="section-title">📅 Расписание занятий</h2>
                {isTeacher && <button className="add-btn" onClick={()=>setShowSchedForm(true)}>+ Добавить занятие</button>}
              </div>
              <div className="week-calendar">
                {weekDates.map((date,idx)=>{
                  const dayNum=String(idx+1), dayLessons=schedule.filter(s=>s.dayOfWeek===dayNum), isToday=date.toDateString()===today.toDateString();
                  return (
                    <div key={idx} className={`week-day ${isToday?"today":""}`}>
                      <div className="week-day-header">
                        <span className="day-name">{DAY_NAMES_SHORT[idx]}</span>
                        <span className={`day-date ${isToday?"today-dot":""}`}>{date.getDate()}</span>
                      </div>
                      <div className="day-lessons">
                        {dayLessons.length===0?<div className="no-lessons">—</div>:dayLessons.map((l,li)=>(
                          <div key={li} className="lesson-block">
                            <span className="lesson-time">{l.time}</span>
                            <span className="lesson-subject">{l.subject}</span>
                            <span className="lesson-duration">{l.duration} мин</span>
                            {isTeacher && <button className="del-btn" onClick={()=>delSc(l.id)}>×</button>}
                          </div>
                        ))}
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
                {isTeacher && <button className="add-btn" onClick={()=>setShowHwForm(true)}>+ Добавить ДЗ</button>}
              </div>
              {loadingData?<div className="empty-state">Загрузка...</div>:homework.length===0?(
                <div className="empty-state">{isTeacher?"Нажмите «+ Добавить ДЗ» чтобы добавить задание.":"Домашних заданий пока нет."}</div>
              ):(
                <div className="homework-list">
                  {homework.map((hw,i)=>{
                    const due=new Date(hw.dueDate+"T23:59:59"), isOverdue=due<today, daysLeft=Math.ceil((due-today)/(1000*60*60*24));
                    return (
                      <div key={i} className={`hw-card ${isOverdue?"overdue":""}`}>
                        <div className="hw-card-left"><div className="hw-title">{hw.title}</div>{hw.description&&<div className="hw-desc">{hw.description}</div>}</div>
                        <div className="hw-card-right">
                          <span className={`due-badge ${isOverdue?"overdue":daysLeft<=2?"soon":""}`}>{isOverdue?"Просрочено":daysLeft===0?"Сегодня":daysLeft===1?"Завтра":`До ${due.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}`}</span>
                          {isTeacher && <button className="del-btn-hw" onClick={()=>delHw(hw.id)}>×</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* PROFILE */}
        {activeSection==="profile" && (
          <div>
            <div className="dashboard-header"><h1>Личный кабинет</h1></div>
            <div className="dashboard-section">
              <div className="profile-card">
                <div className="profile-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
                <div className="profile-info">
                  <div className="profile-name">{user?.firstName} {user?.lastName}</div>
                  <div className="profile-phone">{user?.phone}</div>
                  <span style={{display:"inline-block",background:statusObj?.color+"18",color:statusObj?.color,fontWeight:700,fontSize:12,padding:"4px 14px",borderRadius:99,border:`1px solid ${statusObj?.color}30`,marginBottom:8}}>{statusObj?.label}</span>
                  <div className="profile-goal-tag">{user?.goal}</div>
                  <div className="profile-detail">{user?.details}</div>
                  <div className="profile-date">Зарегистрирован: {user?.registeredAt?new Date(user.registeredAt).toLocaleDateString("ru-RU"):"—"}</div>
                </div>
              </div>
              <div className="profile-actions">
                <button className="cta-button active" style={{width:"auto",padding:"14px 28px"}} onClick={onStartDiagnostics}>🎯 Пройти диагностику</button>
                <button className="cta-button active" style={{width:"auto",padding:"14px 28px",background:THEME.surface,color:THEME.primary,border:`1px solid ${THEME.border}`,boxShadow:"none"}} onClick={onViewPlan}>🗺️ Мой план обучения</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Schedule */}
      {showSchedForm && (
        <div className="modal-overlay" onClick={()=>setShowSchedForm(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Добавить занятие</div>
            <form onSubmit={addSchedule}>
              <div className="input-group"><label className="input-label">День недели</label><select className="input-field" value={schedForm.dayOfWeek} onChange={e=>setSchedForm(p=>({...p,dayOfWeek:e.target.value}))}>{DAY_NAMES_FULL.map((d,i)=><option key={i} value={String(i+1)}>{d}</option>)}</select></div>
              <div className="input-group"><label className="input-label">Время</label><input type="time" className="input-field" value={schedForm.time} onChange={e=>setSchedForm(p=>({...p,time:e.target.value}))} required/></div>
              <div className="input-group"><label className="input-label">Предмет / тема</label><input type="text" className="input-field" value={schedForm.subject} onChange={e=>setSchedForm(p=>({...p,subject:e.target.value}))} placeholder="Математика" required/></div>
              <div className="input-group"><label className="input-label">Длительность (мин)</label><input type="number" className="input-field" value={schedForm.duration} onChange={e=>setSchedForm(p=>({...p,duration:e.target.value}))} min="15" max="240"/></div>
              <div style={{display:"flex",gap:12}}>
                <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>setShowSchedForm(false)}>Отмена</button>
                <button type="submit" className="cta-button active">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Homework */}
      {showHwForm && (
        <div className="modal-overlay" onClick={()=>setShowHwForm(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Добавить домашнее задание</div>
            <form onSubmit={addHomework}>
              <div className="input-group"><label className="input-label">Название</label><input type="text" className="input-field" value={hwForm.title} onChange={e=>setHwForm(p=>({...p,title:e.target.value}))} placeholder="Алгебра: задачи 1–10" required/></div>
              <div className="input-group"><label className="input-label">Описание (необязательно)</label><textarea className="input-field" value={hwForm.description} onChange={e=>setHwForm(p=>({...p,description:e.target.value}))} placeholder="Подробности..." rows={3} style={{resize:"vertical"}}/></div>
              <div className="input-group"><label className="input-label">Срок сдачи</label><input type="date" className="input-field" value={hwForm.dueDate} onChange={e=>setHwForm(p=>({...p,dueDate:e.target.value}))} required/></div>
              <div style={{display:"flex",gap:12}}>
                <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>setShowHwForm(false)}>Отмена</button>
                <button type="submit" className="cta-button active">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth");
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [report, setReport] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const handleRegister = (u) => { setUser(u); setScreen("dashboard"); };

  const startDiagnostics = async () => {
    setLoadingQuiz(true);
    try {
      const snap = await getDocs(collection(db,"questions"));
      let qs = snap.docs.map(d=>({id:d.id,...d.data()}));
      if (user?.goalKey) qs = qs.filter(q=>(q.goals||[]).includes(user.goalKey));
      setQuestions(qs.length>0 ? qs : FALLBACK_QUESTIONS);
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    }
    setQIndex(0); setAnswers([]);
    setLoadingQuiz(false);
    setScreen("question");
  };

  const handleAnswer = (data) => {
    const next = [...answers, data];
    setAnswers(next);
    if (qIndex+1 < questions.length) setQIndex(qIndex+1);
    else { setReport({answers:next}); setScreen("report"); }
  };

  const goHome = () => setScreen("dashboard");
  const viewPlan = () => setScreen("rpgmap");
  const openAdmin = () => setScreen("admin");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${THEME.bg};-webkit-font-smoothing:antialiased;color:${THEME.text};font-family:'Inter',sans-serif;}

        /* AUTH */
        .split-layout{display:flex;min-height:100vh;}
        .split-left{flex:1.1;background:${THEME.surface};padding:60px 80px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid ${THEME.border};}
        .split-right{flex:1;display:flex;align-items:center;justify-content:center;padding:60px;background:${THEME.bg};}
        .hero-title{font-family:'Montserrat',sans-serif;font-size:44px;font-weight:800;line-height:1.15;margin-bottom:24px;color:${THEME.primary};letter-spacing:-1.5px;}
        .hero-subtitle{font-size:17px;line-height:1.7;color:${THEME.textLight};margin-bottom:50px;max-width:520px;}
        .form-card{width:100%;max-width:480px;background:#fff;padding:40px;border-radius:16px;border:1px solid ${THEME.border};box-shadow:0 15px 35px -5px rgba(10,25,47,0.03);}
        .form-header{margin-bottom:32px;text-align:center;}
        .form-header h2{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:800;color:${THEME.primary};}
        .form-header p{color:${THEME.textLight};font-size:14px;margin-top:6px;}
        .form-row{display:flex;gap:16px;margin-bottom:20px;}
        .input-group{margin-bottom:20px;flex:1;}
        .input-label{display:block;margin-bottom:8px;font-size:12px;font-weight:700;color:${THEME.textLight};text-transform:uppercase;letter-spacing:1px;}
        .input-field{width:100%;padding:14px 16px;border-radius:8px;border:1px solid ${THEME.border};background:${THEME.bg};font-size:15px;outline:none;transition:all 0.2s;font-family:'Inter',sans-serif;}
        .input-field:focus{border-color:${THEME.primary};background:#fff;}
        .cta-button{width:100%;padding:16px 24px;border-radius:8px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:15px;text-align:center;border:none;background:${THEME.border};color:${THEME.textLight};transition:all 0.3s;text-transform:uppercase;letter-spacing:1px;cursor:default;}
        .cta-button.active{background:${THEME.primary};color:${THEME.accent};cursor:pointer;box-shadow:0 10px 20px -5px rgba(10,25,47,0.3);}
        .cta-button.active:hover{transform:translateY(-1px);}
        .benefits-list{display:flex;flex-direction:column;gap:28px;margin-bottom:60px;}
        .benefit-item{display:flex;gap:20px;align-items:flex-start;}
        .benefit-item .icon{font-size:24px;background:${THEME.bg};padding:14px;border-radius:12px;border:1px solid ${THEME.border};}
        .trust-badge{display:inline-flex;align-items:center;gap:12px;background:${THEME.bg};padding:12px 24px;border-radius:99px;border:1px solid ${THEME.border};}

        /* QUIZ */
        .question-container{max-width:800px;margin:0 auto;padding:40px 20px;}
        .modern-timer{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid ${THEME.border};padding:10px 20px;border-radius:99px;font-weight:700;font-family:'Montserrat',sans-serif;font-size:15px;}
        .pulse-dot{width:8px;height:8px;background:${THEME.error};border-radius:50%;animation:pulse 2s infinite;}
        .progress-bar-container{width:100%;height:6px;background:${THEME.border};border-radius:99px;overflow:hidden;margin-bottom:32px;}
        .progress-bar-fill{height:100%;background:${THEME.primary};transition:width 0.4s;}
        .question-meta{display:flex;justify-content:space-between;margin-bottom:20px;align-items:center;}
        .badge{background:${THEME.primary};color:${THEME.accent};padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;text-transform:uppercase;}
        .question-text{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:800;line-height:1.4;margin-bottom:40px;color:${THEME.primary};}
        .options-grid{display:flex;flex-direction:column;gap:14px;margin-bottom:40px;}
        .option-card{display:flex;align-items:center;padding:20px 24px;background:#fff;border:1px solid ${THEME.border};border-radius:12px;cursor:pointer;transition:all 0.2s;}
        .option-card.selected{border-color:${THEME.primary};background:#f1f5f9;border-width:2px;}
        .option-card.correct{border-color:${THEME.success};background:#ecfdf5;border-width:2px;}
        .option-card.wrong{border-color:${THEME.error};background:#fef2f2;border-width:2px;}
        .option-card.disabled{opacity:0.5;pointer-events:none;}
        .option-letter{width:36px;height:36px;background:${THEME.bg};border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;margin-right:20px;flex-shrink:0;}
        .option-content{font-size:16px;font-weight:600;flex:1;}
        .icon-status{margin-left:12px;}
        .confidence-section{background:#fff;border:1px solid ${THEME.border};padding:32px;border-radius:16px;margin-bottom:40px;}
        .confidence-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;}
        .conf-btn{flex:1;padding:14px 10px;border:1px solid ${THEME.border};border-radius:10px;background:#fff;cursor:pointer;font-weight:600;font-family:'Inter',sans-serif;}

        /* REPORT */
        .report-container{max-width:760px;margin:40px auto;padding:0 20px 40px;}
        .report-header-card{background:#fff;padding:32px;border-radius:16px;border:1px solid ${THEME.border};margin-bottom:32px;}
        .report-hero-compact{display:flex;align-items:center;gap:24px;}
        .score-badge{width:90px;height:90px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;flex-shrink:0;}
        .results-list-modern{background:#fff;border-radius:16px;border:1px solid ${THEME.border};padding:32px;}
        .result-card-modern{border-radius:12px;border:1px solid ${THEME.border};background:${THEME.bg};margin-bottom:12px;padding:16px 20px;}
        .result-card-modern.red{border-left:4px solid ${THEME.error};}
        .result-card-modern.yellow{border-left:4px solid ${THEME.warning};}
        .result-card-modern.green{border-left:4px solid ${THEME.success};}
        .card-main{display:flex;justify-content:space-between;align-items:center;gap:16px;}
        .topic-name{font-size:16px;font-weight:700;color:${THEME.primary};}
        .status-text{display:block;font-size:14px;font-weight:700;margin-bottom:4px;}
        .meta-text{font-size:12px;color:${THEME.textLight};}
        .section-badge{background:${THEME.primary};color:${THEME.accent};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;margin-right:10px;text-transform:uppercase;}
        .status-info{text-align:right;}

        /* PATH */
        .path-container{max-width:1000px;margin:40px auto;padding:0 20px 40px;}
        .path-header{text-align:center;margin-bottom:48px;}
        .path-visualization-modern{background:${THEME.primary};border-radius:24px;padding:50px 40px;overflow-x:auto;}

        /* DASHBOARD */
        .dashboard-layout{display:flex;min-height:100vh;background:${THEME.bg};}
        .dashboard-sidebar{width:268px;background:${THEME.primary};display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:20;transition:transform 0.3s ease;overflow-y:auto;}
        .sidebar-logo{padding:28px 24px 24px;border-bottom:1px solid rgba(255,255,255,0.08);}
        .sidebar-nav{flex:1;padding:16px 12px;display:flex;flex-direction:column;gap:4px;}
        .sidebar-nav-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,0.55);font-family:'Inter',sans-serif;font-size:14px;font-weight:500;cursor:pointer;text-align:left;width:100%;transition:all 0.2s;line-height:1.4;}
        .sidebar-nav-item:hover{background:rgba(255,255,255,0.09);color:#fff;}
        .sidebar-nav-item.active{background:rgba(212,175,55,0.18);color:${THEME.accent};font-weight:700;}
        .nav-icon{font-size:18px;flex-shrink:0;}
        .sidebar-user{padding:20px 24px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;}
        .sidebar-user-avatar{width:38px;height:38px;border-radius:50%;background:rgba(212,175,55,0.2);color:${THEME.accent};display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:14px;flex-shrink:0;}
        .sidebar-user-name{color:#fff;font-weight:600;font-size:13px;}
        .sidebar-user-role{font-size:11px;margin-top:2px;}
        .dashboard-main{margin-left:268px;flex:1;padding:40px 48px;min-height:100vh;}
        .dashboard-header{margin-bottom:32px;}
        .dashboard-header h1{font-family:'Montserrat',sans-serif;font-size:30px;font-weight:800;color:${THEME.primary};}
        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
        .stat-card{background:#fff;border-radius:14px;border:1px solid ${THEME.border};padding:20px 24px;display:flex;align-items:center;gap:16px;}
        .stat-icon{font-size:28px;}
        .stat-value{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:${THEME.primary};line-height:1;}
        .stat-label{font-size:12px;color:${THEME.textLight};margin-top:4px;}
        .dashboard-section{background:#fff;border-radius:16px;border:1px solid ${THEME.border};padding:28px 32px;margin-bottom:28px;}
        .section-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;}
        .section-title{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:${THEME.primary};}
        .add-btn{padding:9px 18px;border-radius:8px;border:none;background:${THEME.primary};color:${THEME.accent};font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;cursor:pointer;transition:opacity 0.2s;}
        .add-btn:hover{opacity:0.85;}
        .add-btn:disabled{opacity:0.4;cursor:not-allowed;}

        /* CALENDAR */
        .week-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;}
        .week-day{background:${THEME.bg};border-radius:12px;border:1px solid ${THEME.border};padding:12px 10px;min-height:110px;}
        .week-day.today{border-color:${THEME.accent};background:rgba(212,175,55,0.04);}
        .week-day-header{display:flex;flex-direction:column;align-items:center;margin-bottom:10px;gap:4px;}
        .day-name{font-size:11px;font-weight:700;color:${THEME.textLight};text-transform:uppercase;letter-spacing:0.5px;}
        .day-date{font-size:18px;font-weight:800;color:${THEME.primary};width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;}
        .day-date.today-dot{background:${THEME.accent};color:${THEME.primary};}
        .day-lessons{display:flex;flex-direction:column;gap:6px;}
        .lesson-block{background:${THEME.primary};border-radius:8px;padding:7px 9px;position:relative;}
        .lesson-time{display:block;font-size:11px;color:${THEME.accent};font-weight:700;}
        .lesson-subject{display:block;font-size:12px;color:#fff;font-weight:600;margin-top:2px;word-break:break-word;}
        .lesson-duration{display:block;font-size:10px;color:rgba(255,255,255,0.45);margin-top:2px;}
        .no-lessons{color:${THEME.border};font-size:20px;text-align:center;padding-top:8px;}
        .del-btn{position:absolute;top:4px;right:4px;background:transparent;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;}
        .del-btn:hover{color:${THEME.error};}

        /* HOMEWORK */
        .homework-list{display:flex;flex-direction:column;gap:12px;}
        .hw-card{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:${THEME.bg};border-radius:12px;border:1px solid ${THEME.border};border-left:4px solid ${THEME.primary};gap:16px;}
        .hw-card.overdue{border-left-color:${THEME.error};}
        .hw-card-left{flex:1;}
        .hw-title{font-size:15px;font-weight:700;color:${THEME.primary};margin-bottom:4px;}
        .hw-desc{font-size:13px;color:${THEME.textLight};line-height:1.5;}
        .hw-card-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .due-badge{padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;background:rgba(15,23,42,0.07);color:${THEME.primary};white-space:nowrap;}
        .due-badge.overdue{background:rgba(239,68,68,0.1);color:${THEME.error};}
        .due-badge.soon{background:rgba(245,158,11,0.12);color:#b45309;}
        .del-btn-hw{background:transparent;border:none;color:${THEME.textLight};cursor:pointer;font-size:18px;line-height:1;padding:0 4px;transition:color 0.2s;}
        .del-btn-hw:hover{color:${THEME.error};}
        .empty-state{text-align:center;color:${THEME.textLight};padding:48px 20px;font-size:15px;}

        /* MODAL */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;}
        .modal-card{background:#fff;border-radius:16px;padding:32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.2);}
        .modal-title{font-family:'Montserrat',sans-serif;font-weight:800;font-size:20px;color:${THEME.primary};margin-bottom:24px;}

        /* PROFILE */
        .profile-card{display:flex;align-items:flex-start;gap:28px;padding:28px;background:${THEME.bg};border-radius:14px;border:1px solid ${THEME.border};margin-bottom:24px;}
        .profile-avatar{width:80px;height:80px;border-radius:50%;background:${THEME.primary};color:${THEME.accent};display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:28px;flex-shrink:0;}
        .profile-name{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:800;color:${THEME.primary};margin-bottom:6px;}
        .profile-phone{color:${THEME.textLight};font-size:14px;margin-bottom:10px;}
        .profile-goal-tag{display:inline-block;background:rgba(212,175,55,0.15);color:#92680e;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;margin-bottom:6px;}
        .profile-detail{font-size:15px;font-weight:600;color:${THEME.text};margin-bottom:8px;}
        .profile-date{font-size:12px;color:${THEME.textLight};}
        .profile-info{flex:1;}
        .profile-actions{display:flex;gap:16px;flex-wrap:wrap;}

        /* ADMIN */
        .admin-section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;}
        .admin-section-title{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:${THEME.primary};margin-bottom:4px;}
        .admin-form-card{background:#fff;border:1px solid ${THEME.border};border-radius:16px;padding:28px;margin-bottom:28px;border-top:4px solid ${THEME.accent};}
        .admin-card{background:#fff;border:1px solid ${THEME.border};border-radius:14px;padding:20px 24px;transition:box-shadow 0.2s;}
        .admin-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.06);}

        /* MOBILE */
        .mobile-topbar{display:none;align-items:center;justify-content:space-between;padding:16px 20px;background:#fff;border-bottom:1px solid ${THEME.border};margin-bottom:24px;}
        .burger-btn{background:transparent;border:none;font-size:24px;cursor:pointer;color:${THEME.primary};padding:4px 8px;}
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:19;}

        /* ANIMATIONS */
        .scale-in{animation:scale-in 0.3s ease forwards;}
        @keyframes scale-in{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.7);}70%{box-shadow:0 0 0 8px rgba(239,68,68,0);}100%{box-shadow:0 0 0 0 rgba(239,68,68,0);}}

        /* RESPONSIVE */
        @media(max-width:900px){
          .split-layout{flex-direction:column;} .split-left,.split-right{padding:40px 20px;} .form-row{flex-direction:column;gap:0;}
          .dashboard-sidebar{transform:translateX(-100%);} .dashboard-sidebar.open{transform:translateX(0);}
          .sidebar-overlay{display:block;} .dashboard-main{margin-left:0;padding:0 16px 40px;}
          .mobile-topbar{display:flex;} .stats-row{grid-template-columns:1fr 1fr;} .week-calendar{grid-template-columns:repeat(4,1fr);}
        }
        @media(max-width:600px){
          .stats-row{grid-template-columns:1fr;} .week-calendar{grid-template-columns:repeat(2,1fr);}
          .hw-card{flex-direction:column;align-items:flex-start;} .dashboard-section{padding:20px 16px;}
          .card-main{flex-direction:column;align-items:flex-start;} .status-info{text-align:left;}
        }
      `}</style>

      {screen==="auth" && <AuthScreen onRegister={handleRegister}/>}

      {screen==="dashboard" && (
        <DashboardScreen user={user} onStartDiagnostics={startDiagnostics} onViewPlan={viewPlan} onOpenAdmin={openAdmin}/>
      )}

      {screen==="admin" && (
        <AdminScreen user={user} onBack={goHome}/>
      )}

      {screen==="question" && questions.length>0 && (
        <QuestionScreen question={questions[qIndex]} qNum={qIndex+1} total={questions.length} onComplete={handleAnswer}/>
      )}

      {loadingQuiz && (
        <div style={{minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",flexDirection:"column",gap:16}}>
          <Logo size={48}/><p style={{color:THEME.textLight,marginTop:8}}>Загрузка вопросов...</p>
        </div>
      )}

      {screen==="report" && report && (
        <>
          <nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Logo size={32}/>
            <button onClick={goHome} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Главная</button>
          </nav>
          <ReportScreen report={report} user={user} onViewPlan={viewPlan} onBack={goHome}/>
        </>
      )}

      {screen==="rpgmap" && (
        <>
          <nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Logo size={32}/>
            <button onClick={goHome} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Главная</button>
          </nav>
          <PathMap user={user} onBack={goHome}/>
        </>
      )}
    </>
  );
}
