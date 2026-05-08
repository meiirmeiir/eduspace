import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { THEME } from "../lib/appConstants.js";
import Logo from "../components/ui/Logo.jsx";
import PixelBoss from "../components/PixelBoss.jsx";

export default function IntermediateTestsScreen({ user, onStartBoss, onBack }) {
  const [sections,setSections]=useState([]);
  const [counts,setCounts]=useState({});
  const [medals,setMedals]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const _uid=user?.uid||user?.id; if (!_uid) return;
    (async()=>{
      try{
        const [allSecs,allQs,medalSnap]=await Promise.all([
          getContent("sections"),
          getContent("questions"),
          getDocs(query(collection(db,"medals"),where("userId","==",_uid))),
        ]);
        const intermediate=allSecs.filter(s=>s.sectionType==="topic"||s.sectionType==="chapter");
        const c={};
        allQs.forEach(q=>{ if(q.sectionId) c[q.sectionId]=(c[q.sectionId]||0)+1; });
        const myMedals=medalSnap.docs.map(d=>({id:d.id,...d.data()}));
        setSections(intermediate);
        setCounts(c);
        setMedals(myMedals);
      }catch(e){console.error(e);}
      setLoading(false);
    })();
  },[user?.uid||user?.id]);

  const medalSet=new Set(medals.map(m=>m.sectionId));

  return(
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 40px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo size={32}/>
        <button onClick={onBack} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Назад</button>
      </nav>
      <div style={{maxWidth:960,margin:"0 auto",padding:"48px 24px"}}>
        <div style={{marginBottom:40}}>
          <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:32,fontWeight:800,color:THEME.primary,marginBottom:8}}>⚔️ Промежуточные тесты</h1>
          <p style={{color:THEME.textLight,fontSize:16}}>Сражайся с боссами и зарабатывай медали!</p>
        </div>
        {loading&&<div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загрузка...</div>}
        {!loading&&sections.length===0&&(
          <div style={{textAlign:"center",padding:80}}>
            <div style={{fontSize:48,marginBottom:16}}>⚔️</div>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",color:THEME.primary,marginBottom:8}}>Боссов пока нет</h3>
            <p style={{color:THEME.textLight}}>Преподаватель ещё не добавил промежуточные тесты.</p>
          </div>
        )}
        {!loading&&sections.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
            {sections.map(sec=>{
              const qCount=counts[sec.id]||0;
              const isChapter=sec.sectionType==="chapter";
              const hasMedal=medalSet.has(sec.id);
              const accent=isChapter?"#dc2626":"#16a34a";
              const accentBg=isChapter?"rgba(220,38,38,0.08)":"rgba(22,163,74,0.08)";
              return(
                <div key={sec.id} style={{background:"#fff",borderRadius:16,border:`2px solid ${hasMedal?THEME.accent:accent}`,padding:"24px",position:"relative",overflow:"hidden"}}>
                  {hasMedal&&<div style={{position:"absolute",top:10,right:10,fontSize:22}}>🏅</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div style={{width:56,height:56,background:accentBg,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <PixelBoss type={sec.sectionType} hpPct={100} shake={false}/>
                    </div>
                    <span style={{background:accentBg,color:accent,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:99,border:`1px solid ${accent}33`}}>
                      {isChapter?"💀 Сложный":"⚡ Средний"}
                    </span>
                  </div>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:17,color:THEME.primary,marginBottom:6}}>{sec.name}</h3>
                  {sec.description&&<p style={{color:THEME.textLight,fontSize:13,marginBottom:12,lineHeight:1.5}}>{sec.description}</p>}
                  {isChapter&&<div style={{fontSize:12,color:accent,fontWeight:600,marginBottom:10}}>🏅 За победу — медаль в кабинете!</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${THEME.border}`,paddingTop:12,marginTop:8}}>
                    <span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>{qCount} вопросов</span>
                    {qCount>0
                      ? <button onClick={()=>onStartBoss(sec)} style={{background:accent,color:"#fff",fontSize:13,fontWeight:700,padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer"}}>⚔️ В бой →</button>
                      : <span style={{color:THEME.textLight,fontSize:12}}>Нет вопросов</span>
                    }
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
