import React, { useState } from "react";
import { THEME, RPG_NODES, RPG_PATHS } from "../lib/appConstants.js";
import Logo from "../components/ui/Logo.jsx";
import RadarChart from "../components/ui/RadarChart.jsx";

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

// ── RADAR CHART ───────────────────────────────────────────────────────────────

// ── ПРОСМОТР ЭКСПЕРТНОГО ОТЧЁТА (ДЛЯ УЧЕНИКА) ────────────────────────────────
function ExpertReportView({ report, onBack, studentPhotos }) {
  const zoneColor={correct:THEME.success,partial:THEME.warning,incorrect:THEME.error};
  const zoneLabel={correct:"Верно",partial:"Частично",incorrect:"Неверно"};
  const [lightbox,setLightbox]=useState(null);
  const photos=studentPhotos||report.studentPhotos||[];
  return(
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <nav style={{background:THEME.primary,padding:"0 40px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo size={32} light/>
        <button onClick={onBack} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif"}}>← Назад</button>
      </nav>
      <div style={{maxWidth:900,margin:"0 auto",padding:"40px 24px"}}>
        <div style={{marginBottom:32}}>
          <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:26,fontWeight:800,color:THEME.primary,marginBottom:6}}>Экспертный отчёт</h1>
          <p style={{color:THEME.textLight,fontSize:14}}>{report.sectionName} · {report.createdAt?new Date(report.createdAt).toLocaleDateString("ru-RU"):""}</p>
        </div>

        {/* 1. Общие параметры */}
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:24,borderTop:`4px solid ${THEME.accent}`}}>
          <h2 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:20}}>1. Общие параметры</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {[
              {label:"Общий балл",value:`${report.generalParams?.score??"-"}%`,icon:"🎯"},
              {label:"Точность решений",value:`${report.generalParams?.accuracy??"-"}%`,icon:"✅"},
              {label:"Средний темп",value:report.generalParams?.avgPace?`${report.generalParams.avgPace} сек/задача`:"—",icon:"⏱"},
            ].map((s,i)=>(
              <div key={i} style={{background:THEME.bg,borderRadius:12,padding:"20px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
                <div style={{fontSize:28,marginBottom:8}}>{s.icon}</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:22,color:THEME.primary,marginBottom:4}}>{s.value}</div>
                <div style={{fontSize:12,color:THEME.textLight,fontWeight:600}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Карта компетенций */}
        {report.competencyMap?.length>0&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:24}}>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:20}}>2. Карта компетенций</h2>
            <RadarChart data={report.competencyMap.map(t=>({label:t.topic,value:t.percent}))} size={300}/>
          </div>
        )}

        {/* 3. Таблица задач */}
        {report.taskTable?.length>0&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:24,overflowX:"auto"}}>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:20}}>3. Полный отчёт по задачам</h2>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:THEME.bg,borderBottom:`2px solid ${THEME.border}`}}>
                {["#","Раздел","Статус","Анализ черновика","Вердикт эксперта"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:700,color:THEME.textLight,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {report.taskTable.map((row,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${THEME.border}`,background:i%2===0?"#fff":THEME.bg+"80"}}>
                    <td style={{padding:"10px 14px",fontWeight:700,color:THEME.primary}}>{row.num||i+1}</td>
                    <td style={{padding:"10px 14px",color:THEME.textLight}}>{row.section}</td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{background:(zoneColor[row.status]||THEME.border)+"20",color:zoneColor[row.status]||THEME.textLight,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:99}}>
                        {zoneLabel[row.status]||row.status||"—"}
                      </span>
                    </td>
                    <td style={{padding:"10px 14px",maxWidth:220,lineHeight:1.5}}>{row.draftAnalysis||"—"}</td>
                    <td style={{padding:"10px 14px",maxWidth:220,lineHeight:1.5,fontWeight:600,color:THEME.primary}}>{row.expertVerdict||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3б. Зоны вязкости */}
        {report.viscosityZones&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:16,borderTop:"4px solid #f59e0b"}}>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary,marginBottom:14,display:"flex",alignItems:"center",gap:10}}><span>🕰️</span>Зоны вязкости</h3>
            <p style={{color:THEME.textLight,fontSize:12,marginBottom:10}}>Темы и задачи, где ученик тратил значительно больше времени</p>
            <p style={{color:THEME.text,fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{report.viscosityZones}</p>
          </div>
        )}

        {/* 3в. Когнитивная выносливость */}
        {report.cognitiveEndurance&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:16,borderTop:"4px solid #8b5cf6"}}>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary,marginBottom:14,display:"flex",alignItems:"center",gap:10}}><span>🧠</span>Когнитивная выносливость</h3>
            <p style={{color:THEME.textLight,fontSize:12,marginBottom:10}}>Паттерн снижения эффективности в ходе диагностики</p>
            <p style={{color:THEME.text,fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{report.cognitiveEndurance}</p>
          </div>
        )}

        {/* 4. Рекомендации */}
        {report.recommendations&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:16}}>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary,marginBottom:14,display:"flex",alignItems:"center",gap:10}}><span>💡</span>Рекомендации</h3>
            <p style={{color:THEME.text,fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{report.recommendations}</p>
          </div>
        )}

        {/* 4b. Zoned plan preview */}
        {report.zonedPlan&&(report.zonedPlan.red?.length||report.zonedPlan.yellow?.length||report.zonedPlan.green?.length)?(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:16}}>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary,marginBottom:20,display:"flex",alignItems:"center",gap:10}}><span>🗺️</span>Глобальный план подготовки</h3>
            {[{zone:"red",label:"🔴 Красная зона",color:THEME.error},{zone:"yellow",label:"🟡 Жёлтая зона",color:"#b45309"},{zone:"green",label:"🟢 Зелёная зона",color:"#065f46"}].map(({zone,label,color})=>(
              report.zonedPlan[zone]?.length?(
                <div key={zone} style={{marginBottom:16}}>
                  <div style={{fontWeight:700,color,fontSize:13,marginBottom:8}}>{label}</div>
                  {report.zonedPlan[zone].map((t,i)=>(
                    <div key={i} style={{padding:"10px 14px",background:THEME.bg,borderRadius:8,marginBottom:6,borderLeft:`3px solid ${color}`}}>
                      <div style={{fontWeight:700,fontSize:14,color:THEME.primary}}>{t.topic}</div>
                      {t.description&&<div style={{fontSize:12,color:THEME.textLight,marginTop:3}}>{t.description}</div>}
                    </div>
                  ))}
                </div>
              ):null
            ))}
          </div>
        ):null}

        {[{key:"expertAssessment",title:"Итоговая экспертная оценка",icon:"🏆"},{key:"parentSummary",title:"Резюме для родителя",icon:"👨‍👩‍👧"}].filter(s=>report[s.key]).map(s=>(
          <div key={s.key} style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:16}}>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>{s.icon}</span>{s.title}
            </h3>
            <p style={{color:THEME.text,fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{report[s.key]}</p>
          </div>
        ))}

        {/* Записи ученика */}
        {photos.length>0&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:"28px",marginBottom:16}}>
            <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>📝</span>Записи ученика
            </h3>
            <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
              {photos.map((url,i)=>(
                <img key={i} src={url} alt={`запись ${i+1}`} onClick={()=>setLightbox(url)}
                  style={{height:140,borderRadius:10,objectFit:"cover",border:`1px solid ${THEME.border}`,cursor:"zoom-in",transition:"transform 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.03)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {lightbox&&<div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:24}}>
        <img src={lightbox} alt="full" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:12,objectFit:"contain",boxShadow:"0 8px 48px rgba(0,0,0,0.6)"}}/>
        <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:20,right:24,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:28,width:44,height:44,borderRadius:"50%",cursor:"pointer",lineHeight:1}}>×</button>
      </div>}
    </div>
  );
}

export { PathMap };
export default ExpertReportView;
