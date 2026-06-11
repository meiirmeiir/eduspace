import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { useTheme } from "../ThemeContext.jsx";
import { getAlmatyDateStr, SRS_INTERVALS } from "../lib/srsUtils.js";
import { addPoints } from "../lib/pointsUtils.js";
import { addCrystals, onboardFirstCrystals } from "../lib/crystalsUtils.js";
import { addXp, XP_REWARDS, getLevelInfo } from "../lib/levelUtils.js";
import { updateQuestProgress } from "../lib/questsUtils.js";
import Logo from "../components/ui/Logo.jsx";
import LatexText from "../components/ui/LatexText.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import Boss3D from "../components/Boss3D.jsx";
import BattleScene3D from "../components/BattleScene3D.jsx";
import DailyBackground3D from "../components/DailyBackground3D.jsx";
import ProbeScene3D from "../components/ProbeScene3D.jsx";
import Character3D from "../components/Character3D.jsx";
import { computePlayerHp } from "../lib/shopItems.js";
import { bossForGrade, bossById } from "../lib/bossConfig.js";
import { useNpc } from "../NpcContext.jsx";

// ── ТЕСТОВЫЙ РЕЖИМ ────────────────────────────────────────────────────────────
// Тестовый ученический аккаунт: ежедневные задачи проходятся БЕСКОНЕЧНО (прогресс
// НЕ пишется в Firestore → задачи остаются «к повторению») + шанс босса 50%.
// Отключить целиком: TEST_UID = null.
const TEST_UID = 'bsZhaekYhxODSY9Xanxvh3WutIQ2'; // meirbekbazarbek+student@gmail.com
const isTestUser = (uid) => !!TEST_UID && uid === TEST_UID;

// Детект появления босса: детерминированно по дню (seed = uid + дата), 30% (тест — 50%).
// Чистая функция, без записи в БД — стабильно в течение дня (повторный вход = тот
// же исход). Тип босса (дракон/слизень) — из второго среза хеша (косметика).
function bossRollFor(uid, dateStr) {
  const s = `${uid || 'anon'}|${dateStr}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h = h >>> 0;
  const active = (h % 100) < (isTestUser(uid) ? 50 : 30);
  const TYPES = ['ufo', 'robot', 'slime', 'dragon', 'asteroid'];
  const type = TYPES[Math.floor(h / 100) % TYPES.length];
  return { active, type };
}
const BOSS_NAME = { ufo: 'НЛО-Разведчик', robot: 'Боевой Дроид', slime: 'Космо-Слизень', dragon: 'Звёздный Дракон', asteroid: 'Астероид-Голем' };

// ── Геймификация сессии («Ежедневная миссия») ────────────────────────────────
// Множитель дневного стрика: действует на XP всех ответов сессии.
function streakMultiplier(days) {
  if (days >= 30) return 2;
  if (days >= 14) return 1.5;
  if (days >= 7)  return 1.2;
  return 1;
}
// Множитель combo — серии верных ответов подряд ВНУТРИ сессии (не дневной стрик).
const comboMultiplier = (c) => (c >= 5 ? 2 : c >= 3 ? 1.5 : 1);
// Потенциал наград для экрана старта (если все ответы верные, без speed-бонуса).
function potentialXp(n, sMult) {
  let t = 0;
  for (let i = 1; i <= n; i++) t += Math.round(10 * comboMultiplier(i) * sMult);
  return t;
}
const potentialCrystals = (n) => n * 2 + (n >= 5 ? 5 : 0); // +2💎/ответ, +5💎 за combo ×5
// Русские плюралы: plural(3, ['задача','задачи','задач'])
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
// Флаг отката живого 3D-фона мирного режима: true = Three.js космос+планета,
// false = прежний CSS-градиент (BG). В бою фон не рендерится в любом случае.
const DAILY_BG_3D = true;
// Палитра AAPA для CTA (как на авторизации): тёмный фон + золотой текст.
const BTN_DARK = { background:'#1a1a2e', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.4)' };
const BTN_GOLD = { background:'linear-gradient(90deg,#fbbf24,#f59e0b)', color:'#1a1a2e', border:'none' };

export default function DailyTasksScreen({ user, onBack, onOpenDiagnostics, onViewPlan, onOpenFaq, onRankRefresh }) {
  const { showNpcMessage } = useNpc();
  const { theme: THEME, dark, shopTheme } = useTheme();
  // Тёмный UI = системная dark-тема ИЛИ тёмная shop-тема (galaxy/matrix/fire).
  const isDarkUi = dark || (shopTheme && shopTheme !== 'sakura');
  // Фон экрана: мягкий градиент вместо голого белого (+ тёмный аналог).
  const BG = isDarkUi
    ? 'linear-gradient(180deg, #0b1226 0%, #131b36 45%, #0f172a 100%)'
    : 'linear-gradient(180deg, #f0f4ff 0%, #f7f9ff 40%, #ffffff 100%)';
  const [phase,    setPhase]    = useState('loading'); // loading|intro|playing|done|empty
  const [emptyReason, setEmptyReason] = useState(null); // 'no-diag'|'no-mastered'|'wait-until'|null
  const [nextReviewDate, setNextReviewDate] = useState(null); // YYYY-MM-DD when wait-until
  const [queue,    setQueue]    = useState([]);  // [{skillId, skillName, reviewStage, task}]
  const [qIdx,     setQIdx]     = useState(0);
  const [skillLives, setSkillLives] = useState({}); // lives per skill: { [skillId]: number }
  const [chosen,   setChosen]   = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [correct,  setCorrect]  = useState(new Set()); // skillIds answered correctly
  const [wrong,    setWrong]    = useState(new Set()); // skillIds answered wrong (still protected)
  const [degraded, setDegraded] = useState(new Set()); // skillIds to degrade
  const [saving,   setSaving]   = useState(false);
  const [lastWrongWasDanger, setLastWrongWasDanger] = useState(false); // lives=0 warning
  const [streak,   setStreak]   = useState(0); // combo: серия верных ответов подряд внутри сессии
  const questionStartRef = useRef(0);
  const streak3AwardedRef = useRef(false);
  const sessionAnswersRef = useRef([]); // bool на каждый ответ сессии → recentAnswers батчем

  // ── Геймификация: live-счётчики наград (начисляются batch'ем в конце сессии) ──
  const [answers,         setAnswers]         = useState([]);   // bool по каждой решённой задаче → сегменты прогресс-бара
  const [sessionXp,       setSessionXp]       = useState(0);    // накоплено XP за сессию (UI live)
  const [sessionCrystals, setSessionCrystals] = useState(0);    // накоплено 💎 за сессию (UI live)
  const [xpFloat,         setXpFloat]         = useState(null); // {text, speed, key} — всплывающий «+N XP»
  const [perfectFlash,    setPerfectFlash]    = useState(false);// 💎 PERFECT COMBO ×5 — оверлей
  const [comboFlash,      setComboFlash]      = useState(false);// вспышка золотой рамки на combo ×3
  const [hadPerfect,      setHadPerfect]      = useState(false);// был ли combo ×5 за сессию (бейдж на итоге)

  // ── Грузовой зонд с лутом (итоговый экран): дрон доставляет капсулу,
  // тир по доле верных, 💎 начисляются в общем batch'е ──
  const [probeTier,     setProbeTier]     = useState('standard'); // standard|silver|gold
  const [probeCrystals, setProbeCrystals] = useState(0);          // выпавшие из зонда 💎
  const [probeLanded,   setProbeLanded]   = useState(false);      // дрон улетел → можно открывать
  const [probeOpened,   setProbeOpened]   = useState(false);
  const [probeAnimDone, setProbeAnimDone] = useState(false);      // 3D-анимация открытия доиграла → «+N 💎»
  const [probeCount,    setProbeCount]    = useState(0);          // count-up числа после открытия
  const openProbe = () => {
    if (probeOpened || !probeLanded) return;
    setProbeOpened(true); // 3D-сцена сама играет створку/свет/частицы
  };
  // Count-up: число кристаллов «досчитывается» вверх — после того как створка
  // открылась (onOpenComplete).
  useEffect(() => {
    if (!probeOpened) return;
    if (!probeAnimDone) return;
    let v = 0;
    const step = Math.max(1, Math.ceil(probeCrystals / 18));
    const id = setInterval(() => {
      v = Math.min(probeCrystals, v + step);
      setProbeCount(v);
      if (v >= probeCrystals) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeOpened, probeAnimDone]);
  // Дневной стрик → постоянный множитель XP на сессию.
  const effStreak = Number(user?.streak || 0);
  const sMult = streakMultiplier(effStreak);

  // ── Босс (косметический слой поверх сессии; учёбу/SRS/награды НЕ трогает) ──
  const [bossActive, setBossActive] = useState(false);
  const [bossId,     setBossId]     = useState('shadow');
  const [bossHp,     setBossHp]     = useState(100);
  const [playerHp,   setPlayerHp]   = useState(3);
  const bossDef = bossById(bossId);
  const bossMax = bossDef.hp;
  const bossName = bossDef.name;
  const [dmgMsg,     setDmgMsg]     = useState(null);
  const [playerHit,  setPlayerHit]  = useState(false);
  const [battleResult, setBattleResult] = useState(null); // null | 'win' | 'lose'
  const [bossIntroPhase, setBossIntroPhase] = useState(null); // 'intro' | 'battle' | null
  const [attackSeq,  setAttackSeq]  = useState(0); // ++ при верном ответе → лазер персонажа
  const [hitSeq,     setHitSeq]     = useState(0); // ++ при настоящей ошибке → вздрагивание
  // Сигналы для фон-планеты (мирный режим): верный → буст приближения, неверный → сбой.
  const [bgBoostSeq,  setBgBoostSeq]  = useState(0);
  const [bgGlitchSeq, setBgGlitchSeq] = useState(0);

  const bossBonusAwardedRef = useRef(false);
  // HP героя в бою = база 3 + бонусы надетого снаряжения (Этап 2C).
  const maxPlayerHp = computePlayerHp(user?.equipped, user?.gender);

  const shuf = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

  // Засекаем время появления вопроса (для fast_answer < 10s)
  useEffect(() => {
    if (phase === 'playing') questionStartRef.current = Date.now();
  }, [phase, qIdx]);

  // Интро-анимация (VS-экран, ~3с) → переход в боевую фазу.
  useEffect(() => {
    if (bossIntroPhase !== 'intro') return;
    const id = setTimeout(() => setBossIntroPhase('battle'), 3000);
    return () => clearTimeout(id);
  }, [bossIntroPhase]);

  useEffect(() => {
    const load = async () => {
      if (!user?.phone) { setPhase('empty'); return; }
      // 1) Диагностика ещё не пройдена — самое начало пути.
      if (!user?.smartDiagDone) { setEmptyReason('no-diag'); setPhase('empty'); return; }
      try {
        const today = getAlmatyDateStr(0);
        const [masterySnap, shSnap] = await Promise.race([
          Promise.all([
            getDoc(doc(db, 'skillMastery', user.uid)),
            getContent('skillHierarchies'),
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ]);
        const masteryData = masterySnap.exists() ? (masterySnap.data()?.skills || {}) : {};
        const masteredEntries = Object.entries(masteryData).filter(([, ms]) => ms?.stagesCompleted === 3);

        // 2) Нет ни одного освоенного навыка (3-й этап ни у кого не пройден).
        if (masteredEntries.length === 0) { setEmptyReason('no-mastered'); setPhase('empty'); return; }

        // Skills due for review today (all due skills, no hard cap).
        // ТЕСТ: игнорируем SRS-дату → все освоенные навыки всегда «к повторению»
        // (старые next_review_date в будущем больше не блокируют ежедневки).
        const dueEntries = isTestUser(user?.uid)
          ? masteredEntries
          : masteredEntries.filter(([, ms]) => ms.next_review_date && ms.next_review_date <= today);
        if (dueEntries.length === 0) {
          // 3) Есть освоенные, но все next_review_date > today → ждём ближайшую дату.
          const upcoming = masteredEntries
            .map(([, ms]) => ms.next_review_date)
            .filter(Boolean)
            .sort();
          if (upcoming.length) { setNextReviewDate(upcoming[0]); setEmptyReason('wait-until'); }
          else                 { setEmptyReason(null); }
          setPhase('empty'); return;
        }
        // Distribute limit evenly: tasksPerSkill = limit / skillCount (min 1)
        const limit = user?.dailyTasksLimit || 10;
        const tasksPerSkill = Math.max(1, Math.floor(limit / dueEntries.length));

        // Build skill name map
        const namesMap = {};
        shSnap.forEach(d => {
          (d.clusters || []).forEach(cl =>
            (cl.pivot_skills || []).forEach(ps => { if(ps.skill_id) namesMap[ps.skill_id] = ps.skill_name||ps.skill_id; })
          );
        });

        // Load tasks for each due skill from dailyTasks collection
        const taskSnaps = await Promise.race([
          Promise.all(dueEntries.map(([id]) => getDoc(doc(db, 'dailyTasks', id)))),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ]);
        const items = [];
        dueEntries.forEach(([skillId, ms], i) => {
          const td = taskSnaps[i].exists() ? taskSnaps[i].data() : null;
          const pool = td?.questions?.length ? td.questions : [];
          if (!pool.length) return;
          shuf(pool).slice(0, tasksPerSkill).forEach(task => {
            items.push({ skillId, skillName: namesMap[skillId] || skillId, reviewStage: ms.review_stage || 1, task });
          });
        });
        if (!items.length) { setPhase('empty'); return; }
        setQueue(shuf(items)); // interleave skills
        // Босс — редкое событие-сюрприз: ролл детерминирован по дню (стабилен в течение дня).
        const roll = bossRollFor(user?.uid, getAlmatyDateStr(0));
        if (roll.active) { const b = bossForGrade(user?.details || user?.grade); setBossActive(true); setBossId(b.id); setBossHp(b.hp); setPlayerHp(maxPlayerHp); setBattleResult(null); setBossIntroPhase('intro'); }
        setPhase('intro'); // экран старта миссии перед первой задачей
      } catch(e) { console.error(e); setPhase('empty'); }
    };
    load();
  }, [user?.phone]);

  const current = queue[qIdx];

  const handleChoose = (optIdx) => {
    if (revealed) return;
    setChosen(optIdx);
    setRevealed(true);
    const isCorrect = current.task.correct === optIdx;
    sessionAnswersRef.current.push(isCorrect); // для recentAnswers (accuracy-достижение)
    setAnswers(a => [...a, isCorrect]);        // сегмент прогресс-бара: зелёный/красный
    if (isCorrect) {
      setBgBoostSeq(n => n + 1);   // фон: рывок приближения к планете + вспышка
      setCorrect(p => new Set([...p, current.skillId]));
      setLastWrongWasDanger(false);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak >= 3 && nextStreak % 3 === 0) {
        showNpcMessage('streak', 4000);
      }
      // ── XP/💎: считаем с combo- и стрик-множителями. Начисление — одним
      // batch'ем по завершении сессии (handleNext); здесь только live-UI. ──
      const elapsed = questionStartRef.current ? Date.now() - questionStartRef.current : Infinity;
      const speedBonus = elapsed < 10000 ? 3 : 0; // ⚡ ответ быстрее 10 сек
      const effMult = comboMultiplier(nextStreak) * sMult;
      const xpGain = Math.round(XP_REWARDS.correct_answer * effMult) + speedBonus;
      const crystalGain = 2 + (nextStreak === 5 ? 5 : 0); // +5💎 бонус за PERFECT COMBO
      setSessionXp(x => x + xpGain);
      setSessionCrystals(c => c + crystalGain);
      const multLabel = effMult > 1 ? ` (×${parseFloat(effMult.toFixed(2))})` : '';
      setXpFloat({ text: `+${xpGain} XP${multLabel}`, speed: speedBonus > 0, key: Date.now() });
      if (nextStreak === 5)      { setHadPerfect(true); setPerfectFlash(true); setTimeout(() => setPerfectFlash(false), 1300); }
      else if (nextStreak === 3) { setComboFlash(true);   setTimeout(() => setComboFlash(false), 1000); }
      // ── Points + квесты (как раньше, per-answer; XP/💎 — batch в конце) ──
      addPoints(user.uid, 'daily_correct', user);
      // Квесты: счётчики верных ответов (день/неделя) + «зашёл и решил» (target 1).
      updateQuestProgress(user.uid, 'daily_correct', 1, user);
      updateQuestProgress(user.uid, 'weekly_correct', 1, user);
      updateQuestProgress(user.uid, 'login_answer', 1, user);
      if (elapsed < 10000) addPoints(user.uid, 'fast_answer', user);
      if (nextStreak === 3 && !streak3AwardedRef.current) {
        streak3AwardedRef.current = true;
        addPoints(user.uid, 'daily_streak_3', user);
      }
      // ── Бой: урон боссу (косметика поверх; учёбу не трогает) ──
      if (bossActive) {
        const dmg = Math.min(bossMax, Math.ceil(bossMax / Math.max(1, queue.length - 2)));
        setBossHp(h => {
          const nh = Math.max(0, h - dmg);
          if (nh <= 0) setBattleResult(r => r || 'win');
          return nh;
        });
        setDmgMsg(`-${dmg} HP!`); setAttackSeq(n => n + 1); // лазер персонажа → попадание трясёт босса
        setTimeout(() => { setDmgMsg(null); }, 700);
      }
    } else {
      setBgGlitchSeq(n => n + 1);   // фон: лёгкая тряска/красный блик (без отката назад)
      setStreak(0);      // combo сбрасывается
      setXpFloat(null);  // убрать всплывашку прошлого ответа
      const curLives = skillLives[current.skillId] ?? 2;
      if (curLives <= 0) {
        // No lives left for this skill — degrade it
        setDegraded(p => new Set([...p, current.skillId]));
        setLastWrongWasDanger(true);
        // ── Бой: контратака босса только за «настоящую» ошибку (деградация) ──
        if (bossActive) {
          setPlayerHp(p => {
            const np = Math.max(0, p - 1);
            if (np <= 0) setBattleResult(r => r || 'lose');
            return np;
          });
          setPlayerHit(true); setHitSeq(n => n + 1); // персонаж вздрагивает (встречный выстрел босса)
          setTimeout(() => setPlayerHit(false), 600);
        }
      } else {
        setWrong(p => new Set([...p, current.skillId]));
        setSkillLives(prev => ({ ...prev, [current.skillId]: curLives - 1 }));
        setLastWrongWasDanger(false);
      }
    }
  };

  const handleNext = async () => {
    if (qIdx < queue.length - 1) {
      setQIdx(i => i+1); setChosen(null); setRevealed(false); setLastWrongWasDanger(false);
    } else {
      // Session over — save
      setSaving(true);
      // ── Зонд с лутом: тир по доле верных ответов, кристаллы суммируются
      // с ответными в ОДНОМ batch-начислении. Открытие — анимация на итоге.
      const correctCount = answers.filter(Boolean).length;
      const ratio = answers.length ? correctCount / answers.length : 0;
      const tier = ratio === 1 ? 'gold' : ratio >= 0.8 ? 'silver' : 'standard';
      const lootMult = tier === 'gold' ? 3 : tier === 'silver' ? 2 : 1;
      const loot = (5 + Math.floor(Math.random() * 11)) * lootMult; // база 5–15 💎 × тир
      setProbeTier(tier);
      setProbeCrystals(loot);
      // ── XP/💎 за сессию: одно batch-начисление вместо записи на каждый ответ.
      // UI показывал накопление live (sessionXp/sessionCrystals); зонд — сверху.
      if (user?.uid) {
        if (sessionXp > 0)           addXp(user.uid, sessionXp, 'daily_session', user);
        if (sessionCrystals + loot > 0) {
          addCrystals(user.uid, sessionCrystals + loot, 'daily_session');
          onboardFirstCrystals(user, showNpcMessage); // онбординг: разовое объяснение при первом начислении
        }
      }
      // Бонус за победу над боссом — СВЕРХ учебных наград, один раз. Учёбу/SRS не трогает.
      if (bossActive && battleResult === 'win' && !bossBonusAwardedRef.current && user?.uid) {
        bossBonusAwardedRef.current = true;
        addCrystals(user.uid, 5, 'boss_win');
        addXp(user.uid, 20, 'boss_win', user);
      }
      await saveSession();
      onRankRefresh?.();
      setSaving(false);
      setPhase('done');
    }
  };

  const saveSession = async () => {
    if (!user?.phone) return;
    // ТЕСТ: не сохраняем прогресс → ежедневные задачи можно проходить бесконечно.
    if (isTestUser(user?.uid)) { console.info('[daily] test user — прогресс не сохраняется'); return; }
    const updates = {};
    for (const item of queue) {
      const { skillId, reviewStage } = item;
      if (degraded.has(skillId)) {
        // Degrade: back to stage 2 (crystal dims from gold to yellow)
        updates[`skills.${skillId}.stagesCompleted`] = 2;
        updates[`skills.${skillId}.currentStage`] = 3;
        updates[`skills.${skillId}.next_review_date`] = null;
        updates[`skills.${skillId}.review_stage`] = 0;
        updates[`skills.${skillId}.lastDegradedAt`] = getAlmatyDateStr(0);
      } else if (correct.has(skillId)) {
        const nextStage = Math.min(reviewStage + 1, 5);
        const days = SRS_INTERVALS[nextStage - 1];
        updates[`skills.${skillId}.review_stage`] = nextStage;
        updates[`skills.${skillId}.next_review_date`] = getAlmatyDateStr(days);
        updates[`skills.${skillId}.lastReviewedAt`] = getAlmatyDateStr(0);
      } else if (wrong.has(skillId)) {
        // Protected wrong — reschedule tomorrow
        updates[`skills.${skillId}.next_review_date`] = getAlmatyDateStr(1);
      }
    }
    if (Object.keys(updates).length) {
      try { await updateDoc(doc(db, 'skillMastery', user.uid), updates); }
      catch(e) { console.error(e); }
    }

    // Streak: «дней подряд активности». Сессия = одно посещение в день.
    //   lastActiveDate === today      → серия уже зачтена сегодня, ничего не делаем
    //   lastActiveDate === yesterday  → +1
    //   старше или отсутствует        → начинаем заново с 1
    try {
      const userRef  = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const data     = userSnap.exists() ? userSnap.data() : {};

      // recentAnswers — батч за сессию (для accuracy-достижения), последние 50 (FIFO).
      const sessionAns = sessionAnswersRef.current;
      if (sessionAns.length) {
        const merged = [...(Array.isArray(data.recentAnswers) ? data.recentAnswers : []), ...sessionAns].slice(-50);
        // activity — счётчик решённых задач по дням (YYYY-MM-DD → count) для
        // GitHub-графика активности в профиле. Храним последние ~120 дней.
        const activity = { ...(data.activity || {}) };
        const todayKey = getAlmatyDateStr(0);
        activity[todayKey] = (Number(activity[todayKey]) || 0) + sessionAns.length;
        const cutoff = getAlmatyDateStr(-120);
        for (const k of Object.keys(activity)) { if (k < cutoff) delete activity[k]; }
        try { await updateDoc(userRef, { recentAnswers: merged, activity }); }
        catch (e) { console.error('recentAnswers/activity update:', e); }
        sessionAnswersRef.current = [];
      }
      const today     = getAlmatyDateStr(0);
      const yesterday = getAlmatyDateStr(-1);
      const lastActive    = data.lastActiveDate;
      const currentStreak = Number(data.streak ?? 0);
      let newStreak;
      if      (lastActive === today)     newStreak = currentStreak || 1;
      else if (lastActive === yesterday) newStreak = currentStreak + 1;
      else                                newStreak = 1;
      if (newStreak !== currentStreak || lastActive !== today) {
        await updateDoc(userRef, { streak: newStreak, lastActiveDate: today });
      }
      // Квест «7 дней подряд»: прогресс = текущий стрик (set, не инкремент).
      updateQuestProgress(user.uid, 'streak_7', Math.min(newStreak, 7), user, 'set');
      // day_streak_7: один раз навсегда при первом достижении 7 дней подряд.
      // Общий флаг bonusesAwarded.streak7 покрывает и +200 очков, и +50 кристаллов.
      const awarded7 = data?.bonusesAwarded?.streak7 === true;
      if (newStreak >= 7 && !awarded7) {
        const ok = await addPoints(user.uid, 'day_streak_7', user);
        addCrystals(user.uid, 50, 'streak_7');
        if (ok) {
          try { await updateDoc(userRef, { 'bonusesAwarded.streak7': true }); }
          catch (e) { console.error('streak7 flag:', e); }
        }
      }
      // streak_30: только кристаллы (+200), один раз навсегда. Отдельный флаг bonusesAwarded.streak30.
      const awarded30 = data?.bonusesAwarded?.streak30 === true;
      if (newStreak >= 30 && !awarded30) {
        const ok = await addCrystals(user.uid, 200, 'streak_30');
        if (ok) {
          try { await updateDoc(userRef, { 'bonusesAwarded.streak30': true }); }
          catch (e) { console.error('streak30 flag:', e); }
        }
      }
    } catch (e) { console.error('streak update:', e); }
  };

  // ── EMPTY ── (4 варианта в зависимости от reason)
  if (phase === 'empty') {
    const Btn = ({ onClick, label, primary = true }) => (
      <button
        onClick={onClick}
        style={{
          marginTop: 28,
          background: primary ? BTN_DARK.background : 'transparent',
          color: primary ? BTN_DARK.color : THEME.textLight,
          border: primary ? BTN_DARK.border : `1px solid ${THEME.border}`,
          borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}
      >{label}</button>
    );

    // 1) Диагностика не пройдена
    if (emptyReason === 'no-diag') return (
      <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
        <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} user={user} />
        <div style={{ maxWidth:520, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🎯</div>
          <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:12 }}>Сначала пройди диагностику</h2>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.textLight, lineHeight:1.7 }}>
            Ежедневные задачи строятся вокруг твоих освоенных навыков. Чтобы понять, с чего начать, пройди диагностику — это 15–20 минут.
          </p>
          <Btn onClick={()=>onOpenDiagnostics?.()} label="Начать диагностику →" />
        </div>
      </div>
    );

    // 2) Нет освоенных навыков — показываем прогресс-шаги
    if (emptyReason === 'no-mastered') {
      const steps = [
        { done: true,  title: 'Диагностика пройдена',     desc: 'План обучения построен.' },
        { done: false, title: 'Освой первый навык',        desc: 'Три этапа: теория и задачи A → B → C.', hasHelp: true },
        { done: false, title: 'Получи ежедневные задачи',  desc: 'На следующий день после освоения навыка задачи появятся здесь.' },
      ];
      return (
        <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
          <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} user={user} />
          <div style={{ maxWidth:520, margin:'48px auto', padding:'0 24px', textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>🎓</div>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:8 }}>Освой первый навык</h2>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:THEME.textLight, lineHeight:1.6, marginBottom:24 }}>
              Ежедневные задачи откроются, как только в плане появится первый освоенный навык.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, textAlign:'left', maxWidth:420, margin:'0 auto' }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:12, padding:'12px 14px' }}>
                  <div style={{
                    flexShrink:0, width:26, height:26, borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: s.done ? '#10b981' : 'transparent',
                    border: s.done ? '2px solid #10b981' : `2px solid ${THEME.border}`,
                    color: s.done ? '#fff' : THEME.textLight,
                    fontSize:12, fontWeight:700,
                  }}>{s.done ? '✓' : (i + 1)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:14, color: s.done ? THEME.textLight : THEME.primary, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</div>
                      {s.hasHelp && (
                        <button onClick={()=>onOpenFaq?.('skillMastery')} title="Подробнее в FAQ" aria-label="Подробнее в FAQ"
                          style={{ width:20, height:20, borderRadius:'50%', border:`1px solid ${THEME.border}`, background:'transparent', color:THEME.textLight, fontSize:11, fontWeight:700, cursor:'pointer', lineHeight:1, padding:0 }}
                        >?</button>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:THEME.textLight, marginTop:2 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <Btn onClick={()=>onViewPlan?.()} label="🗺️ Перейти к плану" />
          </div>
        </div>
      );
    }

    // 3) Все освоенные навыки повторены — мотивационный экран со статистикой
    if (emptyReason === 'wait-until') {
      const fmt = (ymd) => {
        try {
          const [y,m,d] = ymd.split('-').map(Number);
          return new Date(y, m-1, d).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
        } catch { return ymd; }
      };
      // Мини-статистика из профиля (без запросов): стрик, задачи за 7 дней
      // из activity-карты, очки недели. Пустые скрываем.
      const st = (() => {
        const activity = user?.activity || {};
        let weekTasks = 0;
        for (let i = 0; i < 7; i++) weekTasks += Number(activity[getAlmatyDateStr(-i)] || 0);
        return { streak: Number(user?.streak || 0), weekTasks, weekPoints: Number(user?.weekPoints || 0) };
      })();
      const statCards = [
        st.streak >= 2   && { icon:'🔥', val:st.streak,     label:`${plural(st.streak, ['день','дня','дней'])} подряд` },
        st.weekTasks > 0 && { icon:'📊', val:st.weekTasks,  label:`${plural(st.weekTasks, ['задача','задачи','задач'])} за неделю` },
        st.weekPoints > 0 && { icon:'⭐', val:st.weekPoints, label:'очков за неделю' },
      ].filter(Boolean);
      return (
        <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
          <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} user={user} />
          <div style={{ maxWidth:560, margin:'64px auto', padding:'0 24px', textAlign:'center' }}>
            <div style={{ fontSize:60, marginBottom:14 }}>🏆</div>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, color:THEME.primary, marginBottom:10 }}>Всё повторено! Ты молодец 🎉</h2>

            {/* Мини-карточки статистики (если есть данные) */}
            {statCards.length > 0 && (
              <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap', margin:'20px 0 6px' }}>
                {statCards.map(c => (
                  <div key={c.icon} style={{ background: isDarkUi ? THEME.surface : '#ffffff', border:`1px solid ${THEME.border}`, borderRadius:14, padding:'13px 20px', minWidth:120, boxShadow:'0 4px 14px rgba(10,25,47,0.06)' }}>
                    <div style={{ fontSize:20, marginBottom:3 }}>{c.icon}</div>
                    <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:20, color:THEME.text, lineHeight:1.1 }}>{c.val}</div>
                    <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:THEME.textLight, marginTop:2 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.textLight, lineHeight:1.7, marginTop:18 }}>
              📅 Следующая разминка — <b style={{ color:THEME.primary }}>{nextReviewDate ? fmt(nextReviewDate) : '—'}</b>
            </p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13.5, color:THEME.textLight, marginTop:4 }}>
              Пока можно освоить новые навыки из плана.
            </p>
            <Btn onClick={()=>onViewPlan?.()} label="🗺️ К плану обучения →" />
          </div>
        </div>
      );
    }

    // 4) Fallback — что-то пошло не так / нет данных / пользователь без uid
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
        <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} user={user} />
        <div style={{ maxWidth:480, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🌙</div>
          <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:12 }}>Разминка не нужна</h2>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.textLight, lineHeight:1.7 }}>
            На сегодня нет навыков для повторения. Освой навыки в Индивидуальном плане — они появятся здесь через день после завершения.
          </p>
          <Btn onClick={()=>onViewPlan?.()} label="Перейти к плану" />
        </div>
      </div>
    );
  }

  // ── LOADING ──
  if (phase === 'loading') return (
    <div className="page-themed" style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Inter',sans-serif", color:THEME.textLight }}>Загрузка разминки...</div>
    </div>
  );

  // ── INTRO: экран старта «Ежедневной миссии» ──
  if (phase === 'intro') {
    const skillCount = new Set(queue.map(q => q.skillId)).size;
    const potXp = potentialXp(queue.length, sMult);
    const potCr = potentialCrystals(queue.length);
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:'linear-gradient(160deg, #0c1230 0%, #181a3e 55%, #2b1b52 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <style>{`@keyframes missionRise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ textAlign:'center', maxWidth:480, animation:'missionRise 0.5s ease both' }}>
          <div style={{ fontSize:54, marginBottom:8, filter:'drop-shadow(0 0 16px rgba(251,191,36,0.45))' }}>⚔️</div>
          <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:32, color:'#fff', textShadow:'0 0 24px rgba(251,191,36,0.35)', margin:'0 0 20px' }}>Ежедневная миссия</h1>

          {/* Что предстоит */}
          <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <span style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:99, padding:'7px 16px', fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:600, color:'#e2e8f0' }}>
              📝 {queue.length} {plural(queue.length, ['задача','задачи','задач'])}
            </span>
            <span style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:99, padding:'7px 16px', fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:600, color:'#e2e8f0' }}>
              🧠 {skillCount} {plural(skillCount, ['навык','навыка','навыков'])}
            </span>
          </div>

          {/* Что можно заработать */}
          <div style={{ background:'rgba(251,191,36,0.10)', border:'1px solid rgba(251,191,36,0.4)', borderRadius:14, padding:'13px 20px', marginBottom:12 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'rgba(255,255,255,0.6)', marginBottom:3 }}>Можно заработать</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:18, color:'#fbbf24' }}>До +{potXp} XP · до +{potCr} 💎</div>
          </div>

          {/* Стрик и множитель */}
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'rgba(255,255,255,0.8)', marginBottom:26 }}>
            {effStreak >= 2
              ? <>🔥 {effStreak} {plural(effStreak, ['день','дня','дней'])} подряд{sMult > 1 && <b style={{ color:'#fbbf24' }}> · множитель ×{sMult}</b>}</>
              : <>🔥 Реши сегодня — начни серию дней и получи множитель XP!</>}
          </div>

          <button onClick={() => setPhase('playing')}
            style={{ ...BTN_GOLD, borderRadius:14, padding:'16px 52px', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:18, cursor:'pointer', boxShadow:'0 0 26px rgba(251,191,36,0.45)' }}>
            Начать миссию →
          </button>
        </div>
      </div>
    );
  }

  // ── DONE: полноценный экран награждения ──
  if (phase === 'done') {
    // Карточки навыков — queue дедуплицируем по skillId (навык мог дать
    // несколько задач), статус: деградация > верно > жизнь потрачена.
    const uniqSkills = [];
    {
      const seen = new Set();
      for (const q of queue) { if (!seen.has(q.skillId)) { seen.add(q.skillId); uniqSkills.push(q); } }
    }
    const degradedCount = uniqSkills.filter(q => degraded.has(q.skillId)).length;
    const correctCount = answers.filter(Boolean).length;
    const totalCount = answers.length || queue.length;
    const isPerfect = totalCount > 0 && correctCount === totalCount;
    const shownCrystals = sessionCrystals + (probeOpened ? probeCrystals : 0);
    // Стрик: прогресс до следующего порога множителя (7 → 14 → 30)
    const nextThr  = effStreak >= 30 ? null : effStreak >= 14 ? 30 : effStreak >= 7 ? 14 : 7;
    const prevThr  = effStreak >= 30 ? 30   : effStreak >= 14 ? 14 : effStreak >= 7 ? 7  : 0;
    const nextMult = nextThr === 7 ? 1.2 : nextThr === 14 ? 1.5 : 2;
    const streakPct = nextThr ? Math.max(4, Math.min(100, ((effStreak - prevThr) / (nextThr - prevThr)) * 100)) : 100;
    // Уровень: XP-бар с учётом только что заработанного
    const lvl = getLevelInfo((Number(user?.xp) || 0) + sessionXp);
    const xpLeft = Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp);
    // Друзья — лёгкий nudge без запросов к Firestore (берём user.friends из профиля)
    const friendsCount = Array.isArray(user?.friends) ? user.friends.length : 0;
    // Зонд: подпись и акцент по тиру (визуал — в 3D-сцене)
    const PROBE = {
      gold:     { name:'Легендарный зонд', note:'×3 за PERFECT',   accent:'#fbbf24', body:'linear-gradient(180deg,#fcd34d,#b45309)' },
      silver:   { name:'Усиленный зонд',   note:'×2 за результат', accent:'#7dd3fc', body:'linear-gradient(180deg,#f1f5f9,#94a3b8)' },
      standard: { name:'Грузовой зонд',    note:null,              accent:'#fb923c', body:'linear-gradient(180deg,#cbd5e1,#8b95a5)' },
    }[probeTier];
    const card = { background: isDarkUi ? THEME.surface : '#ffffff', border:`1px solid ${THEME.border}`, borderRadius:14 };
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background: isDarkUi
        ? 'linear-gradient(180deg, #131b36 0%, #1a1d3f 40%, #0f172a 100%)'
        : 'linear-gradient(180deg, #eef2ff 0%, #fdf6e9 45%, #ffffff 100%)' }}>
        <style>{`
          @keyframes lootPop { 0% { transform:scale(0.6); opacity:0; } 60% { transform:scale(1.12); opacity:1; } 100% { transform:scale(1); opacity:1; } }
          @keyframes confettiFall { 0% { transform:translateY(-50px) rotate(0deg); opacity:1; } 100% { transform:translateY(105vh) rotate(560deg); opacity:0.5; } }
        `}</style>

        {/* CSS-конфетти при PERFECT (лёгкие частички, один проход) */}
        {isPerfect && (
          <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:50, overflow:'hidden' }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} style={{
                position:'absolute', top:0, left:`${4 + i * 7}%`,
                width: i % 3 === 0 ? 10 : 7, height: i % 2 === 0 ? 12 : 8,
                borderRadius: i % 3 === 0 ? '50%' : 2,
                background: ['#fbbf24','#22c55e','#818cf8','#f472b6','#f59e0b'][i % 5],
                animation: `confettiFall ${2.2 + (i % 4) * 0.35}s ease-in ${(i % 5) * 0.18}s both`,
              }}/>
            ))}
          </div>
        )}

        <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} user={user} />
        <div style={{ maxWidth:560, margin:'36px auto', padding:'0 24px 60px' }}>
          {/* a) Заголовок */}
          <div style={{ textAlign:'center', marginBottom:18 }}>
            <div style={{ fontSize:52, marginBottom:10 }}>{degradedCount > 0 ? '⚠️' : '🏆'}</div>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, color:THEME.primary, marginBottom:6 }}>Миссия выполнена!</h2>
            {isPerfect
              ? <p style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:'#d4a017', textShadow: isDarkUi ? '0 0 14px rgba(251,191,36,0.5)' : 'none' }}>PERFECT! {correctCount} из {totalCount} ✨</p>
              : <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:THEME.textLight }}>{correctCount} из {totalCount} верно</p>}
          </div>

          {/* b) Награды — крупные чипы */}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:18 }}>
            <span style={{ background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.5)', borderRadius:99, padding:'9px 20px', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:isDarkUi?'#fbbf24':'#b45309' }}>
              ⚡ +{sessionXp} XP{sMult > 1 && <span style={{ fontSize:11.5, fontWeight:700, opacity:0.8 }}> · ×{sMult} стрик</span>}
            </span>
            <span style={{ background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.5)', borderRadius:99, padding:'9px 20px', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:'#a78bfa' }}>💎 +{shownCrystals}</span>
            {hadPerfect && (
              <span style={{ background:'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius:99, padding:'9px 18px', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:'#1a1a2e' }}>🔥 Perfect combo!</span>
            )}
          </div>

          {/* Исход боя с боссом (механика не менялась) */}
          {bossActive && battleResult === 'win' && (
            <div style={{ background:'linear-gradient(135deg, rgba(212,175,55,0.14), rgba(102,178,255,0.10))', border:'1px solid rgba(212,175,55,0.5)', borderRadius:14, padding:'16px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:120, flexShrink:0 }}><Boss3D bossId={bossId} hpPct={10} shake={false} height={100} /></div>
              <div>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:'#b8860b' }}>🏆 Босс повержен!</div>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.textLight, marginTop:2 }}>Бонус сверху: <b style={{ color:'#a78bfa' }}>+5 💎</b> и <b style={{ color:'#22c55e' }}>+20 XP</b></div>
              </div>
            </div>
          )}
          {bossActive && battleResult !== 'win' && (
            <div style={{ background:'rgba(99,102,241,0.06)', border:`1px solid ${THEME.border}`, borderRadius:14, padding:'14px 18px', marginBottom:14, textAlign:'center' }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:15, color:THEME.primary }}>Босс ушёл, но ты всё равно прокачался 💪</div>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.textLight, marginTop:3 }}>Все награды за ответы засчитаны. Попробуй снова в другой раз!</div>
            </div>
          )}

          {/* c) Стрик: прогресс до следующего порога множителя */}
          <div style={{ ...card, padding:'14px 18px', marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, flexWrap:'wrap', marginBottom:8 }}>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.text }}>
                🔥 {effStreak >= 2 ? <>{effStreak} {plural(effStreak, ['день','дня','дней'])} подряд!</> : 'Серия дней началась!'}
              </span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight }}>
                {nextThr
                  ? <>Ещё {nextThr - effStreak} {plural(nextThr - effStreak, ['день','дня','дней'])} до множителя <b style={{ color:isDarkUi?'#fbbf24':'#b45309' }}>×{nextMult}</b></>
                  : <b style={{ color:isDarkUi?'#fbbf24':'#b45309' }}>Максимальный множитель ×2.0!</b>}
              </span>
            </div>
            <div style={{ height:8, background:isDarkUi?'rgba(148,163,184,0.2)':'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${streakPct}%`, background:'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius:99, transition:'width 0.5s' }}/>
            </div>
          </div>

          {/* d) Грузовой зонд с лутом — доставка дроном (3D) */}
          <div style={{ ...card, padding:'18px 18px 20px', marginBottom:14, textAlign:'center' }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight }}>Твоя награда</div>
            {/* 3D-сцена: дрон → сброс → отлёт → капсула; CSS-капсула — фолбэк без WebGL */}
            <ProbeScene3D
              tier={probeTier}
              state={probeOpened ? 'open' : 'delivering'}
              onLanded={() => setProbeLanded(true)}
              onOpenComplete={() => setProbeAnimDone(true)}
              width={360}
              height={280}
              fallback={
                <div style={{ position:'relative', width:170, height:80, margin:'34px auto 14px' }}>
                  {probeOpened && (
                    <div style={{ position:'absolute', inset:-26, background:`radial-gradient(circle, ${PROBE.accent}55, transparent 68%)`, pointerEvents:'none' }}/>
                  )}
                  {/* Капсула: корпус + маркировочные полосы + иллюминатор */}
                  <div style={{ position:'absolute', inset:0, borderRadius:44, background:PROBE.body, border:'2px solid rgba(0,0,0,0.28)', boxShadow: probeOpened ? `0 0 24px ${PROBE.accent}88` : 'none', transition:'box-shadow 0.5s', overflow:'hidden' }}>
                    {[26, 130].map(x => <div key={x} style={{ position:'absolute', top:0, bottom:0, left:x, width:9, background:PROBE.accent, opacity:0.85 }}/>)}
                    <div style={{ position:'absolute', top:26, left:'50%', transform:'translateX(-50%)', width:22, height:22, borderRadius:'50%', background:'#0b1220', border:`2px solid ${PROBE.accent}` }}/>
                  </div>
                  {probeOpened && [0,1,2].map(i => (
                    <span key={i} style={{ position:'absolute', top:-18 - (i === 1 ? 8 : 0), left:`${30 + i * 16}%`, fontSize: i === 1 ? 22 : 17 }}>💎</span>
                  ))}
                </div>
              }
            />
            {/* Название тира — под капсулой */}
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.text, marginTop:6 }}>
              {PROBE.name}{PROBE.note && <span style={{ fontSize:11.5, fontWeight:700, color:isDarkUi?'#fbbf24':'#b45309' }}> · {PROBE.note}</span>}
            </div>
            {!probeOpened ? (
              probeLanded ? (
                <button onClick={openProbe}
                  style={{ ...BTN_GOLD, marginTop:12, borderRadius:10, padding:'11px 34px', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 0 16px rgba(251,191,36,0.35)' }}>
                  Открыть зонд
                </button>
              ) : (
                <div style={{ marginTop:12, fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.textLight }}>📡 Дрон доставляет груз…</div>
              )
            ) : probeAnimDone ? (
              /* «+N 💎» — после того как створка доиграла открытие */
              <div style={{ marginTop:6, animation: 'lootPop 0.5s ease both' }}>
                <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:30, color:'#a78bfa', textShadow: isDarkUi ? '0 0 16px rgba(167,139,250,0.5)' : 'none' }}>+{probeCount} 💎</span>
              </div>
            ) : (
              <div style={{ marginTop:6, height:38 }}/>
            )}
          </div>

          {/* e) Навыки — карточки результата */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            {uniqSkills.map(q => {
              const st = degraded.has(q.skillId) ? 'deg' : correct.has(q.skillId) ? 'ok' : wrong.has(q.skillId) ? 'warn' : null;
              if (!st) return null;
              const days = SRS_INTERVALS[Math.min(q.reviewStage + 1, 5) - 1];
              const S = {
                ok:   { bg:'rgba(34,197,94,0.08)',  border: isDarkUi?'rgba(74,222,128,0.4)':'#86efac', icon:'✅', color: isDarkUi?'#bbf7d0':'#166534', note:`→ повторение через ${days} дн.`,  noteColor: isDarkUi?'#4ade80':'#15803d' },
                warn: { bg:'rgba(251,191,36,0.08)', border: isDarkUi?'rgba(252,211,77,0.4)':'#fde68a', icon:'⚠️', color: isDarkUi?'#fde68a':'#78350f', note:'→ повторение завтра',             noteColor: isDarkUi?'#fcd34d':'#92400e' },
                deg:  { bg:'rgba(239,68,68,0.08)',  border: isDarkUi?'rgba(248,113,113,0.4)':'#fca5a5', icon:'💀', color: isDarkUi?'#fecaca':'#b91c1c', note:'— деградация, повтори Этап 3',    noteColor: isDarkUi?'#f87171':'#dc2626' },
              }[st];
              return (
                <div key={q.skillId} style={{ background:S.bg, border:`1px solid ${S.border}`, borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{S.icon}</span>
                  <span style={{ flex:'1 1 180px', fontFamily:"'Inter',sans-serif", fontSize:13.5, fontWeight:700, color:S.color }}>{q.skillName}</span>
                  <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:S.noteColor, flexShrink:0 }}>{S.note}</span>
                </div>
              );
            })}
          </div>

          {/* f) Прогресс до следующего уровня */}
          <div style={{ ...card, padding:'13px 18px', marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, marginBottom:7 }}>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:THEME.text }}>Уровень {lvl.level} → {lvl.level + 1}</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight }}>осталось <b style={{ color:isDarkUi?'#a5b4fc':'#4f46e5' }}>{xpLeft} XP</b></span>
            </div>
            <div style={{ height:8, background:isDarkUi?'rgba(148,163,184,0.2)':'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.round(lvl.progress * 100)}%`, background:'linear-gradient(90deg,#818cf8,#a78bfa)', borderRadius:99, transition:'width 0.5s' }}/>
            </div>
          </div>

          {/* Социальный nudge — без запросов: friends уже в профиле */}
          {friendsCount > 0 ? (
            <div style={{ ...card, padding:'12px 16px', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>👥</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.text }}>
                У тебя {friendsCount} {plural(friendsCount, ['друг','друга','друзей'])} — загляни в рейтинг: кто сегодня впереди?
              </span>
            </div>
          ) : (
            <div style={{ ...card, padding:'12px 16px', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🤝</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.text }}>
                Пригласи друзей — соревнуйтесь каждый день!
              </span>
            </div>
          )}

          {/* g) CTA */}
          <button onClick={onBack} style={{ ...BTN_DARK, width:'100%', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  // ── PLAYING ──
  if (!current) return null;
  const task = current.task;
  const isCorrectAnswer = chosen !== null && task.correct === chosen;
  const isDanger = (skillLives[current?.skillId] ?? 2) === 0;
  const lives = skillLives[current?.skillId] ?? 2;
  const bossHpPct = bossMax ? (bossHp / bossMax) * 100 : 0;
  const bossHpColor = bossHpPct > 60 ? '#22c55e' : bossHpPct > 30 ? '#f59e0b' : '#ef4444';


  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:BG, position:'relative' }}>
      {/* Живой 3D-фон мирного режима (космос+планета). В бою — НЕ рендерим (свой
          WebGL-контекст у BattleScene3D); откат на CSS-градиент — DAILY_BG_3D=false. */}
      {DAILY_BG_3D && !bossActive && (
        <DailyBackground3D
          isDark={isDarkUi}
          progress={queue.length ? qIdx / queue.length : 0}
          boostSeq={bgBoostSeq}
          glitchSeq={bgGlitchSeq}
        />
      )}
      {/* Анимации геймификации (combo, XP-флоат, HP-бар) + hover вариантов */}
      <style>{`
        @keyframes xpFloatUp { 0% { opacity:0; transform:translateY(8px); } 15% { opacity:1; transform:translateY(0); } 70% { opacity:1; } 100% { opacity:0; transform:translateY(-26px); } }
        @keyframes perfectPop { 0% { transform:scale(0.55); opacity:0; } 18% { transform:scale(1.1); opacity:1; } 75% { transform:scale(1); opacity:1; } 100% { transform:scale(1); opacity:0; } }
        @keyframes comboPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.18); } }
        @keyframes cardFlash {
          0%,100% { box-shadow:0 0 0 2px rgba(251,191,36,0.45), 0 0 22px rgba(251,191,36,0.25); }
          50%     { box-shadow:0 0 0 4px rgba(251,191,36,0.9),  0 0 36px rgba(251,191,36,0.55); }
        }
        @keyframes hpShake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-4px); } 50% { transform:translateX(4px); } 75% { transform:translateX(-2px); } }
        .daily-opt { transition: all 0.15s ease; cursor:pointer; }
        .daily-opt:not(:disabled):hover { border-color:#fbbf24 !important; background:${isDarkUi ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.07)'} !important; transform:translateY(-1px); }
      `}</style>

      {/* 💎 PERFECT COMBO ×5 — оверлей по центру на ~1 сек */}
      {perfectFlash && (
        <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, pointerEvents:'none' }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:40, color:'#fbbf24', textShadow:'0 0 30px rgba(251,191,36,0.8)', background:'rgba(10,14,28,0.82)', padding:'20px 42px', borderRadius:20, border:'2px solid rgba(251,191,36,0.6)', animation: 'perfectPop 1.25s ease forwards', whiteSpace:'nowrap' }}>
            💎 PERFECT COMBO ×5
          </div>
        </div>
      )}

      {/* ⚔️ Интро — VS-экран в стиле Dota 2: горизонтальный слайд + экшен-эффекты */}
      {bossIntroPhase === 'intro' && (() => {
        const pName = user?.firstName || 'Ты';
        const pLevel = getLevelInfo(Number(user?.xp) || 0).level;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
        const modelH = Math.round(vh * 0.94); // канвас выше половины → нижняя часть обрезается краем
        const sparks = (palette, n, seed) => Array.from({ length: n }).map((_, i) => {
          const left = (i * 53 + seed) % 100;
          const dur = 2.4 + ((i * 7) % 12) / 10;   // 2.4..3.6с
          const delay = ((i * 13) % 28) / 10;       // 0..2.7с
          const sz = 2 + (i % 3);
          const c = palette[i % palette.length];
          return <span key={i} style={{ position:'absolute', left:left+'%', bottom:'-4%', width:sz, height:sz, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}`, opacity:0, animation:`vs-rise ${dur}s linear ${delay}s infinite` }}/>;
        });
        return (
        <div style={{ position:'fixed', inset:0, zIndex:200, overflow:'hidden', animation:'vs-fade 3s ease forwards' }}>
          <style>{`
            @keyframes vs-fade{0%{opacity:0}7%{opacity:1}90%{opacity:1}100%{opacity:0}}
            @keyframes vs-shake{0%,9%{transform:translate(0,0)}10%{transform:translate(-3px,2px)}12%{transform:translate(3px,-2px)}14%{transform:translate(-3px,-2px)}16%{transform:translate(2px,3px)}18%{transform:translate(-2px,2px)}20%{transform:translate(3px,-1px)}23%,100%{transform:translate(0,0)}}
            @keyframes vs-top{0%,84%{transform:translateY(0)}100%{transform:translateY(-105%)}}
            @keyframes vs-bottom{0%,84%{transform:translateY(0)}100%{transform:translateY(105%)}}
            @keyframes vs-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}}
            @keyframes vs-boss-slide{0%{transform:translateX(120%)}100%{transform:translateX(0)}}
            @keyframes vs-player-slide{0%{transform:translateX(-120%)}100%{transform:translateX(0)}}
            @keyframes vs-redflash{0%,9%{opacity:0}13%{opacity:1}26%,100%{opacity:0}}
            @keyframes vs-name{0%,63%{opacity:0;transform:translateY(10px)}73%,100%{opacity:1;transform:translateY(0)}}
            @keyframes vs-line-appear{0%,40%{opacity:0;transform:translateY(-50%) scaleX(0)}43%{opacity:1;transform:translateY(-50%) scaleX(1)}100%{opacity:1;transform:translateY(-50%) scaleX(1)}}
            @keyframes vs-line-flow{0%{background-position:0% 0}100%{background-position:200% 0}}
            @keyframes vs-badge{0%,50%{opacity:0;transform:translate(-50%,-50%) scale(0)}57%{opacity:1;transform:translate(-50%,-50%) scale(1.5)}63%{transform:translate(-50%,-50%) scale(0.92)}67%{transform:translate(-50%,-50%) scale(1.06)}71%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
            @keyframes vs-white{0%,50%{opacity:0}53%{opacity:0.5}60%,100%{opacity:0}}
            @keyframes vs-shock{0%,50%{opacity:0;transform:translate(-50%,-50%) scale(0)}52%{opacity:0.9}64%{opacity:0;transform:translate(-50%,-50%) scale(3)}100%{opacity:0}}
            @keyframes vs-ray{0%,50%{opacity:0;transform:scaleX(0)}54%{opacity:1}55%{transform:scaleX(1)}66%{opacity:0;transform:scaleX(1.25)}100%{opacity:0}}
            @keyframes vs-rise{0%{transform:translateY(0);opacity:0}12%{opacity:0.9}88%{opacity:0.6}100%{transform:translateY(-46vh);opacity:0}}
          `}</style>

          {/* сцена со screen-shake при появлении босса */}
          <div style={{ position:'absolute', inset:0, animation:'vs-shake 3s ease forwards' }}>

            {/* ВЕРХ — территория босса */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'50%', overflow:'hidden', animation:'vs-top 3s ease forwards' }}>
              <div style={{ position:'absolute', inset:0, zIndex:0, background:'linear-gradient(135deg,#1a0a0a,#3a0a2a)', boxShadow:'inset 0 0 120px 10px rgba(0,0,0,0.6)', animation:'vs-pulse 2s ease-in-out infinite' }}/>
              {sparks(['#ff6b35','#ffae42','#ff3b3b'], 20, 17)}
              <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', boxShadow:'inset 0 0 80px 6px rgba(255,0,0,0.45)', animation:'vs-redflash 3s ease forwards' }}/>
              <div style={{ position:'absolute', top:'30%', left:'7%', transform:'translateY(-50%)', textAlign:'left', zIndex:3, animation:'vs-name 3s ease forwards' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:54, color:'#fff', textShadow:'0 0 24px rgba(255,60,80,0.75), 0 2px 10px rgba(0,0,0,0.85)', whiteSpace:'nowrap' }}>{bossName}</div>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:16, color:'rgba(255,200,200,0.9)', marginTop:8 }}>Tier {bossDef.tier} · {bossDef.hp} HP{bossDef.description ? ` · ${bossDef.description}` : ''}</div>
              </div>
              <div style={{ position:'absolute', top:Math.round(-modelH*0.05), right:'-4%', width:modelH, height:modelH, zIndex:2, filter:'drop-shadow(0 0 40px rgba(255,60,60,0.5))', animation:'vs-boss-slide 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}>
                <Boss3D bossId={bossId} hpPct={100} height={modelH}/>
              </div>
            </div>

            {/* НИЗ — территория игрока */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'50%', overflow:'hidden', animation:'vs-bottom 3s ease forwards' }}>
              <div style={{ position:'absolute', inset:0, zIndex:0, background:'linear-gradient(135deg,#0a0a2a,#0a1a3a)', boxShadow:'inset 0 0 120px 10px rgba(0,0,0,0.6)', animation:'vs-pulse 2s ease-in-out infinite' }}/>
              {sparks(['#60a5fa','#7dd3fc','#a5b4fc'], 20, 41)}
              <div style={{ position:'absolute', top:Math.round(-modelH*0.12), left:'-6%', width:modelH, height:modelH, zIndex:2, filter:'drop-shadow(0 0 36px rgba(96,165,250,0.5))', animation:'vs-player-slide 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.5s both' }}>
                <Character3D gender={user?.gender || 'male'} equipped={user?.equipped} height={modelH} autoSpin={0} animation="idle"/>
              </div>
              <div style={{ position:'absolute', top:'40%', right:'7%', transform:'translateY(-50%)', textAlign:'right', zIndex:3, animation:'vs-name 3s ease forwards' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:54, color:'#fff', textShadow:'0 0 24px rgba(96,165,250,0.75), 0 2px 10px rgba(0,0,0,0.85)', whiteSpace:'nowrap' }}>{pName}</div>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:16, color:'rgba(200,220,255,0.9)', marginTop:8 }}>Уровень {pLevel}</div>
              </div>
            </div>

            {/* Огненно-энергетический разделитель (бегущий градиент) */}
            <div style={{ position:'absolute', top:'50%', left:0, right:0, height:4, zIndex:4, transformOrigin:'center', background:'linear-gradient(90deg, #fbbf24, #ff3b3b, #fbbf24, #ff3b3b, #fbbf24)', backgroundSize:'200% 100%', boxShadow:'0 0 22px rgba(251,191,36,0.95), 0 0 10px rgba(255,60,60,0.8)', animation:'vs-line-appear 3s ease forwards, vs-line-flow 1.1s linear infinite' }}/>

            {/* Ударная волна + лучи из центра (момент VS) */}
            <div style={{ position:'absolute', top:'50%', left:'50%', width:120, height:120, marginLeft:-60, marginTop:-60, borderRadius:'50%', border:'4px solid rgba(251,191,36,0.9)', zIndex:6, pointerEvents:'none', animation:'vs-shock 3s ease forwards' }}/>
            <div style={{ position:'absolute', top:'50%', left:'50%', zIndex:6, pointerEvents:'none' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} style={{ position:'absolute', left:0, top:0, transform:`rotate(${i*45}deg)`, transformOrigin:'0 0' }}>
                  <span style={{ display:'block', width:90, height:3, marginTop:-1.5, transformOrigin:'0 50%', background:'linear-gradient(90deg, rgba(251,191,36,0.95), rgba(255,150,0,0))', animation:'vs-ray 3s ease forwards' }}/>
                </span>
              ))}
            </div>

            {/* VS — удар scale */}
            <div style={{ position:'absolute', top:'50%', left:'50%', zIndex:7, animation:'vs-badge 3s ease forwards' }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:96, color:'#fbbf24', textShadow:'0 0 30px rgba(251,191,36,0.95), 0 0 60px rgba(255,120,0,0.6), 0 4px 12px rgba(0,0,0,0.8)', WebkitTextStroke:'2px rgba(0,0,0,0.35)' }}>VS</div>
            </div>

            {/* Белая вспышка на весь экран в момент VS */}
            <div style={{ position:'absolute', inset:0, zIndex:8, background:'#fff', opacity:0, pointerEvents:'none', animation:'vs-white 3s ease forwards' }}/>
          </div>
        </div>
        );
      })()}

      <nav data-inner-nav style={{ position:'relative', zIndex:1, background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Logo size={28}/>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {/* Заработано за сессию (live; начисление batch'ем в конце) */}
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(251,191,36,0.10)', border:'1px solid rgba(251,191,36,0.4)', borderRadius:99, padding:'5px 14px' }}>
            <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:isDarkUi?'#fbbf24':'#b45309' }}>⚡ {sessionXp} XP</span>
            <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:'#a78bfa' }}>💎 {sessionCrystals}</span>
            {sMult > 1 && (
              <span title={`Множитель дневного стрика ×${sMult}`} style={{ fontSize:11, fontWeight:800, color:'#1a1a2e', background:'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius:99, padding:'2px 8px' }}>×{sMult}</span>
            )}
          </div>
          {/* Progress */}
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight }}>
            {qIdx+1} / {queue.length}
          </div>
        </div>
        <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${THEME.border}`, borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:THEME.textLight }}>← Выйти</button>
      </nav>

      <div style={{ position:'relative', zIndex:1, maxWidth:800, margin:'0 auto', padding:'24px 20px 60px' }}>
        {/* ── Покемон-арена боя (HP боссa/игрока — оверлеями внутри сцены) ── */}
        {bossActive && (
          <>
            <style>{`@keyframes boss-dmg{0%{opacity:1;transform:translateX(-50%) translateY(0);}100%{opacity:0;transform:translateX(-50%) translateY(-30px);}}`}</style>
            <div style={{ position:'relative', marginBottom:18, borderRadius:14, overflow:'hidden', border:'1px solid rgba(102,178,255,0.25)' }}>
              <BattleScene3D
                equipped={user?.equipped} gender={user?.gender || 'male'}
                bossId={bossId} bossHp={bossHp} maxHp={bossMax}
                attackSeq={attackSeq} hitSeq={hitSeq}
                playerHp={playerHp} playerMaxHp={maxPlayerHp} playerName={user?.firstName || 'Ты'}
                hud={bossIntroPhase !== 'intro'}
                height={Math.round((typeof window !== 'undefined' ? window.innerHeight : 900) * 0.46)}
              />
              {dmgMsg && <div style={{ position:'absolute', top:'42%', left:'72%', color:'#ef4444', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:20, whiteSpace:'nowrap', textShadow:'0 2px 6px rgba(0,0,0,0.7)', animation:'boss-dmg 0.7s ease forwards', pointerEvents:'none' }}>{dmgMsg}</div>}
              {bossHp <= 0 && <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:'#f5c518', textShadow:'0 0 14px rgba(0,0,0,0.8)', pointerEvents:'none' }}>🏆 Босс повержен!</div>}
              {bossHp > 0 && playerHp <= 0 && <div style={{ position:'absolute', bottom:12, left:16, fontFamily:"'Inter',sans-serif", fontSize:13, color:'rgba(255,255,255,0.85)', textShadow:'0 1px 4px rgba(0,0,0,0.7)', pointerEvents:'none' }}>Босс одолел… но учёба идёт</div>}
            </div>
          </>
        )}
        {/* Сегментированный прогресс-бар: сегмент = задача (✓ зелёный / ✗ красный /
            текущая синяя / впереди серая) + combo-бейдж справа */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div style={{ flex:1, display:'flex', gap:4 }}>
            {queue.map((_, i) => {
              const answered = i < answers.length;
              const bg = answered
                ? (answers[i] ? '#22c55e' : '#ef4444')
                : i === qIdx
                  ? '#3b82f6'
                  : isDarkUi ? 'rgba(148,163,184,0.25)' : '#e2e8f0';
              return (
                <span key={i} style={{ flex:1, height:11, borderRadius:6, background:bg, transition:'background 0.3s',
                  boxShadow: (!answered && i === qIdx) ? '0 0 8px rgba(59,130,246,0.55)' : 'none' }}/>
              );
            })}
          </div>
          {streak >= 2 && (
            <span style={{ flexShrink:0, fontFamily:"'Montserrat',sans-serif", fontWeight:800,
              fontSize: streak >= 5 ? 14 : streak >= 3 ? 13 : 12,
              color:'#1a1a2e', background:'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius:99,
              padding: streak >= 3 ? '5px 14px' : '4px 11px',
              boxShadow:'0 0 12px rgba(251,191,36,0.5)',
              animation: comboFlash ? 'comboPulse 0.45s ease 2' : 'none', whiteSpace:'nowrap' }}>
              {streak >= 5 ? `💎 PERFECT ×${streak}` : streak >= 3 ? `🔥🔥 ×${streak}!` : `🔥 ×${streak}`}
            </span>
          )}
        </div>

        {/* Danger alert if lives=0 and last wrong */}
        {lastWrongWasDanger && (
          <div style={{ background:'rgba(239,68,68,0.08)', border:`1px solid ${isDarkUi?'rgba(248,113,113,0.45)':'#fca5a5'}`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontFamily:"'Inter',sans-serif", fontSize:13, color:isDarkUi?'#f87171':'#dc2626' }}>
            💀 Жизней нет! Навык <b>{current.skillName}</b> деградировал — кристалл потускнеет. Чтобы вернуть золото, нужно заново пройти Этап 3.
          </div>
        )}
        {!lastWrongWasDanger && revealed && !isCorrectAnswer && lives > 0 && (
          <div style={{ background:'rgba(251,191,36,0.08)', border:`1px solid ${isDarkUi?'rgba(252,211,77,0.45)':'#fde68a'}`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontFamily:"'Inter',sans-serif", fontSize:13, color:isDarkUi?'#fcd34d':'#92400e' }}>
            🛡️ Жизнь потрачена! Осталось: {'❤️'.repeat(lives)}{'🖤'.repeat(2-lives)}
          </div>
        )}

        {/* Карточка задачи */}
        <div className="theme-card" style={{
          position:'relative', flex:'1 1 auto', minWidth:0,
          background: isDarkUi ? THEME.surface : '#fffdf8',
          border:`1px solid ${THEME.border}`, borderRadius:16, padding:'24px 28px',
          boxShadow: streak >= 2
            ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 22px rgba(251,191,36,0.25), 0 8px 32px rgba(10,25,47,0.08)'
            : '0 8px 32px rgba(10,25,47,0.08)',
          animation: comboFlash ? 'cardFlash 0.5s ease 2' : 'none',
          transition:'box-shadow 0.3s',
        }}>
          {/* Всплывающий «+N XP» после верного ответа */}
          {xpFloat && (
            <div key={xpFloat.key} style={{ position:'absolute', top:-14, right:20, zIndex:5, pointerEvents:'none', textAlign:'right',
              animation: 'xpFloatUp 1.5s ease forwards' }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:19, color:'#22c55e', textShadow: isDarkUi ? '0 0 12px rgba(34,197,94,0.6)' : '0 1px 3px rgba(255,255,255,0.9)' }}>{xpFloat.text}</div>
              {xpFloat.speed && <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, color:'#f59e0b' }}>⚡ +3 XP Speed bonus</div>}
            </div>
          )}

          {/* Лейбл навыка (с цветной полоской, как в плане) + HP-бар жизней */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:16 }}>
            <div style={{ borderLeft:'4px solid #fbbf24', paddingLeft:11, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, color:THEME.text, lineHeight:1.35, flex:'1 1 200px', minWidth:0 }}>
              {current.skillName}
            </div>
            {(() => {
              const hpColor = lives === 2 ? '#22c55e' : lives === 1 ? '#f59e0b' : '#ef4444';
              return (
                <div key={lives} style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, animation: lives < 2 ? 'hpShake 0.5s ease' : 'none' }}>
                  <div style={{ width:110, height:10, background: isDarkUi?'rgba(148,163,184,0.2)':'#e2e8f0', borderRadius:99, overflow:'hidden', border:`1px solid ${isDarkUi?'rgba(148,163,184,0.3)':'#cbd5e1'}` }}>
                    <div style={{ height:'100%', width:`${(lives/2)*100}%`, background:hpColor, borderRadius:99, transition:'width 0.4s ease, background 0.4s' }}/>
                  </div>
                  <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, fontWeight:700, color:hpColor, whiteSpace:'nowrap' }}>
                    {lives === 2 ? '2/2 жизни' : lives === 1 ? '1/2 — осторожно!' : '0/2 — жизней нет'}
                  </span>
                </div>
              );
            })()}
          </div>

          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:16, color:THEME.text, lineHeight:1.75, marginBottom:20 }}>
            <LatexText text={task.text || task.question_text || task.question || ''}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(task.options || []).map((opt, i) => {
              let bg = THEME.bg, border = THEME.border, color = THEME.text;
              if (revealed) {
                if (i === task.correct) {
                  bg = isDarkUi ? 'rgba(34,197,94,0.15)' : '#dcfce7';
                  border = '#4ade80';
                  color = isDarkUi ? '#4ade80' : '#15803d';
                } else if (i === chosen && i !== task.correct) {
                  bg = isDarkUi ? 'rgba(239,68,68,0.15)' : '#fee2e2';
                  border = isDarkUi ? '#f87171' : '#fca5a5';
                  color = isDarkUi ? '#f87171' : '#dc2626';
                }
              } else if (chosen === i) { bg='rgba(251,191,36,0.08)'; border='#fbbf24'; }
              return (
                <button key={i} className="daily-opt" onClick={() => handleChoose(i)} disabled={revealed}
                  style={{ background:bg, border:`2px solid ${border}`, color, borderRadius:12, padding:'14px 18px', textAlign:'left', cursor:revealed?'default':'pointer', fontFamily:"'Inter',sans-serif", fontSize:16 }}>
                  <span style={{ fontWeight:700, marginRight:10 }}>{['А','Б','В','Г'][i]}.</span>
                  <LatexText text={opt}/>
                </button>
              );
            })}
          </div>
          {revealed && task.explanation && (
            <div style={{ marginTop:14,
              background: isCorrectAnswer ? (isDarkUi?'rgba(34,197,94,0.10)':'#f0fdf4') : (isDarkUi?'rgba(239,68,68,0.10)':'#fef2f2'),
              border:`1px solid ${isCorrectAnswer ? (isDarkUi?'rgba(74,222,128,0.4)':'#bbf7d0') : (isDarkUi?'rgba(248,113,113,0.4)':'#fecaca')}`,
              borderRadius:10, padding:'10px 14px', fontSize:13, color:THEME.text, fontFamily:"'Inter',sans-serif", lineHeight:1.6 }}>
              💡 <LatexText text={task.explanation}/>
            </div>
          )}
          {revealed && (
            <button onClick={handleNext} disabled={saving}
              style={{ ...BTN_DARK, marginTop:16, width:'100%', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {qIdx < queue.length-1 ? 'Следующая задача →' : saving ? 'Сохраняем...' : 'Завершить миссию'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
