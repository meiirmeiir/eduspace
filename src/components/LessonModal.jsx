import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, db } from "../firestore-rest.js";
import { useTheme } from "../ThemeContext.jsx";
import WhiteboardCanvas from "./WhiteboardCanvas.jsx";

export default function LessonModal({ lesson, date, user, isAdmin, onClose }) {
  const { theme: THEME } = useTheme();
  const [initData, setInitData] = useState(null); // null = loading
  const [summary, setSummary] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const wbId = `wb_${lesson.id}_${fmtDate(date)}`;
  const dateLabel = date.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  useEffect(()=>{
    (async()=>{
      try {
        const snap = await getDoc(doc(db,"whiteboards",wbId));
        if (snap.exists()) {
          const d = snap.data();
          setSummary(d.summary||"");
          setVideoUrl(d.videoUrl||"");
          setEditSummary(d.summary||"");
          setEditVideoUrl(d.videoUrl||"");
          if (d.summary || d.videoUrl) setInfoExpanded(true);
          // Load strokes: chunked (new) or inline (legacy)
          let strokes = [];
          if (d.strokeChunks > 0) {
            const chunkSnaps = await Promise.all(
              Array.from({length: d.strokeChunks}, (_, i) =>
                getDoc(doc(db,"wbStrokes",`${wbId}_${i}`))
              )
            );
            for (const cs of chunkSnaps) {
              if (cs.exists()) strokes.push(...(cs.data().strokes || []));
            }
          } else {
            strokes = d.strokes || []; // legacy: strokes stored inline
          }
          // Support both legacy (images with src inline) and new (imageRefs without src)
          const imageRefs = d.imageRefs || d.images || [];
          let images;
          if (imageRefs.length > 0 && !imageRefs[0].src) {
            // New format: fetch each image src from its own Firestore document
            images = await Promise.all(imageRefs.map(async ref => {
              try {
                const imgSnap = await getDoc(doc(db,"wbImages",`${wbId}_${ref.id}`));
                return { ...ref, src: imgSnap.exists() ? imgSnap.data().src : "" };
              } catch { return { ...ref, src: "" }; }
            }));
          } else {
            images = imageRefs; // legacy format already has src
          }
          setInitData({ strokes, images });
        } else {
          setInitData({ strokes:[], images:[] });
        }
      } catch(e) { console.error(e); setInitData({ strokes:[], images:[] }); }
    })();
  },[wbId]);

  const handleSave = async ({ strokes, images }) => {
    // Save each image to its own Firestore document — no combined size limit
    const imageRefs = [];
    await Promise.all((images||[]).map(async img => {
      const imgDocId = `${wbId}_${img.id}`;
      await setDoc(doc(db,"wbImages",imgDocId),{ src: img.src, wbId, updatedAt: new Date().toISOString() });
      imageRefs.push({ id: img.id, x: img.x, y: img.y, w: img.w, h: img.h, angle: img.angle||0 });
    }));

    // Split strokes into ~800 KB chunks to stay under Firestore's 1 MB doc limit
    const CHUNK_BYTES = 800_000;
    const chunks = [];
    let cur = [], curSize = 0;
    for (const stroke of (strokes||[])) {
      const sz = JSON.stringify(stroke).length;
      if (curSize + sz > CHUNK_BYTES && cur.length > 0) { chunks.push(cur); cur=[]; curSize=0; }
      cur.push(stroke); curSize += sz;
    }
    if (cur.length > 0) chunks.push(cur);

    // How many chunks existed before (to delete stale ones)
    const mainSnap = await getDoc(doc(db,"whiteboards",wbId));
    const oldChunkCount = mainSnap.exists() ? (mainSnap.data().strokeChunks || 0) : 0;

    // Write new stroke chunks in parallel
    await Promise.all(chunks.map((chunk, i) =>
      setDoc(doc(db,"wbStrokes",`${wbId}_${i}`), { strokes: chunk, wbId, chunkIndex: i, updatedAt: new Date().toISOString() })
    ));

    // Remove leftover chunks from a previous larger save
    for (let i = chunks.length; i < oldChunkCount; i++) {
      await deleteDoc(doc(db,"wbStrokes",`${wbId}_${i}`));
    }

    // Main document stores only metadata + references — never the raw strokes
    await setDoc(doc(db,"whiteboards",wbId),{
      strokeChunks: chunks.length,
      imageRefs,
      summary,
      videoUrl,
      updatedAt: new Date().toISOString(),
      lessonId: lesson.id,
      date: fmtDate(date),
      subject: lesson.subject,
    });
  };

  const saveInfo = async () => {
    setInfoSaving(true);
    try {
      const snap = await getDoc(doc(db,"whiteboards",wbId));
      const existing = snap.exists() ? snap.data() : {};
      await setDoc(doc(db,"whiteboards",wbId),{
        ...existing,
        summary: editSummary,
        videoUrl: editVideoUrl,
        updatedAt: new Date().toISOString(),
        lessonId: lesson.id,
        date: fmtDate(date),
        subject: lesson.subject,
      });
      setSummary(editSummary);
      setVideoUrl(editVideoUrl);
    } catch(e) { alert("Ошибка: "+e.message); }
    setInfoSaving(false);
  };

  const getEmbedUrl = (url) => {
    if (!url) return "";
    // Convert Google Drive share link to embed link
    const m = url.match(/\/file\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    const m2 = url.match(/[?&]id=([^&]+)/);
    if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`;
    return url;
  };

  const hasContent = summary || videoUrl;

  // Prevent background scroll when modal open
  useEffect(()=>{ document.body.style.overflow="hidden"; return()=>{ document.body.style.overflow=""; }; },[]);

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",background:"#fff"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px 24px",background:THEME.primary,flexShrink:0,boxShadow:"0 2px 12px rgba(0,0,0,0.25)"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:19,fontWeight:800,color:"#fff"}}>{lesson.subject||'Доска занятия'}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginTop:2}}>{dateLabel} · {lesson.zoomMeetingId?new Date(lesson.date).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):lesson.time} · {lesson.zoomMeetingId?lesson.durationMinutes:lesson.duration} мин</div>
        </div>
        {isAdmin && <div style={{fontSize:12,color:THEME.accent,fontWeight:700,background:"rgba(212,175,55,0.15)",padding:"4px 12px",borderRadius:99}}>✏️ Редактирование</div>}
        {(hasContent || isAdmin) && !lesson.zoomMeetingId && (
          <button onClick={()=>setInfoExpanded(v=>!v)}
            style={{background:infoExpanded?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            {infoExpanded ? "✕ Скрыть панель" : "📋 Конспект и видео"}
          </button>
        )}
        <button onClick={onClose}
          style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
          ← Закрыть
        </button>
      </div>
      {/* Body — whiteboard + optional right panel */}
      <div style={{flex:1,display:"flex",flexDirection:"row",overflow:"hidden",minHeight:0}}>
        {/* Whiteboard */}
        <div style={{flex:1,overflow:"hidden",display:"flex",minHeight:0,minWidth:0}}>
          {initData === null
            ? <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{textAlign:"center",color:THEME.textLight}}>
                  <div style={{fontSize:32,marginBottom:8}}>⏳</div>
                  <div style={{fontWeight:600}}>Загрузка доски...</div>
                </div>
              </div>
            : <WhiteboardCanvas initData={initData} onSave={handleSave} readOnly={!isAdmin}/>
          }
        </div>
        {/* Right panel — summary & video */}
        {infoExpanded && (
          <div style={{width:"46%",minWidth:360,maxWidth:640,flexShrink:0,overflowY:"auto",borderLeft:`2px solid ${THEME.border}`,background:"#f8fafc",display:"flex",flexDirection:"column"}}>
            {/* Panel header */}
            <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${THEME.border}`,background:"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontWeight:800,fontSize:16,color:THEME.primary}}>📋 Конспект и видео</div>
              <button onClick={()=>setInfoExpanded(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:THEME.textLight,lineHeight:1}}>✕</button>
            </div>
            <div style={{padding:"20px",flex:1}}>
              {isAdmin ? (
                <>
                  <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:8}}>Краткая выжимка занятия</div>
                  <textarea
                    value={editSummary}
                    onChange={e=>setEditSummary(e.target.value)}
                    placeholder="Напишите краткое содержание занятия, ключевые темы и выводы..."
                    rows={5}
                    style={{width:"100%",boxSizing:"border-box",padding:"10px 14px",borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:14,fontFamily:"inherit",resize:"vertical",outline:"none",color:THEME.text,lineHeight:1.6}}
                  />
                  <div style={{fontWeight:700,fontSize:14,color:THEME.primary,margin:"16px 0 8px"}}>Ссылка на видеозапись (Google Drive)</div>
                  <input
                    type="url"
                    value={editVideoUrl}
                    onChange={e=>setEditVideoUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/.../view"
                    style={{width:"100%",boxSizing:"border-box",padding:"10px 14px",borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:THEME.text}}
                  />
                  <div style={{fontSize:12,color:THEME.textLight,marginTop:4}}>Вставьте ссылку «Поделиться» из Google Drive. Убедитесь, что доступ открыт по ссылке.</div>
                  <button
                    onClick={saveInfo}
                    disabled={infoSaving}
                    style={{marginTop:14,padding:"10px 24px",borderRadius:8,background:THEME.primary,color:"#fff",fontWeight:700,fontSize:14,border:"none",cursor:infoSaving?"not-allowed":"pointer",opacity:infoSaving?0.7:1}}>
                    {infoSaving ? "Сохранение..." : "Сохранить"}
                  </button>
                  {editVideoUrl && (
                    <div style={{marginTop:20}}>
                      <div style={{fontWeight:600,fontSize:13,color:THEME.textLight,marginBottom:8}}>Предпросмотр видео:</div>
                      <div style={{position:"relative",width:"100%",paddingBottom:"56.25%",borderRadius:10,overflow:"hidden",background:"#000"}}>
                        <iframe src={getEmbedUrl(editVideoUrl)} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} allow="autoplay" allowFullScreen title="Видеозапись занятия"/>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!summary && !videoUrl && (
                    <div style={{textAlign:"center",color:THEME.textLight,padding:"40px 0",fontSize:14}}>Конспект и видеозапись ещё не добавлены</div>
                  )}
                  {videoUrl && (
                    <div style={{marginBottom:summary?24:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:10}}>Видеозапись занятия</div>
                      <div style={{position:"relative",width:"100%",paddingBottom:"56.25%",borderRadius:10,overflow:"hidden",background:"#000"}}>
                        <iframe src={getEmbedUrl(videoUrl)} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} allow="autoplay" allowFullScreen title="Видеозапись занятия"/>
                      </div>
                    </div>
                  )}
                  {summary && (
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:10}}>Краткая выжимка занятия</div>
                      <div style={{background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:10,padding:"16px 18px",fontSize:14,lineHeight:1.8,color:THEME.text,whiteSpace:"pre-wrap"}}>{summary}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
