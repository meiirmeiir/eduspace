import React, { useState, useEffect, useRef } from "react";
import { collection, doc, getDocs, query, updateDoc, where, db } from "../firestore-rest.js";
import { THEME, REG_GOALS, getSpecificList } from "../lib/appConstants.js";
import { isNpcEnabled, setNpcEnabled } from "../NpcContext.jsx";
import ChangePasswordInline from "./ChangePasswordInline.jsx";
import ExpertReportView from "../screens/ExpertReportView.jsx";
import ErrorCard from "./ui/ErrorCard.jsx";

export default function ProfileSection({ user, statusObj, onOpenDiagnostics, onViewPlan, onUpdateUser }) {
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState(false);
  const [expertMap,setExpertMap]=useState({});
  const [viewingExpert,setViewingExpert]=useState(null);
  const [viewingPhotos,setViewingPhotos]=useState([]);
  const [medals,setMedals]=useState([]);
  const [isEditing,setIsEditing]=useState(false);
  const [editForm,setEditForm]=useState({
    firstName:user?.firstName||"",
    lastName:user?.lastName||"",
    goalKey:user?.goalKey||"",
    details:user?.details||"",
    avatarUrl:user?.avatarUrl||"",
  });
  const [editSaving,setEditSaving]=useState(false);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const [npcOn,setNpcOn]=useState(()=>isNpcEnabled());
  const avatarInputRef=useRef(null);

  const handleAvatarChange=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(file.size>2*1024*1024){alert("Файл слишком большой. Максимум 2 МБ.");return;}
    setAvatarUploading(true);
    try{
      const reader=new FileReader();
      reader.onload=ev=>{
        const dataUrl=ev.target.result;
        setEditForm(p=>({...p,avatarUrl:dataUrl}));
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    }catch{setAvatarUploading(false);}
  };

  const saveProfile=async()=>{
    if(!editForm.firstName.trim()){alert("Введите имя.");return;}
    if(!editForm.goalKey){alert("Выберите цель.");return;}
    if(!editForm.details){alert("Выберите класс или экзамен.");return;}
    setEditSaving(true);
    try{
      const updates={
        firstName:editForm.firstName.trim(),
        lastName:editForm.lastName.trim(),
        goalKey:editForm.goalKey,
        goal:REG_GOALS[editForm.goalKey],
        details:editForm.details,
        ...(editForm.avatarUrl?{avatarUrl:editForm.avatarUrl}:{}),
      };
      await updateDoc(doc(db,"users",user.uid),updates);
      onUpdateUser?.({...user,...updates});
      setIsEditing(false);
    }catch(e){alert("Ошибка: "+e.message);}
    setEditSaving(false);
  };

  const load=async()=>{
    const _uid=user?.uid||user?.id; if (!_uid) return;
    setLoading(true); setFetchError(false);
    try{
      const [resSnap,repSnap,medalSnap]=await Promise.all([
        getDocs(query(collection(db,"diagnosticResults"),where("userId","==",_uid))),
        getDocs(query(collection(db,"expertReports"),where("userId","==",_uid))),
        getDocs(query(collection(db,"medals"),where("userId","==",_uid))),
      ]);
      const mine=resSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.completedAt?.localeCompare(a.completedAt));
      setResults(mine);
      const map={};
      repSnap.docs.forEach(d=>{const r={id:d.id,...d.data()};if(r.resultId)map[r.resultId]=r;});
      setExpertMap(map);
      setMedals(medalSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.earnedAt?.localeCompare(a.earnedAt)));
    }catch(e){console.error(e);setFetchError(true);}
    setLoading(false);
  };
  useEffect(()=>{ load(); },[user?.uid||user?.id]);

  if(viewingExpert) return <ExpertReportView report={viewingExpert} studentPhotos={viewingPhotos} onBack={()=>{setViewingExpert(null);setViewingPhotos([]);}}/>;

  const totalDiag=results.length;
  const totalSec=results.reduce((s,r)=>s+(r.totalTime||0),0);
  const totalMin=Math.floor(totalSec/60);
  const totalHr=Math.floor(totalMin/60);
  const timeLabel=totalHr>0?`${totalHr} ч ${totalMin%60} мин`:`${totalMin} мин ${totalSec%60} сек`;
  const fmtTime=sec=>{const m=Math.floor(sec/60),s=sec%60;return m>0?`${m} мин ${s} с`:`${s} с`;};

  return(
    <div className="profile-page">
      <div className="dashboard-header"><h1>Личный кабинет</h1></div>
      {/* Profile card */}
      <div className="dashboard-section">
        <div className="profile-card">
          {/* Avatar */}
          <div style={{position:"relative",flexShrink:0}}>
            {(isEditing?editForm.avatarUrl:user?.avatarUrl)
              ? <img src={isEditing?editForm.avatarUrl:user.avatarUrl} alt="avatar" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",border:`3px solid ${THEME.accent}`}}/>
              : <div className="profile-avatar">{(isEditing?editForm.firstName:user?.firstName)?.[0]}{(isEditing?editForm.lastName:user?.lastName)?.[0]}</div>
            }
            {isEditing&&(
              <>
                <button onClick={()=>avatarInputRef.current?.click()} disabled={avatarUploading}
                  style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderRadius:"50%",background:THEME.primary,color:"#fff",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer",padding:0}}>
                  {avatarUploading?"⏳":"📷"}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarChange}/>
              </>
            )}
          </div>
          <div className="profile-info">
            {isEditing?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Имя</div>
                    <input className="input-field" style={{marginBottom:0,padding:"8px 12px"}} value={editForm.firstName} onChange={e=>setEditForm(p=>({...p,firstName:e.target.value}))} placeholder="Имя"/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Фамилия</div>
                    <input className="input-field" style={{marginBottom:0,padding:"8px 12px"}} value={editForm.lastName} onChange={e=>setEditForm(p=>({...p,lastName:e.target.value}))} placeholder="Фамилия"/>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Цель</div>
                  <select className="input-field" style={{marginBottom:0,padding:"8px 12px"}} value={editForm.goalKey}
                    onChange={e=>setEditForm(p=>({...p,goalKey:e.target.value,details:""}))}>
                    <option value="">— Выберите цель —</option>
                    {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {editForm.goalKey&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>
                      {editForm.goalKey==="exam"?"Экзамен":"Класс"}
                    </div>
                    <select className="input-field" style={{marginBottom:0,padding:"8px 12px"}} value={editForm.details}
                      onChange={e=>setEditForm(p=>({...p,details:e.target.value}))}>
                      <option value="">— Выберите —</option>
                      {getSpecificList(editForm.goalKey).map(x=><option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                )}
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button onClick={saveProfile} disabled={editSaving} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,fontSize:13,cursor:editSaving?"not-allowed":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Сохраняю...":"Сохранить"}</button>
                  <button onClick={()=>{setIsEditing(false);setEditForm({firstName:user?.firstName||"",lastName:user?.lastName||"",goalKey:user?.goalKey||"",details:user?.details||"",avatarUrl:user?.avatarUrl||""});}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"}}>Отмена</button>
                </div>
              </div>
            ):(
              <>
                <div className="profile-name">{user?.firstName} {user?.lastName}</div>
                <div className="profile-phone">{user?.phone}</div>
                <span style={{display:"inline-block",background:statusObj.color+"18",color:statusObj.color,fontWeight:700,fontSize:12,padding:"4px 14px",borderRadius:99,border:`1px solid ${statusObj.color}30`,marginBottom:10}}>{statusObj.label}</span>
                <div className="profile-goal-tag">{user?.goal}</div>
                <div className="profile-detail">{user?.details}</div>
                <div className="profile-date">Зарегистрирован: {user?.registeredAt?new Date(user.registeredAt).toLocaleDateString("ru-RU"):"—"}</div>
                <button onClick={()=>setIsEditing(true)} style={{marginTop:10,background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:"6px 16px",fontWeight:600,fontSize:12,cursor:"pointer"}}>✏️ Редактировать профиль</button>
                <ChangePasswordInline />
                <label style={{display:"flex",alignItems:"center",gap:10,marginTop:12,fontSize:13,color:THEME.textLight,cursor:"pointer"}}>
                  <input type="checkbox" checked={npcOn} onChange={e=>{setNpcOn(e.target.checked);setNpcEnabled(e.target.checked);}} style={{width:16,height:16,cursor:"pointer"}}/>
                  Показывать подсказки помощника
                </label>
              </>
            )}
          </div>
        </div>
        <div className="profile-actions">
          <button className="cta-button active" style={{width:"auto",padding:"14px 28px"}} onClick={onOpenDiagnostics}>🎯 Пройти диагностику</button>
          <button className="cta-button active profile-plan-btn" style={{width:"auto",padding:"14px 28px",boxShadow:"none"}} onClick={onViewPlan}>🗺️ Мой план обучения</button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="profile-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:16,marginBottom:24}}>
        <div className="stat-card"><div className="stat-icon">📋</div><div style={{minWidth:0}}><div className="stat-value">{totalDiag}</div><div className="stat-label">диагностик пройдено</div></div></div>
        <div className="stat-card"><div className="stat-icon">📊</div><div style={{minWidth:0}}><div className="stat-value">{Object.keys(expertMap).length}</div><div className="stat-label">экспертных отчётов</div></div></div>
        <div className="stat-card"><div className="stat-icon">⏱️</div><div style={{minWidth:0}}><div className="stat-value" style={{fontSize:totalHr>0?14:18,wordBreak:"break-word"}}>{totalDiag>0?timeLabel:"—"}</div><div className="stat-label">всего потрачено</div></div></div>
      </div>

      {/* Medals */}
      {medals.length>0&&(
        <div className="dashboard-section" style={{marginBottom:24}}>
          <h2 className="section-title" style={{marginBottom:16}}>🏅 Мои медали</h2>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            {medals.map(m=>(
              <div key={m.id} style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:"16px 20px",minWidth:160,textAlign:"center",border:"1px solid rgba(212,175,55,0.3)",boxShadow:"0 4px 20px rgba(0,0,0,0.12)"}}>
                <div style={{fontSize:36,marginBottom:6}}>🏅</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,color:THEME.accent,marginBottom:4}}>{m.sectionName}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{m.earnedAt?new Date(m.earnedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):"—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History — full width */}
      <div data-tour="diag-history" className="dashboard-section" style={{marginBottom:24}}>
        <h2 className="section-title" style={{marginBottom:20}}>📊 История диагностик</h2>
        {loading&&<div className="empty-state" style={{padding:"24px 0"}}>Загрузка...</div>}
        {!loading&&fetchError&&<ErrorCard onRetry={load}/>}
        {!loading&&!fetchError&&results.length===0&&<div className="empty-state" style={{padding:"24px 0"}}>Диагностик ещё не пройдено</div>}
        {!loading&&!fetchError&&results.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {results.map((r,i)=>{
              const hasReport=!!expertMap[r.id];
              const pct=r.score||0;
              const color=pct>=80?THEME.success:pct>=60?THEME.warning:THEME.error;
              const num=results.length-i;
              const title=r.sectionName||"Общая диагностика";
              return(
                <div key={r.id} className="diag-history-item" onClick={hasReport?()=>{setViewingExpert(expertMap[r.id]);setViewingPhotos(r.studentPhotos||[]);}:undefined}
                  style={{padding:"16px 20px",borderRadius:12,border:`1px solid ${hasReport?THEME.accent:THEME.border}`,borderLeft:`4px solid ${hasReport?THEME.accent:THEME.border}`,cursor:hasReport?"pointer":"default",transition:"box-shadow 0.15s"}}
                  onMouseEnter={e=>{if(hasReport)e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.07)";}}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span className="diag-history-num" style={{fontSize:11,fontWeight:700,color:THEME.textLight,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:99,padding:"1px 9px"}}>#{num}</span>
                        <span className="diag-history-title" style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{title}</span>
                      </div>
                      <div style={{fontSize:12,color:THEME.textLight}}>{new Date(r.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})} · {r.totalQuestions} вопросов · {fmtTime(r.totalTime||0)}</div>
                      {hasReport
                        ? <div style={{fontSize:11,color:THEME.accent,fontWeight:700,marginTop:5}}>📋 Экспертный отчёт доступен — нажмите чтобы открыть →</div>
                        : <div style={{fontSize:11,color:THEME.textLight,marginTop:5}}>⏳ Ожидает проверки преподавателя</div>
                      }
                    </div>
                    {hasReport&&(
                      <div style={{flexShrink:0,textAlign:"center"}}>
                        <div style={{width:50,height:50,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15}}>{pct}%</div>
                        <div style={{marginTop:6,height:4,width:50,borderRadius:99,background:THEME.border,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99}}/>
                        </div>
                      </div>
                    )}
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
