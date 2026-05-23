import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { useTheme } from "../ThemeContext.jsx";
import Logo from "../components/ui/Logo.jsx";
import ErrorCard from "../components/ui/ErrorCard.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import DiagnosticModuleTree, { buildDiagModuleTree } from "../components/diagTree/DiagnosticModuleTree.jsx";

export default function IndividualPlanScreen({ user, onBack, onStartTraining }) {
  const { theme: THEME } = useTheme();
  const [autoPlan,          setAutoPlan]          = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [fetchError,        setFetchError]        = useState(false);
  const [skillProgressData, setSkillProgressData] = useState({});
  const [cgLinks,           setCgLinks]           = useState([]);
  const [skillNamesMap,     setSkillNamesMap]     = useState({});
  const [skillMasteryData,  setSkillMasteryData]  = useState({}); // skillId → { stagesCompleted, currentStage }

  const load = async () => {
    setLoading(true); setFetchError(false);
    try {
      const [planSnap, progressSnap, cgLinks, shItems, masterySnap] = await Promise.all([
        getDoc(doc(db, 'individualPlans', user?.uid)),
        getDoc(doc(db, 'skillProgress',   user?.uid)),
        getContent('crossGradeLinks'),
        getContent('skillHierarchies'),
        getDoc(doc(db, 'skillMastery',    user?.uid)),
      ]);
      if (planSnap.exists())     setAutoPlan(planSnap.data());
      if (progressSnap.exists()) setSkillProgressData(progressSnap.data()?.skills || {});
      if (masterySnap.exists())  setSkillMasteryData(masterySnap.data()?.skills || {});
      setCgLinks(cgLinks);
      const namesMap = {};
      shItems.forEach(d => {
        const hier = d;
        (hier.clusters || []).forEach(cl => {
          (cl.pivot_skills || []).forEach(ps => {
            if (ps.skill_id && ps.skill_name) namesMap[ps.skill_id] = ps.skill_name;
          });
        });
      });
      setSkillNamesMap(namesMap);
    } catch(e) { console.error(e); setFetchError(true); }
    setLoading(false);
  };

  useEffect(() => { if (user?.uid) load(); }, [user?.uid]);

  const diagData = useMemo(() => {
    if (!autoPlan) return { modules:[], edges:[] };
    return buildDiagModuleTree(autoPlan, skillProgressData, cgLinks, skillNamesMap, skillMasteryData);
  }, [autoPlan, skillProgressData, cgLinks, skillNamesMap, skillMasteryData]);

  const totalMod    = diagData.modules.length;
  const masteredMod = diagData.modules.filter(m => m.mastery >= 100).length;
  const inProgMod   = diagData.modules.filter(m => m.mastery > 0 && m.mastery < 100).length;
  const lockedMod   = diagData.modules.filter(m => m.isLocked && m.mastery < 100).length;

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
      <AppTopbar title="🗺️ Индивидуальный план" onBack={onBack} />

      <div style={{ maxWidth:1440, margin:'0 auto', padding:'28px 20px 60px' }}>
        <div data-tour="plan-header" style={{ marginBottom:20 }}>
          <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:800, color:THEME.primary, margin:0, lineHeight:1.4 }}>🗺 Карта модулей</h1>
          <p style={{ color:THEME.textLight, fontSize:14, marginTop:6, fontFamily:"'Inter',sans-serif" }}>
            {user?.firstName} {user?.lastName}{autoPlan?.targetGrade ? ` · Целевой класс: ${autoPlan.targetGrade}` : ''}
          </p>
        </div>

        {loading && <div style={{ textAlign:'center', padding:80, color:THEME.textLight, fontFamily:"'Inter',sans-serif", fontSize:15 }}>Загрузка карты...</div>}
        {!loading && fetchError && <ErrorCard onRetry={load}/>}

        {!loading && !fetchError && !autoPlan && (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:52, marginBottom:20 }}>🎯</div>
            <h3 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:18, color:THEME.primary, marginBottom:12 }}>Карта не сформирована</h3>
            <p style={{ color:THEME.textLight, maxWidth:400, margin:'0 auto', lineHeight:1.7, fontFamily:"'Inter',sans-serif" }}>
              Пройди умную диагностику — система автоматически построит твою карту модулей снизу вверх.
            </p>
          </div>
        )}

        {!loading && !fetchError && autoPlan && (() => {
          const availableMods  = diagData.modules.filter(m => !m.isLocked && m.mastery === 0);
          const inProgressMods = diagData.modules.filter(m => m.mastery > 0 && m.mastery < 100);
          const activeSkills   = Object.values(skillMasteryData).filter(s => (s.stagesCompleted||0) > 0 && (s.stagesCompleted||0) < 3).length;
          return (
          <>
            {/* ── Гайд для ученика ── */}
            <div data-tour="plan-stats" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:20 }}>
              {/* С чего начать */}
              <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#15803d', marginBottom:8 }}>▶ С чего начать</div>
                {availableMods.length === 0
                  ? <div style={{ fontSize:12, color:'#64748b', fontFamily:"'Inter',sans-serif" }}>Нет доступных модулей для старта.</div>
                  : availableMods.slice(0,3).map(m => (
                      <div key={m.id} style={{ fontSize:12, color:'#166534', fontFamily:"'Inter',sans-serif", marginBottom:4, padding:'4px 8px', background:'#dcfce7', borderRadius:6 }}>
                        {m.moduleName} <span style={{ color:'#4ade80' }}>· {m.grade}</span>
                      </div>
                    ))
                }
                {availableMods.length > 3 && <div style={{ fontSize:11, color:'#16a34a', fontFamily:"'Inter',sans-serif", marginTop:4 }}>+{availableMods.length-3} ещё</div>}
              </div>

              {/* Сейчас изучаешь */}
              <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:'#b45309', marginBottom:8 }}>⚡ Сейчас изучаешь</div>
                {inProgressMods.length === 0
                  ? <div style={{ fontSize:12, color:'#64748b', fontFamily:"'Inter',sans-serif" }}>Ещё не начал ни одного модуля.</div>
                  : inProgressMods.slice(0,3).map(m => (
                      <div key={m.id} style={{ fontSize:12, color:'#92400e', fontFamily:"'Inter',sans-serif", marginBottom:4, padding:'4px 8px', background:'#fef3c7', borderRadius:6 }}>
                        {m.moduleName} <span style={{ color:'#f59e0b' }}>· {m.mastery}%</span>
                      </div>
                    ))
                }
                {inProgressMods.length > 3 && <div style={{ fontSize:11, color:'#d97706', fontFamily:"'Inter',sans-serif", marginTop:4 }}>+{inProgressMods.length-3} ещё</div>}
              </div>

              {/* Активные навыки */}
              <div style={{ background: activeSkills >= 3 ? '#fef2f2' : '#f5f3ff', border:`1px solid ${activeSkills >= 3 ? '#fca5a5' : '#c4b5fd'}`, borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color: activeSkills >= 3 ? '#b91c1c' : '#6d28d9', marginBottom:8 }}>
                  {activeSkills >= 3 ? '⚠️ Лимит навыков' : '📊 Активные навыки'}
                </div>
                <div style={{ fontSize:28, fontWeight:800, color: activeSkills >= 3 ? '#ef4444' : '#7c3aed', fontFamily:"'Montserrat',sans-serif", marginBottom:4 }}>
                  {activeSkills} <span style={{ fontSize:14, fontWeight:400, color:'#94a3b8' }}>/ 3</span>
                </div>
                <div style={{ fontSize:11, color:'#64748b', fontFamily:"'Inter',sans-serif", lineHeight:1.5 }}>
                  {activeSkills >= 3 ? 'Завершите один из навыков, чтобы взять новый.' : `Ты можешь добавить ещё ${3-activeSkills} навык${3-activeSkills===1?'':'а'}.`}
                </div>
              </div>

              {/* Статистика */}
              <div className="theme-card" style={{ background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:THEME.primary, marginBottom:8 }}>📈 Прогресс</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[
                    { label:'Всего модулей', val:totalMod, color:'#7c3aed' },
                    { label:'Освоено', val:masteredMod, color:'#22c55e' },
                    { label:'В процессе', val:inProgMod, color:'#f59e0b' },
                    { label:'Заблокировано', val:lockedMod, color:'#94a3b8' },
                  ].map(s => (
                    <div key={s.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontFamily:"'Inter',sans-serif" }}>
                      <span style={{ color:THEME.textLight }}>{s.label}</span>
                      <span style={{ fontWeight:700, color:s.color }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Карта модулей ── */}
            <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:700, color:THEME.primary }}>Карта модулей</span>
              {[['✅','Освоен','#22c55e'],['⚡','В процессе','#f59e0b'],['▶ Начать','Доступен','#6366f1'],['🔒','Заблокирован','#94a3b8']].map(([ic,lb,cl]) => (
                <span key={lb} style={{ fontSize:11, color:cl, display:'flex', alignItems:'center', gap:4, fontFamily:"'Inter',sans-serif" }}>{ic} {lb}</span>
              ))}
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:THEME.textLight, marginLeft:'auto' }}>Нажми на модуль для деталей</span>
            </div>

            {diagData.modules.length > 0
              ? <DiagnosticModuleTree diagData={diagData} onStartTraining={onStartTraining} skillMastery={skillMasteryData}/>
              : <div style={{ textAlign:'center', padding:60, color:THEME.textLight, fontFamily:"'Inter',sans-serif", fontSize:14 }}>
                  В плане нет навыков для отображения.
                </div>
            }
          </>
          );
        })()}
      </div>

    </div>
  );
}
