import React, { useState } from "react";
import { THEME, tgPhoto } from "../lib/appConstants.js";
import { compressImage } from "../lib/mathUtils.js";
import { updateDoc, doc, db } from "../firestore-rest.js";
import Logo from "../components/ui/Logo.jsx";

// ── ЗАГРУЗКА ФОТО ─────────────────────────────────────────────────────────────
function UploadAnalysisScreen({ user, onDone, onSkip, resultId }) {
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
      // Save compressed photos to Firestore so they appear in the expert report
      if (resultId) {
        try {
          const studentPhotos = await Promise.all(files.map(f => compressImage(f, 800, 0.65)));
          // Guard: Firestore document limit ~1MB — skip save if total base64 too large
          const totalSize = studentPhotos.reduce((s,p)=>s+p.length, 0);
          if (totalSize < 900000) {
            await updateDoc(doc(db, "diagnosticResults", resultId), { studentPhotos });
          }
          // Photos are always sent to Telegram regardless of Firestore size
        } catch(e) { console.error("Не удалось сохранить фото:", e); }
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

export default UploadAnalysisScreen;
