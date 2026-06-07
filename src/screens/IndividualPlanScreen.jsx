import React, { useState, useEffect, useMemo, useRef } from "react";
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
  const [focusReq,          setFocusReq]          = useState(null); // { id, n } → центрирование карты на модуле
  const mapWrapRef = useRef(null);

  // Клик по модулю в карточках сверху: скроллим страницу к карте и просим
  // DiagnosticModuleTree отцентрировать узел (счётчик n — для повторных кликов).
  const focusModule = (id) => {
    setFocusReq(prev => ({ id, n: (prev?.n || 0) + 1 }));
    mapWrapRef.current?.scrollIntoView({ behavior:'smooth', block:'center' });
  };

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

  // Категории модулей — ВЗАИМОИСКЛЮЧАЮЩИЕ, чтобы сумма сходилась с totalMod
  // (раньше «в процессе» пересекалось с «заблокировано», а «доступно» терялось).
  const totalMod       = diagData.modules.length;
  const masteredMod    = diagData.modules.filter(m => m.mastery >= 100).length;
  const lockedMod      = diagData.modules.filter(m => m.isLocked && m.mastery < 100).length;
  const inProgressMods = diagData.modules.filter(m => !m.isLocked && m.mastery > 0 && m.mastery < 100);
  const availableMods  = diagData.modules.filter(m => !m.isLocked && m.mastery === 0);
  // Общий прогресс с учётом частичного освоения: средний mastery по всем модулям.
  const overallPct = totalMod
    ? Math.round(diagData.modules.reduce((s, m) => s + Math.min(m.mastery || 0, 100), 0) / totalMod)
    : 0;

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
          const activeSkills = Object.values(skillMasteryData).filter(s => (s.stagesCompleted||0) > 0 && (s.stagesCompleted||0) < 3).length;
          const slotsFree    = Math.max(0, 3 - activeSkills);
          const slotsText    = slotsFree === 0 ? 'все слоты заняты'
            : slotsFree === 1 ? 'ещё 1 свободный слот' : `ещё ${slotsFree} свободных слота`;
          // Сегменты прогресс-бара (взаимоисключающие категории, сумма = totalMod)
          const segments = [
            { label:'Освоено',       val:masteredMod,          color:'#22c55e' },
            { label:'В работе',      val:inProgressMods.length, color:'#f59e0b' },
            { label:'Доступно',      val:availableMods.length,  color:'#6366f1' },
            { label:'Заблокировано', val:lockedMod,            color:'#94a3b8' },
          ];
          return (
          <>
            {/* hover-эффекты карточек навыков */}
            <style>{`
              .plan-mod-card, .plan-avail-card { cursor:pointer; border:none; width:100%; text-align:left; transition:transform .12s, box-shadow .15s; }
              .plan-mod-card:hover, .plan-avail-card:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(10,25,47,0.12) !important; }
            `}</style>

            {/* ── Горизонтальная полоска прогресса на всю ширину (вместо правой колонки) ── */}
            <div data-tour="plan-stats" className="theme-card" style={{
              background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:12,
              padding:'12px 18px', marginBottom:14,
              display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
            }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:7, flexShrink:0 }}>
                <span style={{ fontSize:26, fontWeight:800, color:'#22c55e', fontFamily:"'Montserrat',sans-serif", lineHeight:1 }}>{overallPct}%</span>
                <span style={{ fontSize:12, color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>общий прогресс</span>
              </div>
              {/* стек-бар: 4 цветных сегмента по долям категорий */}
              <div style={{ flex:'1 1 220px', minWidth:180, display:'flex', height:14, borderRadius:99, overflow:'hidden', background:'rgba(148,163,184,0.18)' }}>
                {segments.filter(s => s.val > 0).map(s => (
                  <span key={s.label} title={`${s.label}: ${s.val}`}
                    style={{ width:`${(s.val / Math.max(totalMod, 1)) * 100}%`, background:s.color, transition:'width .4s' }}/>
                ))}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', fontSize:12, fontFamily:"'Inter',sans-serif" }}>
                {segments.map(s => (
                  <span key={s.label} style={{ display:'inline-flex', alignItems:'center', gap:5, color:THEME.textLight }}>
                    <span style={{ width:8, height:8, borderRadius:99, background:s.color, flexShrink:0 }}/>
                    {s.label} <b style={{ color:s.color }}>{s.val}</b>
                  </span>
                ))}
              </div>
            </div>

            {/* ── Сейчас в работе + готовы к старту — на всю ширину ── */}
            <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:12 }}>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:14, color:'#b45309' }}>⚡ Сейчас в работе</div>
                {/* мини-индикатор фокуса */}
                <div style={{ fontSize:11, color:'#a16207', fontFamily:"'Inter',sans-serif", background:'#fef9c3', border:'1px solid #fde047', borderRadius:99, padding:'3px 10px', display:'flex', alignItems:'center', gap:6 }}>
                  🎯 В фокусе {Math.min(activeSkills, 3)} из 3 навыков · {slotsText}
                  <span style={{ display:'inline-flex', gap:3 }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{ width:12, height:5, borderRadius:99, background: i < activeSkills ? '#eab308' : 'rgba(148,163,184,0.35)' }}/>
                    ))}
                  </span>
                </div>
              </div>

              {inProgressMods.length === 0 && availableMods.length === 0 && (
                <div style={{ fontSize:13, color:'#64748b', fontFamily:"'Inter',sans-serif" }}>Открой первый модуль на карте ниже.</div>
              )}
              {inProgressMods.length === 0 && availableMods.length > 0 && (
                <div style={{ fontSize:13, color:'#92400e', fontFamily:"'Inter',sans-serif", marginBottom:8 }}>Ещё ничего не начато — выбери модуль из готовых к старту 👇</div>
              )}

              {/* Карточки навыков в работе: оранжевый акцент слева + заметный прогресс-бар */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {inProgressMods.map(m => (
                  <button key={m.id} className="plan-mod-card" onClick={() => focusModule(m.id)}
                    title="Показать на карте"
                    style={{
                      background:'#fff', borderRadius:10, borderLeft:'4px solid #f59e0b',
                      boxShadow:'0 2px 8px rgba(10,25,47,0.07)',
                      padding:'11px 14px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
                    }}>
                    <span style={{ flex:'1 1 200px', minWidth:0 }}>
                      <span style={{ display:'block', fontSize:13.5, fontWeight:700, color:'#1f2937', fontFamily:"'Inter',sans-serif", lineHeight:1.35 }}>{m.moduleName}</span>
                      <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Inter',sans-serif" }}>{m.grade}</span>
                    </span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      <span style={{ width:130, height:9, background:'rgba(148,163,184,0.25)', borderRadius:99, overflow:'hidden' }}>
                        <span style={{ display:'block', height:'100%', width:`${m.mastery}%`, background:'linear-gradient(90deg,#fbbf24,#f59e0b)', borderRadius:99 }}/>
                      </span>
                      <span style={{ fontSize:15, fontWeight:800, color:'#d97706', fontFamily:"'Montserrat',sans-serif", minWidth:42, textAlign:'right' }}>{m.mastery}%</span>
                    </span>
                  </button>
                ))}
              </div>

              {availableMods.length > 0 && (
                <>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12, color:'#15803d', margin:'14px 0 8px', textTransform:'uppercase', letterSpacing:'0.4px' }}>▶ Готовы к старту</div>
                  {/* Карточки доступных: зелёный акцент, без прогресса, с кнопкой-чипом */}
                  <div style={availableMods.length > 4
                    ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:8 }
                    : { display:'flex', flexDirection:'column', gap:8 }}>
                    {availableMods.map(m => (
                      <button key={m.id} className="plan-avail-card" onClick={() => focusModule(m.id)}
                        title="Показать на карте"
                        style={{
                          background:'#fff', borderRadius:10, borderLeft:'4px solid #22c55e',
                          boxShadow:'0 2px 8px rgba(10,25,47,0.07)',
                          padding:'10px 14px', display:'flex', alignItems:'center', gap:10,
                        }}>
                        <span style={{ flex:1, minWidth:0 }}>
                          <span style={{ display:'block', fontSize:13.5, fontWeight:700, color:'#1f2937', fontFamily:"'Inter',sans-serif", lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.moduleName}</span>
                          <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Inter',sans-serif" }}>{m.grade}</span>
                        </span>
                        <span style={{ flexShrink:0, fontSize:11.5, fontWeight:800, color:'#15803d', background:'#dcfce7', border:'1px solid #86efac', borderRadius:99, padding:'4px 11px', fontFamily:"'Inter',sans-serif" }}>▶ Начать</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* info-блок про фокус */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginTop:12, padding:'9px 12px', background:'rgba(245,158,11,0.08)', borderRadius:8, fontSize:12, color:'#854d0e', fontFamily:"'Inter',sans-serif", lineHeight:1.5 }}>
                <span style={{ fontSize:14, lineHeight:1.3 }}>💡</span>
                Чтобы не распыляться — открываем до 3 навыков одновременно. Заверши один — откроется следующий.
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
              ? <div ref={mapWrapRef}>
                  <DiagnosticModuleTree diagData={diagData} onStartTraining={onStartTraining} skillMastery={skillMasteryData} focusRequest={focusReq}/>
                </div>
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
