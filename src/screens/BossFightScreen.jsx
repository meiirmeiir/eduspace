import React, { useState, useEffect } from "react";
import { addDoc, collection, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { DIFFICULTY_WEIGHTS } from "../lib/appConstants.js";
import { useTheme } from "../ThemeContext.jsx";
import { shuffle, generateQuestion, updateTopicProgress } from "../lib/mathUtils.js";
import Boss3D from "../components/Boss3D.jsx";
import { bossForSection } from "../lib/bossConfig.js";
import ImageModal from "../components/ui/ImageModal.jsx";
import MathText from "../components/ui/MathText.jsx";
import ChartRenderer from "../components/charts/ChartRenderer.jsx";

export default function BossFightScreen({ section, user, onBack }) {
  const { theme: THEME } = useTheme();
  const bossType = section.sectionType;
  const isChapter = bossType === "chapter";
  const bossDef = bossForSection(bossType, user?.details || user?.grade);
  const [phase,setPhase]=useState("loading");
  const [questions,setQuestions]=useState([]);
  const [qIdx,setQIdx]=useState(0);
  const [bossHp,setBossHp]=useState(bossDef.hp);
  const [answers,setAnswers]=useState([]);
  const [shake,setShake]=useState(false);
  const [dmgMsg,setDmgMsg]=useState(null);
  const [result,setResult]=useState(null);
  const [chosen,setChosen]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [lightboxSrc,setLightboxSrc]=useState(null);

  useEffect(()=>{
    (async()=>{
      try{
        const qs=shuffle((await getContent("questions")).filter(q=>q.sectionId===section.id));
        if(!qs.length){alert("В разделе нет вопросов.");onBack();return;}
        setQuestions(qs.slice(0,Math.min(qs.length,10)).map(q=>(q.type==="generated"||q.type==="model")?generateQuestion(q):q));
        setPhase("fight");
      }catch(e){console.error(e);alert("Ошибка загрузки.");onBack();}
    })();
  },[]);

  const maxHp=bossDef.hp;
  const dmgPerQ=questions.length>0?maxHp/questions.length:20;
  const bossHpPct=maxHp?Math.round(bossHp/maxHp*100):0;
  const hpColor=bossHpPct>60?"#22c55e":bossHpPct>30?"#f59e0b":"#ef4444";
  const bossName=bossDef.name;
  const bossAccent=isChapter?"#dc2626":"#16a34a";

  const handleChoose=(idx)=>{
    if(revealed)return;
    setChosen(idx);
  };

  const handleConfirm=async()=>{
    if(chosen===null||revealed)return;
    const q=questions[qIdx];
    const correct=chosen===q.correct;
    setRevealed(true);

    const newAnswers=[...answers,{correct,topic:q.topic,section:q.sectionName||q.section,difficulty:q.difficulty||"A"}];
    setAnswers(newAnswers);

    let newHp=bossHp;
    if(correct){
      newHp=Math.max(0,Math.round(bossHp-dmgPerQ));
      setShake(true);
      setDmgMsg(`-${Math.round(dmgPerQ)} HP!`);
      setTimeout(()=>{setShake(false);setDmgMsg(null);},700);
    }
    setBossHp(newHp);

    setTimeout(async()=>{
      const isLast=qIdx+1>=questions.length;
      if(isLast){
        const correctCount=newAnswers.filter(a=>a.correct).length;
        const bossDefeated=newHp<=0;
        const bossScoringEntries=newAnswers.flatMap(a=>a.type==="compound"&&a.subResults?.length?a.subResults.map(sr=>({correct:sr.correct,difficulty:sr.difficulty||"A"})):[{correct:a.correct,difficulty:a.difficulty||"A"}]);
        const bossTotalWeight=bossScoringEntries.reduce((s,e)=>s+(DIFFICULTY_WEIGHTS[e.difficulty]||1),0);
        const bossEarnedWeight=bossScoringEntries.filter(e=>e.correct).reduce((s,e)=>s+(DIFFICULTY_WEIGHTS[e.difficulty]||1),0);
        const bossScore=bossTotalWeight>0?Math.round(bossEarnedWeight/bossTotalWeight*100):0;
        let medalEarned=false;
        try{
          await addDoc(collection(db,"diagnosticResults"),{
            userId:user?.uid,
            userPhone:user?.phone,
            userName:`${user?.firstName} ${user?.lastName}`,
            sectionName:section.name,
            sectionId:section.id,
            completedAt:new Date().toISOString(),
            totalQuestions:questions.length,
            correctAnswers:correctCount,
            score:bossScore,
            testType:bossType,
            bossDefeated,
          });
          if(isChapter&&bossDefeated){
            await addDoc(collection(db,"medals"),{
              userId:user?.uid,
              userPhone:user?.phone,
              userName:`${user?.firstName} ${user?.lastName}`,
              sectionId:section.id,
              sectionName:section.name,
              earnedAt:new Date().toISOString(),
            });
            medalEarned=true;
          }
          // Обновляем прогресс по темам и навыкам на основе ответов в бою
          if(user?.phone && newAnswers.length>0){
            try{ await updateTopicProgress(user.phone, newAnswers); }
            catch(e){ console.error("boss skillProgress:", e); }
          }
        }catch(e){console.error(e);}
        setResult({correct:correctCount,total:questions.length,bossDefeated,medalEarned});
        setPhase("result");
      }else{
        setQIdx(i=>i+1);
        setChosen(null);
        setRevealed(false);
      }
    },1200);
  };

  if(phase==="loading") return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:THEME.bg}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>⚔️</div><div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:THEME.primary}}>Загружаем врага...</div></div>
    </div>
  );

  if(phase==="result") return(
    <div style={{minHeight:"100vh",background:result.bossDefeated?(isChapter?"linear-gradient(135deg,#1e1b4b,#312e81)":"linear-gradient(135deg,#052e16,#14532d)"):"linear-gradient(135deg,#450a0a,#7f1d1d)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:24,padding:"48px 40px",maxWidth:480,width:"100%",textAlign:"center",color:"#fff"}}>
        <div style={{fontSize:64,marginBottom:16}}>{result.bossDefeated?"🏆":"💀"}</div>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,marginBottom:8}}>
          {result.bossDefeated?"Босс повержен!":"Босс выжил..."}
        </div>
        <div style={{opacity:0.75,fontSize:16,marginBottom:24}}>
          {result.correct} из {result.total} верных ответов
        </div>
        {result.medalEarned&&(
          <div style={{background:"rgba(212,175,55,0.2)",border:"1px solid rgba(212,175,55,0.4)",borderRadius:16,padding:"20px",marginBottom:24}}>
            <div style={{fontSize:40,marginBottom:8}}>🏅</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:700,color:THEME.accent}}>Получена медаль!</div>
            <div style={{fontSize:14,opacity:0.8,marginTop:4}}>«{section.name}» добавлена в личный кабинет</div>
          </div>
        )}
        {!result.bossDefeated&&!result.medalEarned&&(
          <div style={{opacity:0.65,fontSize:14,marginBottom:24}}>
            {isChapter?"Победи босса полностью (все ответы верно), чтобы получить медаль!":"Попробуй ещё раз — ты можешь!"}
          </div>
        )}
        <button onClick={onBack} style={{background:THEME.accent,color:THEME.onAccent ?? '#0f172a',border:"none",borderRadius:10,padding:"14px 32px",fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}>← Назад к тестам</button>
      </div>
    </div>
  );

  const q=questions[qIdx];
  const opts=q.options||[];
  return(
    <div style={{minHeight:"100vh",background:isChapter?"#1a0a0a":"#0a1a0a"}}>
      {/* Boss panel */}
      <div style={{background:isChapter?"linear-gradient(180deg,#2d0a0a,#1a0a0a)":"linear-gradient(180deg,#0a2d0a,#0a1a0a)",borderBottom:`2px solid ${bossAccent}33`,padding:"24px 32px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
          <div style={{position:"relative",flexShrink:0,width:130}}>
            <Boss3D bossId={bossDef.id} hpPct={bossHpPct} shake={shake} height={130}/>
            {dmgMsg&&<div style={{position:"absolute",top:-20,left:"50%",transform:"translateX(-50%)",color:"#ef4444",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,whiteSpace:"nowrap",animation:"boss-dmg 0.7s ease forwards",pointerEvents:"none"}}>{dmgMsg}</div>}
          </div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:"#fff"}}>{bossName}</span>
              <span style={{color:hpColor,fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:15}}>{bossHp} / {maxHp} HP</span>
            </div>
            <div style={{height:16,background:"rgba(255,255,255,0.1)",borderRadius:99,overflow:"hidden",border:`1px solid ${bossAccent}44`}}>
              <div style={{height:"100%",width:`${bossHpPct}%`,background:`linear-gradient(90deg,${hpColor},${hpColor}cc)`,borderRadius:99,transition:"width 0.5s ease",boxShadow:`0 0 8px ${hpColor}88`}}/>
            </div>
            <div style={{marginTop:8,fontSize:13,color:"rgba(255,255,255,0.5)"}}>Вопрос {qIdx+1} из {questions.length} · {isChapter?"Сложный":"Средний"} уровень</div>
          </div>
        </div>
      </div>
      <ImageModal src={lightboxSrc} onClose={()=>setLightboxSrc(null)}/>
      {/* Question */}
      <div style={{maxWidth:800,margin:"0 auto",padding:"36px 24px"}}>
        <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${bossAccent}33`,borderRadius:16,padding:"28px 32px",marginBottom:20}}>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",fontWeight:600,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>{q.sectionName||q.section} · {q.topic}</div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:800,color:"#fff",lineHeight:1.4,marginBottom:q.image||q.conditionChart?12:0}}><MathText text={q.text}/></div>
          {q.image&&<img src={q.image} alt="question" onClick={()=>setLightboxSrc(q.image)} style={{maxWidth:"100%",maxHeight:400,objectFit:"contain",borderRadius:10,marginTop:8,border:"1px solid rgba(255,255,255,0.15)",cursor:"zoom-in",display:"block"}}/>}
          {q.conditionChart&&<div style={{marginTop:10,display:"flex",justifyContent:"center",background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 8px",overflowX:"auto"}}><ChartRenderer chart={q.conditionChart} vars={q._vars||{}}/></div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:24}}>
          {opts.map((opt,i)=>{
            let bg="rgba(255,255,255,0.04)",border=`1px solid rgba(255,255,255,0.12)`,color="#fff";
            if(revealed){
              if(i===q.correct){bg="rgba(34,197,94,0.15)";border="1px solid #22c55e";color="#86efac";}
              else if(i===chosen&&i!==q.correct){bg="rgba(239,68,68,0.15)";border="1px solid #ef4444";color="#fca5a5";}
              else{color="rgba(255,255,255,0.3)";}
            }else if(i===chosen){bg=`rgba(${isChapter?"220,38,38":"22,163,74"},0.2)`;border=`1px solid ${bossAccent}`;}
            const optImg=(q.optionImages||[])[i];
            const optChart=(q.optionCharts||[])[i];
            return(
              <div key={i} onClick={()=>handleChoose(i)} style={{display:"flex",alignItems:optImg||optChart?"flex-start":"center",gap:16,padding:"16px 20px",background:bg,border,borderRadius:12,cursor:revealed?"default":"pointer",transition:"all 0.2s"}}>
                <div style={{width:32,height:32,borderRadius:8,background:`rgba(255,255,255,0.08)`,border:`1px solid rgba(255,255,255,0.15)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,color:"rgba(255,255,255,0.6)",flexShrink:0}}>
                  {String.fromCharCode(65+i)}
                </div>
                <div style={{flex:1}}>
                  {optImg&&<img src={optImg} alt={`opt${i}`} onClick={e=>{e.stopPropagation();setLightboxSrc(optImg);}} style={{maxWidth:"100%",maxHeight:200,objectFit:"contain",borderRadius:6,marginBottom:opt?6:0,display:"block",cursor:"zoom-in"}}/>}
                  {optChart&&<div style={{overflowX:"auto",marginBottom:opt?6:0}}><ChartRenderer chart={optChart} vars={q._vars||{}}/></div>}
                  {opt&&<span style={{fontSize:15,fontWeight:600,color}}><MathText text={opt}/></span>}
                </div>
                {revealed&&i===q.correct&&<span style={{marginLeft:"auto",fontSize:18,flexShrink:0}}>✅</span>}
                {revealed&&i===chosen&&i!==q.correct&&<span style={{marginLeft:"auto",fontSize:18,flexShrink:0}}>❌</span>}
              </div>
            );
          })}
        </div>
        {!revealed&&(
          <button onClick={handleConfirm} disabled={chosen===null} style={{width:"100%",padding:"16px",background:chosen===null?"rgba(255,255,255,0.08)":bossAccent,color:chosen===null?"rgba(255,255,255,0.3)":"#fff",border:"none",borderRadius:12,fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:16,cursor:chosen===null?"default":"pointer",transition:"all 0.2s"}}>
            ⚔️ Атаковать!
          </button>
        )}
        {revealed&&<div style={{textAlign:"center",color:"rgba(255,255,255,0.45)",fontSize:14,padding:"12px 0"}}>Следующий вопрос...</div>}
      </div>
      <style>{`
        @keyframes boss-dmg{0%{opacity:1;transform:translateX(-50%) translateY(0);}100%{opacity:0;transform:translateX(-50%) translateY(-30px);}}
      `}</style>
    </div>
  );
}
