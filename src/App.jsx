import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { ReactFlow, Background, Controls, Panel, useNodesState, useEdgesState, Handle, Position, getBezierPath } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode.jsx';
import MagicEdge  from './MagicEdge.jsx';
import NpcGuide from './components/NpcGuide.jsx';
import './MapStyles.css';
import { useNpc } from './NpcContext.jsx';
import { app, auth, signOut, reauthenticateWithCredential, updatePassword, EmailAuthProvider } from "./lib/firebase";
import EmailAuthScreen from "./components/auth/EmailAuthScreen.jsx";
import AboutLanding from "./screens/AboutLanding.jsx";
import DemoScreen from "./screens/DemoScreen.jsx";
import DemoResultScreen from "./screens/DemoResultScreen.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, addDoc, deleteDoc, onSnapshot, db,
  query, where,
} from "./firestore-rest.js";
import { getContent } from "./lib/contentCache.js";
import { ThemeProvider, useTheme } from "./ThemeContext.jsx";
import Logo from "./components/ui/Logo.jsx";
import MobileBottomNav from "./components/MobileBottomNav.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import { DiagnosticRulesScreen, DiagnosticsScreen, QuestionScreen } from "./screens/DiagnosticsScreens.jsx";
import ReportScreen from "./screens/ReportScreen.jsx";
import UploadAnalysisScreen from "./screens/UploadAnalysisScreen.jsx";
import ExpertReportView from "./screens/ExpertReportView.jsx";
import LandingScreen from "./screens/LandingScreen.jsx";
import RoadmapScreen from "./screens/RoadmapScreen.jsx";
import IntermediateTestsScreen from "./screens/IntermediateTestsScreen.jsx";
import BossFightScreen from "./screens/BossFightScreen.jsx";
import TheoryBrowseScreen from "./screens/TheoryBrowseScreen.jsx";
import DailyTasksScreen from "./screens/DailyTasksScreen.jsx";
import FaqScreen from "./screens/FaqScreen.jsx";
import DailyLockModal from "./components/DailyLockModal.jsx";
import { getAlmatyDateStr } from "./lib/srsUtils.js";
import { generateRoadmap, parseGrade } from "./lib/diagnosticUtils.js";
import { DIFFICULTY_WEIGHTS, escHtml, tgSend } from "./lib/appConstants.js";
import { updateTopicProgress } from "./lib/mathUtils.js";
import IndividualPlanScreen from "./screens/IndividualPlanScreen.jsx";
import SmartDiagRunner from "./components/SmartDiagRunner.jsx";
import SkillMasteryScreen from "./screens/SkillMasteryScreen.jsx";
import PracticeScreen from "./screens/PracticeScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import AdminScreen from "./screens/AdminScreen.jsx";
import LeaderboardScreen from "./screens/LeaderboardScreen.jsx";
import FriendsScreen from "./screens/FriendsScreen.jsx";
import PublicProfileScreen from "./screens/PublicProfileScreen.jsx";
import ShopScreen from "./screens/ShopScreen.jsx";
import { addPoints } from "./lib/pointsUtils.js";
import { addCrystals } from "./lib/crystalsUtils.js";
import { addXp, XP_REWARDS, subscribeXp } from "./lib/levelUtils.js";
import { findAchievement } from "./lib/achievements.js";
import { initDailyQuests, initWeeklyQuests, subscribeQuest } from "./lib/questsUtils.js";
import LevelUpModal from "./components/LevelUpModal.jsx";
import RewardChest from "./components/RewardChest.jsx";
import { getShopItem } from "./lib/shopItems.js";




// ── LEARNING PLAN SERVICE ─────────────────────────────────────────────────────
/**
 * Автоматически генерирует Индивидуальный план обучения и сохраняет его в Firestore.
 *
 * Решает проблему "0 пробелов" при переходе между разделами:
 * загружает ВСЕ ответы умной диагностики из diagnosticResults,
 * объединяет с currentAnswers (полный формат с verticalId) и только
 * потом вызывает generateRoadmap — чтобы ни один раздел не потерялся.
 *
 * Пишет в Firestore:
 *  - individualPlans/{userId}  — план с gamification-статусами модулей
 *  - skillProgress/{userId}    — навыки по зонам (для IndividualPlanScreen)
 *
 * @param {string}  userId
 * @param {Array}   currentAnswers — ответы текущей (последней) сессии, полный формат
 * @param {string}  targetGrade
 * @returns {{ roadmapData, plan }}
 */
async function autoGeneratePlan(userId, currentAnswers, targetGrade) {
  // ── 1. Собираем ВСЕ ответы умной диагностики из Firestore ─────────────────
  // Это исправляет баг "0 пробелов": предыдущие разделы хранятся в Firestore,
  // но НЕ попадают в allAnswersRef SmartDiagRunner при повторном входе.
  const historicalAnswers = [];
  try {
    const snap = await getDocs(query(collection(db, 'diagnosticResults'), where('userId', '==', userId)));
    snap.docs.forEach(d => {
      const r = d.data();
      const isSmartDiag =
        (r.sectionName || '').includes('Умная Диагностика') ||
        (r.sectionId   || '').includes('smartDiag');
      if (!isSmartDiag) return;
      (r.answers || []).forEach(a => historicalAnswers.push(a));
    });
  } catch(e) { console.error('autoGeneratePlan: load history:', e); }

  // currentAnswers обогащены verticalId и skillId — ставим их последними,
  // чтобы дедупликация в generateRoadmap (по skill_id) предпочла более полные данные.
  const allAnswers = [...historicalAnswers, ...currentAnswers];

  // ── 2. Генерируем дорожную карту ──────────────────────────────────────────
  const roadmapData = generateRoadmap(allAnswers, parseGrade(targetGrade)); // БАГ 2 ФИХ

  // ── 3. Собираем skillProgress по зонам ────────────────────────────────────
  const bucket = {};
  for (const ans of allAnswers) {
    const sid = ans.skillId || ans.topic;
    if (!sid) continue;
    if (!bucket[sid]) {
      bucket[sid] = {
        asked: 0, correct: 0,
        grade:    parseGrade(ans.section || ans._grade),
        section:  ans.section || ans._grade || '',
      };
    }
    bucket[sid].asked++;
    if (ans.correct) bucket[sid].correct++;
  }
  const skills = {};
  Object.entries(bucket).forEach(([sid, s]) => {
    const acc = s.asked > 0 ? s.correct / s.asked : 0;
    skills[sid] = {
      zone:      acc >= 0.8 ? 'green' : acc >= 0.5 ? 'yellow' : 'red',
      lastScore: Math.round(acc * 100),
      grade:     s.grade ? `${s.grade} класс` : '',
      section:   s.section,
      updatedAt: new Date().toISOString(),
    };
  });

  // ── 4. Структура IndividualLearningPlan ────────────────────────────────────
  const plan = {
    userId,
    targetGrade,
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
    status:            'ACTIVE',
    total_gap_skills:  roadmapData.total_gap_skills,
    isPerfectStudent:  roadmapData.isPerfectStudent || false,
    currentModuleStep: 1,
    modules:           roadmapData.roadmap,
  };

  // ── 5. Пишем в Firestore (параллельно) ────────────────────────────────────
  await Promise.all([
    setDoc(doc(db, 'individualPlans', userId), plan),
    // полный пересчёт skills из диагностики — map заменяется намеренно (без merge)
    setDoc(doc(db, 'skillProgress',   userId), { skills }),
  ]);

  return { roadmapData, plan };
}

// ── APP ───────────────────────────────────────────────────────────────────────
const QUIZ_PROGRESS_KEY="aapa_quiz_progress";

function AppInner() {
  const { showNpcMessage, startTourIfNew } = useNpc();
  const { theme: THEME } = useTheme();
  const { firebaseUser, profile, loading: authLoading, setProfile } = useAuth();
  const [user,setUser]=useState(()=>{try{const u=localStorage.getItem("aapa_user");return u?JSON.parse(u):null;}catch{return null;}});
  // Path-маршруты публичного лендинга: /about, /landing/parents, /landing/students.
  // Гостю показываем лендинг (форму входа — только по CTA), залогиненному — для шеринга.
  const [aboutRoute,setAboutRoute]=useState(()=>{
    try{
      const p=window.location.pathname||"/";
      if(p.startsWith("/landing/parent"))  return {role:"parent"};
      if(p.startsWith("/landing/student")) return {role:"student"};
      if(p==="/about"||p.startsWith("/about/")) return {role:null};
    }catch{}
    return null;
  });
  // Демо-режим без регистрации: /demo (мини-диагностика) и /demo/result (план).
  const [demoRoute,setDemoRoute]=useState(()=>{
    try{
      const p=window.location.pathname||"/";
      if(p.startsWith("/demo/result")) return {step:"result"};
      if(p.startsWith("/demo"))        return {step:"quiz"};
    }catch{}
    return null;
  });
  // Приглашение в друзья: /invite/{friendCode}. Код кладём в localStorage —
  // гость увидит лендинг с баннером, а после входа/регистрации (или сразу,
  // если уже залогинен) эффект ниже отправит запрос дружбы автоматически.
  const [inviteBanner,setInviteBanner]=useState(()=>{
    try{
      const m=/^\/invite\/(\d{6})$/.exec(window.location.pathname||"");
      if(m){
        localStorage.setItem("aapa_invite_code",m[1]);
        window.history.replaceState(null,"","/");
        return true;
      }
      return !!localStorage.getItem("aapa_invite_code");
    }catch{ return false; }
  });
  const [demoResult,setDemoResult]=useState(()=>{try{const r=localStorage.getItem("demoResult");return r?JSON.parse(r):null;}catch{return null;}});
  const [authFrom,setAuthFrom]=useState(null);
  const [showAuth,setShowAuth]=useState(false);
  // Sync Firestore profile → user; fix landing flicker (bug2) and missing onboarding (bug1).
  // ВАЖНО: всегда мержим свежий profile из Firestore поверх локального state — иначе
  // crystals / inventory / equipped, обновлённые на другом устройстве или через админку,
  // не доедут до этой сессии, и localStorage становится «источником правды» в расхождение
  // с БД. Firestore — single source of truth для покупных полей.
  useEffect(()=>{
    if(!profile) return;
    setUser(prev=>{
      const merged={...(prev||{}), ...profile};
      try{localStorage.setItem("aapa_user",JSON.stringify(merged));}catch{}
      return merged;
    });
    // Bug 2: authenticated user somehow landed on landing (e.g. empty localStorage on load)
    if(screenRef.current==="landing"){
      _setScreen(profile.onboardingDone?"dashboard":"onboarding");
      return;
    }
    // Bug 1: new user after registration goes to dashboard but hasn't done onboarding
    if(!profile.onboardingDone&&screenRef.current==="dashboard"){
      _setScreen("onboarding");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profile]);

  const [screen,setScreen]=useState(()=>{
    const hash=window.location.hash.slice(1);
    if(hash){
      // экраны, требующие авторизации
      const authRequired=["dashboard","plan","practice","admin","diagnostics","theory","daily","intermediate_tests","mastery","boss_fight","report","report_view","smart_diag","quiz_rules","question","upload","roadmap","onboarding","faq","leaderboard","shop","public_profile","friends"];
      try{
        const raw=localStorage.getItem("aapa_user");
        const hasUser=!!raw;
        if(authRequired.includes(hash)&&!hasUser)return "landing";
        // план только если диагностика завершена
        if(hash==="plan"){const u=raw?JSON.parse(raw):null;if(!u?.smartDiagDone)return "dashboard";}
      }catch{}
      return hash;
    }
    try{return localStorage.getItem("aapa_user")?"dashboard":"landing";}catch{return "landing";}
  });
  const [questions,setQuestions]=useState([]);
  const [qIndex,setQIndex]=useState(0);
  // uid открытого публичного профиля. Восстанавливаем из localStorage при
  // прямой загрузке #public_profile — иначе reload даёт белый экран
  // (state потерян, hash не несёт uid).
  const [publicProfileUid,setPublicProfileUid]=useState(()=>{
    try {
      if (window.location.hash === '#public_profile') {
        return localStorage.getItem('aapa_public_profile_uid') || null;
      }
    } catch {}
    return null;
  });
  const [answers,setAnswers]=useState([]);
  const [report,setReport]=useState(null);
  const [lastResultId,setLastResultId]=useState(null);
  const [viewingReport,setViewingReport]=useState(null);
  const [currentSectionName,setCurrentSectionName]=useState("");
  const [pendingSection,setPendingSection]=useState(null);
  const [quizLoading,setQuizLoading]=useState(false);
  const [smartDiagEngineState,setSmartDiagEngineState]=useState(null);
  const [roadmap,setRoadmap]=useState(null);
  // Счётчик для триггера перезапроса rankInfo в DashboardScreen после Daily/Mastery сессий.
  // addPoints обновляет Firestore, но не локальный user.weekPoints — перечитываем леaderboard заново.
  const [rankRefreshKey,setRankRefreshKey]=useState(0);
  const refreshRank=()=>setRankRefreshKey(k=>k+1);
  /* Dashboard's current sub-section (home/profile/...) lives here so
     the bottom-nav can switch it even when we're already on the
     dashboard screen (which wouldn't otherwise re-mount). */
  const [dashSection,setDashSection]=useState(()=>{
    try { return localStorage.getItem("aapa_dashboard_section") || "home"; } catch { return "home"; }
  });
  const navigateDashSection=(s)=>{
    setDashSection(s);
    try { localStorage.setItem("aapa_dashboard_section", s); } catch {}
  };
  // Command palette (⌘K / Ctrl+K)
  const [cmdOpen, setCmdOpen] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const savingDiagRef=useRef(false);

  // NPC: запускаем тур экрана. Зависим от firebaseUser?.uid, чтобы эффект
  // перезапустился когда auth загрузится (иначе тур стартует до того, как
  // NpcContext получит uid, и markTourSeen запишет в legacy-ключ).
  useEffect(()=>{
    if(!firebaseUser?.uid) return;
    if(screen==="plan"){
      // Онбординг: первый заход на план ПОСЛЕ пройденной диагностики — Пиксель
      // показывает карту навыков со spotlight на [data-tour="plan-graph"].
      // Однократно (флаг aapa_npc_skillmap_{uid}). В этот заход общий plan-тур
      // не запускаем, чтобы не конкурировать; он покажется при следующем визите.
      const uid=firebaseUser?.uid;
      const skillmapKey=uid?`aapa_npc_skillmap_${uid}`:null;
      let shownSkillmap=false;
      if(uid && user?.smartDiagDone){
        try{
          if(!localStorage.getItem(skillmapKey)){
            // небольшая задержка — дать карте модулей отрисоваться (подсветка
            // дождётся элемента через MutationObserver, но так надёжнее).
            setTimeout(()=>showNpcMessage("onboard_skillmap",14000,{selector:'[data-tour="plan-graph"]'}),700);
            localStorage.setItem(skillmapKey,"1");
            shownSkillmap=true;
          }
        }catch{}
      }
      if(!shownSkillmap) startTourIfNew("plan");
    }
    if(screen==="theory")     startTourIfNew("theory");
    if(screen==="diagnostics") startTourIfNew("diagnostics");
    // Туры practice и intermediate удалены (академическое наследие, в новом
    // онбординге не нужны). Тур daily временно отключён — TODO: переосмыслить
    // для боссов (структура тура сохранена в npcTours.js).
    // if(screen==="daily")      startTourIfNew("daily");
  },[screen, firebaseUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveQuizProgress=(qs,idx,ans,secName,sec)=>{
    if(!user?.uid)return;
    const safeQs=qs.map(({image,optionImages,...rest})=>rest);
    const local={userPhone:user.phone,questions:safeQs,qIndex:idx,answers:ans,currentSectionName:secName,pendingSection:sec,savedAt:new Date().toISOString()};
    try{localStorage.setItem(QUIZ_PROGRESS_KEY,JSON.stringify(local));}catch{}
    // Firestore: save only IDs (no images) for cross-device resume
    const remote={userPhone:user.phone,questionIds:qs.map(q=>q.id),sectionId:sec?.id||null,qIndex:idx,answers:ans,currentSectionName:secName,pendingSection:sec||null,savedAt:new Date().toISOString()};
    setDoc(doc(db,"quizProgress",user.uid),remote).catch(()=>{});
  };

  const clearQuizProgress=()=>{
    try{localStorage.removeItem(QUIZ_PROGRESS_KEY);}catch{}
    if(user?.uid) deleteDoc(doc(db,"quizProgress",user.uid)).catch(()=>{});
  };

  // Auto-resume saved quiz on mount (localStorage → fast; Firestore → cross-device)
  useEffect(()=>{
    if(!(user?.uid||user?.id))return;
    const _uid=user?.uid||user?.id;
    const tryResume=async()=>{
      // 1. Try localStorage first (same browser, instant)
      try{
        const raw=localStorage.getItem(QUIZ_PROGRESS_KEY);
        if(raw){
          const p=JSON.parse(raw);
          if(p?.userPhone===user.phone&&p?.questions?.length&&p?.qIndex<p.questions.length){
            setQuestions(p.questions);setQIndex(p.qIndex||0);setAnswers(p.answers||[]);
            setCurrentSectionName(p.currentSectionName||"");setPendingSection(p.pendingSection||null);
            setScreen("question");return;
          }
        }
      }catch{}
      // 2. Try Firestore (other device / incognito)
      try{
        const snap=await getDoc(doc(db,"quizProgress",_uid));
        if(!snap.exists())return;
        const p=snap.data();
        if(!p?.userPhone||p.userPhone!==user.phone||!p?.questionIds?.length)return;
        if(p.qIndex>=p.questionIds.length)return; // already finished
        setQuizLoading(true);
        const allSnap=await getDocs(collection(db,"questions"));
        const qMap=Object.fromEntries(allSnap.docs.map(d=>({id:d.id,...d.data()})).map(q=>[q.id,q]));
        const qs=p.questionIds.map(id=>qMap[id]).filter(Boolean);
        setQuizLoading(false);
        if(!qs.length){clearQuizProgress();return;}
        setQuestions(qs);setQIndex(p.qIndex||0);setAnswers(p.answers||[]);
        setCurrentSectionName(p.currentSectionName||"");setPendingSection(p.pendingSection||null);
        setScreen("question");
      }catch(e){setQuizLoading(false);console.warn("resume:",e);}
    };
    tryResume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Проверка истечения статуса/пробного периода при логине.
  // statusExpiry < сегодня → status = 'inactive' (и для trial с trialExpiry).
  useEffect(()=>{
    const _uid=firebaseUser?.uid; if(!_uid) return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",_uid));
        if(!snap.exists()) return;
        const data=snap.data();
        const today=new Date().toISOString().slice(0,10);
        const statusExpired=data.statusExpiry && data.statusExpiry<today && data.status!=='inactive';
        const trialExpired=data.status==='trial' && data.trialExpiry && data.trialExpiry<today;
        if(statusExpired || trialExpired){
          await updateDoc(doc(db,"users",_uid),{status:'inactive'});
          setUser(prev=>{
            const next={...(prev||{}),status:'inactive'};
            try{localStorage.setItem("aapa_user",JSON.stringify(next));}catch{}
            return next;
          });
          setProfile(p=>p?{...p,status:'inactive'}:p);
        }
      }catch(e){console.warn("status expiry check:",e);}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[firebaseUser?.uid]);

  // Синхронизация smartDiag-полей из Firestore при каждом монтировании.
  // Нужно, чтобы сброс флага администратором отражался у залогиненного студента
  // без повторного входа (данные в localStorage могут быть устаревшими).
  useEffect(()=>{
    const _uid=user?.uid||user?.id; if(!_uid)return;
    getDoc(doc(db,"users",_uid)).then(snap=>{
      if(!snap.exists())return;
      const data=snap.data();
      const fresh=data.smartDiagDone??false;
      const freshNextSection=data.smartDiagNextSection||null;
      const freshSections=data.smartDiagSections||[];
      const freshEngineState=data.smartDiagEngineState||null;
      const freshRoadmap=data.smartDiagRoadmap||null;
      // Update engine state in local React state (not stored in localStorage — too large)
      if(freshEngineState) setSmartDiagEngineState(freshEngineState);
      if(freshRoadmap) setRoadmap(freshRoadmap);
      // Update user object with section progress
      const changed=fresh!==!!user.smartDiagDone||freshNextSection!==user.smartDiagNextSection||(JSON.stringify(freshSections)!==JSON.stringify(user.smartDiagSections||[]));
      if(changed){
        const updated={...user,smartDiagDone:fresh,smartDiagNextSection:freshNextSection,smartDiagSections:freshSections};
        setUser(updated);
        try{localStorage.setItem("aapa_user",JSON.stringify(updated));}catch{}
      }
    }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleUpdateUser=u=>{setUser(u);try{localStorage.setItem("aapa_user",JSON.stringify(u));}catch{}};
  const [bossSection,setBossSection]=useState(null);
  const [theorySkillId,setTheorySkillId]=useState(null);
  const [masterySkillId,setMasterySkillId]=useState(null);
  const [masterySkillName,setMasterySkillName]=useState('');
  const [faqInitial,setFaqInitial]=useState(null);
  // Статус "ежедневных задач" — единый источник правды для бейджей в сайдбаре,
  // мобильного bottom-nav и lock-модалки (которая теперь рендерится здесь
  // и потому доступна на любом экране — например, при тапе Daily из Theory).
  const [masteryStatus,setMasteryStatus]=useState({ hasMastered:false, masteredCount:0, hasDueToday:false, completedToday:false });
  const [lockModalOpen,setLockModalOpen]=useState(false);
  // Единая очередь наград (level-up + достижения + квесты). Рендерится ТОЛЬКО
  // голова (rewardCurrent) — два оверлея физически невозможны.
  const [rewardCurrent,setRewardCurrent]=useState(null);
  const [rewardQueue,setRewardQueue]=useState([]);
  const seenAchKeysRef=useRef(new Set());

  const openFaq=(key)=>{setFaqInitial(key||null);navigate("faq");};

  // Один раз при логине читаем skillMastery и считаем три флага: есть ли
  // вообще освоенный навык, есть ли задачи на сегодня, и закрыты ли они.
  useEffect(()=>{
    const uid=firebaseUser?.uid; if(!uid){setMasteryStatus({ hasMastered:false, masteredCount:0, hasDueToday:false, completedToday:false });return;}
    getDoc(doc(db,"skillMastery",uid)).then(snap=>{
      const mastery=snap.exists()?(snap.data().skills||{}):{};
      const today=getAlmatyDateStr(0);
      const mastered=Object.values(mastery).filter(ms=>ms?.stagesCompleted===3);
      const masteredCount=mastered.length;
      const hasMastered=masteredCount>0;
      const hasDueToday=mastered.some(ms=>ms?.next_review_date&&ms.next_review_date<=today);
      const completedToday=hasMastered&&!hasDueToday&&mastered.some(ms=>ms?.lastReviewedAt===today);
      setMasteryStatus({hasMastered,masteredCount,hasDueToday,completedToday});
    }).catch(()=>{});
  },[firebaseUser?.uid]);

  // Инициализация квестов при логине: сброс dailyQuests при смене дня (UTC+5) и
  // weeklyQuests при смене недели. Читаем свежий doc, чтобы решение о сбросе не
  // зависело от устаревшего localStorage, затем мёрджим в user-стейт.
  useEffect(()=>{
    const uid=firebaseUser?.uid; if(!uid) return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        const data=snap.exists()?snap.data():{};
        if(data.role==='parent') return;   // родителю квесты не инициализируем (гейт по свежему getDoc, не по стейту)
        const base={...(user||{}),dailyQuests:data.dailyQuests,weeklyQuests:data.weeklyQuests};
        let u=await initDailyQuests(uid,base);
        u=await initWeeklyQuests(uid,u);
        setUser(prev=>{
          const next={...(prev||{}),dailyQuests:u.dailyQuests,weeklyQuests:u.weeklyQuests};
          try{localStorage.setItem("aapa_user",JSON.stringify(next));}catch{}
          return next;
        });
      }catch(e){console.warn("init quests:",e);}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[firebaseUser?.uid]);

  // Загрузка текущего XP при логине (для XpBar/LevelRing на старте).
  useEffect(()=>{
    const _uid=firebaseUser?.uid; if(!_uid) return;
    getDoc(doc(db,"users",_uid)).then(snap=>{
      if(!snap.exists()) return;
      const x=snap.data().xp;
      if(typeof x!=='number') return;
      setUser(prev=>{
        if(!prev||prev.xp===x) return prev;
        const next={...prev,xp:x};
        try{localStorage.setItem("aapa_user",JSON.stringify(next));}catch{}
        return next;
      });
    }).catch(()=>{});
  },[firebaseUser?.uid]);

  // ── Единая очередь наград ───────────────────────────────────────────────
  const REWARD_PRIORITY={levelup:0,achievement:1,quest:2};
  const enqueueReward=(item)=>setRewardQueue(q=>[...q,item].sort((a,b)=>(REWARD_PRIORITY[a.type]??9)-(REWARD_PRIORITY[b.type]??9)));
  const dismissReward=async()=>{
    const it=rewardCurrent; setRewardCurrent(null);
    // Достижение показано → убрать его ключ из pendingAchievements (read-modify-write:
    // firestore-rest не поддерживает arrayRemove-transform; перечитываем свежий массив,
    // чтобы не затереть начисленное во время сессии).
    if(it && it.type==='achievement' && firebaseUser?.uid){
      try{
        const ref=doc(db,"users",firebaseUser.uid);
        const snap=await getDoc(ref);
        const arr=Array.isArray(snap.data()?.pendingAchievements)?snap.data().pendingAchievements:[];
        if(arr.includes(it.key)) await updateDoc(ref,{pendingAchievements:arr.filter(k=>k!==it.key)});
      }catch(e){console.warn("clear pendingAchievements:",e);}
    }
  };

  // XP-события: живо обновляем user.xp (реактивный XpBar) + level-up в очередь.
  useEffect(()=>{
    const unsub=subscribeXp((p)=>{
      setUser(prev=>{
        if(!prev||prev.xp===p.totalXp) return prev;
        const next={...prev,xp:p.totalXp};
        try{localStorage.setItem("aapa_user",JSON.stringify(next));}catch{}
        return next;
      });
      if(p.leveledUp) enqueueReward({type:'levelup', info:p});
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Выполненные квесты → сундук в очередь.
  useEffect(()=>{
    const unsub=subscribeQuest((q)=> enqueueReward({type:'quest', quest:q}));
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Достижения: читаем pendingAchievements при входе на дашборд (и логине),
  // дедуп по ref, маппим ключи в сундуки.
  useEffect(()=>{
    const _uid=firebaseUser?.uid; if(!_uid || screen!=='dashboard') return;
    getDoc(doc(db,"users",_uid)).then(snap=>{
      const keys=Array.isArray(snap.data()?.pendingAchievements)?snap.data().pendingAchievements:[];
      for(const key of keys){
        if(seenAchKeysRef.current.has(key)) continue;
        const found=findAchievement(key);
        if(!found) continue;
        seenAchKeysRef.current.add(key);
        enqueueReward({type:'achievement', key, ach:found.ach, level:found.level});
      }
    }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen, firebaseUser?.uid]);

  // Берём следующую награду, когда на дашборде и ничего не показано.
  useEffect(()=>{
    if(screen==='dashboard' && !rewardCurrent && rewardQueue.length>0){
      setRewardCurrent(rewardQueue[0]);
      setRewardQueue(q=>q.slice(1));
    }
  },[screen, rewardCurrent, rewardQueue]);

  // Попытка открыть Daily — если ни одного освоенного навыка нет, открываем
  // lock-модалку (то же поведение, что у sidebar в DashboardScreen).
  const tryOpenDaily=React.useCallback(()=>{
    if(!masteryStatus.hasMastered){setLockModalOpen(true);return;}
    navigate("daily");
  },[masteryStatus.hasMastered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Защита роутов для inactive: разрешены только dashboard и faq, всё остальное → dashboard.
  useEffect(()=>{
    if(user?.status!=='inactive') return;
    if(screen==='dashboard' || screen==='faq' || screen==='landing' || screen==='onboarding') return;
    // _setScreen ещё не объявлен здесь — используем setScreen напрямую + history.
    window.history.replaceState({screen:'dashboard'},"","#dashboard");
    setScreen('dashboard');
  },[screen,user?.status]);

  // ── URL / History routing ─────────────────────────────────────────────────
  // Собственный стек навигации (не зависим от browser history stack)
  const customHistory=useRef([]);
  const screenRef=useRef(screen);

  const _setScreen=React.useCallback((s)=>{
    screenRef.current=s;
    // Обновляем URL через replaceState (не pushState) — чисто для обновления страницы
    window.history.replaceState({screen:s},"",s==="landing"?"#":`#${s}`);
    setScreen(s);
  },[]);

  // navigate: вперёд — сохраняем текущий экран в стек
  const navigate=React.useCallback((s)=>{
    customHistory.current.push(screenRef.current);
    _setScreen(s);
  },[_setScreen]);

  // Авто-обработка приглашения /invite/{code}: когда профиль загружен,
  // резолвим код → отправляем запрос дружбы. Если онбординг пройден —
  // сразу ведём в раздел «Друзья» (новичку не ломаем онбординг).
  useEffect(()=>{
    if(!profile?.uid) return;
    let code=null;
    try{ code=localStorage.getItem("aapa_invite_code"); }catch{}
    if(!code) return;
    (async()=>{
      try{
        const { resolveFriendCode, sendFriendRequest } = await import("./lib/friendsUtils.js");
        const toUid = await resolveFriendCode(code);
        if(toUid && toUid!==profile.uid) await sendFriendRequest(profile, toUid);
      }catch(e){ console.warn("[invite] auto-request failed", e); }
      try{ localStorage.removeItem("aapa_invite_code"); }catch{}
      setInviteBanner(false);
      if(profile.onboardingDone) navigate("friends");
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profile?.uid]);

  // goBack: назад — достаём предыдущий экран из стека
  const goBack=React.useCallback((fallback="dashboard")=>{
    const prev=customHistory.current.pop()||fallback;
    _setScreen(prev);
  },[_setScreen]);

  // ── Демо-режим без регистрации ──────────────────────────────────────────
  const startDemo=React.useCallback(()=>{
    setDemoResult(null);
    try{localStorage.removeItem("demoResult");}catch{}
    setDemoRoute({step:"quiz"});
    try{window.history.pushState(null,"","/demo");}catch{}
    window.scrollTo(0,0);
  },[]);
  const finishDemo=React.useCallback((res)=>{
    setDemoResult(res);
    try{localStorage.setItem("demoResult",JSON.stringify(res));}catch{}
    setDemoRoute({step:"result"});
    try{window.history.pushState(null,"","/demo/result");}catch{}
    window.scrollTo(0,0);
  },[]);
  const exitDemo=React.useCallback(()=>{
    setDemoRoute(null);
    try{window.history.pushState(null,"","/");}catch{}
    window.scrollTo(0,0);
  },[]);
  const demoRegister=React.useCallback(()=>{
    setAuthFrom("demo");
    setDemoRoute(null);
    setShowAuth(true);
    try{window.history.replaceState(null,"","#");}catch{}
  },[]);

  // Залогиненный зашёл на /demo — демо ему не нужно, уводим в кабинет.
  useEffect(()=>{
    if(demoRoute&&firebaseUser){
      setDemoRoute(null);
      try{window.history.replaceState(null,"","#dashboard");}catch{}
      _setScreen("dashboard");
    }
  },[demoRoute,firebaseUser,_setScreen]);

  // После авторизации (логин/регистрация из демо) — переносим результаты демо
  // в профиль: users/{uid}.demoCompleted + initialWeakTopics. Один раз.
  useEffect(()=>{
    if(!profile?.uid) return;
    if(profile?.role==='parent') return;   // родителю demo-поля не пишем
    let demo;
    try{const raw=localStorage.getItem("demoResult");demo=raw?JSON.parse(raw):null;}catch{}
    if(!demo) return;
    if(profile.demoCompleted){try{localStorage.removeItem("demoResult");}catch{}return;}
    (async()=>{
      try{
        await updateDoc(doc(db,"users",profile.uid),{
          demoCompleted:true,
          demoCompletedAt:new Date().toISOString(),
          initialWeakTopics:demo.weakTopics||[],
          initialStrongTopics:demo.strongTopics||[],
          demoScore:{correct:demo.correctCount,total:demo.total},
        });
        try{localStorage.removeItem("demoResult");}catch{}
        setProfile&&setProfile({...profile,demoCompleted:true,initialWeakTopics:demo.weakTopics||[]});
      }catch{}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profile?.uid]);

  // Публичный профиль: открыть (с сохранением uid в localStorage для reload)
  // и закрыть (с replace вместо push, чтобы публичный профиль не попадал в стек
  // истории — иначе Back из leaderboard ведёт обратно в public_profile).
  const openPublicProfile=React.useCallback((uid)=>{
    if (!uid) return;
    setPublicProfileUid(uid);
    try { localStorage.setItem('aapa_public_profile_uid', uid); } catch {}
    navigate('public_profile');
  },[navigate]);
  const closePublicProfile=React.useCallback(()=>{
    setPublicProfileUid(null);
    try { localStorage.removeItem('aapa_public_profile_uid'); } catch {}
    // Снимаем stale "leaderboard" с customHistory — он был добавлен
    // navigate('public_profile') при открытии (там push'ится screenRef.current,
    // который был leaderboard). Без pop первый клик ← Назад на leaderboard
    // пытается уйти на ту же leaderboard — визуально клик не работает.
    if (customHistory.current[customHistory.current.length - 1] === 'leaderboard') {
      customHistory.current.pop();
    }
    // Явно заменяем текущую запись браузерной истории (вместо push), чтобы
    // public_profile не попадал в browser back-стек: следующее нажатие Back
    // в leaderboard уведёт на dashboard, а не обратно в публичный профиль.
    try { window.history.replaceState(null, '', '#leaderboard'); } catch {}
    _setScreen('leaderboard');
  },[_setScreen]);

  // Перехват кнопки «Назад» браузера через sentinel-запись
  useEffect(()=>{
    // Одна pushState запись — «пробка». Всегда находимся «поверх» неё.
    window.history.pushState({_sentinel:true},"");
    const onPop=()=>{
      // Пользователь нажал браузерный Back — возвращаем sentinel и идём назад в нашем стеке
      window.history.pushState({_sentinel:true},"");
      const prev=customHistory.current.pop()||"dashboard";
      _setScreen(prev);
    };
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleRegister=u=>{setUser(u);try{localStorage.setItem("aapa_user",JSON.stringify(u));}catch{}navigate(u.onboardingDone?"dashboard":"onboarding");}; // TODO(cleanup): remove after full localStorage→Firebase migration
  const handleLogout=()=>{
    signOut(auth).catch(()=>{});  // Firebase Auth sign out (no-op if not signed in via Firebase)
    setUser(null);
    clearQuizProgress();
    try{localStorage.removeItem("aapa_user");}catch{}
    customHistory.current=[];
    _setScreen("landing");
  };
  const goHome=()=>navigate("dashboard");
  const viewPlan=()=>{
    if(!user?.smartDiagDone){
      alert("Сначала нужно пройти диагностику полностью.\n\nПосле того как все разделы будут пройдены, откроется индивидуальный план обучения.");
      return;
    }
    navigate("plan");
  };
  const openAdmin=()=>navigate("admin");
  const openDiagnostics=()=>navigate("diagnostics");
  const openPractice=()=>navigate("practice");
  const openIntermediateTests=()=>navigate("intermediate_tests");
  const openReport=r=>{setViewingReport(r);navigate("report_view");};

  // Step 1: load questions & go to rules screen
  const startQuiz=async(section)=>{
    // Умная диагностика — передаём управление SmartDiagRunner
    if(section?._smartDiag){
      setPendingSection(section);
      setCurrentSectionName("Умная Диагностика");
      // Если продолжаем с сохранённого места — загружаем состояние движка из Firestore
      if(section._continueSection && user?.uid && !smartDiagEngineState){
        setQuizLoading(true);
        try{
          const snap=await getDoc(doc(db,"users",user.uid));
          if(snap.exists()) setSmartDiagEngineState(snap.data().smartDiagEngineState||null);
        }catch(e){console.error("load engine state:",e);}
        setQuizLoading(false);
      }
      setScreen("smart_diag");
      return;
    }

    setQuizLoading(true);
    let qs=[];
    let loadFailed=false;
    try{
      qs=await getContent("questions");
      if(section) qs=qs.filter(q=>q.sectionId===section.id);
      else if(user?.goalKey) qs=qs.filter(q=>(q.goals||[]).includes(user.goalKey));
    }catch{ loadFailed=true; }
    setQuizLoading(false);
    if(loadFailed){ alert("Ошибка загрузки вопросов. Проверьте соединение и попробуйте снова."); return; }
    if(qs.length===0){ alert("В этом разделе пока нет вопросов. Попробуйте позже."); return; }
    setQuestions(qs);
    setCurrentSectionName(section?.name||"");
    setPendingSection(section||null);
    setQIndex(0);setAnswers([]);
    setScreen("quiz_rules");
  };

  // Step 2: actually begin after user confirms on rules screen
  const beginQuiz=()=>{
    saveQuizProgress(questions,0,[],currentSectionName,pendingSection);
    setScreen("question");
  };

  // Завершение одного раздела умной диагностики — сохраняем состояние и возвращаемся в дашборд
  const finishDiagnosticSection=async(sectionAnswers, engineState, sectionNum, stackSize)=>{
    // 1. Сохраняем результаты раздела в Firestore
    try{
      const correct=sectionAnswers.filter(a=>a.correct).length;
      const totalTime=sectionAnswers.reduce((s,a)=>s+(a.timeSpent||0),0);
      await addDoc(collection(db,"diagnosticResults"),{
        userId:user?.uid,
        userPhone:user?.phone,
        userName:`${user?.firstName} ${user?.lastName}`,
        sectionId:`smartDiag_section${sectionNum}`,
        sectionName:`Умная Диагностика — Раздел ${sectionNum}`,
        completedAt:new Date().toISOString(),
        totalQuestions:sectionAnswers.length,
        correctAnswers:correct,
        totalTime,
        answers:sectionAnswers.map(a=>({topic:a.topic,section:a.section,_grade:a._grade,skillId:a.skillId,verticalId:a.verticalId,correct:a.correct,difficulty:a.difficulty||"A",confidence:a.confidence,timeSpent:a.timeSpent}))
      });
      if(user?.uid){
        addPoints(user.uid,'diagnostic_done',user);
        addCrystals(user.uid,20,'diagnostic_done');
        addXp(user.uid,XP_REWARDS.diagnostic_section,'diagnostic_section',user);
      }
    }catch(e){console.error("section results save:",e);}

    // 2. Сохраняем состояние движка и прогресс разделов в Firestore
    const nextSection=sectionNum+1;
    const newSections=[...(user?.smartDiagSections||[]),sectionNum];
    if(user?.uid){
      try{
        await updateDoc(doc(db,"users",user.uid),{
          smartDiagEngineState:engineState,
          smartDiagNextSection:nextSection,
          smartDiagSections:newSections,
        });
      }catch(e){console.error("section state save:",e);}
    }

    // 3. Пересчитываем индивидуальный план со ВСЕМИ накопленными разделами.
    // autoGeneratePlan сам загружает все сохранённые разделы из diagnosticResults,
    // поэтому передаём пустой массив currentAnswers (текущий раздел уже записан выше).
    if(user?.uid){
      try{
        const { roadmapData } = await autoGeneratePlan(user.uid, [], user.details);
        setRoadmap(roadmapData);
        // stackSize===0 означает что навыков для проверки больше нет — диагностика полностью завершена
        if(stackSize===0){
          await updateDoc(doc(db,"users",user.uid),{smartDiagDone:true,smartDiagRoadmap:roadmapData});
        }
      }catch(e){console.error("autoGeneratePlan after section:",e);}
    }

    // 4. Обновляем локальный стейт пользователя
    setSmartDiagEngineState(engineState);
    const updated={...user,smartDiagNextSection:nextSection,smartDiagSections:newSections};
    setUser(updated);
    try{localStorage.setItem("aapa_user",JSON.stringify(updated));}catch{}
    // НЕ вызываем setScreen("dashboard") — переход на дашборд делает кнопка "На главный экран" через onStop
  };

  const finishDiagnostic=async(next)=>{
      if(savingDiagRef.current)return;
      savingDiagRef.current=true;
      clearQuizProgress();
      setReport({answers:next});
      // Переход на следующий экран — СРАЗУ, до медленных операций (Firestore +
      // autoGeneratePlan + Telegram могут занимать 10-30 сек). Раньше setScreen
      // стоял в конце, и пользователь видел зависший question-фон после исчезновения NPC.
      // RoadmapScreen толерантен к пустому roadmap (`roadmap || {}`);
      // UploadAnalysisScreen от плана вообще не зависит.
      const isSmartDiagFinal=next.some(a=>a.verticalId)||!!pendingSection?._smartDiag;
      setScreen(isSmartDiagFinal?"roadmap":"upload");
      // Сохранение в Firestore, autoGeneratePlan, Telegram-логи и начисление очков — в фон.
      void (async()=>{
      try{
        const correct=next.filter(a=>a.correct).length;
        const totalTime=next.reduce((s,a)=>s+(a.timeSpent||0),0);
        const weakTopics=next.filter(a=>!a.correct).map(a=>({topic:a.topic,section:a.section}));
        const scoringEntries=next.flatMap(a=>a.type==="compound"&&a.subResults?.length?a.subResults.map(sr=>({correct:sr.correct,difficulty:sr.difficulty||"A"})):[{correct:a.correct,difficulty:a.difficulty||"A"}]);
        const totalWeight=scoringEntries.reduce((s,e)=>s+(DIFFICULTY_WEIGHTS[e.difficulty]||1),0);
        const earnedWeight=scoringEntries.filter(e=>e.correct).reduce((s,e)=>s+(DIFFICULTY_WEIGHTS[e.difficulty]||1),0);
        const score=totalWeight>0?Math.round(earnedWeight/totalWeight*100):0;
        const ref=await addDoc(collection(db,"diagnosticResults"),{
          userId:user?.uid,
          userPhone:user?.phone,
          userName:`${user?.firstName} ${user?.lastName}`,
          sectionId:pendingSection?._smartDiag?`smartDiag_final`:(pendingSection?.id||null),
          sectionName:currentSectionName||[...new Set(next.map(a=>a.section).filter(Boolean))].join(", ")||"Общая диагностика",
          completedAt:new Date().toISOString(),
          totalQuestions:next.length,
          correctAnswers:correct,
          score,
          totalTime,
          weakTopics,
          answers: next.map(a=>({topic:a.topic,section:a.section,_grade:a._grade,skillId:a.skillId,verticalId:a.verticalId,correct:a.correct,difficulty:a.difficulty||"A",confidence:a.confidence,timeSpent:a.timeSpent}))
        });
        setLastResultId(ref.id);
        // diagnostic_done: для умной диагностики очки/кристаллы уже начисляются
        // за каждый раздел в finishDiagnosticSection — здесь начисляем только для
        // обычной, чтобы не двойного-начислять финальный раздел умной.
        if(user?.uid && !pendingSection?._smartDiag){
          addPoints(user.uid,'diagnostic_done',user);
          addCrystals(user.uid,20,'diagnostic_done');
          addXp(user.uid,XP_REWARDS.diagnostic_section,'diagnostic_section',user);
        }
        // Если умная диагностика — генерируем дорожную карту и помечаем как пройденную
        if((next.some(a=>a.verticalId)||pendingSection?._smartDiag) && user?.uid){
          try{
            // autoGeneratePlan: загружает ВСЕ разделы из Firestore, генерирует
            // roadmap + записывает individualPlans + skillProgress за один вызов
            // Передаём пустой массив — все ответы уже записаны в diagnosticResults,
            // autoGeneratePlan сам их загрузит (включая текущую сессию, записанную выше).
            const { roadmapData } = await autoGeneratePlan(user.uid, [], user.details);
            setRoadmap(roadmapData);
            await updateDoc(doc(db,"users",user.uid),{smartDiagDone:true,smartDiagRoadmap:roadmapData});
            const updated={...user,smartDiagDone:true};
            setUser(updated);
            try{localStorage.setItem("aapa_user",JSON.stringify(updated));}catch{}
          }catch(e){console.error("smartDiagDone:",e);}
        }
        // Обновить прогресс по темам
        updateTopicProgress(user?.phone, next).catch(e=>console.error("progress:",e));
        // Уведомление в Telegram — разбиваем на чанки, чтобы не превысить лимит 4096 символов
        // Определяем тип диагностики по данным ответов:
        // у умной диагностики все ответы имеют поле verticalId (ставит DiagnosticEngine).
        const isSmartDiag=next.some(a=>a.verticalId)||!!pendingSection?._smartDiag;
        // Для умной диагностики строим разбивку по вертикальным линиям
        let verticalBreakdown="";
        if(isSmartDiag){
          const vertMap={};
          next.forEach(a=>{
            const vid=a.verticalId||a.section||"—";
            if(!vertMap[vid]) vertMap[vid]={correct:0,total:0};
            vertMap[vid].total++;
            if(a.correct) vertMap[vid].correct++;
          });
          verticalBreakdown="\n📐 <b>По вертикалям:</b>\n"+Object.entries(vertMap).map(([vid,s])=>{
            const pct=Math.round(s.correct/s.total*100);
            const bar=pct>=70?"🟢":pct>=40?"🟡":"🔴";
            return `  ${bar} ${escHtml(vid)}: ${s.correct}/${s.total} (${pct}%)`;
          }).join("\n");
        }
        const summary=[
          isSmartDiag?`🧠 <b>Умная Диагностика завершена</b>`:`📊 <b>Диагностика завершена</b>`,
          `👤 <b>${escHtml(user?.firstName)} ${escHtml(user?.lastName)}</b> (${escHtml(user?.phone)})`,
          `🎯 ${escHtml(user?.goal)} · ${escHtml(user?.details)}`,
          isSmartDiag?`📚 Раздел: <b>Умная Диагностика</b>`:`📚 Раздел: <b>${escHtml(currentSectionName||"—")}</b>`,
          `✅ Результат: <b>${score}%</b> (${correct}/${next.length})`,
          `⏱ Время: ${Math.floor(totalTime/60)}м ${totalTime%60}с`,
          verticalBreakdown,
        ].filter(Boolean).join("\n");
        await tgSend(summary);
        // Send answers in chunks to stay under Telegram's 4096-char limit
        const MAX=3800;
        // Для умной диагностики: шаги движка отправляем все разом после завершения
        if(isSmartDiag){
          const flushSmart=async(c)=>{try{await tgSend(c);}catch(e){console.warn("smart chunk:",e);}};
          let smartChunk="";
          for(let i=0;i<next.length;i++){
            const a=next[i];
            const d=a._engineDebug||{};
            const icon=a.correct?"✅":"❌";
            const resultTxt=a.correct?"Верно":"Неверно";
            const entry=[
              `\nШаг ${i+1} / ${next.length}`,
              `👤 ${icon} Ответ: ${resultTxt} | Тема: ${escHtml(a.topic||"—")} | Класс: ${escHtml(a._grade||a.section||"—")} | Увер: ${a.confidence??"-"}/5 | ${a.timeSpent||0}с`,
              `⚙️ 🔄 ${escHtml(d.skillStatusLine||"—")}`,
              `📍 Вертикаль: ${escHtml(d.verticalName||"—")} (остаток: ${d.availableCount??"-"})`,
              `🧠 ${escHtml(d.selectionReasonRu||"—")}`,
            ].join("\n");
            if(smartChunk.length+entry.length>MAX){await flushSmart(smartChunk);smartChunk=entry;}
            else smartChunk+=entry;
          }
          if(smartChunk)await flushSmart(smartChunk);
        } else {
        let chunk=`📝 <b>Ответы:</b>`;
        const flushChunk=async(c)=>{ try{ await tgSend(c); }catch(e){ console.warn("chunk send:",e); } };
        for(let i=0;i<next.length;i++){
          const a=next[i];
          let entry;
          if(a.type==="compound"){
            let subLines;
            if((a.subResults||[]).length>0){
              subLines=a.subResults.map((sr,si)=>{
                const lines=[];
                lines.push(`   Под-вопрос ${si+1}: ${sr.correct?"✅":"❌"} <b>${escHtml(sr.text||"")}</b>`);
                if((sr.options||[]).length>0){
                  const optsStr=sr.options.map((o,oi)=>`${String.fromCharCode(1040+oi)}) ${escHtml(o)}`).join(" | ");
                  lines.push(`      📋 ${optsStr}`);
                }
                if(sr.selectedIdx!=null&&(sr.options||[]).length>sr.selectedIdx){
                  const selLetter=String.fromCharCode(1040+sr.selectedIdx);
                  const corrLetter=sr.correctIdx!=null?String.fromCharCode(1040+sr.correctIdx):null;
                  const wrongNote=!sr.correct&&corrLetter?` (верно: ${corrLetter})`:""
                  lines.push(`      ➤ Выбрано: <b>${selLetter}) ${escHtml(sr.options[sr.selectedIdx])}</b>${wrongNote}`);
                }
                if((sr.skillNames||[]).length>0) lines.push(`      🎯 Навык: ${escHtml(sr.skillNames.join(", "))}`);
                return lines.join("\n");
              }).join("\n");
            } else {
              const parts=(a.selectedAnswer||"").split(" | ");
              subLines=parts.map((part,si)=>`   Под-вопрос ${si+1}: ${escHtml(part)}`).join("\n");
            }
            entry=[
              `\n${i+1}. ${a.correct?"✅":"❌"} <b>${escHtml(a.topic)}</b> [${escHtml(a.section)}] (составной)`,
              a.questionText?`   📝 <i>${escHtml(a.questionText.slice(0,200))}</i>`:null,
              subLines,
              `   ⏱ ${a.timeSpent}с | Увер: ${a.confidence??"-"}/5`,
            ].filter(Boolean).join("\n");
          } else {
          const optionsLine=(a.options||[]).length>0?`   📋 Варианты: ${a.options.map((o,oi)=>String.fromCharCode(1040+oi)+") "+o).join(" | ")}`:null;
          const skillsLine=(a.skillNames||[]).length>0?`   🎯 Навыки: ${a.skillNames.join(", ")}`:null;
          entry=[
            `\n${i+1}. ${a.correct?"✅":"❌"} <b>${escHtml(a.topic)}</b> [${escHtml(a.section)}]`,
            a.questionText?`   📝 <i>${escHtml(a.questionText.slice(0,300))}</i>`:null,
            optionsLine?`   ${escHtml(optionsLine.trim())}`:null,
            `   ➤ Выбрано: <b>${escHtml(a.selectedAnswer||"—")}</b> | Увер: ${a.confidence??"-"}/5 | ${a.timeSpent}с`,
            skillsLine?`   ${escHtml(skillsLine.trim())}`:null,
          ].filter(Boolean).join("\n");
          }
          if(chunk.length+entry.length>MAX){
            await flushChunk(chunk);
            chunk=entry;
          } else {
            chunk+=entry;
          }
        }
        if(chunk) await flushChunk(chunk);
        } // end else (regular diag)
      }catch(e){console.error("Ошибка сохранения:",e);}
      savingDiagRef.current=false;
      })();
  };

  const handleAnswer=async data=>{
    const next=[...answers,data];
    setAnswers(next);
    if(qIndex+1<questions.length){
      setQIndex(qIndex+1);
      saveQuizProgress(questions,qIndex+1,next,currentSectionName,pendingSection);
    } else {
      await finishDiagnostic(next);
    }
  };

  const handleStopQuiz=async()=>{
    if(!confirm(`Завершить диагностику досрочно?\nОтветы на пройденные вопросы (${answers.length} из ${questions.length}) будут сохранены.`))return;
    if(answers.length===0){clearQuizProgress();setScreen("diagnostics");return;}
    await finishDiagnostic(answers);
  };

  const handlePauseQuiz=()=>{
    saveQuizProgress(questions,qIndex,answers,currentSectionName,pendingSection);
    setScreen("dashboard");
  };

  // ── Защита маршрутов через Firebase Auth ────────────────────────────────
  if (authLoading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:THEME.bg}}>
      <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:THEME.primary,fontSize:16}}>Загрузка...</div>
    </div>
  );
  // Гость: демо-режим без регистрации (/demo · /demo/result), затем лендинг.
  if (!firebaseUser) {
    if (demoRoute?.step==="result") return <DemoResultScreen result={demoResult} onRegister={demoRegister} onRestart={startDemo} onExit={exitDemo}/>;
    if (demoRoute?.step==="quiz")   return <DemoScreen onFinish={finishDemo} onExit={exitDemo}/>;
    if (showAuth) return <EmailAuthScreen from={authFrom} onSuccess={(res)=>{setAboutRoute(null);setDemoRoute(null);_setScreen(res?.isNewUser?'onboarding':'dashboard');}} onBack={()=>{setShowAuth(false);setAuthFrom(null);}}/>;
    return <AboutLanding initialRole={aboutRoute?.role ?? null} onStart={()=>setShowAuth(true)} onDemo={startDemo} invitePending={inviteBanner}/>;
  }
  // Залогинен, но открыт публичный лендинг (/about · /landing/*) — показываем для шеринга.
  if (aboutRoute) {
    return <AboutLanding user={user} initialRole={aboutRoute.role}
      onStart={()=>{setAboutRoute(null);try{window.history.replaceState(null,'','#dashboard');}catch{}_setScreen('dashboard');}}
      onDashboard={()=>{setAboutRoute(null);try{window.history.replaceState(null,'','#dashboard');}catch{}_setScreen('dashboard');}}/>;
  }

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${THEME.bg};-webkit-font-smoothing:antialiased;color:${THEME.text};font-family:'Inter',sans-serif;}
        .split-layout{display:flex;min-height:100vh;}
        .split-left{flex:1.1;background:${THEME.surface};padding:60px 80px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid ${THEME.border};}
        .split-right{flex:1;display:flex;align-items:center;justify-content:center;padding:60px;background:${THEME.bg};}
        .hero-title{font-family:'Montserrat',sans-serif;font-size:44px;font-weight:800;line-height:1.15;margin-bottom:24px;color:${THEME.primary};letter-spacing:-1.5px;}
        .hero-subtitle{font-size:17px;line-height:1.7;color:${THEME.textLight};margin-bottom:50px;max-width:520px;}
        .form-card{width:100%;max-width:480px;background:#fff;padding:40px;border-radius:16px;border:1px solid ${THEME.border};box-shadow:0 15px 35px -5px rgba(10,25,47,0.03);}
        .form-header{margin-bottom:32px;text-align:center;}
        .form-header h2{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:800;color:${THEME.primary};}
        .form-header p{color:${THEME.textLight};font-size:14px;margin-top:6px;}
        .form-row{display:flex;gap:16px;margin-bottom:20px;}
        .input-group{margin-bottom:20px;flex:1;}
        .input-label{display:block;margin-bottom:8px;font-size:12px;font-weight:700;color:${THEME.textLight};text-transform:uppercase;letter-spacing:1px;}
        .input-field{width:100%;padding:14px 16px;border-radius:8px;border:1px solid ${THEME.border};background:${THEME.bg};font-size:15px;outline:none;transition:all 0.2s;font-family:'Inter',sans-serif;}
        .theory-rich-text h2{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:${THEME.primary};margin:16px 0 8px;}
        .theory-rich-text h3{font-family:'Montserrat',sans-serif;font-size:17px;font-weight:700;color:${THEME.primary};margin:12px 0 6px;}
        .theory-rich-text ul{padding-left:24px;margin:8px 0;}
        .theory-rich-text ol{padding-left:24px;margin:8px 0;}
        .theory-rich-text li{margin-bottom:4px;}
        .theory-rich-text hr{border:none;border-top:2px solid ${THEME.border};margin:20px 0;}
        .theory-rich-text b,.theory-rich-text strong{font-weight:700;color:${THEME.primary};}
        .theory-rich-text p{margin:4px 0;}
        .input-field:focus{border-color:${THEME.primary};background:#fff;}
        .cta-button{width:100%;padding:16px 24px;border-radius:8px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:15px;text-align:center;border:none;background:${THEME.border};color:${THEME.textLight};transition:all 0.3s;letter-spacing:0.2px;cursor:default;}
        .cta-button.active{background:${THEME.accent};color:${THEME.onAccent ?? '#0f172a'};cursor:pointer;box-shadow:0 10px 20px -5px rgba(10,25,47,0.3);}
        .cta-button.active:hover{transform:translateY(-1px);}
        .benefits-list{display:flex;flex-direction:column;gap:28px;margin-bottom:60px;}
        .benefit-item{display:flex;gap:20px;align-items:flex-start;}
        .benefit-item .icon{font-size:24px;background:${THEME.bg};padding:14px;border-radius:12px;border:1px solid ${THEME.border};}
        .trust-badge{display:inline-flex;align-items:center;gap:12px;background:${THEME.bg};padding:12px 24px;border-radius:99px;border:1px solid ${THEME.border};}
        .question-container{max-width:800px;margin:0 auto;padding:40px 20px;}
        .modern-timer{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid ${THEME.border};padding:10px 20px;border-radius:99px;font-weight:700;font-family:'Montserrat',sans-serif;font-size:15px;}
        .pulse-dot{width:8px;height:8px;background:${THEME.error};border-radius:50%;animation:pulse 2s infinite;}
        .progress-bar-container{width:100%;height:6px;background:${THEME.border};border-radius:99px;overflow:hidden;margin-bottom:32px;}
        .progress-bar-fill{height:100%;background:${THEME.primary};transition:width 0.4s;}
        .question-meta{display:flex;justify-content:space-between;margin-bottom:20px;align-items:center;flex-wrap:wrap;gap:8px;}
        .badge{background:${THEME.primary};color:${THEME.accent};padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;text-transform:uppercase;}
        .type-badge{padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;text-transform:uppercase;}
        .type-badge.type-mcq{background:"rgba(99,102,241,0.1)";color:"#4338ca";background:rgba(99,102,241,0.1);color:#4338ca;}
        .type-badge.type-multiple{background:rgba(16,185,129,0.1);color:#065f46;}
        .type-badge.type-matching{background:rgba(245,158,11,0.1);color:#92400e;}
        .question-text{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:800;line-height:1.4;margin-bottom:40px;color:${THEME.primary};}
        .options-grid{display:flex;flex-direction:column;gap:14px;margin-bottom:24px;background:${THEME.surface}dd;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.3);padding:20px 24px;}
        .option-card{display:flex;align-items:center;padding:18px 22px;background:${THEME.surface};border:1px solid ${THEME.border};border-radius:12px;cursor:pointer;transition:all 0.2s;color:${THEME.text};}
        .option-card:hover:not(.disabled){border-color:${THEME.primary};background:${THEME.bg};}
        .option-card.selected{border-color:${THEME.primary};background:${THEME.bg};border-width:2px;}
        .option-card.correct{border-color:${THEME.success};background:#ecfdf5;border-width:2px;}
        .option-card.wrong{border-color:${THEME.error};background:#fef2f2;border-width:2px;}
        .option-card.disabled{opacity:0.5;pointer-events:none;}
        .option-letter{width:36px;height:36px;background:${THEME.bg};border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;margin-right:20px;flex-shrink:0;}
        .option-content{font-size:16px;font-weight:600;flex:1;}
        .confidence-section{background:${THEME.surface}dd;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid ${THEME.border};padding:28px;border-radius:16px;margin-bottom:24px;color:${THEME.text};box-shadow:0 4px 24px rgba(0,0,0,0.3);}
        .confidence-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;}
        .conf-btn{flex:1;padding:12px 8px;border:1px solid ${THEME.border};border-radius:10px;background:${THEME.surface};color:${THEME.text};cursor:pointer;font-weight:600;font-family:'Inter',sans-serif;min-width:100px;}
        .report-container{max-width:760px;margin:40px auto;padding:0 20px 40px;}
        .report-header-card{background:#fff;padding:32px;border-radius:16px;border:1px solid ${THEME.border};margin-bottom:32px;}
        .report-hero-compact{display:flex;align-items:center;gap:24px;}
        .score-badge{width:90px;height:90px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;flex-shrink:0;}
        .results-list-modern{background:#fff;border-radius:16px;border:1px solid ${THEME.border};padding:32px;}
        .result-card-modern{border-radius:12px;border:1px solid ${THEME.border};background:${THEME.bg};margin-bottom:12px;padding:16px 20px;}
        .result-card-modern.red{border-left:4px solid ${THEME.error};}
        .result-card-modern.yellow{border-left:4px solid ${THEME.warning};}
        .result-card-modern.green{border-left:4px solid ${THEME.success};}
        .card-main{display:flex;justify-content:space-between;align-items:center;gap:16px;}
        .topic-name{font-size:16px;font-weight:700;color:${THEME.primary};}
        .status-text{display:block;font-size:14px;font-weight:700;margin-bottom:4px;}
        .meta-text{font-size:12px;color:${THEME.textLight};}
        .section-badge{background:${THEME.primary};color:${THEME.accent};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;margin-right:10px;text-transform:uppercase;}
        .status-info{text-align:right;}
        .path-container{max-width:1000px;margin:40px auto;padding:0 20px 40px;}
        .path-header{text-align:center;margin-bottom:48px;}
        .path-visualization-modern{background:${THEME.primary};border-radius:24px;padding:50px 40px;overflow-x:auto;}
        .dashboard-layout{display:flex;min-height:100vh;background:${THEME.bg};}
        .dashboard-sidebar{width:268px;background:${THEME.primary};display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:20;transition:transform 0.3s;overflow-y:auto;}
        .sidebar-logo{padding:28px 24px 24px;border-bottom:1px solid rgba(255,255,255,0.08);}
        .sidebar-nav{flex:1;padding:16px 12px;display:flex;flex-direction:column;gap:4px;}
        .sidebar-nav-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,0.55);font-family:'Inter',sans-serif;font-size:14px;font-weight:500;cursor:pointer;text-align:left;width:100%;transition:all 0.2s;line-height:1.4;}
        .sidebar-nav-item:hover{background:rgba(255,255,255,0.09);color:#fff;}
        .sidebar-nav-item.active{background:rgba(212,175,55,0.18);color:${THEME.accent};font-weight:700;}
        .nav-icon{font-size:18px;flex-shrink:0;}
        .nav-badge{flex-shrink:0;font-size:12px;line-height:1;display:inline-flex;align-items:center;justify-content:center;}
        .nav-badge-lock{opacity:0.85;}
        .nav-badge-done{}
        .nav-badge-due{width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,0.25);}
        .sidebar-user{padding:20px 24px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;}
        .sidebar-user-avatar{width:38px;height:38px;border-radius:50%;background:${THEME.accent}30;color:${THEME.onAccent ?? THEME.text};display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:14px;flex-shrink:0;}
        .sidebar-user-name{color:#fff;font-weight:600;font-size:13px;}
        .sidebar-user-role{font-size:11px;margin-top:2px;}
        .dashboard-main{margin-left:268px;flex:1;padding:40px 48px;min-height:100vh;}
        .dashboard-header{margin-bottom:32px;}
        .dashboard-header h1{font-family:'Montserrat',sans-serif;font-size:30px;font-weight:800;color:${THEME.primary};}
        .stats-row{display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:16px;margin-bottom:28px;}
        .stat-card{background:#fff;border-radius:14px;border:1px solid ${THEME.border};padding:20px 24px;display:flex;align-items:center;gap:16px;}
        .stat-icon{font-size:28px;}
        .stat-icon-svg{display:inline-flex;width:32px;height:32px;flex-shrink:0;}
        .stat-value{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:${THEME.primary};line-height:1;}
        .stat-label{font-size:12px;color:${THEME.textLight};margin-top:4px;}
        /* Анимация «рисующейся» галочки в карточке "освоено" + лёгкий bounce */
        @keyframes check-draw {
          0%   { stroke-dashoffset: 24; transform: scale(1); }
          70%  { stroke-dashoffset: 0;  transform: scale(1); }
          85%  { stroke-dashoffset: 0;  transform: scale(1.15); }
          100% { stroke-dashoffset: 0;  transform: scale(1); }
        }
        .check-path {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          /* SVG-путь масштабируем относительно своего bbox, иначе scale уезжает */
          transform-box: fill-box;
          transform-origin: center;
          animation: check-draw 1.2s ease 0.2s forwards;
        }
        /* Анимация огонька в карточке streak */
        @keyframes fire-flicker {
          0%,100% { transform: scale(1);    opacity: 1; }
          25%     { transform: scale(1.08); opacity: 0.92; }
          50%     { transform: scale(0.96); opacity: 1; }
          75%     { transform: scale(1.04); opacity: 0.88; }
        }
        .stat-icon-fire { display:inline-block; transform-origin:center; animation: fire-flicker 1.8s ease-in-out infinite; }
        .stat-icon-muted { opacity:0.45; filter:grayscale(0.4); }
        .dashboard-section{background:#fff;border-radius:16px;border:1px solid ${THEME.border};padding:28px 32px;margin-bottom:28px;}
        .progress-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch;margin-bottom:14px;}
        .progress-grid .pg-col{display:flex;flex-direction:column;gap:14px;min-width:0;}
        @media(max-width:767px){.progress-grid{grid-template-columns:1fr;}}
        .section-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;}
        .section-title{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:${THEME.primary};}
        .add-btn{padding:9px 18px;border-radius:8px;border:none;background:${THEME.primary};color:${THEME.accent};font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;cursor:pointer;transition:opacity 0.2s;}
        .add-btn:hover{opacity:0.85;} .add-btn:disabled{opacity:0.4;cursor:not-allowed;}
        .week-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;}
        .week-day{background:${THEME.bg};border-radius:12px;border:1px solid ${THEME.border};padding:12px 10px;min-height:110px;}
        .week-day.today{border-color:${THEME.accent};background:rgba(212,175,55,0.04);}
        .week-day-header{display:flex;flex-direction:column;align-items:center;margin-bottom:10px;gap:4px;}
        .day-name{font-size:11px;font-weight:700;color:${THEME.textLight};text-transform:uppercase;letter-spacing:0.5px;}
        .day-date{font-size:18px;font-weight:800;color:${THEME.primary};width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;}
        .day-date.today-dot{background:${THEME.accent};color:${THEME.primary};}
        .day-lessons{display:flex;flex-direction:column;gap:6px;}
        .lesson-block{background:${THEME.primary};border-radius:8px;padding:7px 9px;position:relative;}
        .lesson-time{display:block;font-size:11px;color:${THEME.accent};font-weight:700;}
        .lesson-subject{display:block;font-size:12px;color:#fff;font-weight:600;margin-top:2px;word-break:break-word;}
        .lesson-duration{display:block;font-size:10px;color:rgba(255,255,255,0.45);margin-top:2px;}
        .no-lessons{color:${THEME.border};font-size:20px;text-align:center;padding-top:8px;}
        .del-btn{position:absolute;top:4px;right:4px;background:transparent;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;}
        .del-btn:hover{color:${THEME.error};}
        .homework-list{display:flex;flex-direction:column;gap:12px;}
        .hw-card{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:${THEME.bg};border-radius:12px;border:1px solid ${THEME.border};border-left:4px solid ${THEME.primary};gap:16px;}
        .hw-card.overdue{border-left-color:${THEME.error};}
        .hw-card-left{flex:1;}
        .hw-title{font-size:15px;font-weight:700;color:${THEME.primary};margin-bottom:4px;}
        .hw-desc{font-size:13px;color:${THEME.textLight};line-height:1.5;}
        .hw-card-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .due-badge{padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;background:rgba(15,23,42,0.07);color:${THEME.primary};white-space:nowrap;}
        .due-badge.overdue{background:rgba(239,68,68,0.1);color:${THEME.error};}
        .due-badge.soon{background:rgba(245,158,11,0.12);color:#b45309;}
        .del-btn-hw{background:transparent;border:none;color:${THEME.textLight};cursor:pointer;font-size:18px;line-height:1;padding:0 4px;transition:color 0.2s;}
        .del-btn-hw:hover{color:${THEME.error};}
        .empty-state{text-align:center;color:${THEME.textLight};padding:48px 20px;font-size:15px;}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;}
        .modal-card{background:#fff;border-radius:16px;padding:32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.2);}
        .modal-title{font-family:'Montserrat',sans-serif;font-weight:800;font-size:20px;color:${THEME.primary};margin-bottom:24px;}
        .profile-card{display:flex;align-items:flex-start;gap:12px;padding:28px;background:${THEME.bg};border-radius:14px;border:1px solid ${THEME.border};margin-bottom:24px;}
        .profile-avatar{width:80px;height:80px;border-radius:50%;background:${THEME.primary};color:${THEME.accent};display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:28px;flex-shrink:0;}
        .profile-name{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:800;color:${THEME.primary};margin-bottom:6px;}
        .profile-phone{color:${THEME.textLight};font-size:14px;margin-bottom:10px;}
        .profile-goal-tag{display:inline-block;background:rgba(212,175,55,0.15);color:#92680e;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;margin-bottom:6px;}
        .profile-detail{font-size:15px;font-weight:600;color:${THEME.text};margin-bottom:8px;}
        .profile-date{font-size:12px;color:${THEME.textLight};}
        .profile-info{flex:1;}
        .profile-actions{display:flex;gap:16px;flex-wrap:wrap;}
        .admin-section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;}
        .admin-section-title{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:${THEME.primary};margin-bottom:4px;}
        .admin-form-card{background:#fff;border:1px solid ${THEME.border};border-radius:16px;padding:28px;margin-bottom:28px;border-top:4px solid ${THEME.accent};}
        .admin-card{background:#fff;border:1px solid ${THEME.border};border-radius:14px;padding:20px 24px;transition:box-shadow 0.2s;}
        .admin-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.06);}
        .mobile-topbar{display:none;align-items:center;justify-content:space-between;padding:16px 20px;background:#fff;border-bottom:1px solid ${THEME.border};margin-bottom:24px;}
        .burger-btn{background:transparent;border:none;font-size:24px;cursor:pointer;color:${THEME.primary};padding:4px 8px;}
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:19;}
        .scale-in{animation:scale-in 0.3s ease forwards;}
        @keyframes scale-in{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.7);}70%{box-shadow:0 0 0 8px rgba(239,68,68,0);}100%{box-shadow:0 0 0 0 rgba(239,68,68,0);}}
        .dash-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        @media(max-width:900px){
          .split-layout{flex-direction:column;} .split-left,.split-right{padding:40px 20px;} .form-row{flex-direction:column;gap:0;}
          .dashboard-sidebar{transform:translateX(-100%);} .dashboard-sidebar.open{transform:translateX(0);}
          .sidebar-overlay{display:block;} .dashboard-main{margin-left:0;padding:0 16px 40px;}
          .mobile-topbar{display:flex;} .week-calendar{grid-template-columns:repeat(4,1fr);}
          .profile-card{flex-direction:column;align-items:flex-start;gap:16px;}
          .profile-avatar{width:60px;height:60px;font-size:22px;}
        }
        @media(max-width:600px){
          .week-calendar{grid-template-columns:repeat(2,1fr);}
          .hw-card{flex-direction:column;align-items:flex-start;} .dashboard-section{padding:20px 16px;}
          .card-main{flex-direction:column;align-items:flex-start;} .status-info{text-align:left;}
          .dash-grid-2{grid-template-columns:1fr!important;}
          .dashboard-header h1{font-size:22px!important;}
          .profile-name{font-size:18px!important;}
          .profile-card{padding:18px!important;}
          .modal-card{padding:20px 16px;}
          .section-title-row{flex-direction:column;align-items:flex-start;}
          .dashboard-main{padding:0 12px 32px!important;}
        }
        @media(max-width:600px){
          .question-text{font-size:20px!important;margin-bottom:24px!important;}
          .question-container{padding:20px 14px!important;}
          .option-card{padding:14px 16px!important;}
          .option-letter{margin-right:12px!important;width:30px!important;height:30px!important;}
          .option-content{font-size:14px!important;}
          .confidence-section{padding:18px 16px!important;}
          .conf-btn{min-width:70px!important;padding:10px 6px!important;font-size:13px!important;}
          .badge{padding:4px 10px!important;font-size:11px!important;}
        }
        @media(max-width:420px){
          .stat-card{padding:14px 16px;gap:12px;}
          .stat-value{font-size:18px;}
          .stat-icon{font-size:22px;}
          .week-calendar{grid-template-columns:1fr 1fr;}
          .mobile-topbar{padding:12px 14px;}
          .dashboard-section{padding:16px 12px;}
          .question-text{font-size:18px!important;}
          .progress-bar-container{margin-bottom:20px!important;}
        }
      `}</style>

      {screen==="landing"&&<LandingScreen user={user} onStart={()=>navigate("dashboard")} onDashboard={()=>navigate("dashboard")}/>}
      {screen==="onboarding"&&<OnboardingScreen user={user} onFinish={()=>{const u={...user,onboardingDone:true};setUser(u);setProfile(p=>p?{...p,onboardingDone:true}:p);try{localStorage.setItem("aapa_user",JSON.stringify(u));}catch{}navigate("dashboard");}}/>}
      {screen==="dashboard"&&<DashboardScreen user={user} firebaseUser={firebaseUser} activeSection={dashSection} setActiveSection={navigateDashSection} onOpenDiagnostics={openDiagnostics} onStartSmartDiag={(isContinue)=>startQuiz({_smartDiag:true,goal:user?.goalKey,grade:user?.details,...(isContinue?{_continueSection:true}:{})})} onViewRoadmap={user?.smartDiagDone?viewPlan:null} onViewPlan={viewPlan} onOpenTheory={()=>navigate("theory")} onOpenDaily={tryOpenDaily} onOpenAdmin={openAdmin} onOpenLeaderboard={()=>_setScreen("leaderboard")} onOpenFriends={()=>navigate("friends")} onOpenShop={()=>navigate("shop")} onLogout={handleLogout} onOpenPractice={openPractice} onOpenIntermediateTests={openIntermediateTests} onOpenFaq={openFaq} onUpdateUser={handleUpdateUser} masteryStatus={masteryStatus} onOpenDailyLockModal={()=>setLockModalOpen(true)} rankRefreshKey={rankRefreshKey}/>}
      {screen==="practice"&&<PracticeScreen user={user} onBack={()=>goBack()}/>}
      {screen==="admin"&&<AdminScreen onBack={()=>goBack()} firebaseUser={firebaseUser}/>}
      {screen==="diagnostics"&&(
        <div style={{position:"relative"}}>
          <DiagnosticsScreen user={user} onSelectSection={sec=>startQuiz(sec)} onViewReport={openReport} onBack={()=>goBack()}/>
          {quizLoading&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
            <div style={{background:"#fff",borderRadius:16,padding:"32px 48px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
              <div style={{fontSize:40,marginBottom:12,animation:"pulse 1s infinite"}}>📋</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:THEME.primary}}>Загружаем вопросы...</div>
            </div>
          </div>}
        </div>
      )}
      {screen==="smart_diag"&&<SmartDiagRunner user={user} grade={user?.details} onFinish={finishDiagnostic} onStop={goHome} onSectionComplete={finishDiagnosticSection} initialEngineState={pendingSection?._continueSection?smartDiagEngineState:null} initialSectionNum={pendingSection?._continueSection?(user?.smartDiagNextSection||1):1}/>}
      {screen==="quiz_rules"&&<DiagnosticRulesScreen sectionName={currentSectionName} questionCount={questions.length} onStart={beginQuiz} onBack={()=>goBack("diagnostics")}/>}
      {screen==="report_view"&&viewingReport&&<ExpertReportView report={viewingReport} onBack={()=>goBack("diagnostics")}/>}
      {screen==="question"&&questions.length>0&&<QuestionScreen question={questions[qIndex]} qNum={qIndex+1} total={questions.length} onComplete={handleAnswer} onStop={handleStopQuiz} onPause={handlePauseQuiz} canSkip={user?.status==="tester"}/>}
      {screen==="report"&&report&&(
        <>
          <nav data-inner-nav style={{background:THEME.surface,borderBottom:`1px solid ${THEME.border}`,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><Logo size={32}/><button onClick={goHome} className="cta-button active" style={{width:"auto",padding:"10px 20px"}}>← Главная</button></nav>
          <ReportScreen report={report} user={user} onUpload={()=>setScreen("upload")} onViewPlan={viewPlan} onBack={()=>goBack()}/>
        </>
      )}
      {screen==="upload"&&(
        <UploadAnalysisScreen
          user={user}
          resultId={lastResultId}
          onDone={()=>navigate("dashboard")}
          onSkip={()=>navigate("dashboard")}
        />
      )}
      {screen==="roadmap"&&<RoadmapScreen roadmap={roadmap} user={user} onBack={()=>goBack()} onViewPlan={viewPlan}/>}

      {screen==="plan"&&<IndividualPlanScreen user={user} onBack={()=>goBack()} onStartTraining={(skillId,skillName)=>{setMasterySkillId(skillId);setMasterySkillName(skillName||skillId);navigate("mastery");}}/>}
      {screen==="mastery"&&masterySkillId&&<SkillMasteryScreen user={user} skillId={masterySkillId} skillName={masterySkillName} onBack={()=>{setMasterySkillId(null);setMasterySkillName('');goBack("plan");}} onRankRefresh={refreshRank}/>}
      {screen==="theory"&&<TheoryBrowseScreen user={user} onBack={()=>{setTheorySkillId(null);goBack();}} initialSkillId={theorySkillId}/>}
      {screen==="daily"&&<DailyTasksScreen user={user} onBack={()=>goBack()} onOpenDiagnostics={openDiagnostics} onViewPlan={viewPlan} onOpenFaq={openFaq} onRankRefresh={refreshRank}/>}
      {screen==="faq"&&<FaqScreen user={user} initialQuestion={faqInitial} onBack={()=>goBack()}/>}
      {screen==="intermediate_tests"&&<IntermediateTestsScreen user={user} onStartBoss={sec=>{setBossSection(sec);navigate("boss_fight");}} onBack={()=>goBack()}/>}
      {screen==="boss_fight"&&bossSection&&<BossFightScreen section={bossSection} user={user} onBack={()=>goBack("intermediate_tests")}/>}
      {screen==="leaderboard"&&<LeaderboardScreen user={user} onBack={()=>goBack()} onOpenPublicProfile={openPublicProfile} onOpenFriends={()=>navigate("friends")} onGoDaily={()=>navigate("daily")}/>}
      {screen==="friends"&&<FriendsScreen user={user} onBack={()=>goBack()} onOpenPublicProfile={openPublicProfile}/>}
      {screen==="public_profile"&&publicProfileUid&&<PublicProfileScreen uid={publicProfileUid} onBack={closePublicProfile}/>}
      {screen==="shop"&&<ShopScreen user={user} onBack={()=>goBack()} onUpdateUser={handleUpdateUser} onGoDaily={()=>navigate("daily")}/>}
      {/* Bottom-nav: only on screens where the user is browsing,
          not while taking a test or onboarding. */}
      {["dashboard","theory","daily","plan","practice","diagnostics","leaderboard"].includes(screen) && (
        <MobileBottomNav
          active={screen==="dashboard" ? (dashSection==="profile" ? "profile" : "dashboard") : screen}
          dailyStatus={!masteryStatus.hasMastered ? 'locked' : (masteryStatus.hasDueToday ? 'due' : (masteryStatus.completedToday ? 'done' : null))}
          onNavigate={id=>{
            if(id==="profile"){ navigateDashSection("profile"); if(screen!=="dashboard") navigate("dashboard"); return; }
            if(id==="dashboard"){ navigateDashSection("home"); if(screen!=="dashboard") navigate("dashboard"); return; }
            if(id==="plan"){ viewPlan(); return; }
            if(id==="daily"){ tryOpenDaily(); return; }
            if(id==="theory"){ navigate("theory"); return; }
            if(id==="leaderboard"){ _setScreen("leaderboard"); return; }
          }}
        />
      )}
      <CommandPalette
        isOpen={cmdOpen}
        onClose={()=>setCmdOpen(false)}
        onNavigate={(action)=>{
          if(!action) return;
          switch(action.type){
            case "dashboard":   navigateDashSection("home"); navigate("dashboard"); break;
            case "profile":     navigateDashSection("profile"); navigate("dashboard"); break;
            case "plan":        viewPlan(); break;
            case "theory":      setTheorySkillId(null); navigate("theory"); break;
            case "theory-skill":setTheorySkillId(action.skillId); navigate("theory"); break;
            case "daily":       navigate("daily"); break;
            case "smart-diag":  startQuiz({_smartDiag:true,goal:user?.goalKey,grade:user?.details}); break;
            default: break;
          }
        }}
      />
      <NpcGuide />
      <DailyLockModal
        open={lockModalOpen}
        onClose={()=>setLockModalOpen(false)}
        smartDiagDone={!!user?.smartDiagDone}
        onStartDiagnostic={()=>{setLockModalOpen(false);startQuiz({_smartDiag:true,goal:user?.goalKey,grade:user?.details});}}
        onViewPlan={()=>{setLockModalOpen(false);viewPlan();}}
        onOpenFaq={(key)=>{setLockModalOpen(false);openFaq(key);}}
      />
      {/* Единая очередь наград — рендерим ТОЛЬКО голову, только на дашборде.
          Два оверлея одновременно физически невозможны. */}
      {screen==="dashboard" && rewardCurrent && (
        rewardCurrent.type==='levelup'
          ? <LevelUpModal info={rewardCurrent.info} onClose={dismissReward} />
          : <RewardChest item={rewardCurrent} onClose={dismissReward} />
      )}
    </>
  );
}

// Внешняя обёртка: вычисляет shopThemeValue из profile.equipped.theme (источник
// истины — AuthContext, не локальный merged user внутри AppInner) и оборачивает
// AppInner в ThemeProvider. AppInner должен находиться ВНУТРИ провайдера, чтобы
// его useTheme() возвращал валидный контекст.
export default function App() {
  const { profile } = useAuth();
  const shopThemeValue = profile?.equipped?.theme
    ? (getShopItem(profile.equipped.theme)?.value || null)
    : null;
  return (
    <ThemeProvider shopThemeValue={shopThemeValue}>
      <AppInner />
    </ThemeProvider>
  );
}
