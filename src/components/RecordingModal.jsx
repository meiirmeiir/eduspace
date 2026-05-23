import React, { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, db } from "../firestore-rest.js";
import { useTheme } from "../ThemeContext.jsx";

export default function RecordingModal({ lesson, user, isAdmin, onClose }) {
  const { theme: THEME } = useTheme();
  const [liveSummary,setLiveSummary]=useState(lesson.summary||'');
  const [liveVideoUrl,setLiveVideoUrl]=useState(lesson.driveVideoUrl||'');
  const [editSummary,setEditSummary]=useState(lesson.summary||'');
  const [saving,setSaving]=useState(false);
  const videoUrl=liveVideoUrl||lesson.driveVideoUrl||'';

  // Real-time listener: auto-update when webhook fires
  useEffect(()=>{
    if(!lesson.id)return;
    const unsub=onSnapshot(doc(db,'lessons',lesson.id),snap=>{
      if(!snap.exists())return;
      const data=snap.data();
      if(data.summary!==undefined){setLiveSummary(data.summary);setEditSummary(data.summary);}
      if(data.driveVideoUrl!==undefined)setLiveVideoUrl(data.driveVideoUrl);
    });
    return unsub;
  },[lesson.id]);

  const getEmbedUrl=url=>{
    if(!url)return '';
    const m=url.match(/\/file\/d\/([^/]+)/);
    if(m)return `https://drive.google.com/file/d/${m[1]}/preview`;
    const m2=url.match(/[?&]id=([^&]+)/);
    if(m2)return `https://drive.google.com/file/d/${m2[1]}/preview`;
    return url;
  };

  const saveSummary=async()=>{
    setSaving(true);
    try{await updateDoc(doc(db,'lessons',lesson.id),{summary:editSummary,updatedAt:new Date().toISOString()});}
    catch(e){alert('Ошибка: '+e.message);}
    setSaving(false);
  };

  const fmtDateTime=iso=>{
    const d=new Date(iso);
    return d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  };

  useEffect(()=>{document.body.style.overflow='hidden';return()=>{document.body.style.overflow='';};},[]);

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:THEME.surface,borderRadius:20,width:'90vw',maxWidth:760,maxHeight:'90vh',overflowY:'auto',padding:'28px 32px',position:'relative',boxShadow:'0 24px 80px rgba(0,0,0,0.5)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,gap:12}}>
          <div>
            <h2 style={{margin:0,fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:800,color:THEME.text}}>📋 Запись и конспект</h2>
            <p style={{margin:'6px 0 0',color:THEME.textLight,fontSize:13}}>{lesson.subject||'Занятие'} · {fmtDateTime(lesson.date)}</p>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:10,padding:'6px 14px',cursor:'pointer',fontSize:14,fontWeight:700,flexShrink:0,whiteSpace:'nowrap'}}>✕ Закрыть</button>
        </div>

        {/* Summary */}
        <div style={{marginBottom:28}}>
          <h3 style={{fontSize:15,fontWeight:700,color:THEME.primary,margin:'0 0 12px'}}>Конспект занятия</h3>
          {isAdmin?(
            <>
              <textarea
                value={editSummary}
                onChange={e=>{setEditSummary(e.target.value);e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}}
                onFocus={e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}}
                placeholder="Конспект занятия (заполняется автоматически после завершения урока через Zoom или вручную)..."
                style={{width:'100%',boxSizing:'border-box',padding:'12px 16px',borderRadius:10,border:`1px solid ${THEME.border}`,fontSize:14,fontFamily:'inherit',resize:'none',outline:'none',color:THEME.text,lineHeight:1.7,minHeight:100,background:THEME.bg,overflow:'hidden',display:'block'}}
              />
              <button onClick={saveSummary} disabled={saving}
                style={{marginTop:10,padding:'8px 20px',borderRadius:8,background:THEME.primary,color:'#fff',fontWeight:700,fontSize:13,border:'none',cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>
                {saving?'Сохранение...':'💾 Сохранить конспект'}
              </button>
            </>
          ):(
            liveSummary?(
              <div style={{background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:12,padding:'16px 20px',fontSize:14,lineHeight:1.8,color:THEME.text,whiteSpace:'pre-wrap'}}>{liveSummary}</div>
            ):(
              <div style={{background:THEME.bg,borderRadius:12,padding:'32px 20px',textAlign:'center',color:THEME.textLight,fontSize:14}}>
                <div style={{fontSize:32,marginBottom:8}}>📝</div>
                Конспект появится здесь автоматически после завершения занятия
              </div>
            )
          )}
        </div>

        {/* Video */}
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:THEME.primary,margin:'0 0 12px'}}>Запись занятия</h3>
          {videoUrl?(
            <>
              <div style={{position:'relative',width:'100%',paddingBottom:'56.25%',borderRadius:12,overflow:'hidden',background:'#000',marginBottom:10}}>
                <iframe src={getEmbedUrl(videoUrl)} style={{position:'absolute',inset:0,width:'100%',height:'100%',border:'none'}} allow="autoplay; fullscreen" allowFullScreen title="Запись занятия"/>
              </div>
              <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:THEME.accent,textDecoration:'none',fontWeight:600}}>
                ↗ Открыть запись в браузере
              </a>
            </>
          ):(
            <div style={{background:THEME.bg,borderRadius:12,padding:'32px 20px',textAlign:'center',color:THEME.textLight,fontSize:14}}>
              <div style={{fontSize:32,marginBottom:8}}>📹</div>
              Запись появится здесь после окончания занятия
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
