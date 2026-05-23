import React, { useState, useEffect, useMemo } from "react";
import { CONFIDENCE_LEVELS, GRADES_LIST, EXAMS_LIST } from "../lib/appConstants.js";
import { useTheme } from "../ThemeContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { generateQuestion, shuffle } from "../lib/mathUtils.js";
import ErrorCard from "../components/ui/ErrorCard.jsx";
import ChartRenderer from "../components/charts/ChartRenderer.jsx";
import { getContent } from "../lib/contentCache.js";
import { db, getDoc, getDocs, collection, query, where } from "../firestore-rest.js";
import Logo from "../components/ui/Logo.jsx";
import ImageModal from "../components/ui/ImageModal.jsx";
import LatexText from "../components/ui/LatexText.jsx";
import MathText from "../components/ui/MathText.jsx";
import Timer from "../components/ui/Timer.jsx";
import { getShopItem } from "../lib/shopItems.js";

// ── ЭКРАН ПРАВИЛ ДИАГНОСТИКИ ──────────────────────────────────────────────────
function DiagnosticRulesScreen({ sectionName, questionCount, onStart, onBack }) {
  const { theme: THEME } = useTheme();
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState(null);

  const startCountdown = () => {
    setCountdown(3);
  };
  useEffect(()=>{
    if(countdown===null) return;
    if(countdown===0){ onStart(); return; }
    const t = setTimeout(()=>setCountdown(c=>c-1), 1000);
    return ()=>clearTimeout(t);
  },[countdown]);

  const rules = [
    { icon:"🚫", title:"Не отвлекайся",       desc:"Таймер идёт с первого вопроса. Закрой другие вкладки." },
    { icon:"🎯", title:"Отвечай честно",      desc:"Не гугли — чем точнее результат, тем лучше твой план обучения." },
    { icon:"⏱️", title:"Следи за временем",   desc:"Если задание кажется сложным — выбери лучший вариант и иди дальше." },
    { icon:"🔀", title:"Адаптивные разделы",  desc:"Диагностика состоит из нескольких разделов. Следующий раздел зависит от твоих ответов — система подбирает задания под твой уровень." },
    { icon:"📊", title:"Персональный план",   desc:"После полного прохождения всех разделов диагностики получишь индивидуальный план — система сама определит какие навыки нужно подтянуть именно тебе." },
  ];

  return (
    <div style={{minHeight:"100vh",background:THEME.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
      <style>{`
        @keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes countPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
        .rules-card{background:${THEME.surface};border-radius:20px;border:1px solid ${THEME.border};box-shadow:0 20px 50px -10px rgba(10,25,47,0.08);max-width:760px;width:100%;overflow:hidden;}
        .rules-header{background:${THEME.primary};padding:32px 40px;color:${THEME.onPrimary ?? '#fff'};}
        .rules-body{padding:40px;}
        .rule-row{display:flex;gap:16px;align-items:flex-start;padding:16px 0;border-bottom:1px solid ${THEME.border};}
        .rule-row:last-child{border-bottom:none;}
        .rule-icon{font-size:22px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${THEME.bg};border-radius:12px;flex-shrink:0;}
        .countdown-circle{width:100px;height:100px;border-radius:50%;background:${THEME.primary};color:${THEME.onPrimary ?? '#fff'};display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:44px;font-weight:800;animation:countPulse 0.8s ease infinite;margin:0 auto 16px;}
      `}</style>

      {countdown !== null ? (
        <div style={{textAlign:"center",animation:"fadeSlide 0.3s ease"}}>
          <div className="countdown-circle">{countdown}</div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:700,color:THEME.primary}}>Приготовься!</div>
        </div>
      ) : (
        <div className="rules-card rules-hero-card">
          <div className="rules-header">
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{fontSize:32}}>📋</div>
              <div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:800}}>Правила диагностики</div>
                <div style={{opacity:0.7,fontSize:14,marginTop:4}}>{sectionName||"Общая диагностика"} · {questionCount} вопрос{questionCount===1?"":"ов"}</div>
              </div>
            </div>
          </div>

          <div className="rules-body">
            <div className="rules-list" style={{marginBottom:32}}>
              {rules.map((r,i)=>(
                <div key={i} className="rule-row" style={{animation:`fadeSlide 0.4s ease ${i*0.07}s both`}}>
                  <div className="rule-icon">{r.icon}</div>
                  <div>
                    <div style={{fontWeight:700,color:THEME.primary,marginBottom:3}}>{r.title}</div>
                    <div style={{fontSize:13,color:THEME.textLight,lineHeight:1.5}}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="buttons-row" style={{display:"flex",gap:12}}>
              <button onClick={onBack} className="btn-back" style={{padding:"12px 24px",border:`1px solid ${THEME.border}`,borderRadius:10,background:THEME.surface,color:THEME.text,fontWeight:600,cursor:"pointer",fontSize:14}}>
                ← Назад
              </button>
              <button onClick={startCountdown} className="btn-start" style={{flex:1,padding:"14px 24px",border:"none",borderRadius:10,background:THEME.accent,color:THEME.onAccent ?? '#0f172a',fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:0.5,boxShadow:"0 8px 20px -5px rgba(10,25,47,0.3)"}}>
                Начать диагностику →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ЭКРАН ВЫБОРА ДИАГНОСТИКИ ──────────────────────────────────────────────────
function DiagnosticsScreen({ user, onSelectSection, onViewReport, onBack }) {
  // ── Все хуки вверху (Rules of Hooks) ──────────────────────────────────────
  const { theme: THEME } = useTheme();
  const [sections,setSections]=useState([]);
  const [counts,setCounts]=useState({});
  const [reportMap,setReportMap]=useState({});
  const [completedSections,setCompletedSections]=useState(new Set());
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState(false);
  const isTester = user?.status==="tester";

  const load = async ()=>{
    const _uid=user?.uid||user?.id; if (!_uid) return;
    setLoading(true); setFetchError(false);
    try {
        const [allSecs,allQs,repSnap,resSnap]=await Promise.all([
          getContent("sections"),
          getContent("questions"),
          getDocs(query(collection(db,"expertReports"),where("userId","==",_uid))),
          getDocs(query(collection(db,"diagnosticResults"),where("userId","==",_uid))),
        ]);
        // Build map: sectionId → expertReport for this user
        const myResults=resSnap.docs.map(d=>({id:d.id,...d.data()}));
        const myResultIds=new Set(myResults.map(r=>r.id));
        const rMap={};
        repSnap.docs.forEach(d=>{
          const r={id:d.id,...d.data()};
          if(myResultIds.has(r.resultId)) rMap[r.sectionId||r.resultId]=r;
        });
        setReportMap(rMap);
        // Build set of completed section IDs (by this user)
        const completedSecIds=new Set(myResults.filter(r=>r.sectionId).map(r=>r.sectionId));
        setCompletedSections(completedSecIds);
        // Filter sections based on student's goal and target
        const studentGoal = user?.goalKey;
        const studentTarget = user?.details; // e.g. "ЕНТ" or "8 класс"
        const gradeIndex = GRADES_LIST.indexOf(studentTarget);
        const isTrial = user?.status==="trial"||!user?.status;

        const ENT_MAX_GRADE_IDX = GRADES_LIST.indexOf("11 класс");
        const filtered = allSecs.filter(s => {
          const sGoalKeys = s.goalKeys||(s.goalKey?[s.goalKey]:[]);
          if (!s.specificTarget) return false;
          // Tester sees all sections
          if (isTester) return true;
          // Trial users only see public sections
          if (isTrial && !s.isPublic) return false;

          if (studentGoal === "exam") {
            // Show ЕНТ-specific sections
            if (s.specificTarget === studentTarget && sGoalKeys.includes(studentGoal)) return true;
            // For ЕНТ students: also show grade 5–11 diagnostics
            if (studentTarget === "ЕНТ") {
              const sIdx = GRADES_LIST.indexOf(s.specificTarget);
              return sIdx !== -1 && sIdx <= ENT_MAX_GRADE_IDX;
            }
            return false;
          }

          if (!sGoalKeys.includes(studentGoal)) return false;

          if (studentGoal === "gaps") {
            const sIdx = GRADES_LIST.indexOf(s.specificTarget);
            return sIdx !== -1 && gradeIndex !== -1 && sIdx <= gradeIndex;
          }

          if (studentGoal === "future") {
            const sIdx = GRADES_LIST.indexOf(s.specificTarget);
            return sIdx !== -1 && gradeIndex !== -1 && sIdx >= gradeIndex;
          }

          return false;
        });

        // Sort by grade order for gaps/future goals and ЕНТ (grades first, then ЕНТ sections)
        if (studentGoal === "gaps" || studentGoal === "future" || (studentGoal === "exam" && studentTarget === "ЕНТ")) {
          const gradeOrder = [...GRADES_LIST, ...EXAMS_LIST];
          filtered.sort((a, b) => gradeOrder.indexOf(a.specificTarget) - gradeOrder.indexOf(b.specificTarget));
        }
        // Count questions per section
        const c={};
        allQs.forEach(q=>{ if(q.sectionId) c[q.sectionId]=(c[q.sectionId]||0)+1; });
        setCounts(c);
        setSections(filtered);
      } catch(e){ console.error(e); setFetchError(true); }
      setLoading(false);
    };

  useEffect(()=>{ load(); },[user?.uid||user?.id]);

  const typeIcons = { mcq:"🔘", multiple:"☑️", matching:"🔗" };

  // Список секций
  return (
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav data-inner-nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 40px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo size={32}/>
        <button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Назад</button>
      </nav>
      <div style={{maxWidth:960,margin:"0 auto",padding:"48px 24px"}}>
        <div style={{marginBottom:40,display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16}}>
          <div>
            <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:32,fontWeight:800,color:THEME.primary,marginBottom:8}}>Диагностика</h1>
            <p style={{color:THEME.textLight,fontSize:16}}>
              Цель: <strong>{user?.goal}</strong> · {user?.details}
            </p>
          </div>
          <button data-tour="diag-smart" onClick={()=>onSelectSection({_smartDiag:true,goal:user?.goalKey,grade:user?.details})}
            style={{padding:'13px 24px',borderRadius:14,background:THEME.accent,color:THEME.onAccent ?? '#0f172a',
              fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>
            🚀 Умная Диагностика
          </button>
        </div>
        {loading && <div style={{textAlign:"center",padding:60,color:THEME.textLight,fontSize:16}}>Загрузка диагностик...</div>}
        {!loading && fetchError && <ErrorCard onRetry={load}/>}
        {!loading && !fetchError && sections.length===0 && (
          <div style={{textAlign:"center",padding:"48px 24px",background:`linear-gradient(135deg, ${THEME.primary} 0%, #1e3a8a 100%)`,borderRadius:18,border:`1px solid ${THEME.accent}30`,marginTop:8}}>
            <div style={{fontSize:64,marginBottom:16}}>🚀</div>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",color:"#fff",marginBottom:12,fontSize:24,fontWeight:800}}>Начни с Умной Диагностики</h3>
            <p style={{color:"rgba(255,255,255,0.8)",fontSize:15,maxWidth:520,margin:"0 auto 28px",lineHeight:1.5}}>
              Адаптивный тест выявит твои пробелы и построит индивидуальный план обучения. Занимает 20–40 минут.
            </p>
            <button onClick={()=>onSelectSection({_smartDiag:true,goal:user?.goalKey,grade:user?.details})}
              style={{padding:"16px 36px",borderRadius:14,background:THEME.accent,color:THEME.onAccent ?? '#0f172a',fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,border:"none",cursor:"pointer",boxShadow:"0 10px 30px -10px rgba(212,175,55,0.5)"}}>
              🚀 Пройти Умную Диагностику →
            </button>
            <p style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:20}}>
              Тематические разделы появятся, когда преподаватель добавит их для цели «{user?.goal} · {user?.details}».
            </p>
          </div>
        )}
        {!loading && !fetchError && sections.length>0 && (()=>{
          // Group sections by grade/exam and show in order
          const gradeOrder=[...EXAMS_LIST,...GRADES_LIST];
          const grouped={};
          sections.forEach(s=>{
            const ch=s.specificTarget||"Прочее";
            if(!grouped[ch]) grouped[ch]=[];
            grouped[ch].push(s);
          });
          Object.keys(grouped).forEach(ch=>{
            grouped[ch].sort((a,b)=>a.name.localeCompare(b.name));
          });
          const chapterKeys=gradeOrder.filter(c=>grouped[c]).concat(Object.keys(grouped).filter(c=>!gradeOrder.includes(c)));
          return(
            <div data-tour="diag-sections" style={{display:"flex",flexDirection:"column",gap:48}}>
              {chapterKeys.map(chapter=>{
                const chSecs=grouped[chapter];
                const isExam=EXAMS_LIST.includes(chapter);
                const isGrade=GRADES_LIST.includes(chapter);
                const chIcon=isExam?"🎓":isGrade?"📚":"📂";
                return(
                  <div key={chapter}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,paddingBottom:12,borderBottom:`2px solid ${THEME.border}`}}>
                      <span style={{fontSize:22}}>{chIcon}</span>
                      <h2 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:22,color:THEME.primary,margin:0}}>{chapter}</h2>
                      <span style={{background:"rgba(212,175,55,0.12)",color:"#92680e",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{isExam?"Экзамен":isGrade?"Класс":"Прочее"}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
                      {chSecs.map(sec=>{
                        const qCount=counts[sec.id]||0;
                        const isDone=completedSections.has(sec.id);
                        return(
                          <div key={sec.id}
                            style={{background:"#fff",borderRadius:16,border:`1px solid ${isDone?"#10B981":reportMap[sec.id]?THEME.accent:THEME.border}`,padding:"24px",transition:"all 0.2s",opacity:qCount===0?0.5:1,position:"relative",overflow:"hidden"}}
                            onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 30px rgba(0,0,0,0.08)";e.currentTarget.style.transform="translateY(-2px)";}}
                            onMouseLeave={e=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.transform="";}}>
                            {isDone&&<div style={{position:"absolute",top:12,right:12,background:"#dcfce7",color:"#15803d",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99}}>✅ Пройдено</div>}
                            {!isDone&&reportMap[sec.id]&&<div style={{position:"absolute",top:12,right:12,background:"rgba(212,175,55,0.15)",color:"#92680e",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99}}>📋 Отчёт готов</div>}
                            <div style={{width:48,height:48,background:isDone?"#10B981":THEME.primary,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16}}>{isDone?"✅":"📋"}</div>
                            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:6}}>{sec.name}</h3>
                            {sec.description&&<p style={{color:THEME.textLight,fontSize:13,marginBottom:12,lineHeight:1.5}}>{sec.description}</p>}
                            <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${THEME.border}`,paddingTop:12,marginTop:8,flexWrap:"wrap"}}>
                              <span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>{qCount} вопросов</span>
                              <div style={{display:"flex",gap:8}}>
                                {reportMap[sec.id]&&<button onClick={e=>{e.stopPropagation();onViewReport(reportMap[sec.id]);}} style={{background:`rgba(212,175,55,0.12)`,border:`1px solid ${THEME.accent}`,color:"#92680e",fontSize:12,fontWeight:700,padding:"6px 12px",borderRadius:8,cursor:"pointer"}}>📋 Отчёт</button>}
                                {isDone&&!isTester&&<span style={{background:"#dcfce7",color:"#15803d",fontSize:12,fontWeight:700,padding:"6px 12px",borderRadius:8}}>Пройдено ✓</span>}
                                {(!isDone||isTester)&&qCount>0&&<button onClick={()=>onSelectSection(sec)} style={{background:THEME.accent,color:THEME.onAccent ?? '#0f172a',fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer"}}>{isDone&&isTester?"Пройти снова →":"Начать →"}</button>}
                                {qCount===0&&<span style={{color:THEME.textLight,fontSize:12}}>Нет вопросов</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── ВОПРОС (MCQ + MULTIPLE + MATCHING) ───────────────────────────────────────
function QuestionScreen({ question, qNum, total, adaptiveMode, isLastQuestion, onComplete, onStop, onPause, canSkip }) {
  const { theme: THEME } = useTheme();
  const { profile } = useAuth();
  // Кастомный фон из equipped.background для диагностики — radial-gradient
  // делает края тёмными (фокус на условие задачи), центр прозрачный.
  const equippedBg = profile?.equipped?.background ? getShopItem(profile.equipped.background) : null;
  const [elapsed,setElapsed]=useState(0);
  // Resolve generated questions once per question change
  const resolvedQ = useMemo(()=>(question.type==="generated"||question.type==="model")?generateQuestion(question):question, [question.id||question.text]);
  const qType = resolvedQ.type||"mcq";

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
    if(qType!=="matching"||!resolvedQ.pairs) return [];
    return shuffle(resolvedQ.pairs.map((p,i)=>({text:p.right,image:p.rightImage||"",originalIndex:i})));
  },[question.id||question.text]);
  const [matchSel,setMatchSel]=useState({});
  const [matchSubmitted,setMatchSubmitted]=useState(false);

  const [lightboxSrc,setLightboxSrc]=useState(null);

  const [compoundSel,setCompoundSel]=useState({});
  const [compoundSubmitted,setCompoundSubmitted]=useState(false);
  const [compoundConf,setCompoundConf]=useState(null);

  // Open answer state
  const [openAnswer,setOpenAnswer]=useState("");
  const [openSubmitted,setOpenSubmitted]=useState(false);

  useEffect(()=>{setElapsed(0);setSelected(null);setConfidence(null);setMultiSelected([]);setMultiSubmitted(false);setMultiConf(null);setMatchSel({});setMatchSubmitted(false);setCompoundSel({});setCompoundSubmitted(false);setCompoundConf(null);setOpenAnswer("");setOpenSubmitted(false);},[question.id||question.text]);

  const allCompoundFilled = qType==="compound"&&(resolvedQ.subQuestions||[]).length>0&&(resolvedQ.subQuestions||[]).every((_,i)=>compoundSel[i]!==undefined);
  const compoundReady = allCompoundFilled && compoundSubmitted && compoundConf!==null;
  const canProceed = qType==="mcq"?mcqReady : qType==="multiple"?multiReady : qType==="compound"?compoundReady : qType==="open"?openSubmitted : matchSubmitted;

  useEffect(()=>{
    if(canProceed)return;
    const t=setInterval(()=>setElapsed(s=>s+1),1000); return ()=>clearInterval(t);
  },[canProceed]);

  const handleNext = ()=>{
    let correct=false;
    if(qType==="mcq") correct=selected===resolvedQ.correct;
    else if(qType==="multiple"){
      const ca=resolvedQ.correctAnswers||[];
      correct=ca.length===multiSelected.length && ca.every(i=>multiSelected.includes(i));
    } else if(qType==="matching"){
      correct=(resolvedQ.pairs||[]).every((_,i)=>matchSel[i]===i);
    } else if(qType==="compound"){
      correct=(resolvedQ.subQuestions||[]).every((sq,i)=>compoundSel[i]===sq.correct);
    } else if(qType==="open"){
      correct=true; // open answers are not auto-graded, counted as attempted
    }
    const selectedLabel = qType==="mcq"?(resolvedQ.options||[])[selected]
      : qType==="multiple"?multiSelected.map(i=>(resolvedQ.options||[])[i]).join(", ")
      : qType==="compound"?(resolvedQ.subQuestions||[]).map((sq,i)=>`${sq.text}: ${sq.options[compoundSel[i]]??"—"}`).join(" | ")
      : qType==="open"?openAnswer
      : (resolvedQ.pairs||[]).map((p,i)=>`${p.left} → ${(resolvedQ.pairs||[])[matchSel[i]]?.right??"?"}`).join("; ");
    onComplete({ questionId:question.id||qNum, topic:question.topic, section:question.sectionName||question.section, type:question.type||"mcq", difficulty:question.difficulty||"A", correct, confidence:confidence?.v||multiConf?.v||compoundConf?.v||null, timeSpent:elapsed, questionText:resolvedQ.text, options:resolvedQ.options||[], selectedAnswer:selectedLabel, skillNames:question.skillNames||[], ...(question.type==="compound"?{subResults:(resolvedQ.subQuestions||[]).map((sq,i)=>({text:sq.text,options:sq.options||[],selectedIdx:compoundSel[i]??null,correctIdx:sq.correct,correct:compoundSel[i]===sq.correct,skillNames:sq.skillNames||[],difficulty:sq.difficulty||"A"}))}:{}) });
  };

  const handleSkip = () => {
    onComplete({ questionId:question.id||qNum, topic:question.topic, section:question.sectionName||question.section, type:question.type||"mcq", difficulty:question.difficulty||"A", correct:false, skipped:true, confidence:null, timeSpent:elapsed, questionText:resolvedQ.text, options:resolvedQ.options||[], selectedAnswer:"(пропущен)", skillNames:question.skillNames||[] });
  };

  const allMatchFilled = (resolvedQ.pairs||[]).length>0 && (resolvedQ.pairs||[]).every((_,i)=>matchSel[i]!==undefined);

  const CONF_EMOJI = { 1:"😰", 2:"😕", 3:"😐", 4:"😊", 5:"🔥" };
  const CONF_SHORT = { 1:"Нет", 2:"Слабо", 3:"Норм", 4:"Уверен", 5:"100%" };
  const renderConfBtn = (c, currentConf, setConf) => {
    const isActive = currentConf?.v===c.v;
    return (
      <button
        key={c.v}
        className={`conf-btn confidence-btn ${isActive?"active selected":""}`}
        style={isActive
          ? {borderColor:c.color, background:c.color+"22", color:c.color}
          : {background:THEME.surface, color:THEME.text, borderColor:THEME.border}
        }
        onClick={()=>setConf(c)}
      >
        <span className="confidence-emoji">{CONF_EMOJI[c.v]}</span>
        <span className="confidence-short" style={{color: isActive ? c.color : THEME.textLight}}>{CONF_SHORT[c.v]}</span>
        <span className="confidence-label" style={{color: isActive ? c.color : THEME.text}}>{c.label}</span>
      </button>
    );
  };

  return (
    <>
    {equippedBg && (
      <div aria-hidden="true" style={{
        position:'fixed', inset:0, zIndex:-1,
        // Чистый wallpaper, без градиента — читаемость обеспечивается
        // полупрозрачными карточками вопроса/вариантов/уверенности.
        backgroundImage:`url(${equippedBg.file})`,
        backgroundSize:'cover', backgroundPosition:'center', pointerEvents:'none',
      }}/>
    )}
    <div className="question-container question-page-content">
      <ImageModal src={lightboxSrc} onClose={()=>setLightboxSrc(null)}/>
      <div className="question-breadcrumb" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32}}>
        <Logo size={36}/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Timer seconds={elapsed}/>
          {onPause&&<button onClick={onPause} style={{background:"transparent",border:"1px solid rgba(234,179,8,0.45)",color:"#b45309",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",lineHeight:1}}>⏸ Поставить паузу</button>}
          {onStop&&<button onClick={onStop} style={{background:"transparent",border:"1px solid rgba(220,38,38,0.35)",color:"#dc2626",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",lineHeight:1}}>✕ Завершить досрочно</button>}
        </div>
      </div>
      {!adaptiveMode&&<div className="progress-bar-container"><div className="progress-bar-fill" style={{width:`${(qNum/total)*100}%`}}/></div>}
      <div className="question-meta" style={{justifyContent:"flex-end"}}>
        <span style={{color:THEME.textLight,fontSize:14}}>{adaptiveMode?`Вопрос ${qNum}`:`Вопрос ${qNum} из ${total}`}</span>
      </div>
      <div style={{
        background:`${THEME.surface}dd`, backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
        borderRadius:16, boxShadow:'0 4px 24px rgba(0,0,0,0.3)',
        padding:'24px 28px', marginBottom:24,
      }}>
        <h2 className="question-text" style={{marginBottom:0}}>{question.latex?<LatexText text={resolvedQ.text}/>:<MathText text={resolvedQ.text}/>}</h2>
        {resolvedQ.image&&<div style={{margin:"12px 0 0"}}><img src={resolvedQ.image} alt="question" onClick={()=>setLightboxSrc(resolvedQ.image)} style={{maxWidth:"100%",maxHeight:400,borderRadius:12,border:`1px solid ${THEME.border}`,cursor:"zoom-in",display:"block",objectFit:"contain"}}/></div>}
        {resolvedQ.conditionChart&&<div style={{margin:"12px 0 0",display:"flex",justifyContent:"center",background:THEME.surface,borderRadius:12,padding:"14px 10px",border:`1px solid ${THEME.border}`,overflowX:"auto"}}><ChartRenderer chart={resolvedQ.conditionChart} vars={resolvedQ._vars||{}}/></div>}
      </div>

      {/* ── MCQ (includes resolved generated) ── */}
      {qType==="mcq" && (
        <>
          <div className="options-grid">
            {(resolvedQ.options||[]).map((opt,i)=>{
              const isSel=selected===i;
              const cls=isSel?"selected":"";
              const optImg=(resolvedQ.optionImages||[])[i];
              const optChart=(resolvedQ.optionCharts||[])[i];
              const hasMedia=optImg||optChart;
              return(<div key={i} className={`option-card ${cls}`} onClick={()=>{if(selected!==i){setSelected(i);setConfidence(null);}}} style={hasMedia?{flexDirection:"column",alignItems:"flex-start"}:{}}>
                <div className="option-letter">{String.fromCharCode(65+i)}</div>
                <div className="option-content" style={{width:"100%"}}>{optImg&&<img src={optImg} alt={`opt${i}`} onClick={e=>{e.stopPropagation();setLightboxSrc(optImg);}} style={{maxWidth:"100%",maxHeight:200,objectFit:"contain",borderRadius:8,marginBottom:opt||optChart?6:0,display:"block",cursor:"zoom-in"}}/>}{optChart&&<div style={{overflowX:"auto"}}><ChartRenderer chart={optChart} vars={resolvedQ._vars||{}}/></div>}{opt&&(question.latex?<LatexText text={opt}/>:<MathText text={opt}/>)}</div>
              </div>);
            })}
          </div>
          {selected!==null&&(
            <div className="confidence-section scale-in"><h4>Насколько вы уверены?</h4>
              <div className="confidence-grid">{CONFIDENCE_LEVELS.map(c=>renderConfBtn(c, confidence, setConfidence))}</div>
            </div>
          )}
        </>
      )}

      {/* ── MULTIPLE ── */}
      {qType==="multiple" && (
        <>
          <p style={{color:THEME.textLight,fontSize:14,marginBottom:16}}>Выберите все правильные ответы</p>
          <div className="options-grid">
            {(resolvedQ.options||[]).map((opt,i)=>{
              const isSel=multiSelected.includes(i);
              const cls=multiSubmitted?(isSel?"selected":"disabled"):(isSel?"selected":"");
              const optChart=(resolvedQ.optionCharts||[])[i];
              return(<div key={i} className={`option-card ${cls}`} onClick={()=>{if(multiSubmitted)return; setMultiSelected(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);}} style={optChart?{flexDirection:"column",alignItems:"flex-start"}:{}}>
                <div className="option-letter" style={{borderRadius:4,flexShrink:0}}>{isSel?"✓":String.fromCharCode(65+i)}</div>
                <div className="option-content" style={{width:"100%"}}>{optChart&&<div style={{overflowX:"auto",marginBottom:opt?6:0}}><ChartRenderer chart={optChart} vars={resolvedQ._vars||{}}/></div>}{opt&&(question.latex?<LatexText text={opt}/>:<MathText text={opt}/>)}</div>
              </div>);
            })}
          </div>
          {!multiSubmitted&&multiSelected.length>0&&(
            <button className="cta-button active" onClick={()=>setMultiSubmitted(true)} style={{marginBottom:24}}>Подтвердить ответ</button>
          )}
          {multiSubmitted&&!multiReady&&(
            <div className="confidence-section scale-in"><h4>Насколько вы уверены?</h4>
              <div className="confidence-grid">{CONFIDENCE_LEVELS.map(c=>renderConfBtn(c, multiConf, setMultiConf))}</div>
            </div>
          )}
        </>
      )}

      {/* ── MATCHING ── */}
      {qType==="matching" && (
        <>
          <p style={{color:THEME.textLight,fontSize:14,marginBottom:20}}>Для каждого элемента слева выберите соответствующий справа</p>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:32}}>
            {(resolvedQ.pairs||[]).map((pair,i)=>{
              const selectedRight=matchSel[i];
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:THEME.surface,borderRadius:12,border:`1px solid ${THEME.border}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,color:THEME.primary,fontSize:15}}>{pair.left}</div>
                    {pair.leftImage&&<img src={pair.leftImage} alt="" style={{maxHeight:80,maxWidth:"100%",borderRadius:8,marginTop:6,border:`1px solid ${THEME.border}`}}/>}
                  </div>
                  <div style={{color:THEME.textLight,fontWeight:700,fontSize:18}}>→</div>
                  {shuffledRights.some(r=>r.image)?(
                    <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:6}}>
                      {shuffledRights.map((r,ri)=>{
                        const isSel=selectedRight===r.originalIndex;
                        return(
                          <div key={ri} onClick={()=>!matchSubmitted&&setMatchSel(p=>({...p,[i]:r.originalIndex}))} style={{padding:"6px 10px",borderRadius:8,border:`2px solid ${isSel?THEME.primary:THEME.border}`,background:isSel?"rgba(15,23,42,0.05)":"#fafafa",cursor:matchSubmitted?"default":"pointer",textAlign:"center",minWidth:60}}>
                            {r.image&&<img src={r.image} alt="" style={{maxHeight:60,maxWidth:80,borderRadius:6,display:"block",marginBottom:r.text?4:0}}/>}
                            {r.text&&<span style={{fontSize:13,fontWeight:isSel?700:400}}>{r.text}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ):(
                    <select value={selectedRight??""} onChange={e=>!matchSubmitted&&setMatchSel(p=>({...p,[i]:Number(e.target.value)}))}
                      style={{flex:1,padding:"10px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",cursor:matchSubmitted?"default":"pointer"}} disabled={matchSubmitted}>
                      <option value="" disabled>Выбрать...</option>
                      {shuffledRights.map((r,ri)=><option key={ri} value={r.originalIndex}>{r.text}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          {!matchSubmitted&&<button className={`cta-button ${allMatchFilled?"active":""}`} disabled={!allMatchFilled} onClick={()=>setMatchSubmitted(true)} style={{marginBottom:24}}>Подтвердить соответствие</button>}
        </>
      )}

      {/* ── COMPOUND ── */}
      {qType==="compound" && (
        <>
          <p style={{color:THEME.textLight,fontSize:14,marginBottom:20}}>Выберите ответ для каждого вопроса</p>
          <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:24}}>
            {(resolvedQ.subQuestions||[]).map((sq,sqi)=>(
              <div key={sqi} style={{background:THEME.surface,borderRadius:12,border:`1px solid ${THEME.border}`,padding:"16px 18px"}}>
                <div style={{fontWeight:700,color:THEME.primary,fontSize:15,marginBottom:8}}>{sqi+1}. <MathText text={sq.text}/></div>
                {sq.image&&<img src={sq.image} alt="" onClick={()=>setLightboxSrc(sq.image)} style={{maxWidth:"100%",maxHeight:400,objectFit:"contain",borderRadius:8,marginBottom:12,border:`1px solid ${THEME.border}`,cursor:"zoom-in",display:"block"}}/>}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sq.options.map((opt,oi)=>{
                    const isSel=compoundSel[sqi]===oi;
                    const optImg=(sq.optionImages||[])[oi];
                    return(
                      <div key={oi} onClick={()=>{if(!compoundSubmitted){setCompoundSel(p=>({...p,[sqi]:oi}));setCompoundConf(null);}} } style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${isSel?THEME.primary:THEME.border}`,background:isSel?"rgba(15,23,42,0.05)":"#fafafa",cursor:compoundSubmitted?"default":"pointer",transition:"all 0.15s"}}>
                        <div style={{width:24,height:24,borderRadius:6,background:isSel?THEME.primary:THEME.bg,border:`2px solid ${isSel?THEME.primary:THEME.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:12,fontWeight:700}}>{String.fromCharCode(65+oi)}</div>
                        <div style={{flex:1}}>
                          {opt&&<span style={{fontSize:14,color:THEME.text,fontWeight:isSel?600:400}}><MathText text={opt}/></span>}
                          {optImg&&<img src={optImg} alt="" onClick={e=>{e.stopPropagation();setLightboxSrc(optImg);}} style={{maxWidth:"100%",maxHeight:200,objectFit:"contain",borderRadius:6,display:"block",marginTop:opt?4:0,border:`1px solid ${THEME.border}`,cursor:"zoom-in"}}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!compoundSubmitted&&allCompoundFilled&&(
            <button className="cta-button active" onClick={()=>setCompoundSubmitted(true)} style={{marginBottom:24}}>Подтвердить ответы</button>
          )}
          {compoundSubmitted&&compoundConf===null&&(
            <div className="confidence-section scale-in"><h4>Насколько вы уверены?</h4>
              <div className="confidence-grid">{CONFIDENCE_LEVELS.map(c=>renderConfBtn(c, compoundConf, setCompoundConf))}</div>
            </div>
          )}
        </>
      )}

      {/* ── OPEN ANSWER ── */}
      {qType==="open"&&(
        <div style={{marginBottom:24}}>
          <textarea
            value={openAnswer}
            onChange={e=>{setOpenAnswer(e.target.value);setOpenSubmitted(false);}}
            disabled={openSubmitted}
            rows={5}
            placeholder="Напишите ваш ответ здесь..."
            style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:12,border:`1.5px solid ${openSubmitted?THEME.success:THEME.border}`,background:openSubmitted?"#f0fdf4":THEME.surface,fontSize:15,fontFamily:"'Inter',sans-serif",lineHeight:1.6,resize:"vertical",outline:"none",color:THEME.text,transition:"border-color 0.2s"}}
          />
          {!openSubmitted&&openAnswer.trim()&&(
            <button className="cta-button active" onClick={()=>setOpenSubmitted(true)} style={{marginTop:12}}>Подтвердить ответ</button>
          )}
          {openSubmitted&&<div style={{marginTop:8,fontSize:13,color:"#16a34a",fontWeight:600}}>✓ Ответ записан</div>}
        </div>
      )}

      {/* ── FALLBACK: нет вариантов ответа (ошибка данных в БД) ── */}
      {!canProceed && (qType==="mcq"||qType==="compound") && (resolvedQ.options||[]).length===0 && (
        <div style={{marginBottom:16,padding:"14px 18px",borderRadius:12,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.25)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:20}}>⚠️</span>
          <span style={{flex:1,fontSize:14,color:"#b91c1c"}}>Варианты ответа отсутствуют — ошибка данных в банке задач.</span>
          <button onClick={handleSkip} style={{padding:"10px 18px",borderRadius:10,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#dc2626",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>
            Пропустить вопрос →
          </button>
        </div>
      )}

      <div style={{marginTop:qType==="matching"||qType==="compound"||qType==="open"?0:16,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <button className={`cta-button next-question-btn ${canProceed?"active":""}`} disabled={!canProceed} onClick={handleNext} style={{flex:1,minWidth:200}}>
          {adaptiveMode&&isLastQuestion?"Завершить раздел":!adaptiveMode&&qNum>=total?"Завершить диагностику":"Следующий вопрос →"}
        </button>
        {canSkip&&(
          <button onClick={handleSkip} style={{padding:"14px 22px",borderRadius:12,border:`2px solid #8B5CF6`,background:"transparent",color:"#8B5CF6",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap"}}>
            Пропустить →
          </button>
        )}
      </div>
    </div>
    </>
  );
}

export { DiagnosticRulesScreen, DiagnosticsScreen, QuestionScreen };
