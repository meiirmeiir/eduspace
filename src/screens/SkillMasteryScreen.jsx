import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, db } from "../firestore-rest.js";
import { useTheme } from "../ThemeContext.jsx";
import { isStageUnlocked, getAlmatyDateStr, SRS_INTERVALS, getAlmatyNextMidnightAfter, fmtCountdown } from "../lib/srsUtils.js";
import { addPoints } from "../lib/pointsUtils.js";
import { addCrystals } from "../lib/crystalsUtils.js";
import { addXp, XP_REWARDS } from "../lib/levelUtils.js";
import { updateQuestProgress } from "../lib/questsUtils.js";
import Logo from "../components/ui/Logo.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import LatexText from "../components/ui/LatexText.jsx";
import { useNpc } from "../NpcContext.jsx";

// Handles 3-stage mastery flow for a single skill
export default function SkillMasteryScreen({ user, skillId, skillName, onBack, onRankRefresh }) {
  const { showNpcMessage } = useNpc();
  const { theme: THEME } = useTheme();
  const [loading,      setLoading]      = useState(true);
  const [taskData,     setTaskData]     = useState(null);   // { a:[...], b:[...], c:[...] }
  const [theory,       setTheory]       = useState(null);   // skillTheory entry
  const [mastery,      setMastery]      = useState({ stagesCompleted:0, currentStage:1, lastStageCompletedAt:null, pointsAwarded:false });
  const [phase,        setPhase]        = useState('load'); // load|theory|tasks|locked|result
  const [now,          setNow]          = useState(Date.now());
  // Practice tasks state (from skillTheory.tasks)
  const [ptAnswers,    setPtAnswers]    = useState({}); // idx → chosen option index
  const [ptRevealed,   setPtRevealed]  = useState({}); // idx → bool
  const [stage,     setStage]     = useState(1);      // 1,2,3
  const [tasks,     setTasks]     = useState([]);     // current 10 tasks
  const [taskIdx,   setTaskIdx]   = useState(0);
  const [chosen,    setChosen]    = useState(null);
  const [revealed,  setRevealed]  = useState(false);
  const [s1Score,   setS1Score]   = useState(0);      // correct count stage1
  const [s2Energy,  setS2Energy]  = useState(0);      // energy points stage2
  const [s3Streak,  setS3Streak]  = useState(0);      // consecutive correct stage3
  const [s3Total,   setS3Total]   = useState(0);      // total answered stage3
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!skillId) return;
    Promise.all([
      getDoc(doc(db, 'skillTasks',   skillId)),
      getDoc(doc(db, 'skillTheory',  skillId)),
      getDoc(doc(db, 'skillMastery', user?.uid)),
    ]).then(([tSnap, thSnap, mSnap]) => {
      setTaskData(tSnap.exists() ? tSnap.data() : null);
      setTheory(thSnap.exists() ? { id:thSnap.id, ...thSnap.data() } : null);
      const ms = mSnap.exists() ? (mSnap.data()?.skills?.[skillId] || {}) : {};
      const completed = ms.stagesCompleted || 0;
      const lastAt = ms.lastStageCompletedAt || null;
      setMastery({ stagesCompleted: completed, currentStage: Math.min(completed + 1, 3), lastStageCompletedAt: lastAt, pointsAwarded: ms.pointsAwarded === true });
      setStage(Math.min(completed + 1, 3));
      setLoading(false);
      if (completed >= 3) {
        setPhase('result');
      } else if (completed === 0) {
        setPhase('theory');
      } else if (lastAt && !isStageUnlocked(lastAt)) {
        setPhase('locked');
      } else {
        // Продолжающий навык, этап разблокирован → СРАЗУ грузим задачи нужного
        // этапа. Раньше тут был голый setPhase('tasks') без startStage → tasks=[]
        // → мёртвый экран «Задачи ещё не добавлены» при возврате на след. день.
        // Передаём свежий tSnap.data() — state `taskData` в этом тике ещё пуст.
        startStage(completed + 1, tSnap.exists() ? tSnap.data() : null);
      }
    }).catch(() => setLoading(false));
  }, [skillId, user?.phone]);

  const shuffle = arr => {
    const a = [...arr]; for (let i = a.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  };

  // taskDataOverride — свежие данные skillTasks, когда startStage зовётся из
  // useEffect-загрузки (state `taskData` там ещё не обновлён в том же тике).
  const startStage = (stageNum, taskDataOverride = null) => {
    setStage(stageNum);
    const td = taskDataOverride || taskData;
    const pool = (td?.[stageNum===1?'a':stageNum===2?'b':'c'] || []);
    setTasks(shuffle(pool).slice(0, 10));
    setTaskIdx(0); setChosen(null); setRevealed(false);
    setS1Score(0); setS2Energy(0); setS3Streak(0); setS3Total(0);
    setPhase('tasks');
  };

  const saveMasteryStage = async (completedStage) => {
    if (!user?.phone) return;
    setSaving(true);
    try {
      const newCompleted = Math.max(mastery.stagesCompleted, completedStage);
      const stageAdvanced = newCompleted > mastery.stagesCompleted; // завершён новый этап
      const now_ = new Date().toISOString();
      const skillUpdate = { stagesCompleted: newCompleted, currentStage: Math.min(newCompleted+1,3), lastStageCompletedAt: now_, updatedAt: now_ };
      // When fully mastered, schedule first SRS review (tomorrow Almaty)
      const firstMastery = newCompleted === 3 && !mastery.pointsAwarded;
      if (newCompleted === 3) {
        skillUpdate.next_review_date = getAlmatyDateStr(SRS_INTERVALS[0]);
        skillUpdate.review_stage = 1;
        if (firstMastery) skillUpdate.pointsAwarded = true;
      }
      // Dot-path: обновляем ТОЛЬКО этот навык (skills.{skillId}), не затирая остальные.
      // Раньше был setDoc(merge) с { skills: { [skillId]: ... } } → updateMask=skills →
      // Firestore заменял весь map skills, обнуляя прогресс других навыков.
      await updateDoc(doc(db,'skillMastery',user.uid), { [`skills.${skillId}`]: skillUpdate });
      setMastery({ stagesCompleted: newCompleted, currentStage: Math.min(newCompleted+1,3), lastStageCompletedAt: now_, pointsAwarded: mastery.pointsAwarded || firstMastery });
      // Квест «Пройди этап навыка» — на каждый вновь завершённый этап (1/2/3).
      if (stageAdvanced) {
        updateQuestProgress(user.uid, 'skill_stage', 1, user);
        addXp(user.uid, XP_REWARDS.skill_stage, 'skill_stage', user);
      }
      if (firstMastery) {
        addPoints(user.uid, 'skill_mastered', user);
        addCrystals(user.uid, 10, 'skill_mastered');
        addXp(user.uid, XP_REWARDS.skill_mastered, 'skill_mastered', user);
        // Квест «Освой 3 навыка за неделю» — на полное освоение навыка.
        updateQuestProgress(user.uid, 'weekly_mastered', 1, user);
      }
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const handleAnswer = async (optIdx) => {
    if (revealed) return;
    setChosen(optIdx);
    setRevealed(true);
    const correct = tasks[taskIdx]?.correct === optIdx;

    if (!correct) {
      showNpcMessage('encouragement', 5000);
    }

    if (stage === 1) {
      const newScore = s1Score + (correct ? 1 : 0);
      setS1Score(newScore);
      // Check stage completion
      if (taskIdx === tasks.length - 1) {
        if (newScore >= 8) {
          await saveMasteryStage(1);
          onRankRefresh?.();
          showNpcMessage('success', 6000);
          setPhase('result');
        }
        // else show retry
      }
    } else if (stage === 2) {
      const newEnergy = s2Energy + (correct ? 1 : 0);
      setS2Energy(newEnergy);
      if (newEnergy >= 8) {
        await saveMasteryStage(2);
        onRankRefresh?.();
        showNpcMessage('success', 6000);
        setPhase('result');
        return;
      }
    } else if (stage === 3) {
      const newStreak = correct ? s3Streak + 1 : 0;
      const newTotal  = s3Total + 1;
      setS3Streak(newStreak);
      setS3Total(newTotal);
      if (newStreak >= 5) {
        await saveMasteryStage(3);
        onRankRefresh?.();
        showNpcMessage('success', 6000);
        setPhase('result');
        return;
      }
    }
  };

  const nextTask = () => {
    if (taskIdx < tasks.length - 1) {
      setTaskIdx(i => i+1); setChosen(null); setRevealed(false);
    } else {
      // End of task list without completing
      if (stage === 1) {
        // s1Score already updated in handleAnswer, show result or retry
        setPhase('result');
      } else if (stage === 2) {
        // More tasks needed — reshuffle and continue
        const pool = taskData?.b || [];
        const more = shuffle(pool).slice(0,10);
        setTasks(more); setTaskIdx(0); setChosen(null); setRevealed(false);
      } else if (stage === 3) {
        const pool = taskData?.c || [];
        const more = shuffle(pool).slice(0,10);
        setTasks(more); setTaskIdx(0); setChosen(null); setRevealed(false);
      }
    }
  };

  const BG = '#f8fafc';
  const currentTask = tasks[taskIdx];
  const stageColors = { 1:'#6366f1', 2:'#f59e0b', 3:'#22c55e' };
  const stageNames  = { 1:'Этап 1 — Теория и задачи уровня A', 2:'Этап 2 — Задачи уровня B', 3:'Этап 3 — Задачи уровня C' };

  if (loading) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>Загрузка...</div>
    </div>
  );

  // ── THEORY PHASE ──
  if (phase === 'theory') {
    const e = theory;
    return (
      <div style={{ minHeight:'100vh', background:BG }}>
        <AppTopbar title={`📖 ${skillName || skillId}`} subtitle="Освоение навыка" onBack={onBack} />
        <div style={{ maxWidth:800, margin:'0 auto', padding:'32px 24px' }}>
          <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, padding:'14px 18px', marginBottom:24 }}>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#6366f1', marginBottom:4 }}>Этап 1 из 3 — Изучение теории</div>
            <div style={{ fontSize:12, color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>Изучи материал, затем пройди 10 задач уровня A. Нужно набрать минимум 80% для перехода на следующий этап.</div>
          </div>
          {!e ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>
              <div style={{ fontSize:40, marginBottom:16 }}>📚</div>
              <div>Теория для этого навыка ещё не добавлена.</div>
              <button onClick={() => startStage(1)} style={{ marginTop:24, background:'#6366f1', color:'#fff', border:'none', borderRadius:10, padding:'12px 28px', fontSize:15, fontWeight:600, cursor:'pointer' }}>
                {taskData?.a?.length ? 'Приступить к проверке знаний →' : 'Вернуться к плану'}
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:20 }}>{skillName || e.skill_id}</h2>

              {/* Concept block */}
              {e.theory?.concept && (
                <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#6366f1', marginBottom:8 }}>💡 Основная идея</div>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.text, lineHeight:1.8, margin:0 }}>
                    <LatexText text={e.theory.concept}/>
                  </p>
                </div>
              )}

              {/* Micro hints */}
              {(e.theory?.micro_hints || []).length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:THEME.primary, marginBottom:12 }}>📌 Микро-правила</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {(e.theory.micro_hints || []).map((hint, hi) => (
                      <div key={hi} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#6366f1', marginBottom:6 }}>{hint.skill_name}</div>
                        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:THEME.text, lineHeight:1.7, marginBottom: hint.example ? 8 : 0 }}>
                          <LatexText text={hint.rule}/>
                        </div>
                        {hint.example && (
                          <div style={{ background:'#f1f5f9', borderRadius:8, padding:'10px 14px', fontFamily:"'Inter',sans-serif", fontSize:13, color:'#475569', lineHeight:1.7 }}>
                            <span style={{ fontWeight:600, color:'#64748b' }}>Пример: </span>
                            <LatexText text={hint.example}/>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy blocks format support */}
              {!e.theory && (e.blocks || []).map((bl, bi) => (
                <div key={bi} style={{ marginBottom:16 }}>
                  {bl.type === 'text' && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.text, lineHeight:1.75, margin:0 }}><LatexText text={bl.value}/></p>}
                  {bl.type === 'formula' && <div style={{ background:'#f1f5f9', borderRadius:8, padding:'14px 18px', fontFamily:'monospace', fontSize:14, overflowX:'auto', margin:'8px 0' }}><LatexText text={bl.value}/></div>}
                  {bl.type === 'image' && <img src={bl.src} alt={bl.caption||''} style={{ maxWidth:'100%', borderRadius:8, marginTop:8 }}/>}
                </div>
              ))}

              {/* Practice tasks from skillTheory.tasks */}
              {(e.tasks || []).length > 0 && (
                <div style={{ marginTop:28, marginBottom:8 }}>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:14, color:THEME.primary, marginBottom:14 }}>
                    🧩 Тренировочные задачи
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {(e.tasks || []).map((pt, pi) => {
                      const chosen  = ptAnswers[pi] ?? null;
                      const revealed = ptRevealed[pi] || false;
                      const correctIdx = pt.correct_index ?? pt.correct ?? 0;
                      const isCorr = chosen === correctIdx;
                      return (
                        <div key={pi} style={{ background:'#fff', border:`1px solid ${revealed ? (isCorr ? '#86efac' : '#fca5a5') : THEME.border}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                          <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12, color:'#94a3b8', marginBottom:8 }}>
                            Задача {pi + 1}
                          </div>
                          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.text, lineHeight:1.75, marginBottom:14 }}>
                            <LatexText text={pt.question_text || pt.text || ''}/>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {(pt.options || []).map((opt, oi) => {
                              let bg = '#f8fafc', border = '#e2e8f0', color = THEME.text;
                              if (revealed) {
                                if (oi === correctIdx)          { bg='#dcfce7'; border='#4ade80'; color='#15803d'; }
                                else if (oi === chosen)         { bg='#fee2e2'; border='#fca5a5'; color='#dc2626'; }
                              } else if (chosen === oi)         { bg='rgba(99,102,241,0.08)'; border='#6366f1'; }
                              return (
                                <button key={oi}
                                  onClick={() => {
                                    if (revealed) return;
                                    setPtAnswers(p => ({ ...p, [pi]: oi }));
                                    setPtRevealed(p => ({ ...p, [pi]: true }));
                                  }}
                                  disabled={revealed}
                                  style={{ background:bg, border:`2px solid ${border}`, color, borderRadius:9, padding:'10px 14px', textAlign:'left', cursor:revealed?'default':'pointer', fontFamily:"'Inter',sans-serif", fontSize:14, transition:'all 0.15s' }}>
                                  <span style={{ fontWeight:700, marginRight:8 }}>{['А','Б','В','Г'][oi]}.</span>
                                  <LatexText text={opt}/>
                                </button>
                              );
                            })}
                          </div>
                          {revealed && pt.explanation && (
                            <div style={{ marginTop:12, background: isCorr?'#f0fdf4':'#fef2f2', border:`1px solid ${isCorr?'#bbf7d0':'#fecaca'}`, borderRadius:8, padding:'10px 14px', fontSize:13, color:THEME.text, fontFamily:"'Inter',sans-serif", lineHeight:1.6 }}>
                              💡 <LatexText text={pt.explanation}/>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginTop:32 }}>
                <button onClick={() => { if (taskData?.a?.length) startStage(1); else setPhase('result'); }}
                  style={{ background:'#6366f1', color:'#fff', border:'none', borderRadius:10, padding:'14px 32px', fontSize:15, fontWeight:700, cursor:'pointer', width:'100%' }}>
                  {taskData?.a?.length ? 'Приступить к проверке знаний →' : 'Задачи ещё не добавлены'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── LOCKED PHASE ──
  if (phase === 'locked') {
    const unlockAt = mastery.lastStageCompletedAt
      ? getAlmatyNextMidnightAfter(new Date(mastery.lastStageCompletedAt))
      : null;
    const msLeft = unlockAt ? Math.max(0, unlockAt.getTime() - now) : 0;
    const unlocked = msLeft === 0;
    if (unlocked) {
      // Auto-transition to tasks when time is up
      setPhase('tasks');
      startStage(mastery.stagesCompleted + 1);
    }
    return (
      <div style={{ minHeight:'100vh', background:BG }}>
        <nav data-inner-nav style={{ background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Logo size={28}/>
          <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, color:THEME.primary }}>{skillName || skillId}</div>
          <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${THEME.border}`, borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:THEME.textLight }}>← Назад</button>
        </nav>
        <div style={{ maxWidth:520, margin:'80px auto', padding:'0 24px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🌙</div>
          <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:22, color:THEME.primary, marginBottom:12 }}>
            Этап {mastery.stagesCompleted} пройден!
          </h2>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:THEME.textLight, lineHeight:1.6, marginBottom:28 }}>
            Следующий этап откроется завтра в&nbsp;00:00 по&nbsp;времени Алматы.<br/>
            Дай себе время на отдых и закрепление материала.
          </p>
          <div style={{ background:'rgba(99,102,241,0.08)', border:'2px solid rgba(99,102,241,0.25)', borderRadius:16, padding:'20px 28px', display:'inline-block', marginBottom:28 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight, marginBottom:8 }}>До следующего этапа</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:36, color:'#6366f1', letterSpacing:2 }}>
              {fmtCountdown(msLeft)}
            </div>
          </div>
          <div>
            <button onClick={onBack} style={{ background:THEME.surface, color:THEME.primary, border:`1px solid ${THEME.border}`, borderRadius:10, padding:'12px 28px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Вернуться к плану
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ──
  if (phase === 'result') {
    const completed = mastery.stagesCompleted;
    const nextStageAvail = completed < 3 && taskData?.[completed===1?'b':'c']?.length;
    const unlockAt = mastery.lastStageCompletedAt
      ? getAlmatyNextMidnightAfter(new Date(mastery.lastStageCompletedAt))
      : null;
    const msLeft = unlockAt ? Math.max(0, unlockAt.getTime() - now) : 0;
    const nextLocked = completed >= 1 && completed < 3 && msLeft > 0;
    return (
      <div style={{ minHeight:'100vh', background:BG }}>
        <nav data-inner-nav style={{ background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Logo size={28}/>
          <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${THEME.border}`, borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:THEME.textLight }}>← Назад</button>
        </nav>
        <div style={{ maxWidth:600, margin:'60px auto', padding:'0 24px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>
            {completed >= 3 ? '🏆' : completed >= 2 ? '⚡' : completed >= 1 ? '✅' : '📝'}
          </div>
          <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, color:THEME.primary, marginBottom:12 }}>
            {completed >= 3 ? 'Навык освоен!' : stage===1 && s1Score < 8 ? `Недостаточно очков: ${s1Score}/10` : `Этап ${completed} пройден!`}
          </h2>
          {stage===1 && s1Score < 8 && (
            <p style={{ color:THEME.textLight, fontFamily:"'Inter',sans-serif", marginBottom:24 }}>Нужно минимум 8 правильных ответов. Попробуй снова!</p>
          )}
          {nextLocked && (
            <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:12, padding:'14px 20px', marginBottom:20, display:'inline-block' }}>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight, marginBottom:6 }}>🌙 Этап {completed+1} откроется через</div>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:28, color:'#6366f1', letterSpacing:2 }}>{fmtCountdown(msLeft)}</div>
            </div>
          )}
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginTop:24 }}>
            {stage===1 && s1Score < 8 && (
              <button onClick={() => startStage(1)} style={{ background:'#6366f1', color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Повторить задачи
              </button>
            )}
            {nextStageAvail && !nextLocked && !(stage===1 && s1Score < 8) && (
              <button onClick={() => startStage(completed+1)} style={{ background:stageColors[completed+1]||'#6366f1', color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Перейти к этапу {completed+1} →
              </button>
            )}
            <button onClick={onBack} style={{ background:THEME.surface, color:THEME.primary, border:`1px solid ${THEME.border}`, borderRadius:10, padding:'12px 24px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Вернуться к плану
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── TASKS PHASE ──
  if (!currentTask) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>
        {taskData ? 'Задачи для этого уровня ещё не добавлены.' : 'Задачи не найдены.'}
        <button onClick={onBack} style={{ display:'block', margin:'20px auto 0', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontSize:14 }}>← Назад</button>
      </div>
    </div>
  );

  const isCorrect = chosen !== null && chosen === currentTask.correct;
  const stageColor = stageColors[stage] || '#6366f1';

  return (
    <div style={{ minHeight:'100vh', background:BG }}>
      <nav data-inner-nav style={{ background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Logo size={28}/>
        <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, color:THEME.primary }}>{skillName || skillId}</div>
        <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${THEME.border}`, borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:THEME.textLight }}>← Назад</button>
      </nav>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'28px 24px' }}>
        {/* Stage indicator */}
        <div style={{ background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:12, padding:'14px 18px', marginBottom:24, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:14, color:stageColor }}>{stageNames[stage]}</div>
            <div style={{ fontSize:12, color:THEME.textLight, marginTop:2, fontFamily:"'Inter',sans-serif" }}>
              {stage===1 && `Вопрос ${taskIdx+1} из ${tasks.length} · Правильных: ${s1Score}`}
              {stage===2 && `Вопрос ${taskIdx+1} · Очки энергии: ${s2Energy}/8`}
              {stage===3 && `Вопрос ${s3Total+1} · Стрик: ${s3Streak > 0 ? '🔥'.repeat(Math.min(s3Streak,5)) : '—'}`}
            </div>
          </div>
          {/* Energy bar for stage 2 */}
          {stage===2 && (
            <div style={{ display:'flex', gap:5, marginLeft:'auto' }}>
              {Array.from({length:8},(_,i) => (
                <div key={i} style={{ width:18, height:26, borderRadius:4, background: i<s2Energy ? '#f59e0b' : '#e2e8f0', transition:'background 0.2s', boxShadow: i<s2Energy ? '0 0 6px #f59e0b' : 'none' }}>
                  <div style={{ fontSize:10, textAlign:'center', lineHeight:'26px' }}>{i<s2Energy?'⚡':''}</div>
                </div>
              ))}
            </div>
          )}
          {/* Streak indicator for stage 3 */}
          {stage===3 && s3Streak>0 && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:24 }}>{'🔥'.repeat(Math.min(s3Streak,5))}</span>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:18, color:'#ef4444' }}>{s3Streak}</span>
            </div>
          )}
        </div>

        {/* Task card */}
        <div style={{ background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:16, padding:'24px 28px', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:16, color:THEME.text, lineHeight:1.7, marginBottom:24 }}>
            <LatexText text={currentTask.text}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(currentTask.options||[]).map((opt,i) => {
              let bg = THEME.bg, border = THEME.border, color = THEME.text;
              if (revealed) {
                if (i === currentTask.correct) { bg='#dcfce7'; border='#4ade80'; color='#15803d'; }
                else if (i === chosen && i !== currentTask.correct) { bg='#fee2e2'; border='#fca5a5'; color='#dc2626'; }
              } else if (chosen===i) { bg=`${stageColor}18`; border=stageColor; }
              return (
                <button key={i} onClick={() => handleAnswer(i)} disabled={revealed}
                  style={{ background:bg, border:`2px solid ${border}`, color, borderRadius:10, padding:'12px 16px', textAlign:'left', cursor:revealed?'default':'pointer', fontFamily:"'Inter',sans-serif", fontSize:14, transition:'all 0.15s' }}>
                  <span style={{ fontWeight:700, marginRight:8 }}>{['А','Б','В','Г'][i]}.</span>
                  <LatexText text={opt}/>
                </button>
              );
            })}
          </div>
          {revealed && (
            <div style={{ marginTop:18 }}>
              {currentTask.explanation && (
                <div style={{ background: isCorrect?'#f0fdf4':'#fef2f2', border:`1px solid ${isCorrect?'#bbf7d0':'#fecaca'}`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:THEME.text, fontFamily:"'Inter',sans-serif", lineHeight:1.6 }}>
                  💡 <LatexText text={currentTask.explanation}/>
                </div>
              )}
              <button onClick={nextTask} disabled={saving}
                style={{ background:stageColor, color:'#fff', border:'none', borderRadius:10, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer', width:'100%' }}>
                {taskIdx < tasks.length-1 ? 'Следующий вопрос →' : 'Завершить'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
