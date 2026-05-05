import React from "react";
import { THEME } from "../lib/appConstants.js";

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

export default ReportScreen;
