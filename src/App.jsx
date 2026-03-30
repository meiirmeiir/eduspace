import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, addDoc, deleteDoc
} from "firebase/firestore";

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

const ANTHROPIC_KEY   = import.meta.env.VITE_ANTHROPIC_KEY   || "";
const TELEGRAM_TOKEN  = import.meta.env.VITE_TELEGRAM_TOKEN  || "";
const TELEGRAM_CHAT   = import.meta.env.VITE_TELEGRAM_CHAT   || "";

// ── КОНСТАНТЫ ─────────────────────────────────────────────────────────────────
const FALLBACK_QUESTIONS = [
  { id:"f1", sectionName:"Алгебра", topic:"Линейные уравнения", type:"mcq", text:"Решите уравнение: 3x + 7 = 22", options:["x = 5","x = 3","x = 7","x = 4"], correct:0, goals:["exam","gaps","future"] },
  { id:"f2", sectionName:"Геометрия", topic:"Площадь треугольника", type:"mcq", text:"Основание треугольника 8 см, высота 5 см. Найдите площадь.", options:["20 см²","40 см²","13 см²","16 см²"], correct:0, goals:["exam","gaps","future"] },
  { id:"f3", sectionName:"Алгебра", topic:"Степени", type:"mcq", text:"Вычислите: 2⁵ + 3² = ?", options:["41","32","27","39"], correct:0, goals:["exam","gaps","future"] },
];
const CONFIDENCE_LEVELS = [
  { v:1, label:"Сомневаюсь", color:"#EF4444" }, { v:2, label:"Не уверен", color:"#F59E0B" },
  { v:3, label:"Нейтрально", color:"#94A3B8" }, { v:4, label:"Уверен", color:"#10B981" },
  { v:5, label:"Абсолютно уверен", color:"#059669" }
];
const RPG_NODES = [
  { id:1, name:"Уравнения", x:100, y:350 }, { id:2, name:"Степени", x:250, y:250 },
  { id:3, name:"Рубеж: Алгебра", x:400, y:150, type:"boss" }, { id:4, name:"Площадь", x:550, y:250 },
  { id:5, name:"Пифагор", x:700, y:350 }, { id:6, name:"Рубеж: Геометрия", x:850, y:250, type:"boss" },
  { id:7, name:"Вероятность", x:700, y:100 }, { id:8, name:"Цель: ЕНТ", x:850, y:50, type:"boss" }
];
const RPG_PATHS = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];
const REG_GOALS = { exam:"Подготовка к экзамену", gaps:"Закрытие пробелов", future:"Подготовка к следующему классу" };
const EXAMS_LIST = ["ЕНТ","SAT","NUET","Further Pure Math","IGCSE"];
const GRADES_LIST = ["5 класс","6 класс","7 класс","8 класс","9 класс","10 класс","11 класс","12 класс"];
const STUDENT_STATUSES = [
  { value:"active",    label:"Активный",       color:"#10B981" },
  { value:"trial",     label:"Пробный",         color:"#F59E0B" },
  { value:"inactive",  label:"Неактивный",      color:"#94A3B8" },
  { value:"paused",    label:"Приостановлен",   color:"#EF4444" },
  { value:"graduated", label:"Выпускник",       color:"#6366F1" },
];
const QUESTION_TYPES = [
  { value:"mcq",      label:"Один правильный ответ (MCQ)" },
  { value:"multiple", label:"Несколько правильных ответов" },
  { value:"matching", label:"Установить соответствие" },
];
const DAY_NAMES_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DAY_NAMES_FULL  = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const THEME = { primary:"#0f172a", accent:"#d4af37", bg:"#f8fafc", surface:"#ffffff", text:"#334155", textLight:"#64748b", border:"#e2e8f0", success:"#10B981", warning:"#F59E0B", error:"#EF4444" };

// ── AI АНАЛИЗ ─────────────────────────────────────────────────────────────────
async function analyzePhoto(imageBase64, mediaType, answers) {
  const ctx = answers.map((a,i)=>
    `Задание ${i+1}: тема «${a.topic}» (раздел: ${a.section}). ` +
    `Ответ: ${a.correct?"ВЕРНО":"НЕВЕРНО"}. ` +
    `Время выполнения: ${a.timeSpent}с. ` +
    `Уверенность ученика: ${a.confidence??"-"}/5.`
  ).join("\n");

  const prompt = `Ты — педагогический ИИ-ассистент. Перед тобой рукописные записи ученика после диагностического теста.

КОНТЕКСТ ДИАГНОСТИКИ:
${ctx}

ЗАДАЧА: Проанализируй фото рукописных записей ученика. Для каждой темы из контекста:
1. Определи насколько пошагово и правильно решил задачу ученик (каждый шаг — отдельный навык)
2. Учти время выполнения (долго = труднее материал), уровень уверенности и наличие ошибок
3. Назначь зону:
   - "red" = грубые ошибки, не понимает базу, нужна срочная проработка
   - "yellow" = частичное понимание, есть ошибки в деталях или шагах
   - "green" = понимает, но есть мелкие недочёты, нужна доработка
4. Укажи конкретные навыки которые нужно проработать

Отвечай ТОЛЬКО в JSON, без лишнего текста:
{
  "topics": [
    {
      "topic": "название темы",
      "section": "раздел",
      "zone": "red",
      "reason": "краткое обоснование на русском",
      "skills": ["конкретный навык 1", "конкретный навык 2"]
    }
  ]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-calls": "true"
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type:"image", source:{ type:"base64", media_type: mediaType, data: imageBase64 } },
          { type:"text", text: prompt }
        ]
      }]
    })
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const data = await res.json();
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Не удалось распознать ответ ИИ");
  return JSON.parse(match[0]);
}

// ── TELEGRAM ──────────────────────────────────────────────────────────────────
async function tgSend(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT || TELEGRAM_TOKEN==="your_bot_token_here") return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({chat_id:TELEGRAM_CHAT, text, parse_mode:"HTML"})
    });
  } catch(e){ console.warn("Telegram sendMessage:", e); }
}
async function tgPhoto(file, caption) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT || TELEGRAM_TOKEN==="your_bot_token_here") return;
  try {
    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT);
    form.append("photo", file);
    if (caption) form.append("caption", caption.slice(0,1024));
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method:"POST", body: form
    });
  } catch(e){ console.warn("Telegram sendPhoto:", e); }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const getSpecificList = (goalKey) => goalKey === "exam" ? EXAMS_LIST : goalKey === "gaps" || goalKey === "future" ? GRADES_LIST : [];

// ── ЛОГОТИП ───────────────────────────────────────────────────────────────────
const Logo = ({ size=48, light=false }) => (
  <div style={{display:"flex",alignItems:"center",gap:14}}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{flexShrink:0}}>
      <circle cx="50" cy="50" r="50" fill="#0A2463"/>
      <path d="M45 35 L85 15 L78 28 L95 35 L78 40 L85 55 L65 40 Z" fill="#FBBF24"/>
      <path d="M50 75 Q35 60 15 65 L15 75 Q35 70 50 85 Q65 70 85 75 L85 65 Q65 60 50 75Z" fill="#E2E8F0"/>
      <path d="M50 65 Q35 50 15 55 L15 65 Q35 60 50 75 Q65 60 85 65 L85 55 Q65 50 50 65Z" fill="#FFF"/>
      <path d="M50 30 L15 45 L50 60 L85 45Z" fill="#1E3A8A"/>
      <path d="M50 35 L22 47 L50 55 L78 47Z" fill="#2563EB"/>
      <path d="M50 45 L70 50 L72 65" stroke="#FBBF24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <circle cx="72" cy="68" r="3.5" fill="#FBBF24"/>
    </svg>
    <div>
      <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:size*0.6,color:light?"#fff":THEME.primary,lineHeight:1,letterSpacing:"1px"}}>AAPA</div>
      <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:Math.max(size*0.2,9),color:THEME.accent,letterSpacing:"1px",marginTop:4,textTransform:"uppercase"}}>Ad Astra Per Aspera</div>
    </div>
  </div>
);

function Timer({ seconds }) {
  const m=Math.floor(seconds/60), s=seconds%60;
  return <div className="modern-timer"><div className="pulse-dot"/><span>{m>0?`${m}:${String(s).padStart(2,"0")}`:` 0:${String(s).padStart(2,"0")}`}</span></div>;
}

// ── АВТОРИЗАЦИЯ ───────────────────────────────────────────────────────────────
function AuthScreen({ onRegister }) {
  const [step,setStep]=useState(1);
  const [loading,setLoading]=useState(false);
  const [phone,setPhone]=useState("+7 ");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [mainGoal,setMainGoal]=useState("");
  const [specificGoal,setSpecificGoal]=useState("");
  const [foundUser,setFoundUser]=useState(null);
  const [password,setPassword]=useState("");

  const handlePhone = e => {
    let v = e.target.value;
    if (!v.startsWith("+7 ")) { setPhone("+7 "); return; }
    // Allow only digits after "+7 ", max 10 digits
    const digits = v.slice(3).replace(/\D/g,"").slice(0,10);
    setPhone("+7 " + digits);
  };
  const phoneOk = phone.replace(/\D/g,"").length===11;

  const checkUser = async e => {
    e.preventDefault(); const cp=phone.replace(/\s+/g,"");
    if(cp.length<11){alert("Введите корректный номер.");return;}
    setLoading(true);
    try {
      const snap=await getDoc(doc(db,"users",cp));
      if(snap.exists()){
        const data=snap.data();
        if(data.status!=="trial"){
          setFoundUser(data);
          if(data.password) setStep(3);   // уже есть пароль → ввести
          else setStep(4);                // пароля нет → создать
        } else onRegister(data);
      } else setStep(2);
    }
    catch{ alert("Ошибка соединения."); }
    setLoading(false);
  };

  const checkPassword = e => {
    e.preventDefault();
    if(password===foundUser.password) onRegister(foundUser);
    else { alert("Неверный пароль. Попробуйте ещё раз."); setPassword(""); }
  };

  const [confirmPwd,setConfirmPwd]=useState("");
  const createPassword = async e => {
    e.preventDefault();
    if(password.length<4){alert("Пароль должен быть не менее 4 символов.");return;}
    if(password!==confirmPwd){alert("Пароли не совпадают.");return;}
    setLoading(true);
    try{
      await updateDoc(doc(db,"users",foundUser.phone),{password});
      onRegister({...foundUser,password});
    }catch{ alert("Ошибка при сохранении пароля."); }
    setLoading(false);
  };

  const register = async e => {
    e.preventDefault();
    if(!firstName||!lastName||!mainGoal||!specificGoal)return;
    setLoading(true);
    try {
      const cp=phone.replace(/\s+/g,"");
      const data={firstName,lastName,phone:cp,goalKey:mainGoal,goal:REG_GOALS[mainGoal],details:specificGoal,registeredAt:new Date().toISOString(),status:"trial"};
      await setDoc(doc(db,"users",cp),data); onRegister(data);
    } catch{ alert("Ошибка при сохранении."); }
    setLoading(false);
  };

  return (
    <div className="split-layout">
      <div className="split-left">
        <div style={{marginBottom:60}}><Logo size={60}/></div>
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <h1 className="hero-title">Построй свой путь к <span style={{color:THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">Пройди независимую диагностику компетенций. Система <b>AAPA</b> выявит скрытые пробелы и построит точный маршрут подготовки.</p>
          <div className="benefits-list">
            <div className="benefit-item"><span className="icon">🎯</span><div><strong>Когнитивная диагностика</strong><p>Анализируем не только верные ответы, но и вашу уверенность в них.</p></div></div>
            <div className="benefit-item"><span className="icon">🗺️</span><div><strong>Индивидуальный трек</strong><p>Пошаговая Карта Навыков для достижения вашей цели.</p></div></div>
          </div>
        </div>
        <div className="trust-badge"><span style={{color:THEME.accent,letterSpacing:"2px",fontSize:18}}>★★★★★</span><span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>Нам доверяют подготовку к будущему</span></div>
      </div>
      <div className="split-right">
        <div className="form-card">
          <div className="form-header">
            <h2>{step===1?"Войти в систему":step===2?"Создать профиль":step===3?"Введите пароль":"Создайте пароль"}</h2>
            <p>{step===1?"Введите номер WhatsApp для входа.":step===2?"Мы вас не нашли. Давайте познакомимся!":step===3?"Ваш аккаунт защищён паролем.":"Придумайте пароль для входа в аккаунт."}</p>
          </div>
          {step===3?(
            <form onSubmit={checkPassword}>
              <div className="input-group">
                <label className="input-label">Пароль</label>
                <input type="password" className="input-field" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Введите пароль..." autoFocus required/>
              </div>
              <button type="submit" className={`cta-button ${password?"active":""}`} disabled={!password}>Войти →</button>
              <button type="button" style={{width:"100%",marginTop:10,padding:"12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"transparent",color:THEME.textLight,fontFamily:"'Montserrat',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer"}} onClick={()=>{setStep(1);setFoundUser(null);setPassword("");}}>← Назад</button>
            </form>
          ):step===4?(
            <form onSubmit={createPassword}>
              <div className="input-group">
                <label className="input-label">Новый пароль</label>
                <input type="password" className="input-field" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 4 символа..." autoFocus required/>
              </div>
              <div className="input-group">
                <label className="input-label">Повторите пароль</label>
                <input type="password" className="input-field" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)} placeholder="Повторите пароль..." required/>
              </div>
              <button type="submit" className={`cta-button ${password&&confirmPwd?"active":""}`} disabled={!password||!confirmPwd||loading}>
                {loading?"Сохраняю...":"Сохранить и войти →"}
              </button>
              <button type="button" style={{width:"100%",marginTop:10,padding:"12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"transparent",color:THEME.textLight,fontFamily:"'Montserrat',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer"}} onClick={()=>{setStep(1);setFoundUser(null);setPassword("");setConfirmPwd("");}}>← Назад</button>
            </form>
          ):(
            <form onSubmit={step===1?checkUser:register}>
              <div className="input-group"><label className="input-label">Номер WhatsApp</label><input type="tel" className="input-field" value={phone} onChange={handlePhone} disabled={step===2||loading} placeholder="+7 700 000 00 00" required/></div>
              {step===2&&(<div className="scale-in">
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
                {mainGoal&&<div className="input-group scale-in">
                  <label className="input-label">{mainGoal==="exam"?"Какой экзамен?":"Класс"}</label>
                  <select className="input-field" value={specificGoal} onChange={e=>setSpecificGoal(e.target.value)} required>
                    <option value="" disabled>Выберите...</option>
                    {getSpecificList(mainGoal).map(x=><option key={x} value={x}>{x}</option>)}
                  </select>
                </div>}
              </div>)}
              <button type="submit" className={`cta-button ${phoneOk?"active":""}`} disabled={loading||!phoneOk}>
                {loading?"Загрузка...":(step===1?"Войти →":"Создать аккаунт →")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ЭКРАН ВЫБОРА ДИАГНОСТИКИ ──────────────────────────────────────────────────
function DiagnosticsScreen({ user, onSelectSection, onBack }) {
  const [sections,setSections]=useState([]);
  const [counts,setCounts]=useState({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const load = async ()=>{
      try {
        const [secSnap,qSnap]=await Promise.all([getDocs(collection(db,"sections")),getDocs(collection(db,"questions"))]);
        const allSecs=secSnap.docs.map(d=>({id:d.id,...d.data()}));
        const allQs=qSnap.docs.map(d=>({id:d.id,...d.data()}));
        // Filter sections based on student's goal and target
        const studentGoal = user?.goalKey;
        const studentTarget = user?.details; // e.g. "ЕНТ" or "8 класс"
        const gradeIndex = GRADES_LIST.indexOf(studentTarget);

        const filtered = allSecs.filter(s => {
          if (s.goalKey !== studentGoal) return false;
          if (!s.specificTarget) return false;

          if (studentGoal === "exam") {
            // Show only sections for the student's specific exam
            return s.specificTarget === studentTarget;
          }

          if (studentGoal === "gaps") {
            // Show sections for all classes up to and including student's class
            const sIdx = GRADES_LIST.indexOf(s.specificTarget);
            return sIdx !== -1 && gradeIndex !== -1 && sIdx <= gradeIndex;
          }

          if (studentGoal === "future") {
            // Show sections for student's class and all subsequent classes
            const sIdx = GRADES_LIST.indexOf(s.specificTarget);
            return sIdx !== -1 && gradeIndex !== -1 && sIdx >= gradeIndex;
          }

          return false;
        });

        // Sort by grade order for gaps/future goals
        if (studentGoal === "gaps" || studentGoal === "future") {
          filtered.sort((a, b) => GRADES_LIST.indexOf(a.specificTarget) - GRADES_LIST.indexOf(b.specificTarget));
        }
        // Count questions per section
        const c={};
        allQs.forEach(q=>{ if(q.sectionId) c[q.sectionId]=(c[q.sectionId]||0)+1; });
        setCounts(c);
        setSections(filtered);
      } catch(e){ console.error(e); }
      setLoading(false);
    };
    load();
  },[]);

  const typeIcons = { mcq:"🔘", multiple:"☑️", matching:"🔗" };

  return (
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 40px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo size={32}/>
        <button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Назад</button>
      </nav>
      <div style={{maxWidth:960,margin:"0 auto",padding:"48px 24px"}}>
        <div style={{marginBottom:40}}>
          <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:32,fontWeight:800,color:THEME.primary,marginBottom:8}}>Диагностика</h1>
          <p style={{color:THEME.textLight,fontSize:16}}>
            Цель: <strong>{user?.goal}</strong> · {user?.details}
          </p>
        </div>
        {loading && <div style={{textAlign:"center",padding:60,color:THEME.textLight,fontSize:16}}>Загрузка диагностик...</div>}
        {!loading && sections.length===0 && (
          <div style={{textAlign:"center",padding:80}}>
            <div style={{fontSize:48,marginBottom:16}}>📭</div>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",color:THEME.primary,marginBottom:8}}>Диагностик пока нет</h3>
            <p style={{color:THEME.textLight}}>Преподаватель ещё не добавил разделы для вашей цели ({user?.goal} · {user?.details}).</p>
          </div>
        )}
        {!loading && sections.length>0 && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
            {sections.map(sec=>{
              const qCount=counts[sec.id]||0;
              return (
                <div key={sec.id} onClick={()=>qCount>0&&onSelectSection(sec)}
                  style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"24px",cursor:qCount>0?"pointer":"default",transition:"all 0.2s",opacity:qCount===0?0.5:1,position:"relative",overflow:"hidden"}}
                  onMouseEnter={e=>{if(qCount>0)e.currentTarget.style.boxShadow="0 8px 30px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow=""; e.currentTarget.style.transform="";}}>
                  <div style={{width:48,height:48,background:`${THEME.primary}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16}}>📋</div>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:6}}>{sec.name}</h3>
                  {sec.description&&<p style={{color:THEME.textLight,fontSize:13,marginBottom:12,lineHeight:1.5}}>{sec.description}</p>}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:"rgba(212,175,55,0.12)",color:"#92680e",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{REG_GOALS[sec.goalKey]}</span>
                    {sec.specificTarget&&<span style={{background:THEME.bg,color:THEME.textLight,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,border:`1px solid ${THEME.border}`}}>{sec.specificTarget}</span>}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${THEME.border}`,paddingTop:12,marginTop:8}}>
                    <span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>{qCount} вопросов</span>
                    {qCount>0&&<span style={{background:THEME.primary,color:THEME.accent,fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:8}}>Начать →</span>}
                    {qCount===0&&<span style={{color:THEME.textLight,fontSize:12}}>Нет вопросов</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ВОПРОС (MCQ + MULTIPLE + MATCHING) ───────────────────────────────────────
function QuestionScreen({ question, qNum, total, onComplete }) {
  const [elapsed,setElapsed]=useState(0);
  const qType = question.type||"mcq";

  // MCQ state
  const [selected,setSelected]=useState(null);
  const [confidence,setConfidence]=useState(null);
  const mcqReady = selected!==null && confidence!==null;

  // Multiple state
  const [multiSelected,setMultiSelected]=useState([]);
  const [multiSubmitted,setMultiSubmitted]=useState(false);
  const [multiConf,setMultiConf]=useState(null);
  const multiReady = multiSubmitted && multiConf!==null;

  // Matching state
  const shuffledRights = useMemo(()=>{
    if(qType!=="matching"||!question.pairs) return [];
    return shuffle(question.pairs.map((p,i)=>({text:p.right,originalIndex:i})));
  },[question.id||question.text]);
  const [matchSel,setMatchSel]=useState({});
  const [matchSubmitted,setMatchSubmitted]=useState(false);

  useEffect(()=>{setElapsed(0);setSelected(null);setConfidence(null);setMultiSelected([]);setMultiSubmitted(false);setMultiConf(null);setMatchSel({});setMatchSubmitted(false);},[question.id||question.text]);

  const canProceed = qType==="mcq"?mcqReady : qType==="multiple"?multiReady : matchSubmitted;

  useEffect(()=>{
    if(canProceed)return;
    const t=setInterval(()=>setElapsed(s=>s+1),1000); return ()=>clearInterval(t);
  },[canProceed]);

  const handleNext = ()=>{
    let correct=false;
    if(qType==="mcq") correct=selected===question.correct;
    else if(qType==="multiple"){
      const ca=question.correctAnswers||[];
      correct=ca.length===multiSelected.length && ca.every(i=>multiSelected.includes(i));
    } else if(qType==="matching"){
      correct=(question.pairs||[]).every((_,i)=>matchSel[i]===i);
    }
    onComplete({ questionId:question.id||qNum, topic:question.topic, section:question.sectionName||question.section, type:qType, correct, confidence:confidence?.v||multiConf?.v||null, timeSpent:elapsed });
  };

  const allMatchFilled = (question.pairs||[]).length>0 && (question.pairs||[]).every((_,i)=>matchSel[i]!==undefined);

  return (
    <div className="question-container">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32}}><Logo size={36}/><Timer seconds={elapsed}/></div>
      <div className="progress-bar-container"><div className="progress-bar-fill" style={{width:`${(qNum/total)*100}%`}}/></div>
      <div className="question-meta">
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span className="badge">{question.sectionName||question.section}</span>
          <span className={`type-badge type-${qType}`}>{qType==="mcq"?"Один ответ":qType==="multiple"?"Несколько ответов":"Соответствие"}</span>
        </div>
        <span style={{color:THEME.textLight,fontSize:14}}>Вопрос {qNum} из {total}</span>
      </div>
      <h2 className="question-text">{question.text}</h2>

      {/* ── MCQ ── */}
      {qType==="mcq" && (
        <>
          <div className="options-grid">
            {(question.options||[]).map((opt,i)=>{
              const isSel=selected===i;
              const cls=isSel?"selected":selected!==null?"disabled":"";
              return(<div key={i} className={`option-card ${cls}`} onClick={()=>confidence===null&&setSelected(i)}>
                <div className="option-letter">{String.fromCharCode(65+i)}</div>
                <div className="option-content">{opt}</div>
              </div>);
            })}
          </div>
          {selected!==null&&(
            <div className="confidence-section scale-in"><h4>Насколько вы уверены?</h4>
              <div className="confidence-grid">{CONFIDENCE_LEVELS.map(c=><button key={c.v} className={`conf-btn ${confidence?.v===c.v?"active":""}`} style={confidence?.v===c.v?{borderColor:c.color,background:c.color+"10",color:c.color}:{}} onClick={()=>setConfidence(c)}>{c.label}</button>)}</div>
            </div>
          )}
        </>
      )}

      {/* ── MULTIPLE ── */}
      {qType==="multiple" && (
        <>
          <p style={{color:THEME.textLight,fontSize:14,marginBottom:16}}>Выберите все правильные ответы</p>
          <div className="options-grid">
            {(question.options||[]).map((opt,i)=>{
              const isSel=multiSelected.includes(i);
              const cls=multiSubmitted?(isSel?"selected":"disabled"):(isSel?"selected":"");
              return(<div key={i} className={`option-card ${cls}`} onClick={()=>{if(multiSubmitted)return; setMultiSelected(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);}}>
                <div className="option-letter" style={{borderRadius:4}}>{isSel?"✓":String.fromCharCode(65+i)}</div>
                <div className="option-content">{opt}</div>
              </div>);
            })}
          </div>
          {!multiSubmitted&&multiSelected.length>0&&(
            <button className="cta-button active" onClick={()=>setMultiSubmitted(true)} style={{marginBottom:24}}>Подтвердить ответ</button>
          )}
          {multiSubmitted&&!multiReady&&(
            <div className="confidence-section scale-in"><h4>Насколько вы уверены?</h4>
              <div className="confidence-grid">{CONFIDENCE_LEVELS.map(c=><button key={c.v} className={`conf-btn ${multiConf?.v===c.v?"active":""}`} style={multiConf?.v===c.v?{borderColor:c.color,background:c.color+"10",color:c.color}:{}} onClick={()=>setMultiConf(c)}>{c.label}</button>)}</div>
            </div>
          )}
        </>
      )}

      {/* ── MATCHING ── */}
      {qType==="matching" && (
        <>
          <p style={{color:THEME.textLight,fontSize:14,marginBottom:20}}>Для каждого элемента слева выберите соответствующий справа</p>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:32}}>
            {(question.pairs||[]).map((pair,i)=>{
              const selectedRight=matchSel[i];
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#fff",borderRadius:12,border:`1px solid ${THEME.border}`}}>
                  <div style={{flex:1,fontWeight:600,color:THEME.primary,fontSize:15}}>{pair.left}</div>
                  <div style={{color:THEME.textLight,fontWeight:700,fontSize:18}}>→</div>
                  <select value={selectedRight??""} onChange={e=>!matchSubmitted&&setMatchSel(p=>({...p,[i]:Number(e.target.value)}))}
                    style={{flex:1,padding:"10px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",cursor:matchSubmitted?"default":"pointer"}} disabled={matchSubmitted}>
                    <option value="" disabled>Выбрать...</option>
                    {shuffledRights.map((r,ri)=><option key={ri} value={r.originalIndex}>{r.text}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          {!matchSubmitted&&<button className={`cta-button ${allMatchFilled?"active":""}`} disabled={!allMatchFilled} onClick={()=>setMatchSubmitted(true)} style={{marginBottom:24}}>Подтвердить соответствие</button>}
        </>
      )}

      <div style={{marginTop:qType==="matching"?0:16}}>
        <button className={`cta-button ${canProceed?"active":""}`} disabled={!canProceed} onClick={handleNext}>
          {qNum<total?"Следующий вопрос →":"Завершить диагностику"}
        </button>
      </div>
    </div>
  );
}

// ── ОТЧЁТ ─────────────────────────────────────────────────────────────────────
function ReportScreen({ report, user, onUpload, onViewPlan, onBack }) {
  const { answers } = report;
  const correct=answers.filter(a=>a.correct).length;
  const score=Math.round((correct/answers.length)*100);
  const skills=answers.map(a=>{
    let zone="green",statusText="Верно",priority=3;
    if(!a.correct){zone="red";statusText="Неверно";priority=1;}
    else if(a.confidence&&a.confidence<=2){zone="yellow";statusText="Хрупкое знание";priority=2;}
    if(!a.correct&&a.confidence&&a.confidence>=4) statusText="⚠️ Иллюзия знаний";
    return{...a,zone,statusText,priority};
  }).sort((a,b)=>a.priority-b.priority);
  return(
    <div className="report-container">
      <div className="report-header-card">
        <div className="report-hero-compact">
          <div className="score-badge" style={{backgroundColor:score>=80?THEME.success:score>=60?THEME.warning:THEME.error}}>{score}%</div>
          <div><h1>Диагностика завершена</h1><p>{user?.firstName} {user?.lastName} · {user?.details}</p></div>
        </div>
      </div>
      <div className="results-list-modern">
        <h3 style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:800,color:THEME.primary,marginBottom:24}}>Карта навыков</h3>
        {skills.map((a,i)=>(
          <div key={i} className={`result-card-modern ${a.zone}`}>
            <div className="card-main">
              <div><span className="section-badge">{a.section}</span><span className="topic-name">{a.topic}</span></div>
              <div className="status-info"><span className="status-text">{a.statusText}</span><span className="meta-text">{a.timeSpent}с{a.confidence?` · Уверенность: ${a.confidence}/5`:""}</span></div>
            </div>
          </div>
        ))}
      </div>
      {/* Upload CTA */}
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%)",borderRadius:16,padding:"28px 32px",marginTop:32,display:"flex",alignItems:"center",justifyContent:"space-between",gap:24,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:"#fff",marginBottom:6}}>📸 Загрузи фото своих записей</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.5}}>ИИ проанализирует каждый шаг решения и составит твой индивидуальный план обучения с приоритетами по зонам.</div>
        </div>
        <div style={{display:"flex",gap:12,flexShrink:0,flexWrap:"wrap"}}>
          <button onClick={onBack} style={{padding:"12px 20px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.7)",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>← Главная</button>
          <button onClick={onViewPlan} style={{padding:"12px 20px",borderRadius:8,border:"none",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>План без анализа</button>
          <button onClick={onUpload} style={{padding:"12px 24px",borderRadius:8,border:"none",background:THEME.accent,color:THEME.primary,fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 15px rgba(212,175,55,0.3)"}}>📸 Загрузить записи →</button>
        </div>
      </div>
    </div>
  );
}

// ── ЗАГРУЗКА ФОТО ─────────────────────────────────────────────────────────────
function UploadAnalysisScreen({ user, onDone, onSkip }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = e => {
    const selected = Array.from(e.target.files).slice(0,10);
    setFiles(selected);
    setPreviews(selected.map(f => URL.createObjectURL(f)));
    setError("");
  };

  const handleSend = async () => {
    if (!files.length) { setError("Выберите хотя бы одно фото."); return; }
    setSending(true); setError("");
    try {
      for (let i = 0; i < files.length; i++) {
        await tgPhoto(files[i], `📷 Фото решений (${i+1}/${files.length})\n👤 ${user?.firstName} ${user?.lastName}\n📞 ${user?.phone}`);
      }
      setDone(true);
      setTimeout(() => onDone(), 2000);
    } catch(e) {
      setError("Ошибка отправки: " + e.message);
    }
    setSending(false);
  };

  if (done) return (
    <div style={{minHeight:"100vh",background:THEME.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:16}}>✅</div>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:800,color:THEME.primary,marginBottom:8}}>Фото отправлены!</div>
        <div style={{color:THEME.textLight,fontSize:15}}>Возвращаемся в главное меню...</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav style={{background:THEME.primary,padding:"0 40px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo size={32} light/>
        <button onClick={onSkip} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Пропустить</button>
      </nav>
      <div style={{maxWidth:680,margin:"0 auto",padding:"48px 24px"}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,color:THEME.primary,marginBottom:8}}>Загрузи фото решений</h1>
        <p style={{color:THEME.textLight,fontSize:16,marginBottom:36,lineHeight:1.6}}>Сфотографируй свои записи и отправь преподавателю для проверки.</p>

        <label style={{display:"block",border:`2px dashed ${files.length?THEME.success:THEME.border}`,borderRadius:16,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:files.length?"rgba(16,185,129,0.03)":"#fff",transition:"all 0.2s",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:12}}>{files.length?"✅":"📷"}</div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:16,color:THEME.primary,marginBottom:6}}>
            {files.length?`Выбрано фото: ${files.length}`:"Нажми чтобы выбрать фото"}
          </div>
          <div style={{fontSize:13,color:THEME.textLight}}>JPG, PNG, HEIC — до 10 фото. Сделай чёткое фото при хорошем освещении.</div>
          <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleFiles}/>
        </label>

        {previews.length>0 && (
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:28}}>
            {previews.map((p,i)=>(
              <div key={i} style={{width:110,height:110,borderRadius:12,overflow:"hidden",border:`2px solid ${THEME.border}`}}>
                <img src={p} alt={`Фото ${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{background:"rgba(239,68,68,0.08)",border:`1px solid ${THEME.error}`,borderRadius:12,padding:"14px 18px",color:THEME.error,fontSize:14,marginBottom:20}}>{error}</div>}

        {sending && (
          <div style={{background:"rgba(15,23,42,0.04)",border:`1px solid ${THEME.border}`,borderRadius:12,padding:"16px 20px",marginBottom:20,textAlign:"center",color:THEME.textLight,fontSize:14}}>
            Отправляю фото... Не закрывай страницу.
          </div>
        )}

        <button onClick={handleSend} disabled={!files.length||sending} className={`cta-button ${files.length&&!sending?"active":""}`}>
          {sending?"Отправляю...":"📤 Отправить фото преподавателю"}
        </button>
        <button onClick={onSkip} style={{width:"100%",marginTop:12,padding:"14px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"transparent",color:THEME.textLight,fontFamily:"'Montserrat',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer"}}>Пропустить</button>
      </div>
    </div>
  );
}

// ── ИНДИВИДУАЛЬНЫЙ ПЛАН ОБУЧЕНИЯ ──────────────────────────────────────────────
function IndividualPlanScreen({ user, onBack }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(()=>{
    const load = async () => {
      try {
        const snap = await getDocs(collection(db,"diagnosticResults"));
        const results = snap.docs
          .map(d=>({id:d.id,...d.data()}))
          .filter(r=>r.userPhone===user?.phone && r.zoneAnalysis?.length)
          .sort((a,b)=>a.completedAt?.localeCompare(b.completedAt)); // oldest first
        if (results.length) setLastUpdated(results[results.length-1].completedAt);

        // Merge: latest result per topic wins, but take worst zone across last 2 attempts
        const zoneRank = { red:0, yellow:1, green:2 };
        const topicMap = {};
        results.forEach(r => {
          (r.zoneAnalysis||[]).forEach(t => {
            const key = `${t.section}|||${t.topic}`;
            const existing = topicMap[key];
            if (!existing) { topicMap[key] = { ...t, date: r.completedAt }; }
            else {
              // If newer attempt is worse or same, update
              if (zoneRank[t.zone] <= zoneRank[existing.zone]) {
                topicMap[key] = { ...t, date: r.completedAt };
              }
            }
          });
        });

        const all = Object.values(topicMap);
        all.sort((a,b) => zoneRank[a.zone] - zoneRank[b.zone]);
        setTopics(all);
      } catch(e){ console.error(e); }
      setLoading(false);
    };
    load();
  },[user?.phone]);

  const zones = {
    red:    { label:"🔴 Критическая зона",    desc:"Требует немедленной проработки",           color:THEME.error,   bg:"rgba(239,68,68,0.06)",   border:"rgba(239,68,68,0.2)"  },
    yellow: { label:"🟡 Требует внимания",     desc:"Понимание частичное, нужно закрепить",     color:"#b45309",     bg:"rgba(245,158,11,0.06)",   border:"rgba(245,158,11,0.25)" },
    green:  { label:"🟢 Небольшие недочёты",   desc:"В целом понятно, доработать детали",       color:"#065f46",     bg:"rgba(16,185,129,0.06)",   border:"rgba(16,185,129,0.2)"  },
  };

  const grouped = {
    red:    topics.filter(t=>t.zone==="red"),
    yellow: topics.filter(t=>t.zone==="yellow"),
    green:  topics.filter(t=>t.zone==="green"),
  };
  const totalTopics = topics.length;
  const redPct = totalTopics ? Math.round((grouped.red.length/totalTopics)*100) : 0;

  return (
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"0 40px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo size={32}/>
        <button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Главная</button>
      </nav>
      <div style={{maxWidth:920,margin:"0 auto",padding:"48px 24px"}}>
        <div style={{marginBottom:36}}>
          <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:30,fontWeight:800,color:THEME.primary,marginBottom:6}}>Индивидуальный план обучения</h1>
          <p style={{color:THEME.textLight,fontSize:15}}>{user?.firstName} {user?.lastName} · {user?.goal} · {user?.details}</p>
          {lastUpdated && <p style={{color:THEME.textLight,fontSize:13,marginTop:4}}>Обновлён: {new Date(lastUpdated).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</p>}
        </div>

        {loading && <div style={{textAlign:"center",padding:80,color:THEME.textLight}}>Загрузка плана...</div>}

        {!loading && topics.length===0 && (
          <div style={{textAlign:"center",padding:80}}>
            <div style={{fontSize:56,marginBottom:20}}>🎯</div>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,color:THEME.primary,marginBottom:12}}>План пока пуст</h3>
            <p style={{color:THEME.textLight,maxWidth:420,margin:"0 auto",lineHeight:1.6}}>Пройди диагностику и загрузи фото своих записей — ИИ проанализирует твои ответы и составит персональный план с приоритетами.</p>
            <button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"14px 28px",marginTop:28}}>Перейти к диагностике</button>
          </div>
        )}

        {!loading && topics.length>0 && (
          <>
            {/* Summary bar */}
            <div style={{background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:16,padding:"24px 28px",marginBottom:28,display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:13,fontWeight:600,color:THEME.textLight,marginBottom:8}}>Распределение по зонам</div>
                <div style={{height:10,borderRadius:99,overflow:"hidden",display:"flex",gap:2}}>
                  {grouped.red.length>0    && <div style={{flex:grouped.red.length,   background:THEME.error,  borderRadius:99}}/>}
                  {grouped.yellow.length>0 && <div style={{flex:grouped.yellow.length,background:THEME.warning,borderRadius:99}}/>}
                  {grouped.green.length>0  && <div style={{flex:grouped.green.length, background:THEME.success,borderRadius:99}}/>}
                </div>
              </div>
              {Object.entries(grouped).map(([zone,arr])=>arr.length>0&&(
                <div key={zone} style={{textAlign:"center"}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:800,color:zones[zone].color}}>{arr.length}</div>
                  <div style={{fontSize:12,color:THEME.textLight}}>{zone==="red"?"критичных":zone==="yellow"?"в работе":"в порядке"}</div>
                </div>
              ))}
            </div>

            {/* Topic groups */}
            {["red","yellow","green"].map(zone => grouped[zone].length>0 && (
              <div key={zone} style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                  <h2 style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:800,color:zones[zone].color}}>{zones[zone].label}</h2>
                  <span style={{fontSize:13,color:THEME.textLight}}>{zones[zone].desc}</span>
                  <span style={{marginLeft:"auto",background:zones[zone].bg,color:zones[zone].color,fontWeight:700,fontSize:13,padding:"3px 12px",borderRadius:99,border:`1px solid ${zones[zone].border}`}}>{grouped[zone].length} тем</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {grouped[zone].map((t,i)=>(
                    <div key={i} style={{background:"#fff",borderRadius:14,border:`1px solid ${zones[zone].border}`,borderLeft:`5px solid ${zones[zone].color}`,padding:"20px 24px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                            <span style={{background:THEME.primary,color:THEME.accent,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6,textTransform:"uppercase"}}>{t.section}</span>
                            <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary}}>{t.topic}</span>
                          </div>
                          {t.reason && <p style={{color:THEME.textLight,fontSize:14,lineHeight:1.5,marginBottom:t.skills?.length?12:0}}>{t.reason}</p>}
                          {t.skills?.length>0 && (
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Навыки для проработки:</div>
                              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                {t.skills.map((s,si)=>(
                                  <span key={si} style={{background:zones[zone].bg,color:zones[zone].color,border:`1px solid ${zones[zone].border}`,fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:99}}>{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{flexShrink:0,width:36,height:36,borderRadius:10,background:zones[zone].bg,border:`1px solid ${zones[zone].border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                          {zone==="red"?"🔴":zone==="yellow"?"🟡":"🟢"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function PathMap({ user, onBack }) {
  return(
    <div className="path-container">
      <div className="path-header"><h1>Образовательный трек {user?.firstName}</h1></div>
      <div className="path-visualization-modern">
        <svg width="100%" height={450} viewBox="0 0 920 450" preserveAspectRatio="xMidYMid meet">
          {RPG_PATHS.map(([a,b])=>{ const na=RPG_NODES.find(n=>n.id===a),nb=RPG_NODES.find(n=>n.id===b); return<line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={THEME.accent} strokeWidth={1} opacity={0.4}/>; })}
          {RPG_NODES.map(n=>{ const boss=n.type==="boss"; return(<g key={n.id} transform={`translate(${n.x},${n.y})`}><circle r={boss?24:16} fill={THEME.primary} stroke={THEME.accent} strokeWidth={boss?3:2}/><text y={40} textAnchor="middle" fontSize={12} fontWeight={600} fill="#cbd5e1" fontFamily="Inter">{n.name}</text></g>); })}
        </svg>
      </div>
      <div style={{textAlign:"center",marginTop:32}}><button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"12px 28px"}}>← Вернуться</button></div>
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
function AdminScreen({ onBack }) {
  const [tab,setTab]=useState("sections");
  const [sections,setSections]=useState([]);
  const [questions,setQuestions]=useState([]);
  const [students,setStudents]=useState([]);
  const [loading,setLoading]=useState(true);

  // Section form
  const emptySecForm = {name:"",description:"",goalKey:"",specificTarget:""};
  const [secForm,setSecForm]=useState(emptySecForm);
  const [showSecForm,setShowSecForm]=useState(false);
  const [editingSection,setEditingSection]=useState(null); // id of section being edited

  // Question form
  const emptyQForm = {sectionId:"",sectionName:"",topic:"",text:"",type:"mcq",options:["","","",""],correct:0,correctAnswers:[],pairs:[{left:"",right:""},{left:"",right:""}],goals:[]};
  const [qForm,setQForm]=useState(emptyQForm);
  const [showQForm,setShowQForm]=useState(false);
  const [editingQuestion,setEditingQuestion]=useState(null); // id of question being edited
  const [filterSec,setFilterSec]=useState("all");
  const [filterGoal,setFilterGoal]=useState("all");

  // CSV import
  const [showCsvImport,setShowCsvImport]=useState(false);
  const [csvSectionId,setCsvSectionId]=useState("");
  const [csvText,setCsvText]=useState("");
  const [csvImporting,setCsvImporting]=useState(false);

  useEffect(()=>{
    const load=async()=>{
      try{
        const [sS,qS,uS]=await Promise.all([getDocs(collection(db,"sections")),getDocs(collection(db,"questions")),getDocs(collection(db,"users"))]);
        setSections(sS.docs.map(d=>({id:d.id,...d.data()})));
        setQuestions(qS.docs.map(d=>({id:d.id,...d.data()})));
        setStudents(uS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.lastName||"").localeCompare(b.lastName||"")));
      }catch(e){console.error(e);}
      setLoading(false);
    };
    load();
  },[]);

  // ─ Sections ─
  const openAddSection=()=>{setSecForm(emptySecForm);setEditingSection(null);setShowSecForm(true);};
  const openEditSection=s=>{setSecForm({name:s.name,description:s.description||"",goalKey:s.goalKey,specificTarget:s.specificTarget});setEditingSection(s.id);setShowSecForm(true);};
  const closeSecForm=()=>{setShowSecForm(false);setEditingSection(null);setSecForm(emptySecForm);};

  const addSection=async e=>{
    e.preventDefault();
    if(!secForm.name.trim()||!secForm.goalKey||!secForm.specificTarget){alert("Заполните все поля.");return;}
    try{
      const data={...secForm,name:secForm.name.trim(),createdAt:new Date().toISOString()};
      const ref=await addDoc(collection(db,"sections"),data);
      setSections(p=>[...p,{id:ref.id,...data}]);
      closeSecForm();
    }catch{alert("Ошибка.");}
  };
  const saveSection=async e=>{
    e.preventDefault();
    if(!secForm.name.trim()||!secForm.goalKey||!secForm.specificTarget){alert("Заполните все поля.");return;}
    try{
      const data={name:secForm.name.trim(),description:secForm.description,goalKey:secForm.goalKey,specificTarget:secForm.specificTarget};
      await updateDoc(doc(db,"sections",editingSection),data);
      setSections(p=>p.map(s=>s.id===editingSection?{...s,...data}:s));
      closeSecForm();
    }catch{alert("Ошибка при сохранении.");}
  };
  const delSection=async id=>{
    if(!confirm("Удалить раздел?"))return;
    try{await deleteDoc(doc(db,"sections",id)); setSections(p=>p.filter(s=>s.id!==id));}catch{alert("Ошибка.");}
  };

  // ─ Questions ─
  const addOpt=()=>setQForm(p=>({...p,options:[...p.options,""]}));
  const remOpt=i=>{
    if(qForm.options.length<=2)return;
    setQForm(p=>{
      const opts=p.options.filter((_,j)=>j!==i);
      const correct=p.correct>=i&&p.correct>0?p.correct-1:p.correct;
      const correctAnswers=p.correctAnswers.filter(x=>x!==i).map(x=>x>i?x-1:x);
      return{...p,options:opts,correct,correctAnswers};
    });
  };
  const addPair=()=>setQForm(p=>({...p,pairs:[...p.pairs,{left:"",right:""}]}));
  const remPair=i=>{if(qForm.pairs.length<=2)return; setQForm(p=>({...p,pairs:p.pairs.filter((_,j)=>j!==i)}))};
  const toggleCorrectAnswer=i=>setQForm(p=>({...p,correctAnswers:p.correctAnswers.includes(i)?p.correctAnswers.filter(x=>x!==i):[...p.correctAnswers,i]}));
  const toggleGoalQ=k=>setQForm(p=>({...p,goals:p.goals.includes(k)?p.goals.filter(g=>g!==k):[...p.goals,k]}));

  const buildQData=()=>{
    const data={sectionId:qForm.sectionId,sectionName:qForm.sectionName,topic:qForm.topic,text:qForm.text,type:qForm.type,goals:qForm.goals};
    if(qForm.type==="mcq"){data.options=qForm.options.map(o=>o.trim());data.correct=qForm.correct;}
    else if(qForm.type==="multiple"){data.options=qForm.options.map(o=>o.trim());data.correctAnswers=qForm.correctAnswers;}
    else if(qForm.type==="matching"){data.pairs=qForm.pairs;}
    return data;
  };
  const validateQForm=()=>{
    if(!qForm.sectionId||!qForm.topic.trim()||!qForm.text.trim()||!qForm.goals.length){alert("Заполните все обязательные поля.");return false;}
    if(qForm.type==="mcq"&&qForm.options.some(o=>!o.trim())){alert("Заполните все варианты ответа.");return false;}
    if(qForm.type==="multiple"&&(qForm.options.some(o=>!o.trim())||qForm.correctAnswers.length===0)){alert("Заполните варианты и отметьте правильные.");return false;}
    if(qForm.type==="matching"&&qForm.pairs.some(p=>!p.left.trim()||!p.right.trim())){alert("Заполните все пары соответствия.");return false;}
    return true;
  };

  const openAddQuestion=()=>{setQForm(emptyQForm);setEditingQuestion(null);setShowQForm(true);};
  const openEditQuestion=q=>{
    setQForm({
      sectionId:q.sectionId||"",sectionName:q.sectionName||"",topic:q.topic||"",text:q.text||"",
      type:q.type||"mcq",goals:q.goals||[],
      options:q.options?.length?q.options:["","","",""],
      correct:q.correct||0,
      correctAnswers:q.correctAnswers||[],
      pairs:q.pairs?.length?q.pairs:[{left:"",right:""},{left:"",right:""}]
    });
    setEditingQuestion(q.id);
    setShowQForm(true);
  };
  const closeQForm=()=>{setShowQForm(false);setEditingQuestion(null);setQForm(emptyQForm);};

  const addQuestion=async e=>{
    e.preventDefault();
    if(!validateQForm())return;
    try{
      const data={...buildQData(),createdAt:new Date().toISOString()};
      const ref=await addDoc(collection(db,"questions"),data);
      setQuestions(p=>[...p,{id:ref.id,...data}]);
      closeQForm();
    }catch{alert("Ошибка.");}
  };
  const saveQuestion=async e=>{
    e.preventDefault();
    if(!validateQForm())return;
    try{
      const data=buildQData();
      // Clear fields that don't belong to new type
      const clearFields={};
      if(data.type!=="mcq"&&data.type!=="multiple"){clearFields.options=null;clearFields.correct=null;clearFields.correctAnswers=null;}
      if(data.type!=="matching"){clearFields.pairs=null;}
      await updateDoc(doc(db,"questions",editingQuestion),{...data,...clearFields});
      setQuestions(p=>p.map(q=>q.id===editingQuestion?{...q,...data}:q));
      closeQForm();
    }catch(e){alert("Ошибка при сохранении: "+e.message);}
  };
  const delQuestion=async id=>{
    if(!confirm("Удалить вопрос?"))return;
    try{await deleteDoc(doc(db,"questions",id)); setQuestions(p=>p.filter(q=>q.id!==id));}catch{alert("Ошибка.");}
  };

  // ─ CSV Bulk Import ─
  // Format (tab or semicolon separated):
  // mcq:   mcq ; topic ; question text ; opt1 ; opt2 ; opt3 ; opt4 ; correct_index(0-based) ; goals(exam,gaps,future)
  // multiple: multiple ; topic ; question text ; opt1 ; opt2 ; opt3 ; opt4 ; correct_indices(0,1) ; goals
  // matching: matching ; topic ; question text ; left1=right1 ; left2=right2 ; ... ; goals
  const parseCsvRow=(row,sep)=>{
    const c=row.split(sep).map(s=>s.trim());
    if(c.length<3)return null;
    const type=c[0].toLowerCase();
    const topic=c[1];
    const text=c[2];
    const goalsRaw=c[c.length-1];
    const goals=goalsRaw.split(",").map(g=>g.trim()).filter(g=>["exam","gaps","future"].includes(g));
    if(!type||!topic||!text||!goals.length)return null;
    if(type==="mcq"){
      const opts=c.slice(3,c.length-2);
      const correctIdx=parseInt(c[c.length-2]);
      if(opts.length<2||isNaN(correctIdx))return null;
      return{type:"mcq",topic,text,goals,options:opts,correct:correctIdx};
    }
    if(type==="multiple"){
      const opts=c.slice(3,c.length-2);
      const correctAnswers=(c[c.length-2]||"").split(",").map(x=>parseInt(x.trim())).filter(x=>!isNaN(x));
      if(opts.length<2||!correctAnswers.length)return null;
      return{type:"multiple",topic,text,goals,options:opts,correctAnswers};
    }
    if(type==="matching"){
      const pairs=c.slice(3,c.length-1).map(p=>{const[l,...r]=p.split("=");return{left:l.trim(),right:r.join("=").trim()};}).filter(p=>p.left&&p.right);
      if(pairs.length<2)return null;
      return{type:"matching",topic,text,goals,pairs};
    }
    return null;
  };

  const handleCsvImport=async()=>{
    if(!csvSectionId){alert("Выберите раздел для импорта.");return;}
    const sec=sections.find(s=>s.id===csvSectionId);
    if(!sec)return;
    const lines=csvText.split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#"));
    if(!lines.length){alert("Нет данных для импорта.");return;}
    // Auto-detect separator: semicolon or tab
    const sep=lines[0].includes("\t")?"\t":";";
    const parsed=lines.map(l=>parseCsvRow(l,sep)).filter(Boolean);
    if(!parsed.length){alert("Не удалось распознать ни одной строки. Проверьте формат.");return;}
    if(!confirm(`Импортировать ${parsed.length} вопросов в раздел «${sec.name}»?`))return;
    setCsvImporting(true);
    try{
      const added=[];
      for(const q of parsed){
        const data={...q,sectionId:sec.id,sectionName:sec.name,createdAt:new Date().toISOString()};
        const ref=await addDoc(collection(db,"questions"),data);
        added.push({id:ref.id,...data});
      }
      setQuestions(p=>[...p,...added]);
      setShowCsvImport(false);
      setCsvText("");
      setCsvSectionId("");
      alert(`Успешно импортировано ${added.length} вопросов!`);
    }catch(e){alert("Ошибка при импорте: "+e.message);}
    setCsvImporting(false);
  };

  const downloadCsvTemplate=()=>{
    const header="# Формат: type;topic;question_text;[options...];correct_index_or_pairs;goals\n"+
      "# type: mcq | multiple | matching\n"+
      "# goals: через запятую из exam,gaps,future\n"+
      "# Пример MCQ:\n"+
      "mcq;Линейные уравнения;Решите: 3x+7=22;x=5;x=3;x=7;x=4;0;exam,gaps\n"+
      "# Пример Multiple (несколько верных):\n"+
      "multiple;Свойства степеней;Что верно для a^n?;a^n=a*n;a^n*a^m=a^(n+m);a^0=1;(a^n)^m=a^(nm);1,2,3;future\n"+
      "# Пример Matching (левая=правая):\n"+
      "matching;Формулы;Сопоставьте формулы;S=bh/2=Площадь треугольника;C=2πr=Длина окружности;V=lwh=Объём прямоугольника;exam,gaps,future\n";
    const blob=new Blob([header],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="questions_template.csv";a.click();URL.revokeObjectURL(url);
  };

  const filteredQ=questions.filter(q=>{
    const sOk=filterSec==="all"||q.sectionId===filterSec;
    const gOk=filterGoal==="all"||(q.goals||[]).includes(filterGoal);
    return sOk&&gOk;
  });

  // ─ Students ─
  const [editingPwdFor,setEditingPwdFor]=useState(null);
  const [newPwd,setNewPwd]=useState("");

  const updateStatus=async(phone,status)=>{
    try{await updateDoc(doc(db,"users",phone),{status}); setStudents(p=>p.map(s=>s.id===phone?{...s,status}:s));}
    catch{alert("Ошибка.");}
  };
  const savePassword=async(phone)=>{
    if(!newPwd.trim()){alert("Введите пароль.");return;}
    try{
      await updateDoc(doc(db,"users",phone),{password:newPwd.trim()});
      setStudents(p=>p.map(s=>s.id===phone?{...s,password:newPwd.trim()}:s));
      setEditingPwdFor(null);setNewPwd("");
    }catch{alert("Ошибка.");}
  };
  const removePassword=async(phone)=>{
    if(!confirm("Убрать пароль? Ученик сможет войти без него."))return;
    try{
      await updateDoc(doc(db,"users",phone),{password:null});
      setStudents(p=>p.map(s=>s.id===phone?{...s,password:null}:s));
    }catch{alert("Ошибка.");}
  };

  const TABS=[{id:"sections",label:"📂 Разделы"},{id:"questions",label:"❓ Вопросы"},{id:"students",label:"👥 Ученики"}];

  return(
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <div style={{background:THEME.primary,padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
        <Logo size={32} light/>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span style={{color:THEME.accent,fontWeight:700,fontSize:13,background:"rgba(212,175,55,0.15)",padding:"4px 12px",borderRadius:99}}>Администратор</span>
          <button onClick={onBack} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif"}}>← Выйти</button>
        </div>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"36px 24px"}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:26,fontWeight:800,color:THEME.primary,marginBottom:24}}>Панель администратора</h1>
        <div style={{display:"flex",gap:4,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:12,padding:6,marginBottom:32,width:"fit-content"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 20px",borderRadius:8,border:"none",background:tab===t.id?THEME.primary:"transparent",color:tab===t.id?"#fff":THEME.textLight,fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s"}}>{t.label}</button>)}
        </div>

        {loading&&<div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загрузка...</div>}

        {/* ── SECTIONS ── */}
        {!loading&&tab==="sections"&&(
          <div>
            <div className="admin-section-header">
              <div><h2 className="admin-section-title">Разделы диагностики</h2><p style={{color:THEME.textLight,fontSize:14}}>Каждый раздел привязан к цели и экзамену/классу</p></div>
              <button className="add-btn" onClick={openAddSection}>+ Новый раздел</button>
            </div>
            {showSecForm&&(
              <div className="admin-form-card">
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>{editingSection?"Редактировать раздел":"Новый раздел"}</h3>
                <form onSubmit={editingSection?saveSection:addSection}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Название раздела *</label>
                      <input type="text" className="input-field" value={secForm.name} onChange={e=>setSecForm(p=>({...p,name:e.target.value}))} placeholder="Алгебра, Физика..." required/>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Цель *</label>
                      <select className="input-field" value={secForm.goalKey} onChange={e=>setSecForm(p=>({...p,goalKey:e.target.value,specificTarget:""}))} required>
                        <option value="" disabled>Выберите...</option>
                        {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  {secForm.goalKey&&(
                    <div className="input-group" style={{marginTop:16}}>
                      <label className="input-label">{secForm.goalKey==="exam"?"Экзамен *":"Класс *"}</label>
                      <select className="input-field" value={secForm.specificTarget} onChange={e=>setSecForm(p=>({...p,specificTarget:e.target.value}))} required>
                        <option value="" disabled>Выберите...</option>
                        {getSpecificList(secForm.goalKey).map(x=><option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="input-group">
                    <label className="input-label">Описание (необязательно)</label>
                    <input type="text" className="input-field" value={secForm.description} onChange={e=>setSecForm(p=>({...p,description:e.target.value}))} placeholder="Краткое описание раздела..."/>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={closeSecForm}>Отмена</button>
                    <button type="submit" className="cta-button active">{editingSection?"Сохранить":"Добавить"}</button>
                  </div>
                </form>
              </div>
            )}
            {sections.length===0?<div className="empty-state">Разделов пока нет.</div>:(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
                {sections.map(s=>(
                  <div key={s.id} className="admin-card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:17,color:THEME.primary,marginBottom:6}}>{s.name}</div>
                        {s.description&&<div style={{color:THEME.textLight,fontSize:13,marginBottom:8}}>{s.description}</div>}
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                          <span style={{background:"rgba(212,175,55,0.12)",color:"#92680e",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{REG_GOALS[s.goalKey]||s.goalKey}</span>
                          {s.specificTarget&&<span style={{background:THEME.bg,color:THEME.textLight,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,border:`1px solid ${THEME.border}`}}>{s.specificTarget}</span>}
                        </div>
                        <div style={{fontSize:12,color:THEME.textLight}}>{questions.filter(q=>q.sectionId===s.id).length} вопросов</div>
                      </div>
                      <div style={{display:"flex",gap:4,marginLeft:8,flexShrink:0}}>
                        <button onClick={()=>openEditSection(s)} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6}} title="Редактировать">✏️</button>
                        <button onClick={()=>delSection(s.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}} title="Удалить">×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QUESTIONS ── */}
        {!loading&&tab==="questions"&&(
          <div>
            <div className="admin-section-header">
              <div><h2 className="admin-section-title">Вопросы для диагностики</h2><p style={{color:THEME.textLight,fontSize:14}}>Показано {filteredQ.length} из {questions.length}</p></div>
              <div style={{display:"flex",gap:10}}>
                <button className="add-btn" style={{background:"#fff",border:`1px solid ${THEME.accent}`,color:THEME.accent}} onClick={()=>{setShowCsvImport(v=>!v);setShowQForm(false);}} disabled={sections.length===0}>📋 Импорт CSV</button>
                <button className="add-btn" onClick={()=>{openAddQuestion();setShowCsvImport(false);}} disabled={sections.length===0} title={sections.length===0?"Сначала создайте раздел":""}>+ Новый вопрос</button>
              </div>
            </div>
            {/* CSV Import Panel */}
            {showCsvImport&&(
              <div className="admin-form-card" style={{marginBottom:24}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0}}>Массовый импорт вопросов (CSV)</h3>
                  <button onClick={downloadCsvTemplate} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"6px 14px",borderRadius:8,fontFamily:"'Inter',sans-serif"}}>⬇ Скачать шаблон</button>
                </div>
                <div style={{background:"#f8fafc",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:12,color:THEME.textLight,lineHeight:1.7}}>
                  <strong style={{color:THEME.text}}>Формат строки (разделитель — точка с запятой <code>;</code>):</strong><br/>
                  <code>mcq ; тема ; текст вопроса ; вар1 ; вар2 ; вар3 ; вар4 ; индекс_верного(0) ; цели</code><br/>
                  <code>multiple ; тема ; текст ; вар1 ; вар2 ; вар3 ; верные_индексы(0,2) ; цели</code><br/>
                  <code>matching ; тема ; текст ; левое1=правое1 ; левое2=правое2 ; цели</code><br/>
                  <strong>цели</strong> — через запятую: <code>exam</code>, <code>gaps</code>, <code>future</code>
                </div>
                <div className="input-group">
                  <label className="input-label">Раздел для импорта *</label>
                  <select className="input-field" value={csvSectionId} onChange={e=>setCsvSectionId(e.target.value)}>
                    <option value="" disabled>Выберите раздел...</option>
                    {sections.map(s=><option key={s.id} value={s.id}>{s.name} ({s.specificTarget})</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Данные (каждый вопрос — новая строка)</label>
                  <textarea className="input-field" rows={10} style={{fontFamily:"'Courier New',monospace",fontSize:12}} value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder={"mcq;Линейные уравнения;Решите: 3x+7=22;x=5;x=3;x=7;x=4;0;exam,gaps\nmultiple;Степени;Что верно?;a^n*a^m=a^(n+m);a^0=1;a^n=a*n;0,1;future\nmatching;Формулы;Сопоставьте;S=bh/2=Площадь треугольника;C=2πr=Длина окружности;exam,gaps,future"}/>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowCsvImport(false);setCsvText("");setCsvSectionId("");}}>Отмена</button>
                  <button type="button" className="cta-button active" onClick={handleCsvImport} disabled={csvImporting}>{csvImporting?"Импортирую...":"Импортировать"}</button>
                  {csvText&&<span style={{fontSize:12,color:THEME.textLight}}>{csvText.split("\n").filter(l=>l.trim()&&!l.startsWith("#")).length} строк</span>}
                </div>
              </div>
            )}
            {/* Filters */}
            <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
              <select className="input-field" style={{width:"auto",minWidth:180}} value={filterSec} onChange={e=>setFilterSec(e.target.value)}>
                <option value="all">Все разделы</option>
                {sections.map(s=><option key={s.id} value={s.id}>{s.name} ({s.specificTarget})</option>)}
              </select>
              <select className="input-field" style={{width:"auto",minWidth:200}} value={filterGoal} onChange={e=>setFilterGoal(e.target.value)}>
                <option value="all">Все цели</option>
                {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {/* Add/Edit Question Form */}
            {showQForm&&(
              <div className="admin-form-card">
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>{editingQuestion?"Редактировать вопрос":"Новый вопрос"}</h3>
                <form onSubmit={editingQuestion?saveQuestion:addQuestion}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:0}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Раздел *</label>
                      <select className="input-field" value={qForm.sectionId} onChange={e=>{const s=sections.find(x=>x.id===e.target.value); setQForm(p=>({...p,sectionId:e.target.value,sectionName:s?.name||""}));}} required>
                        <option value="" disabled>Выберите...</option>
                        {sections.map(s=><option key={s.id} value={s.id}>{s.name} ({s.specificTarget})</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Тип вопроса *</label>
                      <select className="input-field" value={qForm.type} onChange={e=>setQForm(p=>({...p,type:e.target.value,options:["","","",""],correct:0,correctAnswers:[],pairs:[{left:"",right:""},{left:"",right:""}]}))}>
                        {QUESTION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Тема *</label>
                      <input type="text" className="input-field" value={qForm.topic} onChange={e=>setQForm(p=>({...p,topic:e.target.value}))} placeholder="Линейные уравнения" required/>
                    </div>
                  </div>
                  <div className="input-group" style={{marginTop:16}}>
                    <label className="input-label">Текст вопроса *</label>
                    <textarea className="input-field" value={qForm.text} onChange={e=>setQForm(p=>({...p,text:e.target.value}))} rows={3} style={{resize:"vertical"}} placeholder="Введите вопрос..." required/>
                  </div>

                  {/* MCQ options */}
                  {(qForm.type==="mcq"||qForm.type==="multiple")&&(
                    <div className="input-group">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <label className="input-label" style={{margin:0}}>Варианты ответов *</label>
                        <button type="button" onClick={addOpt} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить вариант</button>
                      </div>
                      {qForm.options.map((opt,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                          {qForm.type==="mcq"
                            ? <input type="radio" name="correct" checked={qForm.correct===i} onChange={()=>setQForm(p=>({...p,correct:i}))} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>
                            : <input type="checkbox" checked={qForm.correctAnswers.includes(i)} onChange={()=>toggleCorrectAnswer(i)} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>
                          }
                          <div style={{width:28,height:28,borderRadius:6,background:qForm.type==="mcq"?(qForm.correct===i?THEME.primary:THEME.bg):(qForm.correctAnswers.includes(i)?THEME.success:THEME.bg),border:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:qForm.type==="mcq"?(qForm.correct===i?THEME.accent:THEME.textLight):(qForm.correctAnswers.includes(i)?"#fff":THEME.textLight),flexShrink:0}}>{String.fromCharCode(65+i)}</div>
                          <input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={opt} onChange={e=>setQForm(p=>({...p,options:p.options.map((o,j)=>j===i?e.target.value:o)}))} placeholder={`Вариант ${String.fromCharCode(65+i)}`}/>
                          {qForm.options.length>2&&<button type="button" onClick={()=>remOpt(i)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px",flexShrink:0}}>×</button>}
                        </div>
                      ))}
                      <p style={{fontSize:12,color:THEME.textLight,marginTop:4}}>{qForm.type==="mcq"?"● = правильный ответ":"☑ = правильные ответы (можно несколько)"}</p>
                    </div>
                  )}

                  {/* Matching pairs */}
                  {qForm.type==="matching"&&(
                    <div className="input-group">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <label className="input-label" style={{margin:0}}>Пары соответствия *</label>
                        <button type="button" onClick={addPair} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить пару</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:"uppercase",letterSpacing:"0.5px"}}>Левый столбец</div>
                        <div/>
                        <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:"uppercase",letterSpacing:"0.5px"}}>Правый столбец</div>
                        <div/>
                      </div>
                      {qForm.pairs.map((pair,i)=>(
                        <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,alignItems:"center",marginBottom:8}}>
                          <input type="text" className="input-field" style={{marginBottom:0}} value={pair.left} onChange={e=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,left:e.target.value}:x)}))} placeholder={`Левый ${i+1}`}/>
                          <div style={{color:THEME.textLight,fontWeight:700,textAlign:"center"}}>→</div>
                          <input type="text" className="input-field" style={{marginBottom:0}} value={pair.right} onChange={e=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,right:e.target.value}:x)}))} placeholder={`Правый ${i+1}`}/>
                          {qForm.pairs.length>2?<button type="button" onClick={()=>remPair(i)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0"}}>×</button>:<div/>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Goals checkboxes */}
                  <div className="input-group">
                    <label className="input-label">Для каких целей *</label>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
                      {Object.entries(REG_GOALS).map(([k,v])=>(
                        <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 16px",borderRadius:8,border:`1px solid ${qForm.goals.includes(k)?THEME.primary:THEME.border}`,background:qForm.goals.includes(k)?"#f1f5f9":"#fff",fontSize:14,fontWeight:500}}>
                          <input type="checkbox" checked={qForm.goals.includes(k)} onChange={()=>toggleGoalQ(k)} style={{accentColor:THEME.primary}}/>{v}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={closeQForm}>Отмена</button>
                    <button type="submit" className="cta-button active">{editingQuestion?"Сохранить вопрос":"Добавить вопрос"}</button>
                  </div>
                </form>
              </div>
            )}
            {/* Question list */}
            {filteredQ.length===0?<div className="empty-state">{questions.length===0?"Вопросов пока нет.":"Нет вопросов по фильтрам."}</div>:(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {filteredQ.map(q=>(
                  <div key={q.id} className="admin-card">
                    <div style={{display:"flex",justifyContent:"space-between",gap:16}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                          <span style={{background:THEME.primary,color:THEME.accent,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{q.sectionName}</span>
                          <span className={`type-badge type-${q.type||"mcq"}`}>{QUESTION_TYPES.find(t=>t.value===q.type)?.label||"MCQ"}</span>
                          <span style={{background:THEME.bg,color:THEME.textLight,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,border:`1px solid ${THEME.border}`}}>{q.topic}</span>
                          {(q.goals||[]).map(g=><span key={g} style={{background:"rgba(16,185,129,0.1)",color:"#065f46",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{REG_GOALS[g]||g}</span>)}
                        </div>
                        <div style={{fontWeight:600,color:THEME.primary,fontSize:15,marginBottom:10}}>{q.text}</div>
                        {(q.type==="mcq"||q.type==="multiple"||!q.type)&&(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                            {(q.options||[]).map((o,oi)=>{
                              const isCorr=q.type==="multiple"?(q.correctAnswers||[]).includes(oi):oi===q.correct;
                              return<div key={oi} style={{fontSize:13,padding:"5px 10px",borderRadius:6,background:isCorr?"#ecfdf5":THEME.bg,border:`1px solid ${isCorr?THEME.success:THEME.border}`,color:isCorr?"#065f46":THEME.text,fontWeight:isCorr?700:400}}>{String.fromCharCode(65+oi)}. {o} {isCorr&&"✓"}</div>;
                            })}
                          </div>
                        )}
                        {q.type==="matching"&&(
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {(q.pairs||[]).map((p,i)=><div key={i} style={{fontSize:13,padding:"5px 10px",borderRadius:6,background:THEME.bg,border:`1px solid ${THEME.border}`}}>{p.left} → {p.right}</div>)}
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        <button onClick={()=>openEditQuestion(q)} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6}} title="Редактировать">✏️</button>
                        <button onClick={()=>delQuestion(q.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}} title="Удалить">×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {!loading&&tab==="students"&&(
          <div>
            <div className="admin-section-header"><div><h2 className="admin-section-title">Ученики</h2><p style={{color:THEME.textLight,fontSize:14}}>Всего: {students.length}</p></div></div>
            {students.length===0?<div className="empty-state">Учеников пока нет.</div>:(
              <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:THEME.bg,borderBottom:`1px solid ${THEME.border}`}}>
                    {["Ученик","Телефон","Цель","Детали","Статус","Пароль"].map(h=><th key={h} style={{padding:"12px 20px",textAlign:"left",fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:"uppercase",letterSpacing:"0.5px"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {students.map((s,i)=>{
                      const st=STUDENT_STATUSES.find(x=>x.value===s.status)||STUDENT_STATUSES[1];
                      const isTrial=s.status==="trial"||!s.status;
                      return(
                        <React.Fragment key={s.id}>
                          <tr style={{borderBottom:editingPwdFor===s.id?"none":`1px solid ${THEME.border}`,background:i%2===0?"#fff":THEME.bg+"80"}}>
                            <td style={{padding:"14px 20px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <div style={{width:36,height:36,borderRadius:"50%",background:THEME.primary,color:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,flexShrink:0}}>{s.firstName?.[0]}{s.lastName?.[0]}</div>
                                <div><div style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{s.firstName} {s.lastName}</div><div style={{fontSize:11,color:THEME.textLight}}>{s.registeredAt?new Date(s.registeredAt).toLocaleDateString("ru-RU"):""}</div></div>
                              </div>
                            </td>
                            <td style={{padding:"14px 20px",fontSize:13,color:THEME.textLight}}>{s.phone}</td>
                            <td style={{padding:"14px 20px",fontSize:13}}>{s.goal}</td>
                            <td style={{padding:"14px 20px",fontSize:13}}>{s.details}</td>
                            <td style={{padding:"14px 20px"}}>
                              <select value={s.status||"trial"} onChange={e=>updateStatus(s.id,e.target.value)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${st.color}`,background:st.color+"18",color:st.color,fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",outline:"none"}}>
                                {STUDENT_STATUSES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
                              </select>
                            </td>
                            <td style={{padding:"14px 20px"}}>
                              {isTrial?(
                                <span style={{fontSize:11,color:THEME.textLight,fontStyle:"italic"}}>Недоступно</span>
                              ):s.password?(
                                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                  <span style={{fontSize:12,color:THEME.success,fontWeight:700}}>🔒 Задан</span>
                                  <button onClick={()=>{setEditingPwdFor(s.id);setNewPwd("");}} style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${THEME.border}`,background:"transparent",color:THEME.textLight,cursor:"pointer"}}>Изменить</button>
                                  <button onClick={()=>removePassword(s.id)} style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${THEME.error}`,background:"transparent",color:THEME.error,cursor:"pointer"}}>Убрать</button>
                                </div>
                              ):(
                                <button onClick={()=>{setEditingPwdFor(s.id);setNewPwd("");}} style={{fontSize:12,padding:"5px 12px",borderRadius:8,border:`1px solid ${THEME.accent}`,background:"rgba(212,175,55,0.08)",color:"#92680e",cursor:"pointer",fontWeight:700}}>🔑 Задать</button>
                              )}
                            </td>
                          </tr>
                          {editingPwdFor===s.id&&(
                            <tr style={{borderBottom:`1px solid ${THEME.border}`,background:"rgba(212,175,55,0.04)"}}>
                              <td colSpan={6} style={{padding:"12px 20px"}}>
                                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                                  <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Новый пароль..." className="input-field" style={{maxWidth:260,margin:0,padding:"8px 12px"}} autoFocus onKeyDown={e=>{if(e.key==="Enter")savePassword(s.id);if(e.key==="Escape"){setEditingPwdFor(null);setNewPwd("");}}}/>
                                  <button onClick={()=>savePassword(s.id)} className="cta-button active" style={{width:"auto",padding:"8px 18px",fontSize:13}}>Сохранить</button>
                                  <button onClick={()=>{setEditingPwdFor(null);setNewPwd("");}} style={{fontSize:13,padding:"8px 14px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"transparent",color:THEME.textLight,cursor:"pointer"}}>Отмена</button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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

// ── ПРОФИЛЬ ───────────────────────────────────────────────────────────────────
function ProfileSection({ user, statusObj, onOpenDiagnostics, onViewPlan }) {
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const load=async()=>{
      try{
        const snap=await getDocs(collection(db,"diagnosticResults"));
        const all=snap.docs.map(d=>({id:d.id,...d.data()}));
        const mine=all.filter(r=>r.userPhone===user?.phone).sort((a,b)=>b.completedAt?.localeCompare(a.completedAt));
        setResults(mine);
      }catch(e){console.error(e);}
      setLoading(false);
    };
    load();
  },[user?.phone]);

  const totalDiag=results.length;
  const avgScore=totalDiag>0?Math.round(results.reduce((s,r)=>s+r.score,0)/totalDiag):0;
  const totalSec=results.reduce((s,r)=>s+(r.totalTime||0),0);
  const totalMin=Math.floor(totalSec/60);
  const totalHr=Math.floor(totalMin/60);
  const timeLabel=totalHr>0?`${totalHr} ч ${totalMin%60} мин`:`${totalMin} мин ${totalSec%60} сек`;

  // Collect all weak topics across all attempts
  const weakMap={};
  results.forEach(r=>(r.weakTopics||[]).forEach(t=>{
    const key=`${t.section}|${t.topic}`;
    weakMap[key]=(weakMap[key]||0)+1;
  }));
  const topWeak=Object.entries(weakMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,cnt])=>{const[sec,topic]=k.split("|");return{sec,topic,cnt};});

  const fmtTime=sec=>{const m=Math.floor(sec/60),s=sec%60;return m>0?`${m} мин ${s} с`:`${s} с`;};

  return(
    <div>
      <div className="dashboard-header"><h1>Личный кабинет</h1></div>
      {/* Profile card */}
      <div className="dashboard-section">
        <div className="profile-card">
          <div className="profile-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div className="profile-info">
            <div className="profile-name">{user?.firstName} {user?.lastName}</div>
            <div className="profile-phone">{user?.phone}</div>
            <span style={{display:"inline-block",background:statusObj.color+"18",color:statusObj.color,fontWeight:700,fontSize:12,padding:"4px 14px",borderRadius:99,border:`1px solid ${statusObj.color}30`,marginBottom:10}}>{statusObj.label}</span>
            <div className="profile-goal-tag">{user?.goal}</div>
            <div className="profile-detail">{user?.details}</div>
            <div className="profile-date">Зарегистрирован: {user?.registeredAt?new Date(user.registeredAt).toLocaleDateString("ru-RU"):"—"}</div>
          </div>
        </div>
        <div className="profile-actions">
          <button className="cta-button active" style={{width:"auto",padding:"14px 28px"}} onClick={onOpenDiagnostics}>🎯 Пройти диагностику</button>
          <button className="cta-button active" style={{width:"auto",padding:"14px 28px",background:"#fff",color:THEME.primary,border:`1px solid ${THEME.border}`,boxShadow:"none"}} onClick={onViewPlan}>🗺️ Мой план обучения</button>
        </div>
      </div>

      {/* Stats summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
        <div className="stat-card"><div className="stat-icon">📋</div><div><div className="stat-value">{totalDiag}</div><div className="stat-label">диагностик пройдено</div></div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div><div className="stat-value">{avgScore}%</div><div className="stat-label">средний результат</div></div></div>
        <div className="stat-card"><div className="stat-icon">⏱️</div><div><div className="stat-value" style={{fontSize:totalHr>0?16:22}}>{totalDiag>0?timeLabel:"—"}</div><div className="stat-label">всего потрачено</div></div></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        {/* History */}
        <div className="dashboard-section" style={{marginBottom:0}}>
          <h2 className="section-title" style={{marginBottom:20}}>📊 История диагностик</h2>
          {loading&&<div className="empty-state" style={{padding:"24px 0"}}>Загрузка...</div>}
          {!loading&&results.length===0&&<div className="empty-state" style={{padding:"24px 0"}}>Диагностик ещё не пройдено</div>}
          {!loading&&results.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {results.map((r,i)=>{
                const pct=r.score||0;
                const color=pct>=80?THEME.success:pct>=60?THEME.warning:THEME.error;
                return(
                  <div key={r.id} style={{padding:"14px 16px",borderRadius:12,background:THEME.bg,border:`1px solid ${THEME.border}`,borderLeft:`4px solid ${color}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:3}}>{new Date(r.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</div>
                        <div style={{fontSize:12,color:THEME.textLight}}>{r.totalQuestions} вопросов · {fmtTime(r.totalTime||0)}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:44,height:44,borderRadius:10,background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14}}>{pct}%</div>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div style={{marginTop:10,height:4,borderRadius:99,background:THEME.border,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weak topics */}
        <div className="dashboard-section" style={{marginBottom:0}}>
          <h2 className="section-title" style={{marginBottom:20}}>🔍 Темы для проработки</h2>
          {loading&&<div className="empty-state" style={{padding:"24px 0"}}>Загрузка...</div>}
          {!loading&&topWeak.length===0&&<div className="empty-state" style={{padding:"24px 0"}}>{results.length===0?"Пройдите диагностику, чтобы увидеть рекомендации":"Отличный результат — слабых тем не найдено!"}</div>}
          {!loading&&topWeak.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {topWeak.map((t,i)=>(
                <div key={i} style={{padding:"14px 16px",borderRadius:12,background:THEME.bg,border:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:32,height:32,borderRadius:8,background:THEME.error+"15",color:THEME.error,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,flexShrink:0}}>#{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:2}}>{t.topic}</div>
                    <div style={{fontSize:11,color:THEME.textLight,textTransform:"uppercase",letterSpacing:"0.5px"}}>{t.sec}</div>
                  </div>
                  <div style={{flexShrink:0,fontSize:12,color:THEME.textLight,fontWeight:600}}>{t.cnt}× ошибок</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardScreen({ user, onOpenDiagnostics, onViewPlan, onOpenAdmin }) {
  const [activeSection,setActiveSection]=useState("home");
  const [schedule,setSchedule]=useState([]);
  const [homework,setHomework]=useState([]);
  const [loadingData,setLoadingData]=useState(true);
  const [showHwForm,setShowHwForm]=useState(false);
  const [showSchedForm,setShowSchedForm]=useState(false);
  const [hwForm,setHwForm]=useState({title:"",description:"",dueDate:""});
  const [schedForm,setSchedForm]=useState({dayOfWeek:"1",time:"10:00",subject:"Математика",duration:"60"});
  const [sidebarOpen,setSidebarOpen]=useState(false);

  const isTeacher=user?.role==="teacher"||user?.role==="admin";
  const isAdmin=user?.role==="admin";
  const today=new Date();
  const statusObj=STUDENT_STATUSES.find(s=>s.value===user?.status)||STUDENT_STATUSES[1];

  useEffect(()=>{
    const load=async()=>{
      try{
        const [scS,hwS]=await Promise.all([getDocs(collection(db,"schedule")),getDocs(collection(db,"homework"))]);
        setSchedule(scS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.time?.localeCompare(b.time)));
        setHomework(hwS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.dueDate?.localeCompare(b.dueDate)));
      }catch(e){console.error(e);}
      setLoadingData(false);
    };
    load();
  },[]);

  const addHomework=async e=>{
    e.preventDefault();
    try{const data={...hwForm,createdAt:new Date().toISOString()}; const ref=await addDoc(collection(db,"homework"),data); setHomework(p=>[...p,{id:ref.id,...data}].sort((a,b)=>a.dueDate?.localeCompare(b.dueDate))); setHwForm({title:"",description:"",dueDate:""}); setShowHwForm(false);}
    catch{alert("Ошибка.");}
  };
  const addSchedule=async e=>{
    e.preventDefault();
    try{const ref=await addDoc(collection(db,"schedule"),schedForm); setSchedule(p=>[...p,{id:ref.id,...schedForm}].sort((a,b)=>a.time?.localeCompare(b.time))); setSchedForm({dayOfWeek:"1",time:"10:00",subject:"Математика",duration:"60"}); setShowSchedForm(false);}
    catch{alert("Ошибка.");}
  };
  const delHw=async id=>{try{await deleteDoc(doc(db,"homework",id)); setHomework(p=>p.filter(h=>h.id!==id));}catch{alert("Ошибка.");}};
  const delSc=async id=>{try{await deleteDoc(doc(db,"schedule",id)); setSchedule(p=>p.filter(s=>s.id!==id));}catch{alert("Ошибка.");}};

  const getWeekDates=()=>{const dow=today.getDay(),mon=new Date(today); mon.setDate(today.getDate()-(dow===0?6:dow-1)); return Array.from({length:7},(_,i)=>{const d=new Date(mon); d.setDate(mon.getDate()+i); return d;});};
  const weekDates=getWeekDates();

  const navItems=[
    {id:"home",icon:"🏠",label:"Главная"},
    {id:"diagnostics",icon:"🎯",label:"Диагностика"},
    {id:"plan",icon:"🗺️",label:"Индивидуальный план обучения"},
    {id:"profile",icon:"👤",label:"Личный кабинет ученика"},
    ...(isAdmin?[{id:"admin",icon:"⚙️",label:"Администрирование"}]:[]),
  ];

  const handleNav=id=>{
    setSidebarOpen(false);
    if(id==="diagnostics"){onOpenDiagnostics();return;}
    if(id==="plan"){onViewPlan();return;}
    if(id==="admin"){onOpenAdmin();return;}
    setActiveSection(id);
  };

  return(
    <div className="dashboard-layout">
      {sidebarOpen&&<div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}
      <aside className={`dashboard-sidebar ${sidebarOpen?"open":""}`}>
        <div className="sidebar-logo"><Logo size={36} light/></div>
        <nav className="sidebar-nav">
          {navItems.map(item=><button key={item.id} className={`sidebar-nav-item ${activeSection===item.id?"active":""}`} onClick={()=>handleNav(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div><div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div><div className="sidebar-user-role" style={{color:statusObj.color+"cc"}}>{isAdmin?"Администратор":isTeacher?"Преподаватель":statusObj.label}</div></div>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="mobile-topbar"><button className="burger-btn" onClick={()=>setSidebarOpen(true)}>☰</button><Logo size={28}/></div>

        {activeSection==="home"&&(
          <>
            <div className="dashboard-header">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div><h1>Добро пожаловать, <span style={{color:THEME.accent}}>{user?.firstName}</span>!</h1><p style={{color:THEME.textLight,marginTop:6}}>{today.toLocaleDateString("ru-RU",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
                <span style={{background:statusObj.color+"18",color:statusObj.color,fontWeight:700,fontSize:13,padding:"6px 16px",borderRadius:99,border:`1px solid ${statusObj.color}30`,alignSelf:"center"}}>{statusObj.label}</span>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-icon">📅</div><div><div className="stat-value">{schedule.length}</div><div className="stat-label">занятий в неделю</div></div></div>
              <div className="stat-card"><div className="stat-icon">📚</div><div><div className="stat-value">{homework.filter(h=>new Date(h.dueDate+"T23:59:59")>=today).length}</div><div className="stat-label">активных ДЗ</div></div></div>
              <div className="stat-card"><div className="stat-icon">🎯</div><div><div className="stat-value" style={{fontSize:16}}>{user?.details||"—"}</div><div className="stat-label">цель</div></div></div>
            </div>
            {/* Schedule */}
            <div className="dashboard-section">
              <div className="section-title-row"><h2 className="section-title">📅 Расписание занятий</h2>{isTeacher&&<button className="add-btn" onClick={()=>setShowSchedForm(true)}>+ Добавить занятие</button>}</div>
              <div className="week-calendar">
                {weekDates.map((date,idx)=>{
                  const dayNum=String(idx+1),lessons=schedule.filter(s=>s.dayOfWeek===dayNum),isToday=date.toDateString()===today.toDateString();
                  return(<div key={idx} className={`week-day ${isToday?"today":""}`}>
                    <div className="week-day-header"><span className="day-name">{DAY_NAMES_SHORT[idx]}</span><span className={`day-date ${isToday?"today-dot":""}`}>{date.getDate()}</span></div>
                    <div className="day-lessons">
                      {lessons.length===0?<div className="no-lessons">—</div>:lessons.map((l,li)=>(
                        <div key={li} className="lesson-block"><span className="lesson-time">{l.time}</span><span className="lesson-subject">{l.subject}</span><span className="lesson-duration">{l.duration} мин</span>{isTeacher&&<button className="del-btn" onClick={()=>delSc(l.id)}>×</button>}</div>
                      ))}
                    </div>
                  </div>);
                })}
              </div>
            </div>
            {/* Homework */}
            <div className="dashboard-section">
              <div className="section-title-row"><h2 className="section-title">📚 Домашние задания</h2>{isTeacher&&<button className="add-btn" onClick={()=>setShowHwForm(true)}>+ Добавить ДЗ</button>}</div>
              {loadingData?<div className="empty-state">Загрузка...</div>:homework.length===0?<div className="empty-state">{isTeacher?"Нажмите «+ Добавить ДЗ».":"Домашних заданий пока нет."}</div>:(
                <div className="homework-list">
                  {homework.map((hw,i)=>{
                    const due=new Date(hw.dueDate+"T23:59:59"),isOv=due<today,dl=Math.ceil((due-today)/(864e5));
                    return(<div key={i} className={`hw-card ${isOv?"overdue":""}`}>
                      <div className="hw-card-left"><div className="hw-title">{hw.title}</div>{hw.description&&<div className="hw-desc">{hw.description}</div>}</div>
                      <div className="hw-card-right">
                        <span className={`due-badge ${isOv?"overdue":dl<=2?"soon":""}`}>{isOv?"Просрочено":dl===0?"Сегодня":dl===1?"Завтра":`До ${due.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}`}</span>
                        {isTeacher&&<button className="del-btn-hw" onClick={()=>delHw(hw.id)}>×</button>}
                      </div>
                    </div>);
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeSection==="profile"&&(
          <ProfileSection user={user} statusObj={statusObj} onOpenDiagnostics={onOpenDiagnostics} onViewPlan={onViewPlan}/>
        )}
      </main>

      {showSchedForm&&<div className="modal-overlay" onClick={()=>setShowSchedForm(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Добавить занятие</div>
        <form onSubmit={addSchedule}>
          <div className="input-group"><label className="input-label">День недели</label><select className="input-field" value={schedForm.dayOfWeek} onChange={e=>setSchedForm(p=>({...p,dayOfWeek:e.target.value}))}>{DAY_NAMES_FULL.map((d,i)=><option key={i} value={String(i+1)}>{d}</option>)}</select></div>
          <div className="input-group"><label className="input-label">Время</label><input type="time" className="input-field" value={schedForm.time} onChange={e=>setSchedForm(p=>({...p,time:e.target.value}))} required/></div>
          <div className="input-group"><label className="input-label">Предмет</label><input type="text" className="input-field" value={schedForm.subject} onChange={e=>setSchedForm(p=>({...p,subject:e.target.value}))} required/></div>
          <div className="input-group"><label className="input-label">Длительность (мин)</label><input type="number" className="input-field" value={schedForm.duration} onChange={e=>setSchedForm(p=>({...p,duration:e.target.value}))} min="15" max="240"/></div>
          <div style={{display:"flex",gap:12}}><button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>setShowSchedForm(false)}>Отмена</button><button type="submit" className="cta-button active">Добавить</button></div>
        </form>
      </div></div>}

      {showHwForm&&<div className="modal-overlay" onClick={()=>setShowHwForm(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Добавить домашнее задание</div>
        <form onSubmit={addHomework}>
          <div className="input-group"><label className="input-label">Название</label><input type="text" className="input-field" value={hwForm.title} onChange={e=>setHwForm(p=>({...p,title:e.target.value}))} required/></div>
          <div className="input-group"><label className="input-label">Описание</label><textarea className="input-field" value={hwForm.description} onChange={e=>setHwForm(p=>({...p,description:e.target.value}))} rows={3} style={{resize:"vertical"}}/></div>
          <div className="input-group"><label className="input-label">Срок сдачи</label><input type="date" className="input-field" value={hwForm.dueDate} onChange={e=>setHwForm(p=>({...p,dueDate:e.target.value}))} required/></div>
          <div style={{display:"flex",gap:12}}><button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>setShowHwForm(false)}>Отмена</button><button type="submit" className="cta-button active">Добавить</button></div>
        </form>
      </div></div>}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("auth");
  const [user,setUser]=useState(null);
  const [questions,setQuestions]=useState([]);
  const [qIndex,setQIndex]=useState(0);
  const [answers,setAnswers]=useState([]);
  const [report,setReport]=useState(null);
  const [lastResultId,setLastResultId]=useState(null);

  const handleRegister=u=>{setUser(u);setScreen("dashboard");};
  const goHome=()=>setScreen("dashboard");
  const viewPlan=()=>setScreen("plan");
  const openAdmin=()=>setScreen("admin");
  const openDiagnostics=()=>setScreen("diagnostics");

  const startQuiz=async(section)=>{
    try{
      const snap=await getDocs(collection(db,"questions"));
      let qs=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(section) qs=qs.filter(q=>q.sectionId===section.id);
      else if(user?.goalKey) qs=qs.filter(q=>(q.goals||[]).includes(user.goalKey));
      setQuestions(qs.length>0?qs:FALLBACK_QUESTIONS);
    }catch{setQuestions(FALLBACK_QUESTIONS);}
    setQIndex(0);setAnswers([]);setScreen("question");
  };

  const handleAnswer=async data=>{
    const next=[...answers,data];
    setAnswers(next);
    if(qIndex+1<questions.length){
      setQIndex(qIndex+1);
    } else {
      setReport({answers:next});
      // Save result to Firestore, capture ID
      try{
        const correct=next.filter(a=>a.correct).length;
        const totalTime=next.reduce((s,a)=>s+(a.timeSpent||0),0);
        const weakTopics=next.filter(a=>!a.correct).map(a=>({topic:a.topic,section:a.section}));
        const ref=await addDoc(collection(db,"diagnosticResults"),{
          userPhone:user?.phone,
          userName:`${user?.firstName} ${user?.lastName}`,
          completedAt:new Date().toISOString(),
          totalQuestions:next.length,
          correctAnswers:correct,
          score:Math.round((correct/next.length)*100),
          totalTime,
          weakTopics,
          answers: next.map(a=>({topic:a.topic,section:a.section,correct:a.correct,confidence:a.confidence,timeSpent:a.timeSpent}))
        });
        setLastResultId(ref.id);
        // Уведомление в Telegram
        const lines=[
          `📊 <b>Диагностика завершена</b>`,
          `👤 <b>${user?.firstName} ${user?.lastName}</b> (${user?.phone})`,
          `🎯 ${user?.goal} · ${user?.details}`,
          `✅ Результат: <b>${Math.round((correct/next.length)*100)}%</b> (${correct}/${next.length})`,
          `⏱ Время: ${Math.floor(totalTime/60)}м ${totalTime%60}с`,``,
          `📝 <b>Ответы:</b>`
        ];
        next.forEach((a,i)=>{
          lines.push(`${i+1}. ${a.correct?"✅":"❌"} <i>${a.topic}</i> [${a.section}] — увер: ${a.confidence??"-"}/5, ${a.timeSpent}с`);
        });
        tgSend(lines.join("\n"));
      }catch(e){console.error("Ошибка сохранения:",e);}
      setScreen("upload");
    }
  };

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${THEME.bg};-webkit-font-smoothing:antialiased;color:${THEME.text};font-family:'Inter',sans-serif;}
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
        .question-container{max-width:800px;margin:0 auto;padding:40px 20px;}
        .modern-timer{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid ${THEME.border};padding:10px 20px;border-radius:99px;font-weight:700;font-family:'Montserrat',sans-serif;font-size:15px;}
        .pulse-dot{width:8px;height:8px;background:${THEME.error};border-radius:50%;animation:pulse 2s infinite;}
        .progress-bar-container{width:100%;height:6px;background:${THEME.border};border-radius:99px;overflow:hidden;margin-bottom:32px;}
        .progress-bar-fill{height:100%;background:${THEME.primary};transition:width 0.4s;}
        .question-meta{display:flex;justify-content:space-between;margin-bottom:20px;align-items:center;flex-wrap:wrap;gap:8px;}
        .badge{background:${THEME.primary};color:${THEME.accent};padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;text-transform:uppercase;}
        .type-badge{padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;text-transform:uppercase;}
        .type-badge.type-mcq{background:"rgba(99,102,241,0.1)";color:"#4338ca";background:rgba(99,102,241,0.1);color:#4338ca;}
        .type-badge.type-multiple{background:rgba(16,185,129,0.1);color:#065f46;}
        .type-badge.type-matching{background:rgba(245,158,11,0.1);color:#92400e;}
        .question-text{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:800;line-height:1.4;margin-bottom:40px;color:${THEME.primary};}
        .options-grid{display:flex;flex-direction:column;gap:14px;margin-bottom:32px;}
        .option-card{display:flex;align-items:center;padding:18px 22px;background:#fff;border:1px solid ${THEME.border};border-radius:12px;cursor:pointer;transition:all 0.2s;}
        .option-card:hover:not(.disabled){border-color:${THEME.primary};background:#f8fafc;}
        .option-card.selected{border-color:${THEME.primary};background:#f1f5f9;border-width:2px;}
        .option-card.correct{border-color:${THEME.success};background:#ecfdf5;border-width:2px;}
        .option-card.wrong{border-color:${THEME.error};background:#fef2f2;border-width:2px;}
        .option-card.disabled{opacity:0.5;pointer-events:none;}
        .option-letter{width:36px;height:36px;background:${THEME.bg};border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;margin-right:20px;flex-shrink:0;}
        .option-content{font-size:16px;font-weight:600;flex:1;}
        .confidence-section{background:#fff;border:1px solid ${THEME.border};padding:28px;border-radius:16px;margin-bottom:24px;}
        .confidence-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;}
        .conf-btn{flex:1;padding:12px 8px;border:1px solid ${THEME.border};border-radius:10px;background:#fff;cursor:pointer;font-weight:600;font-family:'Inter',sans-serif;min-width:100px;}
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
        .path-container{max-width:1000px;margin:40px auto;padding:0 20px 40px;}
        .path-header{text-align:center;margin-bottom:48px;}
        .path-visualization-modern{background:${THEME.primary};border-radius:24px;padding:50px 40px;overflow-x:auto;}
        .dashboard-layout{display:flex;min-height:100vh;background:${THEME.bg};}
        .dashboard-sidebar{width:268px;background:${THEME.primary};display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:20;transition:transform 0.3s;overflow-y:auto;}
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
        .add-btn:hover{opacity:0.85;} .add-btn:disabled{opacity:0.4;cursor:not-allowed;}
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
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;}
        .modal-card{background:#fff;border-radius:16px;padding:32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.2);}
        .modal-title{font-family:'Montserrat',sans-serif;font-weight:800;font-size:20px;color:${THEME.primary};margin-bottom:24px;}
        .profile-card{display:flex;align-items:flex-start;gap:28px;padding:28px;background:${THEME.bg};border-radius:14px;border:1px solid ${THEME.border};margin-bottom:24px;}
        .profile-avatar{width:80px;height:80px;border-radius:50%;background:${THEME.primary};color:${THEME.accent};display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:28px;flex-shrink:0;}
        .profile-name{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:800;color:${THEME.primary};margin-bottom:6px;}
        .profile-phone{color:${THEME.textLight};font-size:14px;margin-bottom:10px;}
        .profile-goal-tag{display:inline-block;background:rgba(212,175,55,0.15);color:#92680e;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;margin-bottom:6px;}
        .profile-detail{font-size:15px;font-weight:600;color:${THEME.text};margin-bottom:8px;}
        .profile-date{font-size:12px;color:${THEME.textLight};}
        .profile-info{flex:1;}
        .profile-actions{display:flex;gap:16px;flex-wrap:wrap;}
        .admin-section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;}
        .admin-section-title{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:${THEME.primary};margin-bottom:4px;}
        .admin-form-card{background:#fff;border:1px solid ${THEME.border};border-radius:16px;padding:28px;margin-bottom:28px;border-top:4px solid ${THEME.accent};}
        .admin-card{background:#fff;border:1px solid ${THEME.border};border-radius:14px;padding:20px 24px;transition:box-shadow 0.2s;}
        .admin-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.06);}
        .mobile-topbar{display:none;align-items:center;justify-content:space-between;padding:16px 20px;background:#fff;border-bottom:1px solid ${THEME.border};margin-bottom:24px;}
        .burger-btn{background:transparent;border:none;font-size:24px;cursor:pointer;color:${THEME.primary};padding:4px 8px;}
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:19;}
        .scale-in{animation:scale-in 0.3s ease forwards;}
        @keyframes scale-in{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.7);}70%{box-shadow:0 0 0 8px rgba(239,68,68,0);}100%{box-shadow:0 0 0 0 rgba(239,68,68,0);}}
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

      {screen==="auth"&&<AuthScreen onRegister={handleRegister}/>}
      {screen==="dashboard"&&<DashboardScreen user={user} onOpenDiagnostics={openDiagnostics} onViewPlan={viewPlan} onOpenAdmin={openAdmin}/>}
      {screen==="admin"&&<AdminScreen onBack={goHome}/>}
      {screen==="diagnostics"&&<DiagnosticsScreen user={user} onSelectSection={sec=>startQuiz(sec)} onBack={goHome}/>}
      {screen==="question"&&questions.length>0&&<QuestionScreen question={questions[qIndex]} qNum={qIndex+1} total={questions.length} onComplete={handleAnswer}/>}
      {screen==="report"&&report&&(
        <>
          <nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><Logo size={32}/><button onClick={goHome} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Главная</button></nav>
          <ReportScreen report={report} user={user} onUpload={()=>setScreen("upload")} onViewPlan={viewPlan} onBack={goHome}/>
        </>
      )}
      {screen==="upload"&&(
        <UploadAnalysisScreen
          user={user}
          onDone={()=>setScreen("dashboard")}
          onSkip={()=>setScreen("dashboard")}
        />
      )}
      {screen==="plan"&&<IndividualPlanScreen user={user} onBack={goHome}/>}
    </>
  );
}
