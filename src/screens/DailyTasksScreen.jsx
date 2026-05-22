import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { THEME } from "../lib/appConstants.js";
import { getAlmatyDateStr, SRS_INTERVALS } from "../lib/srsUtils.js";
import { addPoints } from "../lib/pointsUtils.js";
import Logo from "../components/ui/Logo.jsx";
import LatexText from "../components/ui/LatexText.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import { useNpc } from "../NpcContext.jsx";

export default function DailyTasksScreen({ user, onBack, onOpenDiagnostics, onViewPlan, onOpenFaq }) {
  const { showNpcMessage } = useNpc();
  const BG = '#f8fafc';
  const [phase,    setPhase]    = useState('loading'); // loading|playing|done|empty
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
  const [streak,   setStreak]   = useState(0); // consecutive correct answers (for NPC encouragement)
  const questionStartRef = useRef(0);
  const streak3AwardedRef = useRef(false);

  const shuf = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

  // Засекаем время появления вопроса (для fast_answer < 10s)
  useEffect(() => {
    if (phase === 'playing') questionStartRef.current = Date.now();
  }, [phase, qIdx]);

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

        // Skills due for review today (all due skills, no hard cap)
        const dueEntries = masteredEntries
          .filter(([, ms]) => ms.next_review_date && ms.next_review_date <= today);
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
        setPhase('playing');
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
    if (isCorrect) {
      setCorrect(p => new Set([...p, current.skillId]));
      setLastWrongWasDanger(false);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak >= 3 && nextStreak % 3 === 0) {
        showNpcMessage('streak', 4000);
      }
      // ── Points ────────────────────────────────────────────────────────────
      const elapsed = questionStartRef.current ? Date.now() - questionStartRef.current : Infinity;
      addPoints(user.uid, 'daily_correct', user);
      if (elapsed < 10000) addPoints(user.uid, 'fast_answer', user);
      if (nextStreak === 3 && !streak3AwardedRef.current) {
        streak3AwardedRef.current = true;
        addPoints(user.uid, 'daily_streak_3', user);
      }
    } else {
      setStreak(0);
      const curLives = skillLives[current.skillId] ?? 2;
      if (curLives <= 0) {
        // No lives left for this skill — degrade it
        setDegraded(p => new Set([...p, current.skillId]));
        setLastWrongWasDanger(true);
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
      await saveSession();
      setSaving(false);
      setPhase('done');
    }
  };

  const saveSession = async () => {
    if (!user?.phone) return;
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
      // day_streak_7: один раз навсегда при первом достижении 7 дней подряд
      const alreadyAwarded = data?.bonusesAwarded?.streak7 === true;
      if (newStreak >= 7 && !alreadyAwarded) {
        const ok = await addPoints(user.uid, 'day_streak_7', user);
        if (ok) {
          try { await updateDoc(userRef, { 'bonusesAwarded.streak7': true }); }
          catch (e) { console.error('streak7 flag:', e); }
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
          background: primary ? '#6366f1' : 'transparent',
          color: primary ? '#fff' : THEME.textLight,
          border: primary ? 'none' : `1px solid ${THEME.border}`,
          borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}
      >{label}</button>
    );

    // 1) Диагностика не пройдена
    if (emptyReason === 'no-diag') return (
      <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
        <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} />
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
          <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} />
          <div style={{ maxWidth:520, margin:'48px auto', padding:'0 24px', textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>🎓</div>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:8 }}>Освой первый навык</h2>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:THEME.textLight, lineHeight:1.6, marginBottom:24 }}>
              Ежедневные задачи откроются, как только в плане появится первый освоенный навык.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, textAlign:'left', maxWidth:420, margin:'0 auto' }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', background:'#fff', border:`1px solid ${THEME.border}`, borderRadius:12, padding:'12px 14px' }}>
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

    // 3) Все освоенные навыки повторены — ждём следующую дату
    if (emptyReason === 'wait-until') {
      const fmt = (ymd) => {
        try {
          const [y,m,d] = ymd.split('-').map(Number);
          return new Date(y, m-1, d).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
        } catch { return ymd; }
      };
      return (
        <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
          <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} />
          <div style={{ maxWidth:520, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>📅</div>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:8 }}>Всё повторено!</h2>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.textLight, lineHeight:1.7 }}>
              Следующая разминка — <b style={{ color:THEME.primary }}>{nextReviewDate ? fmt(nextReviewDate) : '—'}</b>. А пока можно освоить ещё пару навыков из плана.
            </p>
            <Btn onClick={()=>onViewPlan?.()} label="🗺️ Освоить ещё навыки" />
          </div>
        </div>
      );
    }

    // 4) Fallback — что-то пошло не так / нет данных / пользователь без uid
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
        <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} />
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

  // ── DONE ──
  if (phase === 'done') {
    const degradedList = queue.filter(q => degraded.has(q.skillId));
    const correctList  = queue.filter(q => correct.has(q.skillId));
    const wrongList    = queue.filter(q => wrong.has(q.skillId));
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
        <AppTopbar title="📝 Ежедневные задачи" onBack={onBack} />
        <div style={{ maxWidth:540, margin:'48px auto', padding:'0 24px' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{degradedList.length > 0 ? '⚠️' : '🏆'}</div>
            <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:8 }}>Разминка завершена!</h2>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:THEME.textLight }}>{correct.size} из {queue.length} верно</p>
          </div>

          {correctList.length > 0 && (
            <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid #86efac', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#15803d', marginBottom:8 }}>✅ Отлично усвоено</div>
              {correctList.map(q => {
                const nextStage = Math.min(q.reviewStage + 1, 5);
                const days = SRS_INTERVALS[nextStage - 1];
                return (
                  <div key={q.skillId} style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#166534', padding:'4px 0', borderBottom:'1px solid rgba(134,239,172,0.3)' }}>
                    {q.skillName} <span style={{ color:'#86efac', fontSize:12 }}>→ следующее повторение через {days} дн.</span>
                  </div>
                );
              })}
            </div>
          )}

          {wrongList.length > 0 && (
            <div style={{ background:'rgba(251,191,36,0.06)', border:'1px solid #fde68a', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#92400e', marginBottom:8 }}>🛡️ Жизнь потрачена — повторение завтра</div>
              {wrongList.map(q => (
                <div key={q.skillId} style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#78350f', padding:'4px 0' }}>{q.skillName}</div>
              ))}
            </div>
          )}

          {degradedList.length > 0 && (
            <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid #fca5a5', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#dc2626', marginBottom:8 }}>💀 Деградация — вернись и повтори Этап 3</div>
              {degradedList.map(q => (
                <div key={q.skillId} style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#b91c1c', padding:'4px 0' }}>
                  {q.skillName} <span style={{ fontSize:12, color:'#fca5a5' }}>— кристалл потускнел до жёлтого</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={onBack} style={{ width:'100%', background:'#6366f1', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
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

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:BG }}>
      <nav data-inner-nav style={{ background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Logo size={28}/>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Lives */}
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {[0,1].map(i => (
              <span key={i} style={{ fontSize:20, opacity: i < (skillLives[current.skillId] ?? 2) ? 1 : 0.2, transition:'opacity 0.3s' }}>❤️</span>
            ))}
          </div>
          {/* Progress */}
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight }}>
            {qIdx+1} / {queue.length}
          </div>
        </div>
        <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${THEME.border}`, borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:THEME.textLight }}>← Выйти</button>
      </nav>

      <div style={{ maxWidth:660, margin:'0 auto', padding:'24px 20px 60px' }}>
        {/* Progress bar */}
        <div style={{ height:5, background:'#e2e8f0', borderRadius:3, overflow:'hidden', marginBottom:20 }}>
          <div style={{ height:'100%', width:`${((qIdx)/queue.length)*100}%`, background:'#6366f1', transition:'width 0.4s' }}/>
        </div>

        {/* Skill chips (mini map) */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
          {queue.map((q, i) => {
            const done = i < qIdx;
            const active = i === qIdx;
            const isCorr = done && correct.has(q.skillId);
            const isDeg = done && degraded.has(q.skillId);
            return (
              <div key={q.skillId} style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontFamily:"'Inter',sans-serif", fontWeight:600,
                background: isDeg?'rgba(239,68,68,0.1)':isCorr?'rgba(34,197,94,0.1)':active?'rgba(99,102,241,0.12)':'#f1f5f9',
                border:`1px solid ${isDeg?'#fca5a5':isCorr?'#86efac':active?'#6366f1':'#e2e8f0'}`,
                color: isDeg?'#dc2626':isCorr?'#15803d':active?'#6366f1':'#94a3b8' }}>
                {isDeg?'💀':isCorr?'✓':active?'▶':''} {q.skillName}
              </div>
            );
          })}
        </div>

        {/* Danger alert if lives=0 and last wrong */}
        {lastWrongWasDanger && (
          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid #fca5a5', borderRadius:10, padding:'10px 14px', marginBottom:16, fontFamily:"'Inter',sans-serif", fontSize:13, color:'#dc2626' }}>
            💀 Жизней нет! Навык <b>{current.skillName}</b> деградировал — кристалл потускнеет. Чтобы вернуть золото, нужно заново пройти Этап 3.
          </div>
        )}
        {!lastWrongWasDanger && revealed && !isCorrectAnswer && lives > 0 && (
          <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', marginBottom:16, fontFamily:"'Inter',sans-serif", fontSize:13, color:'#92400e' }}>
            🛡️ Жизнь потрачена! Осталось: {'❤️'.repeat(lives)}{'🖤'.repeat(2-lives)}
          </div>
        )}

        {/* Task card */}
        <div style={{ background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:16, padding:'22px 24px', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
          {/* Skill label */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ background:'rgba(99,102,241,0.08)', borderRadius:20, padding:'4px 12px', fontFamily:"'Inter',sans-serif", fontSize:12, color:'#6366f1', fontWeight:600 }}>
              {current.skillName}
            </div>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:THEME.textLight }}>
              {isDanger ? '💀 Жизней нет' : `${'❤️'.repeat(lives)} ${lives} жизни`}
            </div>
          </div>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:16, color:THEME.text, lineHeight:1.75, marginBottom:20 }}>
            <LatexText text={task.text || task.question_text || task.question || ''}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(task.options || []).map((opt, i) => {
              let bg = THEME.bg, border = THEME.border, color = THEME.text;
              if (revealed) {
                if (i === task.correct) { bg='#dcfce7'; border='#4ade80'; color='#15803d'; }
                else if (i === chosen && i !== task.correct) { bg='#fee2e2'; border='#fca5a5'; color='#dc2626'; }
              } else if (chosen === i) { bg='rgba(99,102,241,0.08)'; border='#6366f1'; }
              return (
                <button key={i} onClick={() => handleChoose(i)} disabled={revealed}
                  style={{ background:bg, border:`2px solid ${border}`, color, borderRadius:10, padding:'12px 16px', textAlign:'left', cursor:revealed?'default':'pointer', fontFamily:"'Inter',sans-serif", fontSize:14, transition:'all 0.15s' }}>
                  <span style={{ fontWeight:700, marginRight:8 }}>{['А','Б','В','Г'][i]}.</span>
                  <LatexText text={opt}/>
                </button>
              );
            })}
          </div>
          {revealed && task.explanation && (
            <div style={{ marginTop:14, background: isCorrectAnswer?'#f0fdf4':'#fef2f2', border:`1px solid ${isCorrectAnswer?'#bbf7d0':'#fecaca'}`, borderRadius:10, padding:'10px 14px', fontSize:13, color:THEME.text, fontFamily:"'Inter',sans-serif", lineHeight:1.6 }}>
              💡 <LatexText text={task.explanation}/>
            </div>
          )}
          {revealed && (
            <button onClick={handleNext} disabled={saving}
              style={{ marginTop:16, width:'100%', background:'#6366f1', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {qIdx < queue.length-1 ? 'Следующая задача →' : saving ? 'Сохраняем...' : 'Завершить разминку'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
