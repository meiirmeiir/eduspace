import React, { useState, useEffect, useMemo } from "react";
import { useNpc } from "../NpcContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { addDoc, collection, db, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "../firestore-rest.js";
import { compressImage } from "../lib/mathUtils.js";
import { getAlmatyDateStr } from "../lib/srsUtils.js";
import { openSubscriptionWhatsApp } from "../lib/openSubscription.js";
import { STUDENT_STATUSES, DAY_NAMES_SHORT, PLANS } from "../lib/appConstants.js";
import { useTheme } from "../ThemeContext.jsx";
import { getMyWeeklyRank, getLeague } from "../lib/pointsUtils.js";
import Logo from "../components/ui/Logo.jsx";
import ErrorCard from "../components/ui/ErrorCard.jsx";
import TopbarStats from "../components/TopbarStats.jsx";
import QuestsWidget from "../components/QuestsWidget.jsx";
import LevelRing from "../components/LevelRing.jsx";
import XpBar from "../components/XpBar.jsx";
import InfoTooltip from "../components/InfoTooltip.jsx";
import ShipProgress from "../components/ShipProgress.jsx";
import NewUserDashboard from "../components/dashboard/NewUserDashboard.jsx";
import ProfileSection from "../components/ProfileSection.jsx";
import LessonModal from "../components/LessonModal.jsx";
import RecordingModal from "../components/RecordingModal.jsx";

// Простая русская плюрализация: pluralize(2, ['день','дня','дней']) → 'дня'
function pluralize(n, [one, few, many]) {
  const a = Math.abs(Number(n) || 0) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5)   return few;
  if (b === 1)          return one;
  return many;
}

export default function DashboardScreen({ user: userProp, firebaseUser, activeSection: activeSectionProp, setActiveSection: setActiveSectionProp, onOpenDiagnostics, onStartSmartDiag, onViewRoadmap, onViewPlan, onOpenTheory, onOpenDaily, onOpenAdmin, onOpenLeaderboard, onOpenFriends, onOpenShop, onOpenSubscription, onLogout, onOpenPractice, onOpenIntermediateTests, onOpenFaq, onUpdateUser, masteryStatus: masteryStatusProp = { hasMastered:false, masteredCount:0, hasDueToday:false, completedToday:false }, onOpenDailyLockModal, rankRefreshKey = 0 }) {
  const user = userProp;
  const masteryStatus = masteryStatusProp;
  const { startTourIfNew, showNpcMessage } = useNpc();
  const { profile } = useAuth();
  const { theme: THEME } = useTheme();
  /* If App passes activeSection/setActiveSection — use them (allows
     external navigation, e.g. mobile bottom-nav). Otherwise fall back
     to local state for backwards compatibility. */
  const [localSection,setLocalSection]=useState("home");
  const activeSection = activeSectionProp !== undefined ? activeSectionProp : localSection;
  const setActiveSection = setActiveSectionProp || setLocalSection;
  const [homework,setHomework]=useState([]);
  const [loadingData,setLoadingData]=useState(true);
  const [dataError,setDataError]=useState(false);
  const [showHwForm,setShowHwForm]=useState(false);
  const [showSchedForm,setShowSchedForm]=useState(false);
  const [hwForm,setHwForm]=useState({title:"",description:"",dueDate:"",userId:""});
  const [schedForm,setSchedForm]=useState({studentId:'',subject:'Математика',mode:'weekly',date:'',startTime:'10:00',endTime:'11:00',weekDays:[],startFrom:new Date().toISOString().slice(0,10),weeks:8});
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [rankInfo,setRankInfo]=useState(null); // {rank, total, myPoints} | null
  const [planSkills,setPlanSkills]=useState(null); // массив skill_id из individualPlans/{uid} или null если плана нет
  const [diagPause,setDiagPause]=useState(null); // {sectionNum, qNum} из localStorage aapa_diag_pause

  // Прогресс внутри раздела (пауза посреди диагностики) — живёт ТОЛЬКО в localStorage,
  // в Firestore поднимается лишь по завершении раздела. Дашборд это умеет показать.
  useEffect(()=>{
    if(!user?.details){ setDiagPause(null); return; }
    try{
      const raw=localStorage.getItem('aapa_diag_pause');
      if(!raw){ setDiagPause(null); return; }
      const p=JSON.parse(raw);
      if(p?.grade===user.details && typeof p.qNum==='number'){
        setDiagPause({ sectionNum: p.sectionNum || 1, qNum: p.qNum });
      } else {
        setDiagPause(null);
      }
    }catch{ setDiagPause(null); }
  },[user?.details]);

  useEffect(()=>{
    let cancelled=false;
    const uid=user?.uid||user?.id;
    if(!uid){ setRankInfo(null); return; }
    getMyWeeklyRank(uid, user?.details, user?.region).then(r=>{ if(!cancelled) setRankInfo(r); }).catch(()=>{});
    return ()=>{ cancelled=true; };
    // user.weekPoints из локального state stale (addPoints не зовёт setUser).
    // Перезапрос триггерится через смену uid, заполнение grade/region или
    // через rankRefreshKey, который App.jsx инкрементирует после Daily/Mastery сессий.
  },[user?.uid||user?.id, user?.details, user?.region, rankRefreshKey]);

  const isTeacher=user?.role==="teacher"||user?.role==="admin";
  const isAdmin=user?.role==="admin";
  const today=new Date();
  const [weekOffset,setWeekOffset]=useState(0);
  const [openedLesson,setOpenedLesson]=useState(null); // {lesson, date}
  const planKey=user?.status;
  const isSolo=planKey==='solo';
  const isPaidPlan=!!planKey&&(planKey.startsWith('group_')||planKey.startsWith('individual_'));
  const trialDaysLeft=user?.trialExpiry?Math.max(0,Math.ceil((new Date(user.trialExpiry+"T23:59:59")-new Date())/(864e5))):null;
  // Канал оплаты: общий хелпер openSubscriptionWhatsApp (wa.me с заготовкой имя+класс).
  // onOpenSubscription (если App когда-то протянет) имеет приоритет; иначе — хелпер.
  const openSubscription=()=>{
    if(onOpenSubscription){ onOpenSubscription(); return; }
    openSubscriptionWhatsApp(user);
  };
  const _stdStatus=STUDENT_STATUSES.find(s=>s.value===planKey);
  const _planForStatus=planKey&&PLANS[planKey]?{value:planKey,label:PLANS[planKey].label,color:THEME.accent}:null;
  const statusObj=_stdStatus||_planForStatus||STUDENT_STATUSES[1];

  // ── Прогрессивное раскрытие дашборда (онбординг в 3 этапа) ────────────────
  //   new     — диагностика не пройдена → одна задача: пройти её (NewUserDashboard)
  //   starter — диагностика есть, но < 3 освоенных навыков → упрощённый дашборд
  //   active  — полная версия
  // Служебные роли всегда видят полную версию.
  const stage = useMemo(() => {
    if (isTeacher || user?.status === 'tester') return 'active';
    if (!user?.smartDiagDone) return 'new';
    if ((masteryStatus?.masteredCount ?? 0) < 3) return 'starter';
    return 'active';
  }, [isTeacher, user?.status, user?.smartDiagDone, masteryStatus?.masteredCount]);
  const showFull = stage !== 'new';
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
      const [hwS,uS,subS,lesS]=await Promise.all([
        // schedule-фетч удалён: dead-code (стейт не рендерился) + лишнее чтение всей
        // коллекции на каждом входе. Правило schedule сужено до isAdmin (клиент не читает).
        _isTeacher?getDocs(collection(db,"homework")):getDocs(query(collection(db,"homework"),where("userId","in",[uid,""]))),
        _isTeacher?getDocs(collection(db,"users")):Promise.resolve({docs:[]}),
        _isTeacher?getDocs(collection(db,"hwSubmissions")):getDocs(query(collection(db,"hwSubmissions"),where("userId","==",uid))),
        // lessons содержат driveVideoUrl (видео урока) + summary → приватность ученика.
        // Student запрашивает ТОЛЬКО свои (where studentId==uid) — иначе суженное правило
        // отклонит безфильтровый запрос. Teacher/admin читают все (правило-ветка по роли).
        _isTeacher?getDocs(collection(db,"lessons")):getDocs(query(collection(db,"lessons"),where("studentId","==",uid))),
      ]);
      const allHw=hwS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.dueDate?.localeCompare(b.dueDate));
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
          // Загрузка индивидуального плана — для прогресс-бара «Освоено: N из M навыков из плана»
          try{
            const ipSnap=await getDoc(doc(db,"individualPlans",uid));
            if(ipSnap.exists()){
              // individualPlans хранит массив в поле `modules` (не `roadmap`).
              // Fallback на `.roadmap` — для legacy-документов и совместимости.
              const modules=ipSnap.data()?.modules||ipSnap.data()?.roadmap||[];
              const ids=modules.flatMap(s=>Array.isArray(s?.skills_list)?s.skills_list:[]);
              setPlanSkills(ids);
            } else {
              setPlanSkills(null);
            }
          }catch(_){ setPlanSkills(null); }
        }catch(_){}
      }
    }catch(e){console.error(e);setDataError(true);}
    setLoadingData(false);
  };
  useEffect(()=>{ loadDashData(); },[firebaseUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // NPC: тур личного кабинета при первом открытии раздела profile.
  useEffect(()=>{
    if (activeSection === "profile") startTourIfNew("profile");
  },[activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // NPC: тур + приветствие при первом входе после онбординга.
  // Greeting показывается ПОСЛЕ завершения dashboard-тура (или сразу, если
  // тур уже пройден) — чтобы не конкурировать с туром за state помощника.
  useEffect(()=>{
    const uid = firebaseUser?.uid;
    if (!uid || !profile?.onboardingDone || !user) return;
    const greetedKey = `aapa_npc_greeted_${uid}`;
    // ── Новый юзер (диагностика ещё не пройдена) ──────────────────────────
    // Онбординг-реплика Пикселя, ведущая на диагностику, со spotlight на блок
    // Умной Диагностики ([data-tour="smart-diag"], рендерится при !smartDiagDone).
    // Однократно — тот же greeted-флаг, что и обычное приветствие. Общий
    // dashboard-тур/greetings для новичка пока не запускаем (фокус на диагностике).
    if (!user.smartDiagDone) {
      try {
        if (!localStorage.getItem(greetedKey)) {
          // Spotlight на CTA NewUserDashboard (диагностика). Прежний якорь
          // smart-diag после рефактора не рендерится для нового юзера (stage="new").
          showNpcMessage("onboard_diag", 14000, { selector: '[data-tour="onboard-diag-cta"]' });
          localStorage.setItem(greetedKey, "1");
        }
      } catch {}
      return;
    }
    // ── Существующий юзер ────────────────────────────────────────────────
    // Если уже приветствовали (в т.ч. новичка onboard_diag выше) — не дублируем
    // dashboard-тур/greetings после прохождения диагностики.
    try { if (localStorage.getItem(greetedKey)) return; } catch {}
    // Прежнее поведение: dashboard-тур, затем обычное greetings.
    const showGreeting = () => {
      try {
        if (!localStorage.getItem(greetedKey)) {
          showNpcMessage("greetings", 8000);
          localStorage.setItem(greetedKey, "1");
        }
      } catch {}
    };
    const tourWillFire = startTourIfNew("dashboard", showGreeting);
    if (!tourWillFire) showGreeting();
    // user?.smartDiagDone в deps — чтобы эффект отработал, когда user догрузится
    // позже uid/onboardingDone (иначе onboard_diag мог не показаться из-за гонки).
  },[firebaseUser?.uid, profile?.onboardingDone, user?.smartDiagDone]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const delLesson=async id=>{if(!confirm('Удалить занятие?'))return;try{await deleteDoc(doc(db,'lessons',id));setZoomLessons(p=>p.filter(l=>l.id!==id));}catch{alert('Ошибка.');}};

  const getWeekDates=()=>{const dow=today.getDay(),mon=new Date(today); mon.setDate(today.getDate()-(dow===0?6:dow-1)+weekOffset*7); return Array.from({length:7},(_,i)=>{const d=new Date(mon); d.setDate(mon.getDate()+i); return d;});};
  const weekDates=getWeekDates();
  const weekStart=weekDates[0],weekEnd=weekDates[6];
  const weekLabel=weekOffset===0?"Текущая неделя":weekOffset===-1?"Прошлая неделя":`${weekStart.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${weekEnd.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}`;

  const isTrial=user?.status==="trial";
  const isTester=user?.status==="tester";
  const isInactive=user?.status==="inactive";

  // Бейдж «Друзья»: количество входящих pending-запросов дружбы.
  const [pendingFriendCount,setPendingFriendCount]=useState(0);
  useEffect(()=>{
    if(!user?.uid) return;
    let cancelled=false;
    import("../lib/friendsUtils.js").then(({fetchIncomingPending})=>
      fetchIncomingPending(user.uid).then(reqs=>{if(!cancelled)setPendingFriendCount(reqs.length);})
    ).catch(()=>{});
    return ()=>{cancelled=true;};
  },[user?.uid]);

  // Прогресс по плану: знаменатель — все навыки из individualPlans/{uid}.roadmap[].skills_list[]
  const planSkillsTotal=planSkills?.length||0;
  const masteredCountRaw=masteryStatus.masteredCount||0;
  // masteryStatus считает ВСЕ освоенные навыки, не только те что в плане. Cap'ируем визуально,
  // чтобы не было «12 из 8 навыков», если ученик переучил план.
  const masteredCount=Math.min(masteredCountRaw, planSkillsTotal||masteredCountRaw);
  const topicsGreen=Object.values(progressData?.topics||{}).filter(t=>t?.zone==='green').length;
  const showDiagNav=isTeacher||isTester||(user?.goalKey==="exam");
  const navItems=isInactive?[
    {id:"plan",icon:"🗺️",label:"Индивидуальный план обучения"},
    {id:"leaderboard",icon:"🏆",label:"Таблица рейтинга"},
    {id:"shop",icon:"🛍️",label:"Магазин"},
    {id:"faq",icon:"❓",label:"Частые вопросы"},
    ...(isAdmin?[{id:"admin",icon:"⚙️",label:"Администрирование"}]:[]),
  ]:[
    {id:"home",icon:"🏠",label:"Главная"},
    ...(showDiagNav?[{id:"diagnostics",icon:"🎯",label:"Диагностика"}]:[]),
    {id:"plan",icon:"🗺️",label:"Индивидуальный план обучения"},
    {id:"theory",icon:"📖",label:"Теория"},
    {id:"daily",icon:"📝",label:"Ежедневные задачи"},
    {id:"leaderboard",icon:"🏆",label:"Таблица рейтинга"},
    {id:"friends",icon:"👥",label:"Друзья"},
    {id:"shop",icon:"🛍️",label:"Магазин"},
    {id:"faq",icon:"❓",label:"Частые вопросы"},
    ...(isAdmin?[{id:"admin",icon:"⚙️",label:"Администрирование"}]:[]),
  ];

  const handleNav=id=>{
    setSidebarOpen(false);
    if(id==="diagnostics"){onOpenDiagnostics();return;}
    if(id==="practice"){onOpenPractice();return;}
    if(id==="intermediate"){onOpenIntermediateTests();return;}
    if(id==="plan"){onViewPlan();return;}
    if(id==="theory"){onOpenTheory?.();return;}
    if(id==="daily"){
      // Если у ученика ещё нет ни одного освоенного навыка — показываем
      // модальное окно с прогресс-шагами вместо перехода. Модалка живёт
      // на уровне App.jsx, поэтому работает и из bottom-nav на других экранах.
      if(!masteryStatus.hasMastered){onOpenDailyLockModal?.();return;}
      onOpenDaily?.();return;
    }
    if(id==="faq"){onOpenFaq?.();return;}
    if(id==="leaderboard"){onOpenLeaderboard?.();return;}
    if(id==="friends"){onOpenFriends?.();return;}
    if(id==="shop"){onOpenShop?.();return;}
    if(id==="admin"){onOpenAdmin();return;}
    setActiveSection(id);
  };

  // Профиль теперь открывается не пунктом меню, а кликом по блоку пользователя
  // (внизу сайдбара) и аватару в мобильном топбаре.
  const openProfile=()=>{ setSidebarOpen(false); setActiveSection("profile"); };

  // Кастомный фон из магазина (equipped.background) больше НЕ применяется к
  // дашборду как wallpaper: он делал «Что делать сегодня», приветствие и
  // XP-бар нечитаемыми. Фон живёт только в личном кабинете (карточка героя,
  // см. ProfileSection) и на экране рейтинга.

  return(
    <>
    <div className="dashboard-layout">
      {sidebarOpen&&<div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}
      <div className={`sidebar-backdrop ${sidebarOpen?"visible":""}`} onClick={()=>setSidebarOpen(false)}/>
      <aside className={`dashboard-sidebar ${sidebarOpen?"open":""}`}>
        <div className="sidebar-logo"><Logo size={36} light/></div>
        <nav className="sidebar-nav">
          {navItems.map(item=>{
            // Items also present in the mobile bottom-nav — hide here on mobile to avoid duplication.
            const inBottomNav = ["home","plan","daily","theory","profile"].includes(item.id);
            // Badge для пункта "Ежедневные задачи":
            // 🔒 — нет освоенных навыков; 🔴 — есть задачи на сегодня; ✅ — задачи закрыты сегодня.
            let badge = null;
            if (item.id === "daily") {
              if (!masteryStatus.hasMastered)         badge = <span className="nav-badge nav-badge-lock" aria-label="заблокировано">🔒</span>;
              else if (masteryStatus.hasDueToday)     badge = <span className="nav-badge nav-badge-due" aria-label="есть задачи"/>;
              else if (masteryStatus.completedToday)  badge = <span className="nav-badge nav-badge-done" aria-label="выполнено">✅</span>;
            }
            // Бейдж «Друзья»: число входящих запросов дружбы.
            if (item.id === "friends" && pendingFriendCount > 0) {
              badge = <span aria-label={`${pendingFriendCount} запросов дружбы`} style={{
                background:"#ef4444", color:"#fff", borderRadius:99, fontSize:11, fontWeight:800,
                minWidth:18, height:18, display:"inline-flex", alignItems:"center",
                justifyContent:"center", padding:"0 5px", lineHeight:1,
              }}>{pendingFriendCount}</span>;
            }
            return (
              <button
                key={item.id}
                data-bottom-dup={inBottomNav ? "1" : undefined}
                data-nav-id={item.id}
                className={`sidebar-nav-item ${activeSection===item.id?"active":""}`}
                onClick={()=>handleNav(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                {badge}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user" role="button" tabIndex={0} aria-label="Открыть профиль"
          onClick={openProfile}
          onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProfile();}}}
          style={{cursor:"pointer",borderRadius:12,transition:"background 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";}}
          onMouseLeave={e=>{e.currentTarget.style.background="";}}>
          <LevelRing xp={user?.xp ?? 0} avatarUrl={user?.avatarUrl} equippedFrame={user?.equipped?.frame}
            size={40} label={`${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`} showLevel={!isTeacher} />
          <div style={{flex:1,minWidth:0}}>
            <div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div>
            <div className="sidebar-user-role" style={{color:statusObj.color+"cc"}}>{isAdmin?"Администратор":isTeacher?"Преподаватель":statusObj.label}</div>
            {/* Кристаллы вынесены в единый HUD-чип шапки (TopbarStats) — в сайдбаре дубль убран. */}
          </div>
          <button onClick={e=>{e.stopPropagation();onLogout();}} title="Выйти" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.45)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,flexShrink:0,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.15)";e.currentTarget.style.color="#ef4444";e.currentTarget.style.borderColor="rgba(239,68,68,0.3)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.45)";e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";}}>
            ⎋ Выйти
          </button>
        </div>
      </aside>
      {/* было <main> — демоутнут в <div>: App.jsx даёт единый <main> вокруг блока
          экранов (иначе у dashboard было бы два вложенных <main>). className/CSS целы. */}
      <div className="dashboard-main">
        <div className="mobile-topbar">
          <button className="burger-btn" onClick={()=>setSidebarOpen(true)}>☰</button>
          <Logo size={28} showSubtitle={false}/>
          <span className="mobile-breadcrumb">
            {activeSection==="profile" ? "Профиль" : "Главная"}
          </span>
          <TopbarStats user={user} />
          {/* Аватар-шорткат в профиль — скрыт на самом Профиле (там аватар крупно в теле) */}
          {activeSection !== "profile" && (
            <button onClick={openProfile} aria-label="Профиль" title="Профиль"
              style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0,lineHeight:0,borderRadius:"50%"}}>
              <LevelRing xp={user?.xp ?? 0} avatarUrl={user?.avatarUrl} equippedFrame={user?.equipped?.frame}
                size={30} label={`${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`} showLevel={false} />
            </button>
          )}
        </div>
        <div className="desktop-header-actions"><TopbarStats user={user} /></div>

        {activeSection==="home"&&isInactive&&!isTeacher&&(
          <div style={{maxWidth:520,margin:"80px auto",background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:16,padding:"48px 32px",textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:56,marginBottom:16}}>⛔</div>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:22,color:THEME.primary,marginBottom:12}}>Твой доступ истёк</h2>
            <p style={{color:THEME.textLight,fontSize:15,lineHeight:1.6}}>Обратись к преподавателю для продления.</p>
          </div>
        )}
        {activeSection==="home"&&!(isInactive&&!isTeacher)&&(
          <>
            <div className="dashboard-header" style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div><h1>Добро пожаловать, <span style={{color:THEME.accent}}>{user?.firstName}</span>!</h1><p style={{color:THEME.textLight,marginTop:6}}>{today.toLocaleDateString("ru-RU",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
                <span style={{background:statusObj.color+"18",color:statusObj.color,fontWeight:700,fontSize:13,padding:"6px 16px",borderRadius:99,border:`1px solid ${statusObj.color}30`,alignSelf:"center",display:"inline-flex",alignItems:"center"}}>
                  {statusObj.label}
                  <InfoTooltip text={isSolo
                    ? "Режим обучения «Самостоятельно»: ты занимаешься по своему плану в удобном темпе, без занятий с преподавателем."
                    : isTrial
                    ? "Пробный период: полный доступ к платформе, чтобы попробовать всё."
                    : "Твой текущий тариф обучения."} />
                </span>
              </div>
            </div>

            {/* Баннер триала: показываем ВЕСЬ trial (countdown с 1-го дня), независимо
                от stage — trial про ВРЕМЯ, не про прогресс. Гейт по наличию trialExpiry
                (а не stage==='active'): у новых регистраций оно есть → d осмыслен (7→0);
                у старых аккаунтов без trialExpiry баннер скрыт → нет конфузного «осталось
                0 дней». Enforcement (status==='inactive' → гейт доступа App.jsx:586,
                флип App.jsx:398) — stage-независим и здесь НЕ затронут. */}
            {isTrial&&!isTeacher&&user?.trialExpiry&&(()=>{
              const d=trialDaysLeft??0;
              const plural=(()=>{ const n=Math.abs(d)%100, b=n%10; if(n>10&&n<20)return 'дней'; if(b>1&&b<5)return 'дня'; if(b===1)return 'день'; return 'дней'; })();
              const urgent=d===0, warn=d>0&&d<=3;
              // d=0 → красный + CTA; 1..3 → оранжевое предупреждение; >3 → нейтральный.
              if(urgent){
                // фон #dc2626 (не #ef4444): белый текст на #ef4444 = 3.76 (<AA);
                // на #dc2626 ≈ 4.6 (AA). Conversion-critical призыв trial→оплата.
                return (
                  <div style={{background:"#dc2626",borderRadius:12,padding:"14px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",boxShadow:"0 6px 18px -6px rgba(239,68,68,0.55)"}}>
                    <span style={{fontSize:22}}>⚠️</span>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,color:"#fff",flex:"1 1 auto"}}>
                      Пробный период закончился — оформи подписку, чтобы продолжить
                    </div>
                    {/* openSubscription (см. выше) — канал оплаты WhatsApp с заготовкой
                        имя+класс. onOpenSubscription-проп, если App когда-то протянет, имеет
                        приоритет; иначе прямой wa.me deeplink. */}
                    {/* фон #fffffe (не #fff): белая «пилюля» с красным текстом. В тёмной
                        теме флип-правило index.css:267 ловит `rgb(255,255,255)` и красит фон в
                        #161b22 → красный-на-тёмном 3.58 (<AA). #fffffe визуально белый, но
                        строка rgb(255,255,254) не матчит флип → пилюля остаётся белой →
                        #dc2626-на-белом ≈ 5:1 (AA) в обеих темах. */}
                    <button className="trial-pay-btn" onClick={openSubscription} style={{background:"#fffffe",color:"#dc2626",border:"none",borderRadius:10,padding:"9px 18px",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>
                      Оформить подписку
                    </button>
                  </div>
                );
              }
              const bg=warn?"rgba(249,115,22,0.14)":"rgba(245,158,11,0.12)";
              const bd=warn?"rgba(249,115,22,0.5)":"rgba(245,158,11,0.35)";
              const txt=warn?"#9a3412":"#92400e";
              return (
                <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:12,padding:"14px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <span style={{fontSize:22}}>{warn?"⚠️":"⏳"}</span>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:14,color:txt,flex:"1 1 auto"}}>
                    Пробный период: осталось {d} {plural}
                  </div>
                  {/* «Оплатить сейчас» — оплата ДО истечения trial (опережение). Текст с
                      именем/классом (залогинен). Отличается от «Оформить подписку» в
                      ветке «закончился» (там — необходимость продолжить после конца). */}
                  <button className="trial-pay-btn" onClick={()=>openSubscriptionWhatsApp(user)} style={{marginLeft:"auto",background:txt,color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                    Оплатить сейчас
                  </button>
                </div>
              );
            })()}

            {/* ЭТАП 1 (stage==='new'): одна задача — пройти диагностику. Всё
                остальное (рейтинг/корабль/задания/метрики) скрыто через showFull. */}
            {stage==='new' && (
              <NewUserDashboard user={user} diagPause={diagPause}
                onStart={()=>onStartSmartDiag?.(!!user?.smartDiagNextSection || !!diagPause)} />
            )}

            {/* Блок 1: «Что делать сегодня» — умная карточка с CTA. Скрыта для teacher/admin. */}
            {showFull && !isTeacher && (() => {
              // Приоритет: пауза внутри раздела (localStorage) > раздел из Firestore > свежий старт.
              const hasPartialDiag = !!user?.smartDiagNextSection;
              const hasInSection   = !!diagPause;
              let icon='🎯',
                  text=hasInSection
                       ? `Продолжи раздел ${diagPause.sectionNum} — ${diagPause.qNum} ${pluralize(diagPause.qNum, ['вопрос отвечен','вопроса отвечено','вопросов отвечено'])}`
                       : hasPartialDiag
                       ? `Продолжи диагностику — раздел ${user.smartDiagNextSection}`
                       : 'Пройди диагностику — она определит твой уровень',
                  ctaLabel=hasInSection
                       ? `Продолжить с вопроса ${diagPause.qNum + 1} →`
                       : hasPartialDiag
                       ? `Продолжить раздел ${user.smartDiagNextSection} →`
                       : 'Начать диагностику →',
                  onCta=()=>onStartSmartDiag?.(hasPartialDiag || hasInSection);
              if (user?.smartDiagDone && !masteryStatus.hasMastered) {
                icon='📚'; text='Освой первый навык в индивидуальном плане'; ctaLabel='Перейти к плану →'; onCta=()=>onViewPlan?.();
              } else if (masteryStatus.hasDueToday) {
                icon='📝'; text='Есть задачи для повторения сегодня!'; ctaLabel='Начать разминку →'; onCta=()=>onOpenDaily?.();
              } else if (masteryStatus.hasMastered && !masteryStatus.hasDueToday) {
                icon='✨'; text='Отлично! Продолжай осваивать новые навыки'; ctaLabel='К плану →'; onCta=()=>onViewPlan?.();
              }
              return (
                <div className="dashboard-section" style={{
                  marginBottom:16, padding:'22px 26px',
                  background:`linear-gradient(135deg, ${THEME.primary} 0%, #1e1b4b 100%)`,
                  border:'1px solid rgba(212,175,55,0.25)',
                  color:'#fff',
                  display:'flex', alignItems:'center', gap:20, flexWrap:'wrap',
                }}>
                  <div style={{fontSize:44, lineHeight:1, flexShrink:0}}>{icon}</div>
                  <div style={{flex:'1 1 220px', minWidth:0}}>
                    <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:THEME.accent, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:6}}>Что делать сегодня</div>
                    <div style={{fontSize:16, lineHeight:1.4, color:'#fff', fontWeight:600}}>{text}</div>
                  </div>
                  <button onClick={onCta} style={{
                    background:THEME.accent, color:THEME.onAccent ?? '#0f172a', border:'none', borderRadius:10,
                    padding:'12px 22px', fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:800,
                    cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                    boxShadow:'0 6px 18px -4px rgba(212,175,55,0.5)',
                  }}>{ctaLabel}</button>
                </div>
              );
            })()}

            {/* Умная диагностика — для goals: gaps / future. С появлением этапа
                «new» (NewUserDashboard) эта карточка фактически не рендерится. */}
            {showFull&&!isTeacher&&!isTester&&(user?.goalKey==="gaps"||user?.goalKey==="future")&&!user?.smartDiagDone&&(
              <div data-tour="smart-diag" style={{marginBottom:16}}>
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
                    <button style={{background:THEME.accent,color:THEME.onAccent ?? '#0f172a',border:"none",borderRadius:12,padding:"14px 28px",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                      {user?.smartDiagNextSection?`Начать Раздел ${user.smartDiagNextSection} →`:"Начать →"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Группа «Прогресс»: адаптивная сетка (десктоп — 2 колонки, мобайл — 1). Скрыта для teacher/admin. ── */}
            {showFull && !isTeacher && (
            <div className="progress-grid">
            <div className="pg-col">

            {/* Полоса опыта */}
            <XpBar xp={user?.xp ?? 0} large help={<InfoTooltip text="Опыт за учёбу. Уровень растёт постоянно и не сбрасывается. Подробнее — в Частых вопросах." />} />

            {/* ── ESR Rating: большой FACEIT-style виджет с лигой и тремя рангами. ── */}
            {(() => {
              const myPts  = rankInfo?.myPoints ?? 0;
              const league = getLeague(myPts);
              const wkCh   = rankInfo?.weekChange ?? 0;
              const accent = league.current.color;
              // ЭТАП 2: пока нет ни одного очка — вместо пустого виджета
              // (0 очков, «#—») компактный тизер с понятным следующим шагом.
              if (stage === 'starter' && myPts === 0) {
                return (
                  <div data-tour="esr-widget" style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                    color: '#fff', padding: '20px 24px', borderRadius: 18,
                    border: '1px dashed rgba(167,139,250,0.4)',
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  }}>
                    <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>⭐</div>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: '#a78bfa', marginBottom: 4 }}>ESR Рейтинг</div>
                      <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.5 }}>Реши первые задачи — попадёшь в недельный рейтинг и получишь лигу</div>
                    </div>
                    <button onClick={()=>onViewPlan?.()} style={{
                      background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.45)',
                      borderRadius: 10, padding: '9px 18px', fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>К плану →</button>
                  </div>
                );
              }
              return (
                <div data-tour="esr-widget" style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
                  color: '#fff',
                  padding: '24px 28px',
                  marginBottom: 0,
                  border: `1px solid ${accent}55`,
                  borderRadius: 18,
                  boxShadow: `0 10px 32px -8px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Декоративная иконка в углу */}
                  <div style={{position:'absolute',right:-20,top:-20,fontSize:140,opacity:0.05,lineHeight:1,pointerEvents:'none'}}>
                    {league.current.icon}
                  </div>

                  {/* Header */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:12,flexWrap:'wrap'}}>
                    <div style={{fontSize:11,fontWeight:800,letterSpacing:1.8,textTransform:'uppercase',color:accent,display:'flex',alignItems:'center'}}>
                      ⭐ ESR Рейтинг
                      <InfoTooltip text="Недельный рейтинг. Очки за ежедневные задачи, навыки и диагностику. Сбрасывается каждый понедельник." />
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                      {/* Показываем только положительную динамику; отрицательную/ноль скрываем,
                          а при нулевом рейтинге — мотивирующая подпись вместо красного бейджа. */}
                      {wkCh > 0 ? (
                        <div style={{
                          fontSize:13,fontWeight:700,
                          color:'#10b981',background:'rgba(16,185,129,0.12)',
                          padding:'4px 10px',borderRadius:99,
                        }}>
                          +{wkCh} за неделю ↑
                        </div>
                      ) : myPts === 0 ? (
                        <div style={{fontSize:12,fontWeight:600,color:'rgba(226,232,240,0.6)'}}>
                          Реши задачи — появишься в рейтинге
                        </div>
                      ) : null}
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:'#a78bfa',whiteSpace:'nowrap',lineHeight:1}}>
                        💎 {(user?.crystals ?? 0).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>

                  {/* Big number */}
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:48,fontWeight:800,lineHeight:1,marginBottom:14,letterSpacing:'-1px'}}>
                    {myPts.toLocaleString('ru-RU')}
                  </div>

                  {/* Progress bar */}
                  <div style={{height:8,borderRadius:99,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginBottom:8}}>
                    <div style={{
                      height:'100%',
                      width: `${Math.round(league.progress * 100)}%`,
                      background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                      boxShadow: `0 0 12px ${accent}80`,
                      borderRadius: 99,
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}/>
                  </div>

                  {/* Current league + pts to next */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,fontSize:13,flexWrap:'wrap',gap:8}}>
                    <div style={{color:accent,fontWeight:800,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:18}}>{league.current.icon}</span> {league.current.name}
                    </div>
                    {league.pointsToNext != null
                      ? <div style={{color:'rgba(255,255,255,0.7)',fontWeight:600}}>до {league.nextName}: {league.pointsToNext}</div>
                      : <div style={{color:'rgba(255,255,255,0.7)',fontWeight:600}}>максимальная лига</div>}
                  </div>

                  {/* Three ranks — или призыв, если позиции ещё нет («#—» выглядит
                      как сломанные данные, не показываем) */}
                  {rankInfo?.globalRank != null ? (
                    <div style={{display:'flex',gap:18,flexWrap:'wrap',fontSize:13,color:'rgba(255,255,255,0.85)',marginBottom:16}}>
                      <span style={{whiteSpace:'nowrap'}}>🌍 #{rankInfo.globalRank}{rankInfo?.globalTotal ? ` из ${rankInfo.globalTotal}` : ''}</span>
                      {rankInfo?.gradeRank != null && <span style={{whiteSpace:'nowrap'}}>🏫 #{rankInfo.gradeRank} в классе</span>}
                      {rankInfo?.regionRank != null && <span style={{whiteSpace:'nowrap'}}>📍 #{rankInfo.regionRank} в области</span>}
                    </div>
                  ) : (
                    <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',marginBottom:16}}>
                      🏁 Реши первые задачи на этой неделе — появишься в рейтинге
                    </div>
                  )}

                  {/* CTA — фиксированный золотой стиль: цвет лиги (accent) на
                      Серебре/Алмазе сливался с тёмным фоном виджета */}
                  <button onClick={()=>onOpenLeaderboard?.()} style={{
                    background:'transparent',color:'#fbbf24',
                    border:'1.5px solid #fbbf24',borderRadius:10,
                    padding:'9px 18px',fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,cursor:'pointer',
                    transition:'all 0.2s',
                  }}
                    onMouseEnter={e=>{ e.currentTarget.style.background = 'rgba(251,191,36,0.14)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background = 'transparent'; }}
                  >Посмотреть рейтинг →</button>
                </div>
              );
            })()}

            {/* Прогресс по индивидуальному плану */}
            <div className="dashboard-section" style={{marginBottom:0, padding:'20px 22px'}}>
                <h2 className="section-title" style={{margin:'0 0 12px', display:'flex', alignItems:'center'}}>📊 Прогресс обучения<InfoTooltip text="Каждые 10% освоенных навыков открывают деталь космического корабля. Собери все 10!" /></h2>
                {/* ЭТАП 2: корабль ещё полностью голограмма — поясняем, что это «будущий вид» */}
                {stage==='starter' && masteredCount===0 && !!(user?.smartDiagDone && planSkills?.length) && (
                  <div style={{fontSize:13, color:THEME.textLight, marginBottom:10, display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:16}}>✨</span>
                    Будущий вид твоего корабля. Освой первые навыки — детали начнут материализоваться.
                  </div>
                )}
                <ShipProgress mastered={masteredCount} total={planSkillsTotal} ready={!!(user?.smartDiagDone && planSkills?.length)} uid={firebaseUser?.uid} />
              </div>

            </div>
            <div className="pg-col">

            {/* Задания дня/недели (на этапе 2 недельные скрыты до 1-го дневного) */}
            <QuestsWidget user={user} onUpdateUser={onUpdateUser} starterGate={stage==='starter'} />

            {/* ЭТАП 2: виральность — пригласи друга, пока втягиваешься */}
            {stage==='starter' && (
              <div className="dashboard-section" style={{marginBottom:0, marginTop:16, padding:'18px 22px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap'}}>
                <div style={{fontSize:32, lineHeight:1, flexShrink:0}}>👥</div>
                <div style={{flex:'1 1 180px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.text, marginBottom:3}}>Учиться веселее вместе</div>
                  <div style={{fontSize:12.5, color:THEME.textLight, lineHeight:1.5}}>Пригласи друга — будете соревноваться в собственном рейтинге.</div>
                </div>
                <button onClick={()=>onOpenFriends?.()} style={{
                  background:'rgba(212,175,55,0.12)', color:THEME.accent==='#d4af37'?'#92680e':THEME.accent, border:`1px solid ${THEME.accent}66`,
                  borderRadius:10, padding:'9px 18px', fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap',
                }}>Пригласить друга →</button>
              </div>
            )}

            </div>
            </div>
            )}

            {/* ЭТАП 2: вместо четырёх нулевых метрик — одна понятная цель */}
            {stage==='starter' && (
              <div className="dashboard-section" style={{marginBottom:14, padding:'18px 22px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
                border:`1px solid ${THEME.accent}55`, background:'rgba(212,175,55,0.07)'}}>
                <div style={{fontSize:30, lineHeight:1, flexShrink:0}}>🎯</div>
                <div style={{flex:'1 1 220px'}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.text}}>
                    Сейчас: освой {masteredCount===0?'первый навык':'ещё '+pluralize(3-masteredCount,['навык','навыка','навыка'])} в плане
                  </div>
                  <div style={{fontSize:12.5, color:THEME.textLight, marginTop:3}}>
                    Освоено {masteredCount} из 3 — дальше откроется полный дашборд с метриками
                  </div>
                </div>
                <div style={{display:'flex', gap:5, flexShrink:0}}>
                  {[0,1,2].map(i=>(
                    <span key={i} style={{width:26, height:8, borderRadius:99,
                      background: i<masteredCount ? THEME.accent : 'rgba(148,163,184,0.25)'}}/>
                  ))}
                </div>
              </div>
            )}

            {stage==='active' && (
            <div className="stats-row" style={{marginBottom:14}}>
              {/* «0 активных ДЗ» — мёртвая карточка: показываем только когда
                  ДЗ-функционал реально используется (есть хотя бы одно ДЗ).
                  grid auto-fit растянет оставшиеся карточки на всю ширину. */}
              {!isSolo&&!isInactive&&homework.length>0&&<div className="stat-card"><div className="stat-icon">📚</div><div><div className="stat-value">{homework.filter(h=>new Date(h.dueDate+"T23:59:59")>=today).length}</div><div className="stat-label">активных ДЗ</div></div></div>}
              {/* Освоено навыков — SVG-галочка «рисуется» при загрузке */}
              <div className="stat-card">
                <span className="stat-icon-svg" aria-hidden="true">
                  <svg width="32" height="32" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2" fill="rgba(16,185,129,0.08)"/>
                    <path className="check-path" d="M7 12 l3.5 3.5 L17 8.5" stroke="#10b981" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <div>
                  <div className="stat-value">{masteryStatus?.masteredCount ?? 0}</div>
                  <div className="stat-label">{pluralize(masteryStatus?.masteredCount ?? 0, ['навык освоен','навыка освоено','навыков освоено'])}</div>
                </div>
              </div>
              {/* Streak — огонёк мерцает если >0, тусклый если 0 */}
              {(() => {
                const streakNum = Number(user?.streak ?? 0);
                return (
                  <div className="stat-card">
                    <span className={`stat-icon ${streakNum > 0 ? 'stat-icon-fire' : 'stat-icon-muted'}`} aria-hidden="true">🔥</span>
                    <div>
                      {streakNum > 0 ? (
                        <>
                          <div className="stat-value">{streakNum}</div>
                          <div className="stat-label" style={{display:'inline-flex',alignItems:'center'}}>{pluralize(streakNum, ['день подряд','дня подряд','дней подряд'])}<InfoTooltip text="Дни подряд с активностью. Не прерывай — за длинные серии бонусы." /></div>
                        </>
                      ) : (
                        <>
                          <div className="stat-value" style={{fontSize:15}}>Начни серию</div>
                          <div className="stat-label" style={{display:'inline-flex',alignItems:'center'}}>сегодня<InfoTooltip text="Дни подряд с активностью. Не прерывай — за длинные серии бонусы." /></div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* «0 тем изучено» — скрываем нулевую карточку */}
              {topicsGreen>0&&<div className="stat-card"><div className="stat-icon">📖</div><div><div className="stat-value">{topicsGreen}</div><div className="stat-label">{pluralize(topicsGreen, ['тема изучена','темы изучено','тем изучено'])}</div></div></div>}
            </div>
            )}

            {/* Schedule — пустой календарь скрыт у учеников НА ЛЮБОМ этапе
                (появится, когда учитель назначит занятия). Учитель видит
                всегда — ему нужна кнопка «+ Добавить». */}
            {showFull&&!isSolo&&!isInactive&&(isTeacher||zoomLessons.length>0)&&(
            <div data-tour="next-lesson" className="dashboard-section" style={{marginBottom:18}}>
              <div className="section-title-row">
                <h2 className="section-title">📅 Расписание занятий</h2>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>setWeekOffset(p=>p-1)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.surface,cursor:"pointer",fontSize:14,fontWeight:700,color:THEME.text}}>‹</button>
                  <span style={{fontSize:13,fontWeight:600,color:weekOffset===0?THEME.primary:THEME.textLight,minWidth:160,textAlign:"center"}}>{weekLabel}</span>
                  <button onClick={()=>setWeekOffset(p=>Math.min(0,p+1))} disabled={weekOffset>=0} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.surface,cursor:weekOffset>=0?"not-allowed":"pointer",fontSize:14,fontWeight:700,color:weekOffset>=0?THEME.textLight:THEME.text,opacity:weekOffset>=0?0.4:1}}>›</button>
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
                    <div className="week-day-header"><span className="day-name" style={{color:THEME.textLight}}>{DAY_NAMES_SHORT[idx]}</span><span className={`day-date ${isToday?"today-dot":""}`} style={{color:THEME.text}}>{date.getDate()}</span></div>
                    <div className="day-lessons">
                      {dayLessons.length===0?<div className="no-lessons">—</div>:dayLessons.map((l,li)=>{
                        const stName=isTeacher?(()=>{const s=students.find(s=>s.id===l.studentId);return s?s.firstName+" "+s.lastName[0]+".":null;})():null;
                        const lessonTime=new Date(l.date).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
                        const joinUrl=(isAdmin||isTeacher)?l.zoomStartUrl:l.zoomJoinUrl;
                        const joinable=isJoinable(l);
                        return(
                          <div key={li} className="lesson-block lesson-block-clickable" onClick={()=>setOpenedLesson({lesson:l,date,mode:'board'})} style={{cursor:"pointer",position:"relative",paddingBottom:8}}>
                            <span className="lesson-time">{lessonTime}</span>
                            <span className="lesson-subject">{l.subject||'Занятие'}</span>
                            {stName&&<span style={{display:"block",fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:2,lineHeight:1.3}}>{stName}</span>}
                            <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                              <button className="lesson-action-secondary" onClick={e=>{e.stopPropagation();setOpenedLesson({lesson:l,date,mode:'board'});}}
                                style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:6,border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",cursor:"pointer",lineHeight:1.4}}>
                                🖊️ Доска
                              </button>
                              <button className="lesson-action-secondary" onClick={e=>{e.stopPropagation();setOpenedLesson({lesson:l,date,mode:'notes'});}}
                                style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:6,border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",cursor:"pointer",lineHeight:1.4}}>
                                📋 Запись
                              </button>
                              {joinUrl&&<a href={joinUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
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
            )}
            {/* Homework — пустой блок скрыт у учеников на любом этапе;
                учитель видит всегда (кнопка «+ Добавить ДЗ») */}
            {showFull&&!isSolo&&!isInactive&&(isTeacher||homework.length>0)&&(
            <div data-tour="homework" className="dashboard-section" style={{marginBottom:18}}>
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
                                  <button onClick={()=>saveFeedback(sub.id)} style={{marginTop:8,padding:"7px 18px",borderRadius:8,background:THEME.accent,color:THEME.onAccent ?? '#0f172a',border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>Сохранить</button>
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
            )}
          </>
        )}

        {activeSection==="profile"&&(
          <ProfileSection user={user} statusObj={statusObj} onOpenDiagnostics={onOpenDiagnostics} onViewPlan={onViewPlan} onUpdateUser={onUpdateUser} onOpenShop={onOpenShop}/>
        )}
      </div>

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
    </>
  );
}
