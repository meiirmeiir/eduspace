import React, { useState, useEffect } from "react";
import { useNpc } from "../NpcContext.jsx";
import { addDoc, collection, db, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "../firestore-rest.js";
import { compressImage } from "../lib/mathUtils.js";
import { getAlmatyDateStr } from "../lib/srsUtils.js";
import { tgPhoto, THEME, STUDENT_STATUSES, DAY_NAMES_SHORT } from "../lib/appConstants.js";
import Logo from "../components/ui/Logo.jsx";
import ErrorCard from "../components/ui/ErrorCard.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import ProfileSection from "../components/ProfileSection.jsx";
import LessonModal from "../components/LessonModal.jsx";
import RecordingModal from "../components/RecordingModal.jsx";

export default function DashboardScreen({ user, firebaseUser, activeSection: activeSectionProp, setActiveSection: setActiveSectionProp, onOpenDiagnostics, onStartSmartDiag, onViewRoadmap, onViewPlan, onOpenTheory, onOpenDaily, onOpenAdmin, onLogout, onOpenPractice, onOpenIntermediateTests, onUpdateUser }) {
  const { startTourIfNew } = useNpc();
  /* If App passes activeSection/setActiveSection — use them (allows
     external navigation, e.g. mobile bottom-nav). Otherwise fall back
     to local state for backwards compatibility. */
  const [localSection,setLocalSection]=useState("home");
  const activeSection = activeSectionProp !== undefined ? activeSectionProp : localSection;
  const setActiveSection = setActiveSectionProp || setLocalSection;
  const [schedule,setSchedule]=useState([]);
  const [homework,setHomework]=useState([]);
  const [loadingData,setLoadingData]=useState(true);
  const [dataError,setDataError]=useState(false);
  const [showHwForm,setShowHwForm]=useState(false);
  const [showSchedForm,setShowSchedForm]=useState(false);
  const [hwForm,setHwForm]=useState({title:"",description:"",dueDate:"",userId:""});
  const [schedForm,setSchedForm]=useState({studentId:'',subject:'Математика',mode:'weekly',date:'',startTime:'10:00',endTime:'11:00',weekDays:[],startFrom:new Date().toISOString().slice(0,10),weeks:8});
  const [sidebarOpen,setSidebarOpen]=useState(false);

  const isTeacher=user?.role==="teacher"||user?.role==="admin";
  const isAdmin=user?.role==="admin";
  const today=new Date();
  const [weekOffset,setWeekOffset]=useState(0);
  const [openedLesson,setOpenedLesson]=useState(null); // {lesson, date}
  const statusObj=STUDENT_STATUSES.find(s=>s.value===user?.status)||STUDENT_STATUSES[1];
  const [students,setStudents]=useState([]);
  const [hwImageFiles,setHwImageFiles]=useState([]);
  const [hwImagePreviews,setHwImagePreviews]=useState([]);
  const [hwSaving,setHwSaving]=useState(false);
  const [lightboxImg,setLightboxImg]=useState(null);
  // HW Submissions
  const [hwSubmissions,setHwSubmissions]=useState([]);
  const [submittingHwId,setSubmittingHwId]=useState(null);
  const [submitFiles,setSubmitFiles]=useState([]);
  const [submitPreviews,setSubmitPreviews]=useState([]);
  const [submitSaving,setSubmitSaving]=useState(false);
  const [viewingSubmissions,setViewingSubmissions]=useState(null); // hwId for teacher view
  const [feedbacks,setFeedbacks]=useState({}); // submissionId → {text,grade}
  const [progressData,setProgressData]=useState(null); // {topics:{}, skills:{}}
  const [zoomLessons,setZoomLessons]=useState([]);
  const [newLessonCreating,setNewLessonCreating]=useState(false);
  const [newLessonError,setNewLessonError]=useState('');

  const loadDashData = async ()=>{
    if (!firebaseUser) return;
    // Use firebaseUser.uid — always reliable (user.uid may be absent if Firestore doc lacks uid field)
    const uid = firebaseUser.uid;
    // Compute role inline to avoid stale closure issues
    const _isAdmin = user?.role==="admin";
    const _isTeacher = user?.role==="teacher" || _isAdmin;
    setLoadingData(true); setDataError(false);
    try{
      const [scS,hwS,uS,subS,lesS]=await Promise.all([
        getDocs(collection(db,"schedule")),
        _isTeacher?getDocs(collection(db,"homework")):getDocs(query(collection(db,"homework"),where("userId","in",[uid,""]))),
        _isTeacher?getDocs(collection(db,"users")):Promise.resolve({docs:[]}),
        _isTeacher?getDocs(collection(db,"hwSubmissions")):getDocs(query(collection(db,"hwSubmissions"),where("userId","==",uid))),
        getDocs(collection(db,"lessons")),
      ]);
      const allSc=scS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.time?.localeCompare(b.time));
      const allHw=hwS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.dueDate?.localeCompare(b.dueDate));
      setSchedule(_isAdmin?allSc:allSc.filter(s=>(!s.userId&&!s.userIds?.length)||s.userId===uid||s.userIds?.includes(uid)));
      setHomework(_isTeacher?allHw:allHw);
      if(_isTeacher) setStudents(uS.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.role!=="admin"&&s.id!==uid));
      setHwSubmissions(subS.docs.map(d=>({id:d.id,...d.data()})));
      const allZL=lesS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.date?.localeCompare(b.date));
      setZoomLessons(_isAdmin?allZL:allZL.filter(l=>l.studentId===uid));
      if(!_isTeacher){
        try{
          const [upSnap,spSnap]=await Promise.all([
            getDoc(doc(db,"userProgress",uid)),
            getDoc(doc(db,"skillProgress",uid)),
          ]);
          const topics=upSnap.exists()?(upSnap.data().topics||{}):{};
          const skills=spSnap.exists()?(spSnap.data().skills||{}):{};
          setProgressData({topics,skills});
        }catch(_){}
      }
    }catch(e){console.error(e);setDataError(true);}
    setLoadingData(false);
  };
  useEffect(()=>{ loadDashData(); startTourIfNew("dashboard"); },[firebaseUser?.uid]);

  // Auto-deactivate when learning period expires
  useEffect(()=>{
    const checkPeriod=async()=>{
      if(!user?.phone||isTeacher||isAdmin)return;
      if(user?.status==="inactive")return;
      const end=user?.learningPeriodEnd;
      if(!end)return;
      const today=getAlmatyDateStr(0);
      if(today>end){
        try{
          await updateDoc(doc(db,"users",user.uid||user.id),{status:"inactive"});
          onUpdateUser?.({...user,status:"inactive"});
        }catch(e){console.error(e);}
      }
    };
    checkPeriod();
  },[user?.phone]);

  const handleHwImageChange=e=>{
    const files=Array.from(e.target.files||[]).slice(0,5);
    if(!files.length)return;
    setHwImageFiles(files);
    setHwImagePreviews(files.map(f=>URL.createObjectURL(f)));
  };

  const openSubmitHw=(hwId)=>{setSubmittingHwId(hwId);setSubmitFiles([]);setSubmitPreviews([]);};
  const closeSubmitHw=()=>{setSubmittingHwId(null);setSubmitFiles([]);setSubmitPreviews([]);};
  const handleSubmitFiles=e=>{
    const files=Array.from(e.target.files||[]).slice(0,5);
    setSubmitFiles(files);
    setSubmitPreviews(files.map(f=>URL.createObjectURL(f)));
  };
  const submitHw=async()=>{
    if(!submitFiles.length){alert("Добавьте хотя бы одно фото");return;}
    setSubmitSaving(true);
    try{
      const hw=homework.find(h=>h.id===submittingHwId);
      const photos=await Promise.all(submitFiles.map(f=>compressImage(f,800,0.7)));
      const totalSize=photos.reduce((s,p)=>s+p.length,0);
      const data={hwId:submittingHwId,hwTitle:hw?.title||"",userId:user?.uid,userPhone:user?.phone,userName:`${user?.firstName} ${user?.lastName}`,photos:totalSize<900000?photos:[],submittedAt:new Date().toISOString(),status:"pending",feedback:"",grade:null};
      const ref=await addDoc(collection(db,"hwSubmissions"),data);
      // Send to Telegram
      for(let i=0;i<submitFiles.length;i++){
        await tgPhoto(submitFiles[i],`📚 ДЗ сдано (${i+1}/${submitFiles.length})\n👤 ${user?.firstName} ${user?.lastName} (${user?.phone})\n📋 ${hw?.title||""}`);
      }
      setHwSubmissions(p=>[...p,{id:ref.id,...data}]);
      closeSubmitHw();
    }catch(e){alert("Ошибка: "+e.message);}
    setSubmitSaving(false);
  };
  const saveFeedback=async(subId)=>{
    const fb=feedbacks[subId]||{};
    try{
      await updateDoc(doc(db,"hwSubmissions",subId),{status:"reviewed",feedback:fb.text||"",grade:fb.grade??null});
      setHwSubmissions(p=>p.map(s=>s.id===subId?{...s,status:"reviewed",feedback:fb.text||"",grade:fb.grade??null}:s));
    }catch(e){alert("Ошибка: "+e.message);}
  };

  const addHomework=async e=>{
    e.preventDefault();
    setHwSaving(true);
    try{
      const imageUrls=await Promise.all(hwImageFiles.map(f=>compressImage(f)));
      const data={...hwForm,imageUrls,createdAt:new Date().toISOString()};
      const docRef=await addDoc(collection(db,"homework"),data);
      setHomework(p=>[...p,{id:docRef.id,...data}].sort((a,b)=>a.dueDate?.localeCompare(b.dueDate)));
      setHwForm({title:"",description:"",dueDate:"",userId:""});
      setHwImageFiles([]);setHwImagePreviews([]);
      setShowHwForm(false);
    }catch(e){alert("Ошибка: "+e.message);}
    setHwSaving(false);
  };
  const isJoinable=l=>{const start=new Date(l.date).getTime();const end=start+(l.durationMinutes||60)*60000;const now=Date.now();return now>=start-15*60000&&now<=end;};
  const addSchedule=async e=>{
    e.preventDefault();
    if(isTeacher&&!schedForm.studentId){setNewLessonError('Выберите ученика');return;}
    setNewLessonCreating(true);setNewLessonError('');
    const student=students.find(s=>s.id===schedForm.studentId);
    const studentName=student?`${student.firstName} ${student.lastName}`:'';
    const studentId=schedForm.studentId||(user?.id||user?.phone);
    const [sh,sm]=schedForm.startTime.split(':').map(Number);
    const [eh,em]=schedForm.endTime.split(':').map(Number);
    const durationMinutes=(eh*60+em)-(sh*60+sm);
    if(durationMinutes<=0){setNewLessonError('Время окончания должно быть позже времени начала');setNewLessonCreating(false);return;}
    try{
      const API=window.location.origin;
      const token=await firebaseUser.getIdToken();
      if(schedForm.mode==='once'){
        if(!schedForm.date){setNewLessonError('Выберите дату');setNewLessonCreating(false);return;}
        const isoDate=new Date(`${schedForm.date}T${schedForm.startTime}:00`).toISOString();
        const r=await fetch(`${API}/api/lessons`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body:JSON.stringify({studentId,date:isoDate,durationMinutes,studentName,subject:schedForm.subject})});
        const d=await r.json();
        if(!r.ok) throw new Error(d.error||'Ошибка сервера');
      } else {
        if(!schedForm.weekDays.length){setNewLessonError('Выберите хотя бы один день недели');setNewLessonCreating(false);return;}
        const dates=[];
        const from=new Date(`${schedForm.startFrom}T${schedForm.startTime}:00`);
        const until=new Date(from);until.setDate(until.getDate()+schedForm.weeks*7);
        const cur=new Date(from);
        while(cur<=until){if(schedForm.weekDays.includes(cur.getDay()))dates.push(new Date(cur).toISOString());cur.setDate(cur.getDate()+1);}
        if(!dates.length){setNewLessonError('Нет дат в выбранном диапазоне');setNewLessonCreating(false);return;}
        const r=await fetch(`${API}/api/lessons-batch`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body:JSON.stringify({studentId,studentName,dates,durationMinutes,subject:schedForm.subject})});
        const d=await r.json();
        if(!r.ok) throw new Error(d.error||'Ошибка сервера');
      }
      setShowSchedForm(false);
      setSchedForm({studentId:'',subject:'Математика',mode:'weekly',date:'',startTime:'10:00',endTime:'11:00',weekDays:[],startFrom:new Date().toISOString().slice(0,10),weeks:8});
      await loadDashData();
    }catch(err){setNewLessonError(err.message);}
    setNewLessonCreating(false);
  };
  const delHw=async id=>{try{await deleteDoc(doc(db,"homework",id)); setHomework(p=>p.filter(h=>h.id!==id));}catch{alert("Ошибка.");}};
  const delSc=async id=>{try{await deleteDoc(doc(db,"schedule",id)); setSchedule(p=>p.filter(s=>s.id!==id));}catch{alert("Ошибка.");}};
  const delLesson=async id=>{if(!confirm('Удалить занятие?'))return;try{await deleteDoc(doc(db,'lessons',id));setZoomLessons(p=>p.filter(l=>l.id!==id));}catch{alert('Ошибка.');}};

  const getWeekDates=()=>{const dow=today.getDay(),mon=new Date(today); mon.setDate(today.getDate()-(dow===0?6:dow-1)+weekOffset*7); return Array.from({length:7},(_,i)=>{const d=new Date(mon); d.setDate(mon.getDate()+i); return d;});};
  const weekDates=getWeekDates();
  const weekStart=weekDates[0],weekEnd=weekDates[6];
  const weekLabel=weekOffset===0?"Текущая неделя":weekOffset===-1?"Прошлая неделя":`${weekStart.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${weekEnd.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}`;

  const isTrial=user?.status==="trial";
  const isTester=user?.status==="tester";
  const isInactive=user?.status==="inactive";
  const showDiagNav=isTeacher||isTester||(user?.goalKey==="exam");
  const navItems=isInactive?[
    {id:"plan",icon:"🗺️",label:"Индивидуальный план обучения"},
    {id:"profile",icon:"👤",label:"Личный кабинет ученика"},
    ...(isAdmin?[{id:"admin",icon:"⚙️",label:"Администрирование"}]:[]),
  ]:[
    {id:"home",icon:"🏠",label:"Главная"},
    ...(showDiagNav?[{id:"diagnostics",icon:"🎯",label:"Диагностика"}]:[]),
    ...(!isTrial?[{id:"practice",icon:"🏋️",label:"Тренировка"}]:[]),
    ...(!isTrial?[{id:"intermediate",icon:"⚔️",label:"Промежуточные тесты"}]:[]),
    {id:"plan",icon:"🗺️",label:"Индивидуальный план обучения"},
    {id:"theory",icon:"📖",label:"Теория"},
    {id:"daily",icon:"📝",label:"Ежедневные задачи"},
    {id:"profile",icon:"👤",label:"Личный кабинет ученика"},
    ...(isAdmin?[{id:"admin",icon:"⚙️",label:"Администрирование"}]:[]),
  ];

  const handleNav=id=>{
    setSidebarOpen(false);
    if(id==="diagnostics"){onOpenDiagnostics();return;}
    if(id==="practice"){onOpenPractice();return;}
    if(id==="intermediate"){onOpenIntermediateTests();return;}
    if(id==="plan"){onViewPlan();return;}
    if(id==="theory"){onOpenTheory?.();return;}
    if(id==="daily"){onOpenDaily?.();return;}
    if(id==="admin"){onOpenAdmin();return;}
    setActiveSection(id);
  };

  return(
    <div className="dashboard-layout">
      {sidebarOpen&&<div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}
      <div className={`sidebar-backdrop ${sidebarOpen?"visible":""}`} onClick={()=>setSidebarOpen(false)}/>
      <aside className={`dashboard-sidebar ${sidebarOpen?"open":""}`}>
        <div className="sidebar-logo"><Logo size={36} light/></div>
        <nav className="sidebar-nav">
          {navItems.map(item=>{
            // Items also present in the mobile bottom-nav — hide here on mobile to avoid duplication.
            const inBottomNav = ["home","plan","daily","theory","profile"].includes(item.id);
            return (
              <button
                key={item.id}
                data-bottom-dup={inBottomNav ? "1" : undefined}
                className={`sidebar-nav-item ${activeSection===item.id?"active":""}`}
                onClick={()=>handleNav(item.id)}
              >
                <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user">
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="avatar" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,0.2)",flexShrink:0}}/>
            : <div className="sidebar-user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          }
          <div style={{flex:1,minWidth:0}}><div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div><div className="sidebar-user-role" style={{color:statusObj.color+"cc"}}>{isAdmin?"Администратор":isTeacher?"Преподаватель":statusObj.label}</div></div>
          <button onClick={onLogout} title="Выйти" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.45)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,flexShrink:0,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.15)";e.currentTarget.style.color="#ef4444";e.currentTarget.style.borderColor="rgba(239,68,68,0.3)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.45)";e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";}}>
            ⎋ Выйти
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="mobile-topbar">
          <button className="burger-btn" onClick={()=>setSidebarOpen(true)}>☰</button>
          <Logo size={28}/>
          <ThemeToggle />
        </div>
        <div className="desktop-header-actions"><ThemeToggle /></div>

        {activeSection==="home"&&(
          <>
            <div className="dashboard-header">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div><h1>Добро пожаловать, <span style={{color:THEME.accent}}>{user?.firstName}</span>!</h1><p style={{color:THEME.textLight,marginTop:6}}>{today.toLocaleDateString("ru-RU",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
                <span style={{background:statusObj.color+"18",color:statusObj.color,fontWeight:700,fontSize:13,padding:"6px 16px",borderRadius:99,border:`1px solid ${statusObj.color}30`,alignSelf:"center"}}>{statusObj.label}</span>
              </div>
            </div>


            {/* Умная диагностика — для goals: gaps / future */}
            {!isTeacher&&!isTester&&(user?.goalKey==="gaps"||user?.goalKey==="future")&&!user?.smartDiagDone&&(
              <div data-tour="smart-diag" style={{marginBottom:24}}>
                {/* Пройденные разделы */}
                {(user?.smartDiagSections||[]).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
                    {(user.smartDiagSections).map(n=>(
                      <div key={n} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,padding:"8px 16px"}}>
                        <span style={{fontSize:18}}>✅</span>
                        <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:14,color:"#22c55e"}}>Раздел {n} пройден</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Кнопка старта / продолжения */}
                <div
                  onClick={()=>onStartSmartDiag(!!user?.smartDiagNextSection)}
                  style={{cursor:"pointer",background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",borderRadius:20,padding:"28px 32px",color:"#fff",position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(37,99,235,0.25)",border:"2px solid rgba(212,175,55,0.3)"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(37,99,235,0.35)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 8px 32px rgba(37,99,235,0.25)";}}>
                  <div style={{position:"absolute",right:-10,top:-10,fontSize:120,opacity:0.06}}>🎯</div>
                  <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                    <div style={{width:64,height:64,borderRadius:16,background:"rgba(212,175,55,0.15)",border:"1px solid rgba(212,175,55,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>🎯</div>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:800,color:THEME.accent,marginBottom:6}}>
                        {user?.smartDiagNextSection?`Умная Диагностика — Раздел ${user.smartDiagNextSection}`:"Пройди Умную Диагностику"}
                      </div>
                      <p style={{fontSize:14,opacity:0.8,margin:0,lineHeight:1.6}}>
                        {user?.smartDiagNextSection
                          ?"Продолжи диагностику — в системе ещё остались непроверенные навыки."
                          :`Система проверит все ключевые навыки для ${user?.details} и выявит твои пробелы. Займёт 15–25 минут.`}
                      </p>
                    </div>
                    <button style={{background:THEME.accent,color:THEME.primary,border:"none",borderRadius:12,padding:"14px 28px",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                      {user?.smartDiagNextSection?`Начать Раздел ${user.smartDiagNextSection} →`:"Начать →"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Дорожная карта — показывается после завершения умной диагностики */}
            {!isTeacher&&!isTester&&user?.smartDiagDone&&onViewRoadmap&&(
              <div
                data-tour="roadmap"
                onClick={onViewRoadmap}
                className="dark-invert-back"
                style={{cursor:"pointer",background:"linear-gradient(135deg,#080e1f 0%,#0d1a35 100%)",borderRadius:20,padding:"24px 28px",marginBottom:24,color:"#fff",position:"relative",overflow:"hidden",border:"2px solid rgba(212,175,55,0.35)",boxShadow:"0 8px 32px rgba(212,175,55,0.12)"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";}}
              >
                <div style={{position:"absolute",right:-8,top:-8,fontSize:110,opacity:0.05}}>🗺️</div>
                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{width:56,height:56,borderRadius:14,background:"rgba(212,175,55,0.15)",border:"1px solid rgba(212,175,55,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🗺️</div>
                  <div style={{flex:1,minWidth:180}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:800,color:THEME.accent}}>Твоя дорожная карта</div>
                      <span style={{background:"#22c55e",color:"#fff",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 8px",letterSpacing:0.4}}>ГОТОВА</span>
                    </div>
                    <p style={{fontSize:13,opacity:0.65,margin:0,lineHeight:1.5}}>Диагностика завершена — посмотри персональный план обучения снизу вверх.</p>
                  </div>
                  <button style={{background:THEME.accent,color:THEME.primary,border:"none",borderRadius:10,padding:"12px 22px",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                    Смотреть →
                  </button>
                </div>
              </div>
            )}

            <div className="stats-row">
              <div className="stat-card"><div className="stat-icon">📅</div><div><div className="stat-value">{schedule.length}</div><div className="stat-label">занятий в неделю</div></div></div>
              <div className="stat-card"><div className="stat-icon">📚</div><div><div className="stat-value">{homework.filter(h=>new Date(h.dueDate+"T23:59:59")>=today).length}</div><div className="stat-label">активных ДЗ</div></div></div>
              <div className="stat-card"><div className="stat-icon">🎯</div><div><div className="stat-value" style={{fontSize:16}}>{user?.details||"—"}</div><div className="stat-label">цель</div></div></div>
            </div>

            {/* Schedule */}
            <div data-tour="next-lesson" className="dashboard-section">
              <div className="section-title-row">
                <h2 className="section-title">📅 Расписание занятий</h2>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>setWeekOffset(p=>p-1)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,color:THEME.text}}>‹</button>
                  <span style={{fontSize:13,fontWeight:600,color:weekOffset===0?THEME.primary:THEME.textLight,minWidth:160,textAlign:"center"}}>{weekLabel}</span>
                  <button onClick={()=>setWeekOffset(p=>Math.min(0,p+1))} disabled={weekOffset>=0} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",cursor:weekOffset>=0?"not-allowed":"pointer",fontSize:14,fontWeight:700,color:weekOffset>=0?THEME.border:THEME.text,opacity:weekOffset>=0?0.4:1}}>›</button>
                  {weekOffset<0&&<button onClick={()=>setWeekOffset(0)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${THEME.accent}`,background:"rgba(212,175,55,0.1)",cursor:"pointer",fontSize:12,fontWeight:700,color:"#92680e"}}>Сегодня</button>}
                  {isTeacher&&<button className="add-btn" onClick={()=>setShowSchedForm(true)}>+ Добавить</button>}
                </div>
              </div>
              <div className="week-calendar">
                {weekDates.map((date,idx)=>{
                  const dayLessons=zoomLessons.filter(l=>{const ld=new Date(l.date);return ld.toDateString()===date.toDateString();});
                  const isToday=date.toDateString()===today.toDateString();
                  const isPast=date<today&&!isToday;
                  return(<div key={idx} className={`week-day ${isToday?"today":""}`} style={{opacity:isPast&&weekOffset===0?0.75:1}}>
                    <div className="week-day-header"><span className="day-name">{DAY_NAMES_SHORT[idx]}</span><span className={`day-date ${isToday?"today-dot":""}`}>{date.getDate()}</span></div>
                    <div className="day-lessons">
                      {dayLessons.length===0?<div className="no-lessons">—</div>:dayLessons.map((l,li)=>{
                        const stName=isTeacher?(()=>{const s=students.find(s=>s.id===l.studentId);return s?s.firstName+" "+s.lastName[0]+".":null;})():null;
                        const lessonTime=new Date(l.date).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
                        const joinUrl=(isAdmin||isTeacher)?l.zoomStartUrl:l.zoomJoinUrl;
                        const joinable=isJoinable(l);
                        return(
                          <div key={li} className="lesson-block" style={{cursor:"default",position:"relative",paddingBottom:8}}>
                            <span className="lesson-time">{lessonTime}</span>
                            <span className="lesson-subject">{l.subject||'Занятие'}</span>
                            {stName&&<span style={{display:"block",fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:2,lineHeight:1.3}}>{stName}</span>}
                            <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                              <button onClick={()=>setOpenedLesson({lesson:l,date,mode:'board'})}
                                style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:6,border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",cursor:"pointer",lineHeight:1.4}}>
                                🖊️ Доска
                              </button>
                              <button onClick={()=>setOpenedLesson({lesson:l,date,mode:'notes'})}
                                style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:6,border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",cursor:"pointer",lineHeight:1.4}}>
                                📋 Запись
                              </button>
                              {joinUrl&&<a href={joinUrl} target="_blank" rel="noopener noreferrer"
                                style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:6,background:joinable?"#d4af37":"rgba(212,175,55,0.22)",color:joinable?"#0f172a":"#d4af37",cursor:"pointer",textDecoration:"none",lineHeight:1.4,display:"inline-block"}}>
                                {joinable?'▶ Начать':'🔗 Войти'}
                              </a>}
                            </div>
                            {isTeacher&&<button className="del-btn" onClick={e=>{e.stopPropagation();delLesson(l.id);}}>×</button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>);
                })}
              </div>
            </div>
            {/* Homework */}
            <div data-tour="homework" className="dashboard-section">
              <div className="section-title-row"><h2 className="section-title">📚 Домашние задания</h2>{isTeacher&&<button className="add-btn" onClick={()=>setShowHwForm(true)}>+ Добавить ДЗ</button>}</div>
              {loadingData?<div className="empty-state">Загрузка...</div>:dataError?<ErrorCard onRetry={loadDashData}/>:homework.length===0?<div className="empty-state">{isTeacher?"Нажмите «+ Добавить ДЗ».":"Домашних заданий пока нет."}</div>:(
                <div className="homework-list">
                  {homework.map((hw,i)=>{
                    const due=new Date(hw.dueDate+"T23:59:59"),isOv=due<today,dl=Math.ceil((due-today)/(864e5));
                    const mySub=hwSubmissions.find(s=>s.hwId===hw.id&&s.userId===(firebaseUser?.uid||user?.uid||user?.id));
                    const hwSubs=hwSubmissions.filter(s=>s.hwId===hw.id);
                    return(
                      <div key={i}>
                        <div className={`hw-card ${isOv?"overdue":""}`}>
                          <div className="hw-card-left">
                            <div className="hw-title">{hw.title}</div>
                            {hw.description&&<div className="hw-desc">{hw.description}</div>}
                            {(hw.imageUrls?.length?hw.imageUrls:hw.imageUrl?[hw.imageUrl]:[]).map((url,ii)=><img key={ii} src={url} alt="ДЗ" onClick={()=>setLightboxImg(url)} style={{marginTop:8,maxWidth:"100%",maxHeight:200,borderRadius:8,objectFit:"cover",border:`1px solid ${THEME.border}`,display:"block",cursor:"pointer"}}/>)}
                            {/* Student submission status */}
                            {!isTeacher&&(
                              <div style={{marginTop:10}}>
                                {!mySub&&<button onClick={()=>openSubmitHw(hw.id)} style={{padding:"6px 16px",borderRadius:8,border:`1px solid ${THEME.accent}`,background:"rgba(212,175,55,0.1)",color:"#92680e",fontWeight:700,fontSize:12,cursor:"pointer"}}>📤 Сдать задание</button>}
                                {mySub?.status==="pending"&&<span style={{fontSize:12,fontWeight:700,color:THEME.warning,background:"rgba(245,158,11,0.1)",padding:"4px 12px",borderRadius:99}}>⏳ На проверке</span>}
                                {mySub?.status==="reviewed"&&(
                                  <div>
                                    <span style={{fontSize:12,fontWeight:700,color:THEME.success,background:"rgba(16,185,129,0.1)",padding:"4px 12px",borderRadius:99}}>✅ Проверено{mySub.grade!=null?` · ${mySub.grade}/10`:""}</span>
                                    {mySub.feedback&&<div style={{marginTop:6,fontSize:13,color:THEME.text,background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"8px 12px",lineHeight:1.5}}>💬 {mySub.feedback}</div>}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Teacher: see submissions */}
                            {isTeacher&&hwSubs.length>0&&(
                              <button onClick={()=>setViewingSubmissions(viewingSubmissions===hw.id?null:hw.id)} style={{marginTop:8,padding:"5px 14px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:THEME.primary}}>
                                📥 {hwSubs.length} сдач{hwSubs.length===1?"а":"о"} {viewingSubmissions===hw.id?"▲":"▼"}
                              </button>
                            )}
                          </div>
                          <div className="hw-card-right">
                            <span className={`due-badge ${isOv?"overdue":dl<=2?"soon":""}`}>{isOv?"Просрочено":dl===0?"Сегодня":dl===1?"Завтра":`До ${due.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}`}</span>
                            {isTeacher&&<button className="del-btn-hw" onClick={()=>delHw(hw.id)}>×</button>}
                          </div>
                        </div>
                        {/* Teacher submissions panel */}
                        {isTeacher&&viewingSubmissions===hw.id&&(
                          <div style={{background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:12,padding:20,marginTop:4,marginBottom:8}}>
                            <div style={{fontWeight:700,color:THEME.primary,marginBottom:14,fontSize:14}}>Сдачи: {hw.title}</div>
                            {hwSubs.length===0&&<div style={{color:THEME.textLight,fontSize:13}}>Никто ещё не сдал</div>}
                            <div style={{display:"flex",flexDirection:"column",gap:14}}>
                              {hwSubs.map(sub=>(
                                <div key={sub.id} style={{background:"#fff",borderRadius:10,border:`1px solid ${sub.status==="reviewed"?THEME.success:THEME.border}`,padding:"14px 16px"}}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                                    <div>
                                      <div style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{sub.userName}</div>
                                      <div style={{fontSize:12,color:THEME.textLight}}>{new Date(sub.submittedAt).toLocaleString("ru-RU")}</div>
                                    </div>
                                    <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99,background:sub.status==="reviewed"?"rgba(16,185,129,0.1)":"rgba(245,158,11,0.1)",color:sub.status==="reviewed"?THEME.success:THEME.warning}}>{sub.status==="reviewed"?"✅ Проверено":"⏳ Ожидает"}</span>
                                  </div>
                                  {(sub.photos||[]).length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>{sub.photos.map((p,pi)=><img key={pi} src={p} alt="" onClick={()=>setLightboxImg(p)} style={{height:80,width:80,objectFit:"cover",borderRadius:8,cursor:"pointer",border:`1px solid ${THEME.border}`}}/>)}</div>}
                                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}>
                                    <div>
                                      <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Комментарий</div>
                                      <textarea className="input-field" rows={2} style={{resize:"vertical",fontSize:13}} value={feedbacks[sub.id]?.text??sub.feedback??""} onChange={e=>setFeedbacks(p=>({...p,[sub.id]:{...p[sub.id],text:e.target.value}}))} placeholder="Напишите комментарий..."/>
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Оценка /10</div>
                                      <select className="input-field" style={{width:80}} value={feedbacks[sub.id]?.grade??sub.grade??""} onChange={e=>setFeedbacks(p=>({...p,[sub.id]:{...p[sub.id],grade:e.target.value===''?null:Number(e.target.value)}}))}>
                                        <option value="">—</option>
                                        {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <button onClick={()=>saveFeedback(sub.id)} style={{marginTop:8,padding:"7px 18px",borderRadius:8,background:THEME.primary,color:THEME.accent,border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>Сохранить</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeSection==="profile"&&(
          <ProfileSection user={user} statusObj={statusObj} onOpenDiagnostics={onOpenDiagnostics} onViewPlan={onViewPlan} onUpdateUser={onUpdateUser}/>
        )}
      </main>

      {showSchedForm&&<div className="modal-overlay" onClick={()=>{setShowSchedForm(false);setNewLessonError('');}}><div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:480,width:'100%'}}>
        <div className="modal-title">Добавить занятие</div>
        <form onSubmit={addSchedule} style={{display:'flex',flexDirection:'column',gap:16}}>
          {isTeacher&&<div className="input-group">
            <label className="input-label">Ученик</label>
            <select required value={schedForm.studentId} onChange={e=>setSchedForm(p=>({...p,studentId:e.target.value}))} className="input-field">
              <option value="">Выберите ученика...</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.grade?` · ${s.grade}`:''}</option>)}
            </select>
          </div>}
          <div className="input-group">
            <label className="input-label">Предмет</label>
            <input type="text" className="input-field" value={schedForm.subject} onChange={e=>setSchedForm(p=>({...p,subject:e.target.value}))} required/>
          </div>
          <div style={{display:'flex',borderRadius:10,border:`1px solid ${THEME.border}`,overflow:'hidden'}}>
            {[{v:'once',l:'Разовый'},{v:'weekly',l:'Еженедельно'}].map(m=>(
              <button key={m.v} type="button" onClick={()=>setSchedForm(p=>({...p,mode:m.v}))}
                style={{flex:1,padding:'8px 0',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',
                  background:schedForm.mode===m.v?THEME.primary:'transparent',
                  color:schedForm.mode===m.v?'#fff':THEME.textLight,transition:'all 0.15s'}}>
                {m.l}
              </button>
            ))}
          </div>
          {schedForm.mode==='once'?(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="input-group">
                <label className="input-label">Дата</label>
                <input required type="date" value={schedForm.date} min={new Date().toISOString().slice(0,10)} onChange={e=>setSchedForm(p=>({...p,date:e.target.value}))} className="input-field"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div className="input-group"><label className="input-label">Начало</label><input required type="time" value={schedForm.startTime} onChange={e=>setSchedForm(p=>({...p,startTime:e.target.value}))} className="input-field"/></div>
                <div className="input-group"><label className="input-label">Конец</label><input required type="time" value={schedForm.endTime} onChange={e=>setSchedForm(p=>({...p,endTime:e.target.value}))} className="input-field"/></div>
                <div className="input-group"><label className="input-label">Длительность</label>
                  <div style={{background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:'10px 14px',fontSize:13,color:THEME.textLight,fontWeight:600}}>
                    {(()=>{const [sh,sm]=schedForm.startTime.split(':').map(Number);const [eh,em]=schedForm.endTime.split(':').map(Number);const d=(eh*60+em)-(sh*60+sm);return d>0?`${d} мин`:'—';})()}
                  </div>
                </div>
              </div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="input-group">
                <label className="input-label">Дни недели</label>
                <div style={{display:'flex',gap:6}}>
                  {[{l:'Пн',v:1},{l:'Вт',v:2},{l:'Ср',v:3},{l:'Чт',v:4},{l:'Пт',v:5},{l:'Сб',v:6},{l:'Вс',v:0}].map(d=>(
                    <button key={d.v} type="button"
                      onClick={()=>setSchedForm(p=>({...p,weekDays:p.weekDays.includes(d.v)?p.weekDays.filter(x=>x!==d.v):[...p.weekDays,d.v]}))}
                      style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:12,
                        background:schedForm.weekDays.includes(d.v)?THEME.primary:'rgba(255,255,255,0.06)',
                        color:schedForm.weekDays.includes(d.v)?'#fff':THEME.textLight,transition:'all 0.15s'}}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div className="input-group"><label className="input-label">Начало</label><input type="time" value={schedForm.startTime} onChange={e=>setSchedForm(p=>({...p,startTime:e.target.value}))} className="input-field"/></div>
                <div className="input-group"><label className="input-label">Конец</label><input type="time" value={schedForm.endTime} onChange={e=>setSchedForm(p=>({...p,endTime:e.target.value}))} className="input-field"/></div>
                <div className="input-group"><label className="input-label">Длительность</label>
                  <div style={{background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:'10px 14px',fontSize:13,color:THEME.textLight,fontWeight:600}}>
                    {(()=>{const [sh,sm]=schedForm.startTime.split(':').map(Number);const [eh,em]=schedForm.endTime.split(':').map(Number);const d=(eh*60+em)-(sh*60+sm);return d>0?`${d} мин`:'—';})()}
                  </div>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Начиная с</label>
                <input type="date" value={schedForm.startFrom} min={new Date().toISOString().slice(0,10)} onChange={e=>setSchedForm(p=>({...p,startFrom:e.target.value}))} className="input-field"/>
              </div>
              <div className="input-group">
                <label className="input-label">На {schedForm.weeks} недель вперёд{schedForm.weekDays.length>0?(()=>{const dates=[];const from=new Date(`${schedForm.startFrom}T${schedForm.startTime}:00`);const until=new Date(from);until.setDate(until.getDate()+schedForm.weeks*7);const cur=new Date(from);while(cur<=until){if(schedForm.weekDays.includes(cur.getDay()))dates.push(1);cur.setDate(cur.getDate()+1);}return ` (~${dates.length} уроков)`;})():''}</label>
                <input type="range" min={1} max={24} step={1} value={schedForm.weeks} onChange={e=>setSchedForm(p=>({...p,weeks:Number(e.target.value)}))} style={{width:'100%',accentColor:THEME.accent}}/>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:THEME.textLight,marginTop:2}}><span>1</span><span>4</span><span>8</span><span>16</span><span>24 нед</span></div>
              </div>
            </div>
          )}
          {newLessonError&&<div style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',borderRadius:10,padding:'10px 14px',fontSize:13}}>{newLessonError}</div>}
          <div style={{display:'flex',gap:12}}>
            <button type="button" className="cta-button" style={{background:'#fff',border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowSchedForm(false);setNewLessonError('');}}>Отмена</button>
            <button type="submit" className="cta-button active" disabled={newLessonCreating}>{newLessonCreating?(schedForm.mode==='weekly'?'Создаём уроки...':'Создаём...'):(schedForm.mode==='weekly'?'📅 Создать расписание':'📹 Создать урок')}</button>
          </div>
        </form>
      </div></div>}

      {openedLesson?.mode==='board'&&<LessonModal lesson={openedLesson.lesson} date={openedLesson.date} user={user} isAdmin={isAdmin} onClose={()=>setOpenedLesson(null)}/>}
      {openedLesson?.mode==='notes'&&<RecordingModal lesson={openedLesson.lesson} user={user} isAdmin={isAdmin} onClose={()=>setOpenedLesson(null)}/>}
      {lightboxImg&&<div onClick={()=>setLightboxImg(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:24}}>
        <img src={lightboxImg} alt="full" style={{maxWidth:"100%",maxHeight:"100%",borderRadius:12,objectFit:"contain",boxShadow:"0 8px 48px rgba(0,0,0,0.6)"}}/>
        <button onClick={()=>setLightboxImg(null)} style={{position:"absolute",top:20,right:24,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:28,width:44,height:44,borderRadius:"50%",cursor:"pointer",lineHeight:1}}>×</button>
      </div>}

      {/* Student HW submit modal */}
      {submittingHwId&&<div className="modal-overlay" onClick={closeSubmitHw}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">📤 Сдать домашнее задание</div>
        <p style={{color:THEME.textLight,fontSize:14,marginBottom:20}}>Сфотографируй своё решение и прикрепи фото. Преподаватель проверит и оставит комментарий.</p>
        <label style={{display:"block",border:`2px dashed ${submitFiles.length?THEME.success:THEME.border}`,borderRadius:12,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:submitFiles.length?"rgba(16,185,129,0.03)":"#fff",marginBottom:16}}>
          <div style={{fontSize:32,marginBottom:8}}>{submitFiles.length?"✅":"📷"}</div>
          <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:4}}>{submitFiles.length?`Выбрано: ${submitFiles.length} фото`:"Нажми чтобы выбрать фото"}</div>
          <div style={{fontSize:12,color:THEME.textLight}}>До 5 фото · JPG, PNG</div>
          <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleSubmitFiles}/>
        </label>
        {submitPreviews.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>{submitPreviews.map((p,i)=><img key={i} src={p} alt="" style={{height:72,width:72,objectFit:"cover",borderRadius:8,border:`1px solid ${THEME.border}`}}/>)}</div>}
        <div style={{display:"flex",gap:10}}>
          <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={closeSubmitHw} disabled={submitSaving}>Отмена</button>
          <button className="cta-button active" onClick={submitHw} disabled={!submitFiles.length||submitSaving}>{submitSaving?"Отправляю...":"Отправить →"}</button>
        </div>
      </div></div>}

      {showHwForm&&<div className="modal-overlay" onClick={()=>setShowHwForm(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Добавить домашнее задание</div>
        <form onSubmit={addHomework}>
          {isAdmin&&<div className="input-group"><label className="input-label">Ученик</label><select className="input-field" value={hwForm.userId} onChange={e=>setHwForm(p=>({...p,userId:e.target.value}))}><option value="">Все ученики</option>{students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></div>}
          <div className="input-group"><label className="input-label">Название</label><input type="text" className="input-field" value={hwForm.title} onChange={e=>setHwForm(p=>({...p,title:e.target.value}))} required/></div>
          <div className="input-group"><label className="input-label">Описание</label><textarea className="input-field" value={hwForm.description} onChange={e=>setHwForm(p=>({...p,description:e.target.value}))} rows={3} style={{resize:"vertical"}}/></div>
          <div className="input-group">
            <label className="input-label">Изображения (до 5, необязательно)</label>
            <input type="file" accept="image/*" multiple onChange={handleHwImageChange} style={{display:"block",marginBottom:8}}/>
            {hwImagePreviews.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{hwImagePreviews.map((p,i)=><img key={i} src={p} alt="preview" style={{height:80,borderRadius:6,objectFit:"cover",border:`1px solid ${THEME.border}`}}/>)}</div>}
          </div>
          <div className="input-group"><label className="input-label">Срок сдачи</label><input type="date" className="input-field" value={hwForm.dueDate} onChange={e=>setHwForm(p=>({...p,dueDate:e.target.value}))} required/></div>
          <div style={{display:"flex",gap:12}}><button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowHwForm(false);setHwImageFiles([]);setHwImagePreviews([]);}} disabled={hwSaving}>Отмена</button><button type="submit" className="cta-button active" disabled={hwSaving}>{hwSaving?"Загружаю...":"Добавить"}</button></div>
        </form>
      </div></div>}
    </div>
  );
}
