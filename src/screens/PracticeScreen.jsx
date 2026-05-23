import React, { useState, useEffect } from "react";
import { doc, getDoc, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { shuffle, generateQuestion } from "../lib/mathUtils.js";
import { GRADES_LIST } from "../lib/appConstants.js";
import { useTheme } from "../ThemeContext.jsx";
import Logo from "../components/ui/Logo.jsx";
import MathText from "../components/ui/MathText.jsx";
import ChartRenderer from "../components/charts/ChartRenderer.jsx";
import ImageModal from "../components/ui/ImageModal.jsx";

export default function PracticeScreen({ user, onBack }) {
  const { theme: THEME } = useTheme();
  const [phase, setPhase] = useState("select"); // select | theory_list | theory | practice | done
  const [zones, setZones] = useState({ red:[], yellow:[], green:[] });
  const [allSections, setAllSections] = useState([]);
  const [allTopics, setAllTopics] = useState([]);
  const [expandedSecs, setExpandedSecs] = useState({});
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [browseMode, setBrowseMode] = useState(false); // show all sections instead of zones
  const [filterSec, setFilterSec] = useState("");
  // Theory state
  const [theoryContent, setTheoryContent] = useState(null); // loaded theory object
  const [loadingTheory, setLoadingTheory] = useState(false);
  const [theoryTab, setTheoryTab] = useState("text"); // "text" | "cards"
  const [cardIdx, setCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  // Multi-topic theory list
  const [theoryTopicsList, setTheoryTopicsList] = useState([]); // [{topicName, sectionName, topicId, theory}]
  const [theoryListTitle, setTheoryListTitle] = useState(""); // skill name or topic name

  const [skillZones, setSkillZones] = useState({ red:[], yellow:[], green:[] });

  useEffect(()=>{
    const load = async () => {
      try {
        const [progSnap, allSections, allTopics, skillProgSnap] = await Promise.all([
          getDoc(doc(db,"userProgress",user?.uid)),
          getContent("sections"),
          getContent("topics"),
          getDoc(doc(db,"skillProgress",user?.uid)),
        ]);
        if (progSnap.exists()) {
          const topics = progSnap.data().topics || {};
          const g = { red:[], yellow:[], green:[] };
          Object.entries(topics).forEach(([topic,d]) => g[d.zone||"red"].push({topic, ...d}));
          setZones(g);
        }
        if (skillProgSnap.exists()) {
          const skills = skillProgSnap.data().skills || {};
          const sg = { red:[], yellow:[], green:[] };
          Object.entries(skills).forEach(([skill,d]) => sg[d.zone||"red"].push({skill, ...d}));
          setSkillZones(sg);
        }
        setAllSections(allSections);
        setAllTopics(allTopics);
      } catch(e){ console.error(e); }
      setLoadingTopics(false);
    };
    load();
  },[user?.phone]);

  const startPractice = async (topicName, sectionName) => {
    setLoadingQ(true);
    try {
      let qs = await getContent("questions");
      // Filter by topic name match, fall back to section
      let filtered = qs.filter(q => q.topic === topicName);
      if (!filtered.length) filtered = qs.filter(q => q.sectionName === sectionName || q.section === sectionName);
      if (!filtered.length) { alert("Нет вопросов для этой темы. Попросите преподавателя добавить вопросы."); setLoadingQ(false); return; }
      // Only MCQ, multiple and generated for practice
      filtered = filtered.filter(q => q.type==="mcq"||q.type==="multiple"||q.type==="generated"||q.type==="model"||q.type==="matching"||q.type==="compound"||q.type==="open"||!q.type);
      if (!filtered.length) { alert("Нет подходящих вопросов для тренировки."); setLoadingQ(false); return; }
      // Resolve generated questions with fresh random numbers for this session
      const picked = shuffle(filtered).slice(0, 15).map(q => (q.type==="generated"||q.type==="model") ? generateQuestion(q) : q);
      setQuestions(picked);
      setSelectedTopic({ topic: topicName, section: sectionName });
      setQIdx(0); setChosen(null); setRevealed(false); setResults([]);
      setPhase("practice");
    } catch(e){ alert("Ошибка загрузки вопросов."); }
    setLoadingQ(false);
  };

  const openTheoryDirect = async (theory) => {
    setTheoryContent(theory);
    setTheoryTab("text"); setCardIdx(0); setCardFlipped(false);
    setPhase("theory");
  };

  const openTheory = async (topicName, sectionName, topicId) => {
    setLoadingTheory(true);
    try {
      const all = await getContent("theories");
      const normStr=s=>(s||"").trim().toLowerCase();
      // 1. Exact topicId match (most reliable)
      let found = topicId ? all.find(t => t.topicId === topicId) : null;
      // 2. Exact topic name + section match
      if (!found) found = all.find(t => normStr(t.topicName)===normStr(topicName)&&normStr(t.sectionName)===normStr(sectionName));
      // 3. Topic name only (within same section)
      if (!found) found = all.find(t => normStr(t.topic)===normStr(topicName)&&normStr(t.sectionName)===normStr(sectionName));
      // 4. Topic name anywhere (last resort)
      if (!found) found = all.find(t => normStr(t.topicName)===normStr(topicName)||normStr(t.topic)===normStr(topicName));

      setSelectedTopic({ topic: topicName, section: sectionName, topicId });

      if (found) {
        // Collect all skills from this theory's blocks
        const theorySkills = new Set();
        (found.blocks||[]).forEach(b => (b.skills||[]).forEach(s => theorySkills.add(s.trim().toLowerCase())));

        if (theorySkills.size > 0) {
          // Find other theories that share at least one skill
          const related = all.filter(t => t.id !== found.id && (t.blocks||[]).some(b => (b.skills||[]).some(s => theorySkills.has(s.trim().toLowerCase()))));
          if (related.length > 0) {
            // Multiple theories share skills — show list
            const list = [found, ...related].map(t => ({
              theory: t,
              topicName: t.topicName||t.topic||topicName,
              sectionName: t.sectionName||sectionName,
            }));
            setTheoryTopicsList(list);
            setTheoryListTitle(topicName);
            setPhase("theory_list");
            setLoadingTheory(false);
            return;
          }
        }
        // Single theory — open directly
        setTheoryContent(found);
      } else {
        setTheoryContent({ _notFound: true, topic: topicName, sectionName });
      }
      setTheoryTab("text"); setCardIdx(0); setCardFlipped(false);
      setPhase("theory");
    } catch { alert("Ошибка загрузки теории."); }
    setLoadingTheory(false);
  };

  const handleChoose = (idx) => {
    if (revealed) return;
    setChosen(idx); setRevealed(true);
    const q = questions[qIdx];
    const correct = (q.type==="multiple")
      ? Array.isArray(q.correctAnswers) && q.correctAnswers.includes(idx)
      : idx === q.correct;
    setResults(p=>[...p,{correct, topic: q.topic}]);
  };

  const next = () => {
    if (qIdx+1 >= questions.length) { setPhase("done"); return; }
    setQIdx(q=>q+1); setChosen(null); setRevealed(false);
  };

  const zoneColors = { red:{c:THEME.error,bg:"rgba(239,68,68,0.08)",border:"rgba(239,68,68,0.2)",label:"🔴 Критическая зона"}, yellow:{c:"#b45309",bg:"rgba(245,158,11,0.08)",border:"rgba(245,158,11,0.25)",label:"🟡 Требует внимания"}, green:{c:"#065f46",bg:"rgba(16,185,129,0.08)",border:"rgba(16,185,129,0.2)",label:"🟢 Хорошая зона"} };

  // ── Done screen ──
  if (phase==="done") {
    const correct = results.filter(r=>r.correct).length;
    const pct = Math.round((correct/results.length)*100);
    const color = pct>=80?THEME.success:pct>=60?THEME.warning:THEME.error;
    return (
      <div style={{minHeight:"100vh",background:THEME.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
        <div style={{background:"#fff",borderRadius:20,border:`1px solid ${THEME.border}`,padding:"48px 40px",maxWidth:480,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:56,marginBottom:16}}>{pct>=80?"🏆":pct>=60?"👍":"💪"}</div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,color:THEME.primary,marginBottom:8}}>Тренировка завершена!</div>
          <div style={{fontSize:15,color:THEME.textLight,marginBottom:24}}>Тема: <b>{selectedTopic?.topic}</b></div>
          <div style={{width:90,height:90,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:28,color:"#fff"}}>{pct}%</div>
          <div style={{fontSize:16,color:THEME.textLight,marginBottom:32}}>Верно: <b style={{color:THEME.primary}}>{correct}</b> из {results.length}</div>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>{setPhase("practice");setQIdx(0);setChosen(null);setRevealed(false);setResults([]);setQuestions(shuffle(questions).map(q=>q._generated?generateQuestion(q._origQuestion):q));}} style={{padding:"12px 24px",borderRadius:10,background:THEME.primary,color:THEME.accent,border:"none",fontWeight:700,cursor:"pointer",fontSize:14}}>🔄 Ещё раз</button>
            <button onClick={()=>setPhase("select")} style={{padding:"12px 24px",borderRadius:10,background:"#fff",color:THEME.primary,border:`1px solid ${THEME.border}`,fontWeight:700,cursor:"pointer",fontSize:14}}>← Выбрать тему</button>
            <button onClick={onBack} style={{padding:"12px 24px",borderRadius:10,background:"#fff",color:THEME.textLight,border:`1px solid ${THEME.border}`,fontWeight:600,cursor:"pointer",fontSize:14}}>На главную</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Theory list screen (multiple topics share same skills) ──
  if (phase==="theory_list") {
    return (
      <div style={{minHeight:"100vh",background:THEME.bg}}>
        <nav data-inner-nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"0 40px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <Logo size={28}/>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,color:THEME.textLight}}>📖 Теория</div>
          <button onClick={()=>setPhase("select")} style={{background:"transparent",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,color:THEME.textLight}}>← Назад</button>
        </nav>
        <div style={{maxWidth:780,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{marginBottom:28}}>
            <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:THEME.primary,marginBottom:4}}>Выбери тему для изучения</h1>
            <p style={{color:THEME.textLight,fontSize:14}}>Навык «{theoryListTitle}» встречается в нескольких темах</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {theoryTopicsList.map((item,i)=>(
              <div key={i} onClick={()=>openTheoryDirect(item.theory)} style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.border}`,padding:"20px 24px",cursor:"pointer",transition:"all 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                  <div>
                    <div style={{fontWeight:700,color:THEME.primary,fontSize:16,marginBottom:4}}>{item.theory.title||item.topicName}</div>
                    <div style={{fontSize:13,color:THEME.textLight}}>{item.sectionName} · {item.topicName}</div>
                    {(()=>{const skills=[...new Set((item.theory.blocks||[]).flatMap(b=>b.skills||[]))].filter(Boolean);return skills.length>0&&(<div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>{skills.map((sk,si)=><span key={si} style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99}}>{sk}</span>)}</div>);})()}
                  </div>
                  <span style={{color:THEME.accent,fontWeight:700,fontSize:22,flexShrink:0}}>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Theory screen ──
  if (phase==="theory") {
    const hasContent = theoryContent && !theoryContent._notFound;
    const cards = hasContent ? (theoryContent.cards||[]).filter(c=>c.front||c.back) : [];
    return (
      <div style={{minHeight:"100vh",background:THEME.bg}}>
        <nav data-inner-nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"0 40px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <Logo size={28}/>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,color:THEME.textLight}}>📖 Теория · {selectedTopic?.topic}</div>
          <button onClick={()=>setPhase("select")} style={{background:"transparent",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,color:THEME.textLight}}>← Назад</button>
        </nav>
        <div style={{maxWidth:780,margin:"0 auto",padding:"40px 20px"}}>
          {!hasContent&&(
            <div style={{textAlign:"center",padding:"60px 24px",background:"#fff",borderRadius:20,border:`1px solid ${THEME.border}`}}>
              <div style={{fontSize:48,marginBottom:16}}>📭</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:THEME.primary,marginBottom:8}}>Теория пока не добавлена</div>
              <div style={{color:THEME.textLight,fontSize:14,marginBottom:28}}>Преподаватель ещё не добавил теорию по теме «{selectedTopic?.topic}»</div>
              <button onClick={()=>startPractice(selectedTopic?.topic, selectedTopic?.section)} style={{padding:"12px 28px",borderRadius:12,background:THEME.primary,color:THEME.accent,border:"none",fontWeight:700,cursor:"pointer",fontSize:14}}>🏋️ Всё равно начать тренировку</button>
            </div>
          )}
          {hasContent&&(
            <>
              <div style={{marginBottom:28}}>
                <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:THEME.primary,marginBottom:4}}>{theoryContent.title}</h1>
                <div style={{color:THEME.textLight,fontSize:14}}>{theoryContent.sectionName} · {theoryContent.topic}</div>
              </div>

              {/* Tabs */}
              <div style={{display:"flex",gap:4,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:12,padding:5,marginBottom:24,width:"fit-content"}}>
                {[{id:"text",label:"📖 Теория"},{id:"cards",label:`🃏 Карточки ${cards.length>0?`(${cards.length})`:""}`}].map(t=>(
                  <button key={t.id} onClick={()=>{setTheoryTab(t.id);setCardIdx(0);setCardFlipped(false);}} style={{padding:"8px 20px",borderRadius:8,border:"none",background:theoryTab===t.id?THEME.primary:"transparent",color:theoryTab===t.id?"#fff":THEME.textLight,fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s"}}>{t.label}</button>
                ))}
              </div>

              {/* Theory text/blocks tab */}
              {theoryTab==="text"&&(()=>{
                // Resolve blocks (new format) or fall back to old content string
                const blocks = theoryContent.blocks?.length
                  ? theoryContent.blocks
                  : (theoryContent.content ? [{type:"text",value:theoryContent.content}] : []);
                const hasBlocks = blocks.some(b=>b.type==="image"?b.src:b.type==="formula"?b.value?.trim():b.value?.trim());
                return(
                  <div style={{background:"#fff",borderRadius:18,border:`1px solid ${THEME.border}`,padding:"32px",boxShadow:"0 4px 20px rgba(0,0,0,0.04)",marginBottom:24}}>
                    {!hasBlocks
                      ?<div style={{color:THEME.textLight,fontSize:14,textAlign:"center",padding:"24px 0"}}>Текст теории не добавлен. Перейдите к карточкам.</div>
                      :<div style={{display:"flex",flexDirection:"column",gap:20}}>
                        {blocks.map((block,i)=>{
                          if(block.type==="image"&&block.src) return(
                            <div key={i} style={{textAlign:"center"}}>
                              <img src={block.src} alt={block.caption||"Изображение"} style={{maxWidth:"100%",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}}/>
                              {block.caption&&<div style={{marginTop:8,fontSize:13,color:THEME.textLight,fontStyle:"italic"}}>{block.caption}</div>}
                            </div>
                          );
                          if(block.type==="formula"&&block.value?.trim()) return(
                            <div key={i} style={{margin:"4px 0"}}>
                              <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:10,padding:"18px 28px",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{fontStyle:"italic",fontSize:20,color:"#1e1b4b",letterSpacing:"0.04em",fontFamily:"'Georgia',serif"}}><MathText text={block.value}/></span>
                              </div>
                              {block.skills?.length>0&&(
                                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8,justifyContent:"center"}}>
                                  {block.skills.map((sk,si)=>(
                                    <span key={si} style={{background:"rgba(37,99,235,0.08)",color:THEME.primary,border:`1px solid rgba(37,99,235,0.2)`,borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:600}}>🎯 {sk}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                          if(block.type==="text"&&block.value?.trim()) return(
                            <div key={i}>
                              <div className="theory-rich-text" style={{fontFamily:"'Inter',sans-serif",fontSize:16,lineHeight:1.85,color:THEME.text}} dangerouslySetInnerHTML={{__html:block.value}}/>
                              {block.skills?.length>0&&(
                                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                                  {block.skills.map((sk,si)=>(
                                    <span key={si} style={{background:"rgba(37,99,235,0.08)",color:THEME.primary,border:`1px solid rgba(37,99,235,0.2)`,borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:600}}>🎯 {sk}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                          return null;
                        })}
                      </div>
                    }
                  </div>
                );
              })()}

              {/* Flashcards tab */}
              {theoryTab==="cards"&&(
                cards.length===0
                  ? <div style={{textAlign:"center",padding:"40px",background:"#fff",borderRadius:18,border:`1px solid ${THEME.border}`,color:THEME.textLight,fontSize:14,marginBottom:24}}>Карточки пока не добавлены для этой темы.</div>
                  : (
                  <div style={{marginBottom:24}}>
                    {/* Progress dots */}
                    <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>
                      {cards.map((_,i)=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:i===cardIdx?THEME.primary:THEME.border,transition:"all 0.2s"}}/>)}
                    </div>
                    {/* Card */}
                    <div style={{perspective:"1000px",marginBottom:20}} onClick={()=>setCardFlipped(f=>!f)}>
                      <div style={{position:"relative",width:"100%",paddingBottom:"56%",transformStyle:"preserve-3d",transition:"transform 0.55s ease",transform:cardFlipped?"rotateY(180deg)":"rotateY(0deg)"}}>
                        {/* Front */}
                        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",background:"#fff",borderRadius:20,border:`2px solid ${THEME.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px",boxShadow:"0 8px 32px rgba(0,0,0,0.08)",cursor:"pointer"}}>
                          <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,letterSpacing:"1px",textTransform:"uppercase",marginBottom:16}}>ВОПРОС · {cardIdx+1}/{cards.length}</div>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:700,color:THEME.primary,textAlign:"center",lineHeight:1.4}}>{cards[cardIdx]?.front}</div>
                          <div style={{marginTop:20,fontSize:12,color:THEME.textLight}}>Нажмите, чтобы увидеть ответ</div>
                        </div>
                        {/* Back */}
                        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",transform:"rotateY(180deg)",background:`linear-gradient(135deg, ${THEME.primary} 0%, #1e3a6e 100%)`,borderRadius:20,border:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px",boxShadow:"0 8px 32px rgba(0,0,0,0.15)",cursor:"pointer"}}>
                          <div style={{fontSize:11,fontWeight:700,color:THEME.accent,letterSpacing:"1px",textTransform:"uppercase",marginBottom:16}}>ОТВЕТ · {cardIdx+1}/{cards.length}</div>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:700,color:"#fff",textAlign:"center",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{cards[cardIdx]?.back}</div>
                          <div style={{marginTop:20,fontSize:12,color:"rgba(255,255,255,0.5)"}}>Нажмите, чтобы вернуться</div>
                        </div>
                      </div>
                    </div>
                    {/* Navigation */}
                    <div style={{display:"flex",gap:12,justifyContent:"center",alignItems:"center"}}>
                      <button onClick={(e)=>{e.stopPropagation();setCardIdx(i=>Math.max(0,i-1));setCardFlipped(false);}} disabled={cardIdx===0} style={{padding:"10px 24px",borderRadius:10,background:"#fff",border:`1px solid ${THEME.border}`,fontWeight:700,cursor:cardIdx===0?"not-allowed":"pointer",color:cardIdx===0?THEME.textLight:THEME.primary,fontSize:14}}>← Назад</button>
                      <span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>{cardIdx+1} / {cards.length}</span>
                      {cardIdx<cards.length-1
                        ?<button onClick={(e)=>{e.stopPropagation();setCardIdx(i=>i+1);setCardFlipped(false);}} style={{padding:"10px 24px",borderRadius:10,background:THEME.primary,color:THEME.accent,border:"none",fontWeight:700,cursor:"pointer",fontSize:14}}>Следующая →</button>
                        :<button onClick={(e)=>{e.stopPropagation();setCardIdx(0);setCardFlipped(false);}} style={{padding:"10px 24px",borderRadius:10,background:THEME.success,color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontSize:14}}>🔄 Сначала</button>
                      }
                    </div>
                  </div>
                )
              )}

              <button onClick={()=>startPractice(selectedTopic?.topic, selectedTopic?.section)} style={{width:"100%",padding:"15px",borderRadius:12,background:THEME.primary,color:THEME.accent,border:"none",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 6px 20px rgba(15,23,42,0.2)"}}>
                🏋️ Начать тренировку по этой теме →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Practice screen ──
  if (phase==="practice") {
    const q = questions[qIdx]; // already resolved (MCQ) — generated questions pre-resolved in startPractice
    const isCorrect = chosen!==null && chosen===q.correct;
    const progress = Math.round(((qIdx+1)/questions.length)*100);
    return (
      <div style={{minHeight:"100vh",background:THEME.bg}}>
        <ImageModal src={lightboxSrc} onClose={()=>setLightboxSrc(null)}/>
        <nav data-inner-nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"0 40px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <Logo size={28}/>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,color:THEME.textLight}}>🏋️ Тренировка · {selectedTopic?.topic}</div>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,color:THEME.textLight}}>Выйти</button>
        </nav>
        <div style={{maxWidth:720,margin:"0 auto",padding:"40px 20px"}}>
          {/* Progress */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
            <div style={{flex:1,height:6,background:THEME.border,borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${progress}%`,background:THEME.primary,borderRadius:99,transition:"width 0.3s"}}/>
            </div>
            <span style={{fontSize:13,fontWeight:600,color:THEME.textLight,flexShrink:0}}>{qIdx+1} / {questions.length}</span>
          </div>

          <div style={{background:"#fff",borderRadius:18,border:`1px solid ${THEME.border}`,padding:"32px",marginBottom:20,boxShadow:"0 4px 20px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <span style={{background:THEME.primary,color:THEME.accent,padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:700}}>{q.sectionName||q.section}</span>
              <span style={{background:THEME.bg,color:THEME.textLight,padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1px solid ${THEME.border}`}}>{q.topic}</span>
              <span style={{marginLeft:"auto",background:"rgba(16,185,129,0.1)",color:THEME.success,padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:700}}>🏋️ Тренировка</span>
            </div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:800,color:THEME.primary,lineHeight:1.4,marginBottom:q.image||q.conditionChart?12:28}}><MathText text={q.text}/></div>
            {q.image&&<div style={{marginBottom:16}}><img src={q.image} alt="question" onClick={()=>setLightboxSrc(q.image)} style={{maxWidth:"100%",maxHeight:400,objectFit:"contain",borderRadius:10,border:`1px solid ${THEME.border}`,cursor:"zoom-in",display:"block"}}/></div>}
            {q.conditionChart&&<div style={{marginBottom:16,display:"flex",justifyContent:"center",background:"#f8fafc",borderRadius:10,padding:"12px 8px",border:`1px solid ${THEME.border}`,overflowX:"auto"}}><ChartRenderer chart={q.conditionChart} vars={q._vars||{}}/></div>}

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(q.options||[]).map((opt,i)=>{
                let bg="#fff", border=`1px solid ${THEME.border}`, color=THEME.text;
                if (revealed) {
                  if (i===q.correct) { bg="rgba(16,185,129,0.1)"; border=`2px solid ${THEME.success}`; color=THEME.success; }
                  else if (i===chosen && i!==q.correct) { bg="rgba(239,68,68,0.08)"; border=`2px solid ${THEME.error}`; color=THEME.error; }
                  else { bg="#f8fafc"; color=THEME.textLight; }
                } else if (chosen===i) { bg="#f1f5f9"; border=`2px solid ${THEME.primary}`; }
                const optImg=(q.optionImages||[])[i];
                const optChart=(q.optionCharts||[])[i];
                return (
                  <div key={i} onClick={()=>handleChoose(i)}
                    style={{display:"flex",alignItems:optImg||optChart?"flex-start":"center",gap:14,padding:"14px 18px",borderRadius:12,background:bg,border,cursor:revealed?"default":"pointer",transition:"all 0.15s"}}>
                    <div style={{width:32,height:32,borderRadius:8,background:revealed&&i===q.correct?THEME.success:revealed&&i===chosen&&i!==q.correct?THEME.error:THEME.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:revealed&&(i===q.correct||i===chosen)?'#fff':THEME.textLight,flexShrink:0,border:`1px solid ${THEME.border}`}}>
                      {String.fromCharCode(65+i)}
                    </div>
                    <div style={{flex:1}}>
                      {optImg&&<img src={optImg} alt={`opt${i}`} onClick={e=>{e.stopPropagation();setLightboxSrc(optImg);}} style={{maxWidth:"100%",maxHeight:200,objectFit:"contain",borderRadius:6,marginBottom:opt?6:0,display:"block",cursor:"zoom-in"}}/>}
                      {optChart&&<div style={{overflowX:"auto",marginBottom:opt?6:0}}><ChartRenderer chart={optChart} vars={q._vars||{}}/></div>}
                      {opt&&<span style={{fontSize:15,fontWeight:500,color}}><MathText text={opt}/></span>}
                    </div>
                    {revealed&&i===q.correct&&<span style={{marginLeft:"auto",fontSize:18,flexShrink:0}}>✅</span>}
                    {revealed&&i===chosen&&i!==q.correct&&<span style={{marginLeft:"auto",fontSize:18,flexShrink:0}}>❌</span>}
                  </div>
                );
              })}
            </div>

            {/* Hint after reveal */}
            {revealed&&(
              <div style={{marginTop:20,padding:"14px 18px",borderRadius:12,background:isCorrect?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.06)",border:`1px solid ${isCorrect?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.2)"}`}}>
                <div style={{fontWeight:700,color:isCorrect?THEME.success:THEME.error,marginBottom:isCorrect?0:6}}>
                  {isCorrect?"✅ Верно! Отличная работа":"❌ Неверно"}
                </div>
                {!isCorrect&&<div style={{fontSize:13,color:THEME.textLight}}>Правильный ответ: <b style={{color:THEME.primary}}>{q.options?.[q.correct]}</b></div>}
              </div>
            )}
          </div>

          {revealed&&(
            <button onClick={next} style={{width:"100%",padding:"14px",borderRadius:12,background:THEME.primary,color:THEME.accent,border:"none",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 6px 20px rgba(15,23,42,0.2)"}}>
              {qIdx+1>=questions.length?"Завершить тренировку →":"Следующий вопрос →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Topic selection screen ──
  const hasZones = zones.red.length+zones.yellow.length > 0;
  const sections = [...new Set(allSections.map(s=>s.name))];
  return (
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav data-inner-nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"0 40px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo size={28}/>
        <button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"8px 18px",fontSize:13}}>← Главная</button>
      </nav>
      <div style={{maxWidth:860,margin:"0 auto",padding:"48px 20px"}}>
        <div style={{marginBottom:36}}>
          <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,color:THEME.primary,marginBottom:6}}>🏋️ Тренировочный режим</h1>
          <p style={{color:THEME.textLight,fontSize:15}}>Выбери тему — решай задачи без таймера, сразу видишь верный ответ</p>
        </div>

        {loadingTopics&&<div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загрузка...</div>}
        {loadingQ&&<div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загружаем вопросы...</div>}
        {loadingTheory&&<div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загружаем теорию...</div>}

        {!loadingTopics&&!loadingQ&&(
          <>
            {/* Toggle */}
            <div style={{display:"flex",gap:8,marginBottom:28,flexWrap:"wrap"}}>
              <button onClick={()=>setBrowseMode(false)} style={{padding:"8px 20px",borderRadius:99,border:`1px solid ${!browseMode?THEME.primary:THEME.border}`,background:!browseMode?THEME.primary:"#fff",color:!browseMode?"#fff":THEME.textLight,fontWeight:600,fontSize:13,cursor:"pointer"}}>По моим зонам</button>
              <button onClick={()=>setBrowseMode(true)} style={{padding:"8px 20px",borderRadius:99,border:`1px solid ${browseMode?THEME.primary:THEME.border}`,background:browseMode?THEME.primary:"#fff",color:browseMode?"#fff":THEME.textLight,fontWeight:600,fontSize:13,cursor:"pointer"}}>Все разделы</button>
            </div>

            {!browseMode&&(
              <>
                {!hasZones&&(
                  <div style={{textAlign:"center",padding:"60px 24px",background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`}}>
                    <div style={{fontSize:48,marginBottom:12}}>🎯</div>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:THEME.primary,marginBottom:8}}>Сначала пройди диагностику</div>
                    <div style={{color:THEME.textLight,fontSize:14}}>После диагностики здесь появятся темы из твоих красной и жёлтой зон</div>
                  </div>
                )}
                {["red","yellow","green"].map(zone=>zones[zone].length>0&&(
                  <div key={zone} style={{marginBottom:28}}>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,color:zoneColors[zone].c,marginBottom:12}}>{zoneColors[zone].label}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                      {zones[zone].map((t,i)=>(
                        <div key={i} style={{background:"#fff",border:`1px solid ${zoneColors[zone].border}`,borderLeft:`4px solid ${zoneColors[zone].c}`,borderRadius:12,padding:"14px 16px"}}>
                          <div style={{fontWeight:700,color:THEME.primary,fontSize:14,marginBottom:2}}>{t.topic}</div>
                          {t.section&&<div style={{fontSize:11,color:THEME.textLight,marginBottom:4}}>{t.section}</div>}
                          {(t.skills||[]).length>0&&(
                            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
                              {(t.skills||[]).map((sk,si)=><span key={si} style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:99}}>{sk}</span>)}
                            </div>
                          )}
                          {t.lastScore!=null&&<div style={{fontSize:11,color:zoneColors[zone].c,fontWeight:600,marginBottom:8}}>Результат: {t.lastScore}%</div>}
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>{const sec=allSections.find(s=>s.name===t.section);const tp=allTopics.find(x=>x.name===t.topic&&x.sectionId===sec?.id);openTheory(t.topic,t.section,tp?.id||null);}} style={{flex:1,padding:"6px 4px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,color:THEME.textLight,fontWeight:600,fontSize:11,cursor:"pointer"}}>📖 Теория</button>
                            <button onClick={()=>startPractice(t.topic,t.section)} style={{flex:1,padding:"6px 4px",borderRadius:8,border:"none",background:THEME.primary,color:THEME.accent,fontWeight:700,fontSize:11,cursor:"pointer"}}>🏋️ Тренировка</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Skill-level zones for this zone */}
                    {skillZones[zone]?.length>0&&(
                      <div style={{marginTop:16}}>
                        <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:8}}>🎯 Навыки в этой зоне:</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {skillZones[zone].map((sk,i)=>(
                            <div key={i} style={{background:"#fff",border:`1px solid ${zoneColors[zone].border}`,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,color:zoneColors[zone].c}}>
                              {sk.skill}
                              {sk.lastScore!=null&&<span style={{fontWeight:400,color:THEME.textLight,marginLeft:4}}>{sk.lastScore}%</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {browseMode&&(
              <>
                <div style={{marginBottom:20}}>
                  <input className="input-field" value={filterSec} onChange={e=>setFilterSec(e.target.value)} placeholder="Поиск раздела или темы..." style={{maxWidth:320}}/>
                </div>
                {(()=>{
                  const filtered = allSections.filter(s=>!filterSec||s.name.toLowerCase().includes(filterSec.toLowerCase())||allTopics.filter(t=>t.sectionId===s.id).some(t=>t.name.toLowerCase().includes(filterSec.toLowerCase())));
                  const gradeGroups = GRADES_LIST.map(g=>({grade:g,secs:filtered.filter(s=>s.specificTarget===g).sort((a,b)=>(a.order||0)-(b.order||0))})).filter(g=>g.secs.length>0);
                  const ungrouped = filtered.filter(s=>!s.specificTarget||!GRADES_LIST.includes(s.specificTarget)).sort((a,b)=>(a.order||0)-(b.order||0));
                  const renderSec=(s)=>{
                    const secTopics = allTopics.filter(t=>t.sectionId===s.id).sort((a,b)=>(a.order||0)-(b.order||0));
                    const isExpanded = expandedSecs[s.id];
                    return(
                      <div key={s.id} style={{background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:12,overflow:"hidden"}}>
                        <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,color:THEME.primary,fontSize:14,marginBottom:2}}>{s.name}</div>
                            {secTopics.length>0&&<div style={{fontSize:11,color:THEME.textLight}}>{secTopics.length} {secTopics.length===1?"тема":"тем"}</div>}
                          </div>
                          {secTopics.length>0
                            ?<button onClick={()=>setExpandedSecs(p=>({...p,[s.id]:!p[s.id]}))} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,color:THEME.textLight,fontWeight:600,fontSize:11,cursor:"pointer",flexShrink:0}}>{isExpanded?"▲ Свернуть":"▼ Темы"}</button>
                            :<div style={{display:"flex",gap:6}}>
                              <button onClick={()=>openTheory(s.name,s.name,null)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,color:THEME.textLight,fontWeight:600,fontSize:11,cursor:"pointer"}}>📖</button>
                              <button onClick={()=>startPractice(s.name,s.name)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:THEME.primary,color:THEME.accent,fontWeight:700,fontSize:11,cursor:"pointer"}}>🏋️</button>
                            </div>
                          }
                        </div>
                        {isExpanded&&secTopics.length>0&&(
                          <div style={{borderTop:`1px solid ${THEME.border}`,background:THEME.bg,padding:"8px 12px",display:"flex",flexDirection:"column",gap:6}}>
                            {secTopics.map(tp=>(
                              <div key={tp.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 10px",background:"#fff",borderRadius:8,border:`1px solid ${THEME.border}`}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:600,color:THEME.primary,fontSize:13}}>{tp.name}</div>
                                  {tp.description&&<div style={{fontSize:11,color:THEME.textLight,marginTop:1}}>{tp.description}</div>}
                                </div>
                                <div style={{display:"flex",gap:6,flexShrink:0}}>
                                  <button onClick={()=>openTheory(tp.name,s.name,tp.id)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,color:THEME.textLight,fontWeight:600,fontSize:11,cursor:"pointer"}}>📖 Теория</button>
                                  <button onClick={()=>startPractice(tp.name,s.name)} style={{padding:"5px 10px",borderRadius:8,border:"none",background:THEME.primary,color:THEME.accent,fontWeight:700,fontSize:11,cursor:"pointer"}}>🏋️</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  };
                  return(
                    <>
                      {gradeGroups.map(({grade,secs})=>(
                        <div key={grade} style={{marginBottom:28}}>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,color:THEME.primary,marginBottom:10,padding:"6px 12px",background:`${THEME.primary}10`,borderRadius:8,display:"inline-block"}}>{grade}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {secs.map(s=>renderSec(s))}
                          </div>
                        </div>
                      ))}
                      {ungrouped.length>0&&(
                        <div style={{marginBottom:28}}>
                          {gradeGroups.length>0&&<div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,color:THEME.textLight,marginBottom:10,padding:"6px 12px",background:THEME.bg,borderRadius:8,display:"inline-block"}}>Прочие разделы</div>}
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {ungrouped.map(s=>renderSec(s))}
                          </div>
                        </div>
                      )}
                      {filtered.length===0&&<div style={{textAlign:"center",padding:"40px",color:THEME.textLight,fontSize:14}}>Ничего не найдено</div>}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
