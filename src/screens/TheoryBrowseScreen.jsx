import React, { useState, useEffect, useMemo, useRef } from "react";
import { getContent } from "../lib/contentCache.js";
import { doc, getDoc, updateDoc, db } from "../firestore-rest.js";
import { addXp } from "../lib/levelUtils.js";
import { ruVertical, ruVerticalUpper } from "../lib/verticals.js";
import { useTheme } from "../ThemeContext.jsx";
import Logo from "../components/ui/Logo.jsx";
import LatexText from "../components/ui/LatexText.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import SkillPlanet3D, { fallbackGradient } from "../components/SkillPlanet3D.jsx";
import { buildDiagModuleTree } from "../components/diagTree/DiagnosticModuleTree.jsx";

// ── Хелперы ───────────────────────────────────────────────────────────────────

// Канонический skill_id записи теории (теория привязана 1:1 к навыку).
const sidOf = (t) => t.skill_id || t.id;

// Состояние навыка → life планеты (контракт SkillPlanet3D):
//   locked → -1 (мёртвая скала) · mastery 0 → 0 (серый камень)
//   0<m<50 → 0.4 (первая зелень) · 50≤m<100 → 0.8 (океаны) · 100 → 1.0 (цветущий)
function lifeFor(state) {
  if (!state) return 0;            // навык вне плана — «доступен, не начат»
  if (state.locked) return -1;
  const m = state.mastery || 0;
  if (m >= 100) return 1.0;
  if (m >= 50)  return 0.8;
  if (m > 0)    return 0.4;
  return 0;
}

const ruPlural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

// Ленивый маунт тяжёлого контента (3D-планеты) при приближении к viewport —
// тот же приём, что на лендинге (AboutLanding.LazyMount).
function LazyMount({ height, children, rootMargin = "200px" }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShow(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return <div ref={ref} style={{ minHeight: height }}>{show ? children : null}</div>;
}

function useIsMobile(bp = 880) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(`(max-width:${bp}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const fn = (e) => setM(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn);
  }, [bp]);
  return m;
}

// Статичная мини-планета (CSS-градиент SkillPlanet3D-фолбэка). Используется на
// всех карточках каталога: 289 живых WebGL-контекстов невозможны (лимит браузера
// ~8-16 на страницу), поэтому 3D — только в секции «Сейчас изучаешь».
function PlanetDot({ life, size = 52 }) {
  return (
    <div aria-hidden="true" style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:'50%',
        background: fallbackGradient(life),
        boxShadow: life >= 0.8 ? '0 0 14px rgba(120,200,255,0.45)' : life >= 0 ? '0 0 8px rgba(120,200,255,0.15)' : 'none',
      }}/>
      {life < 0 && (
        <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.38), opacity:0.85 }}>🔒</span>
      )}
    </div>
  );
}

// ── Пошаговое прохождение темы: Теория → Подсказки → Задачи (по одной) → Итог ──
// Логика обратной связи на задачах (зелёная/красная подсветка + объяснение)
// сохранена 1-в-1, изменена только подача: один шаг на экран, прогресс-бар,
// кнопка «дальше» появляется после ответа.
function TheoryWalkthrough({ entry, ruName, onExit, awardXp, user }) {
  const { theme: THEME, dark, shopTheme } = useTheme();
  // Тёмный UI = системная dark-тема ИЛИ тёмная shop-тема (galaxy/matrix/fire).
  // THEME.* адаптируется сам (THEME_DARK), но хардкоды вроде #7c2d12 в
  // примерах на тёмном фоне нечитаемы — для них отдельные dark-значения.
  const isDarkUi = dark || (shopTheme && shopTheme !== 'sakura');
  const exampleBox = isDarkUi
    ? { background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.35)', color:'#fcd34d' }
    : { background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.35)', color:'#7c2d12' };
  const exampleLabelColor = isDarkUi ? '#fbbf24' : undefined; // light наследует цвет текста
  const tasks = entry.tasks || [];
  const hints = entry.theory?.micro_hints || [];
  const hasTheory = !!entry.theory?.concept;

  // Шаги собираются из доступного контента (подсказок может не быть,
  // задач может быть 0..N — режим адаптируется).
  const steps = [
    ...(hasTheory ? ['theory'] : []),
    ...(hints.length ? ['hints'] : []),
    ...tasks.map((_, i) => `task:${i}`),
    ...(tasks.length ? ['result'] : []),
  ];
  const [stepIdx, setStepIdx] = useState(0);
  const [taskStates, setTaskStates] = useState(tasks.map(() => ({ chosen: null, revealed: false })));
  const [xpEarned, setXpEarned] = useState(null);
  const awardedRef = useRef(false);

  const cur = steps[stepIdx] || 'theory';
  const isLast = stepIdx >= steps.length - 1;
  const score = taskStates.filter((ts, i) => ts.revealed && ts.chosen === tasks[i]?.correct_index).length;

  const goNext = () => { if (isLast) onExit(); else setStepIdx(i => i + 1); };
  const restart = () => {
    setStepIdx(0);
    setTaskStates(tasks.map(() => ({ chosen: null, revealed: false })));
    // XP за повтор в той же сессии не начисляем (awardedRef уже взведён)
  };
  const choose = (taskIdx, optIdx) => {
    setTaskStates(prev => prev.map((s, i) => i === taskIdx ? { chosen: optIdx, revealed: true } : s));
  };

  // Начисление XP — один раз, при входе на экран результата.
  useEffect(() => {
    if (cur === 'result' && !awardedRef.current) {
      awardedRef.current = true;
      Promise.resolve(awardXp?.(score, tasks.length)).then(n => setXpEarned(n || 0)).catch(() => setXpEarned(0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  // Подпись CTA текущего шага
  const nextLabel = (() => {
    if (cur === 'theory')  return hints.length ? 'Понятно, дальше →' : tasks.length ? 'К тренировке →' : 'Завершить';
    if (cur === 'hints')   return tasks.length ? 'К тренировке →' : 'Завершить';
    return null; // у задач и результата свои кнопки
  })();

  const ctaStyle = {
    display:'block', margin:'28px auto 0', padding:'13px 34px', borderRadius:12, border:'none',
    cursor:'pointer', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:15,
    background:'#fbbf24', color:'#0f172a', boxShadow:'0 6px 20px rgba(251,191,36,0.35)',
    transition:'transform 0.15s, box-shadow 0.15s',
  };
  const ghostStyle = {
    display:'block', margin:'10px auto 0', padding:'10px 24px', borderRadius:10,
    border:`1px solid ${THEME.border}`, background:'transparent', color:THEME.textLight,
    fontFamily:"'Montserrat',sans-serif", fontWeight:600, fontSize:13, cursor:'pointer',
  };

  // ── Рендер одной задачи (логика подсветки — как в старом скролл-режиме) ──
  const renderTask = (ti) => {
    const task = tasks[ti];
    const ts = taskStates[ti] || { chosen: null, revealed: false };
    const isCorrect = ts.revealed && ts.chosen === task.correct_index;
    return (
      <div className="theme-card" style={{ background:THEME.surface, borderRadius:18, border:`1px solid ${THEME.border}`, padding:'30px 34px', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:12 }}>
          🏋️ Задача {ti + 1} из {tasks.length}
        </div>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:THEME.primary, lineHeight:1.5, marginBottom:18 }}>
          <LatexText text={task.question_text}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {(task.options||[]).map((opt, oi) => {
            let bg=THEME.surface, border=`1px solid ${THEME.border}`, color=THEME.text;
            if (ts.revealed) {
              if (oi===task.correct_index) { bg='rgba(16,185,129,0.1)'; border=`2px solid ${THEME.success}`; color=THEME.success; }
              else if (oi===ts.chosen) { bg='rgba(239,68,68,0.08)'; border=`2px solid ${THEME.error}`; color=THEME.error; }
              else { bg=THEME.surface; color=THEME.textLight; }
            } else if (ts.chosen===oi) { bg=THEME.bg; border=`2px solid ${THEME.primary}`; }
            return (
              <div key={oi} onClick={() => !ts.revealed && choose(ti, oi)}
                className={ts.revealed ? undefined : 'tw-option'}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, background:bg, border, cursor:ts.revealed?'default':'pointer', transition:'all 0.15s ease' }}>
                <div style={{ width:28, height:28, borderRadius:6, background:ts.revealed&&oi===task.correct_index?THEME.success:ts.revealed&&oi===ts.chosen?THEME.error:THEME.bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, color:ts.revealed&&(oi===task.correct_index||oi===ts.chosen)?'#fff':THEME.textLight, flexShrink:0, border:`1px solid ${THEME.border}` }}>
                  {String.fromCharCode(65+oi)}
                </div>
                <span style={{ fontSize:14, fontWeight:500, color }}><LatexText text={opt}/></span>
                {ts.revealed&&oi===task.correct_index&&<span style={{ marginLeft:'auto', fontSize:16, flexShrink:0 }}>✅</span>}
                {ts.revealed&&oi===ts.chosen&&oi!==task.correct_index&&<span style={{ marginLeft:'auto', fontSize:16, flexShrink:0 }}>❌</span>}
              </div>
            );
          })}
        </div>
        {ts.revealed && (
          <div style={{ marginTop:14, padding:'12px 16px', borderRadius:10, background:isCorrect?'rgba(16,185,129,0.07)':'rgba(239,68,68,0.05)', border:`1px solid ${isCorrect?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.15)'}` }}>
            <div style={{ fontWeight:700, fontSize:13, color:isCorrect?THEME.success:THEME.error, marginBottom:isCorrect?0:4 }}>{isCorrect?'✅ Верно!':'❌ Неверно'}</div>
            {!isCorrect&&task.options&&<div style={{ fontSize:13, color:THEME.textLight }}>Правильный ответ: <b style={{ color:THEME.primary }}><LatexText text={task.options[task.correct_index]}/></b></div>}
            {task.explanation&&<div style={{ marginTop:6, fontSize:13, color:THEME.text, lineHeight:1.6 }}>💡 <LatexText text={task.explanation}/></div>}
          </div>
        )}
        {/* Кнопка «дальше» появляется только после ответа */}
        {ts.revealed && (
          <button onClick={goNext} style={ctaStyle}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
            {ti < tasks.length - 1 ? 'Следующая задача →' : 'Завершить →'}
          </button>
        )}
      </div>
    );
  };

  // ── Экран результата ──
  const renderResult = () => {
    const total = tasks.length;
    const perfect = score === total && total > 0;
    const weak = score <= total / 3;
    const msg = perfect ? 'Отлично! Тема освоена 🎉'
      : score >= total * 2 / 3 ? 'Хороший результат! Почти идеально 👍'
      : 'Стоит повторить теорию 📖';
    const accent = perfect ? '#22c55e' : weak ? '#f59e0b' : THEME.primary;
    return (
      <div className="theme-card" style={{ background:THEME.surface, borderRadius:18, border:`1px solid ${THEME.border}`, padding:'36px 34px', boxShadow:'0 4px 20px rgba(0,0,0,0.04)', textAlign:'center' }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:52, fontWeight:800, color:accent, lineHeight:1 }}>
          {score}<span style={{ fontSize:26, color:THEME.textLight, fontWeight:600 }}> из {total}</span>
        </div>
        <div style={{ fontSize:13, color:THEME.textLight, marginTop:4 }}>правильных ответов</div>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:19, fontWeight:800, color:accent, margin:'18px 0 6px' }}>{msg}</div>
        {/* Награды за прохождение: +10 XP базово, +5 XP бонус за идеальный результат */}
        {xpEarned > 0 ? (
          <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:8, marginTop:10 }}>
            <span style={{ padding:'6px 16px', borderRadius:99, background:'rgba(251,191,36,0.14)', border:'1px solid rgba(251,191,36,0.45)', color:isDarkUi?'#fbbf24':'#b45309', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14 }}>
              ⚡ +10 XP за прохождение
            </span>
            {perfect && (
              <span style={{ padding:'6px 16px', borderRadius:99, background:'rgba(212,175,55,0.18)', border:'1px solid rgba(212,175,55,0.6)', color:isDarkUi?'#fcd34d':'#a16207', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14 }}>
                ⭐ +5 XP бонус за {total}/{total}
              </span>
            )}
          </div>
        ) : xpEarned === 0 ? (
          <div style={{ marginTop:8, fontSize:13, fontWeight:600, color:THEME.textLight }}>
            ✓ Тема уже освоена — опыт начислен ранее
          </div>
        ) : null}
        {/* Список задач с галочками/крестиками */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, margin:'22px auto 0', maxWidth:360, textAlign:'left' }}>
          {tasks.map((task, i) => {
            const ok = taskStates[i]?.revealed && taskStates[i].chosen === task.correct_index;
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderRadius:10, background: ok ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)', border:`1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}` }}>
                <span style={{ fontSize:15 }}>{ok ? '✅' : '❌'}</span>
                <span style={{ fontSize:13, fontWeight:600, color:THEME.text }}>Задача {i + 1}</span>
              </div>
            );
          })}
        </div>
        {weak && (
          <button onClick={restart} style={ctaStyle}>Пройти заново</button>
        )}
        <button onClick={onExit} style={weak ? ghostStyle : { ...ctaStyle, marginTop:28 }}>Вернуться к теории</button>
      </div>
    );
  };

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
      <style>{`
        @keyframes twStepIn { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:none; } }
        .tw-step { animation: twStepIn 0.25s ease; }
        .tw-option:hover { background:${THEME.bg} !important; border-color:#fbbf24 !important; }
      `}</style>
      <AppTopbar title="📖 Теория" onBack={onExit} user={user} />

      {/* Сегментированный прогресс-бар: пройденные шаги — золотые */}
      <div style={{ maxWidth:780, margin:'0 auto', padding:'14px 20px 0' }}>
        <div style={{ display:'flex', gap:6 }}>
          {steps.map((s, i) => (
            <span key={s} style={{
              flex:1, height:6, borderRadius:99,
              background: i < stepIdx ? '#fbbf24' : i === stepIdx ? 'rgba(251,191,36,0.55)' : 'rgba(148,163,184,0.25)',
              transition:'background 0.3s',
            }}/>
          ))}
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:THEME.textLight, marginTop:6, textAlign:'right' }}>
          Шаг {Math.min(stepIdx + 1, steps.length)} из {steps.length}
        </div>
      </div>

      <div className="tw-step" key={stepIdx} style={{ maxWidth:780, margin:'0 auto', padding:'14px 20px 40px', display:'flex', flexDirection:'column', minHeight:'calc(100vh - 150px)' }}>
        {/* Заголовок темы */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, color:THEME.textLight, marginBottom:6 }}>{[ruVerticalUpper(entry.vertical_line_id), entry.grade ? `${entry.grade} класс` : ''].filter(Boolean).join(' · ')}</div>
          <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:24, fontWeight:800, color:THEME.primary }}>{ruName}</h1>
        </div>

        {/* ── ШАГ: Теория ── */}
        {cur === 'theory' && (
          <div className="theme-card" style={{ background:THEME.surface, borderRadius:18, border:`1px solid ${THEME.border}`, borderLeft:'4px solid #fbbf24', padding:'32px 36px', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:16 }}>📖 Теория</div>
            <div style={{ fontSize:16, lineHeight:1.85, color:THEME.text, fontFamily:"'Inter',sans-serif" }}>
              <LatexText text={entry.theory.concept}/>
            </div>
            <button onClick={goNext} style={ctaStyle}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';}}>{nextLabel}</button>
          </div>
        )}

        {/* ── ШАГ: Микро-подсказки ── */}
        {cur === 'hints' && (
          <div className="theme-card" style={{ background:THEME.surface, borderRadius:18, border:`1px solid ${THEME.border}`, padding:'30px 34px', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:16 }}>💡 Микро-подсказки</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {hints.map((hint, i) => {
                if (hint && typeof hint === 'object') {
                  return (
                    <div key={i} style={{ background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:12, padding:'16px 20px' }}>
                      {hint.skill_name && <div style={{ fontWeight:700, fontSize:14, color:THEME.primary, marginBottom:6 }}>{hint.skill_name}</div>}
                      {hint.rule && <div style={{ fontSize:14, color:THEME.text, lineHeight:1.7, marginBottom:hint.example ? 8 : 0 }}><LatexText text={hint.rule}/></div>}
                      {hint.example && (
                        <div style={{ ...exampleBox, borderRadius:8, padding:'11px 14px', fontSize:14, fontWeight:500 }}>
                          <strong style={{ fontWeight:800, color:exampleLabelColor }}>Пример: </strong><LatexText text={hint.example}/>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:12, padding:'14px 18px', fontSize:14, color:THEME.text, lineHeight:1.7 }}>
                    <LatexText text={String(hint)}/>
                  </div>
                );
              })}
            </div>
            <button onClick={goNext} style={ctaStyle}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';}}>{nextLabel}</button>
          </div>
        )}

        {/* ── ШАГ: одна задача ── */}
        {cur.startsWith('task:') && renderTask(Number(cur.slice(5)))}

        {/* ── ШАГ: итог ── */}
        {cur === 'result' && renderResult()}

        {/* Пустая тема (нет ни теории, ни подсказок, ни задач) */}
        {steps.length === 0 && (
          <div className="theme-card" style={{ background:THEME.surface, borderRadius:18, border:`1px solid ${THEME.border}`, padding:'30px 34px', textAlign:'center', color:THEME.textLight }}>
            Материалы темы ещё наполняются.
            <button onClick={onExit} style={ctaStyle}>Вернуться к теории</button>
          </div>
        )}

        {/* Мотивационный футер, прижатый к низу видимой области — заполняет пустоту
            под коротким контентом (напр. шаг «Теория»). */}
        {steps.length > 0 && cur !== 'result' && (() => {
          const stepNo = Math.min(stepIdx + 1, steps.length);
          const remaining = steps.length - stepNo;
          const pl = (n) => { const a = n % 100, b = a % 10; if (a > 10 && a < 20) return 'шагов'; if (b > 1 && b < 5) return 'шага'; if (b === 1) return 'шаг'; return 'шагов'; };
          return (
            <div style={{ marginTop:'auto', paddingTop:28, textAlign:'center', fontSize:12.5, fontWeight:600, color:THEME.textLight, opacity:0.75 }}>
              Шаг {stepNo} из {steps.length}{remaining > 0 ? ` · осталось ${remaining} ${pl(remaining)}` : ' · последний шаг'}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function TheoryBrowseScreen({ user, onBack, initialSkillId }) {
  const { theme: THEME } = useTheme();
  const isMobile = useIsMobile(880);
  const [skillTheories, setSkillTheories] = useState([]);
  const [namesMap, setNamesMap] = useState({}); // skill_id → Russian name
  const [loading, setLoading] = useState(true);
  const [filterSec, setFilterSec] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // skillTheory entry
  // Персонализация: состояние навыков из плана + skillMastery + meta пользователя
  const [skillState, setSkillState] = useState({});       // sid → { mastery 0..100, locked }
  const [activeSids, setActiveSids] = useState([]);       // навыки в фокусе (0 < stages < 3)
  const [availableSids, setAvailableSids] = useState([]); // mastery=0, prerequisites выполнены
  const [recentTheory, setRecentTheory] = useState([]);   // [{id, ts}] max 20
  const [theoryRead, setTheoryRead] = useState([]);       // [sid] — все прочитанные
  const [theoryCompleted, setTheoryCompleted] = useState([]); // [sid] — XP начислен (анти-фарм повторов)
  const [showAllAvail, setShowAllAvail] = useState(false);
  const [collapsed, setCollapsed] = useState({});         // sectionKey → bool

  useEffect(() => {
    const uid = user?.uid;
    Promise.all([
      getContent('skillTheory'),
      getContent('skillHierarchies'),
      getContent('crossGradeLinks'),
      uid ? getDoc(doc(db, 'individualPlans', uid)).catch(() => null) : null,
      uid ? getDoc(doc(db, 'skillProgress',   uid)).catch(() => null) : null,
      uid ? getDoc(doc(db, 'skillMastery',    uid)).catch(() => null) : null,
      uid ? getDoc(doc(db, 'users',           uid)).catch(() => null) : null,
    ]).then(([theories, shItems, cgLinks, planSnap, progSnap, masterySnap, userSnap]) => {
      setSkillTheories(theories);
      // Build skill_id → Russian name from skillHierarchies
      const nm = {};
      shItems.forEach(d => {
        (d.clusters || []).forEach(cl => {
          (cl.pivot_skills || []).forEach(ps => {
            if (ps.skill_id && ps.skill_name) nm[ps.skill_id] = ps.skill_name;
          });
        });
      });
      setNamesMap(nm);

      // ── Персонализация: переиспользуем модульную логику карты плана ──
      const plan    = planSnap?.exists?.() ? planSnap.data() : null;
      const prog    = progSnap?.exists?.() ? (progSnap.data()?.skills || {}) : {};
      const mastery = masterySnap?.exists?.() ? (masterySnap.data()?.skills || {}) : {};
      if (plan) {
        const diag = buildDiagModuleTree(plan, prog, cgLinks, nm, mastery);
        const st = {};
        const avail = [];
        for (const m of (diag.modules || [])) {
          for (const sk of (m.skills || [])) {
            st[sk.id] = { mastery: sk.mastery || 0, locked: !!m.isLocked };
            // «Готово к старту»: prerequisites выполнены (модуль не заблокирован), не начат
            if (!m.isLocked && (sk.mastery || 0) === 0) avail.push(sk.id);
          }
        }
        setSkillState(st);
        // «Сейчас изучаешь» — навыки в фокусе (начат, но не завершён 3-этапный
        // цикл). Навыки заблокированных модулей не показываем: на карте их
        // нельзя продолжить, секция «изучаешь» с замком сбивала бы с толку.
        const act = Object.entries(mastery)
          .filter(([, s]) => (s.stagesCompleted || 0) > 0 && (s.stagesCompleted || 0) < 3)
          .map(([id]) => id)
          .filter(id => !st[id]?.locked);
        setActiveSids(act);
        setAvailableSids(avail.filter(id => !act.includes(id)));
      }
      const u = userSnap?.exists?.() ? userSnap.data() : null;
      const loadedRecent = Array.isArray(u?.recentTheory) ? u.recentTheory : [];
      const loadedRead   = Array.isArray(u?.theoryRead)   ? u.theoryRead   : [];
      setRecentTheory(loadedRecent);
      setTheoryRead(loadedRead);
      setTheoryCompleted(Array.isArray(u?.theoryCompleted) ? u.theoryCompleted : []);

      setLoading(false);
      // Если передан initialSkillId — сразу открыть нужный навык (meta пишем от
      // только что загруженных массивов, state ещё не успел обновиться).
      if (initialSkillId) {
        const entry = theories.find(t => t.id === initialSkillId || t.skill_id === initialSkillId);
        if (entry) {
          setSelected(entry);
          recordOpen(entry, loadedRecent, loadedRead);
        }
      }
    }).catch(() => setLoading(false));
  }, []);

  // ── Учёт открытия темы: recentTheory — последние открытые ({id,ts}, max 20),
  // theoryRead — все когда-либо прочитанные. Один updateDoc на открытие.
  const recordOpen = (entry, recentArr, readArr) => {
    const uid = user?.uid;
    const sid = sidOf(entry);
    if (!uid || !sid) return;
    const nextRecent = [{ id: sid, ts: Date.now() }, ...recentArr.filter(r => (r?.id || r) !== sid)].slice(0, 20);
    const nextRead = readArr.includes(sid) ? readArr : [...readArr, sid];
    setRecentTheory(nextRecent);
    setTheoryRead(nextRead);
    updateDoc(doc(db, 'users', uid), { recentTheory: nextRecent, theoryRead: nextRead })
      .catch(e => console.warn('[theory] meta update failed:', e?.message || e));
  };

  const openEntry = (entry) => {
    setSelected(entry);
    recordOpen(entry, recentTheory, theoryRead);
  };

  // ── XP за прохождение темы: +10 (+5 бонус за все верные). Только при ПЕРВОМ
  // завершении (sid фиксируется в users/{uid}.theoryCompleted — иначе фарм
  // перепрохождением). Возвращает начисленную сумму для экрана результата.
  const awardTheoryXp = async (entry, score, total) => {
    const uid = user?.uid;
    const sid = sidOf(entry);
    if (!uid || !sid || !total) return 0;
    if (theoryCompleted.includes(sid)) return 0;
    const amount = 10 + (score === total ? 5 : 0);
    const next = [...theoryCompleted, sid];
    setTheoryCompleted(next);
    try { await updateDoc(doc(db, 'users', uid), { theoryCompleted: next }); }
    catch (e) { console.warn('[theory] completed update failed:', e?.message || e); }
    const res = await addXp(uid, amount, 'theory_complete', user);
    return res ? amount : 0;
  };

  // ── Detail view ──
  if (selected) {
    const ruName = namesMap[selected.id] || namesMap[selected.skill_id] || selected.skill_id;
    return (
      <TheoryWalkthrough
        key={sidOf(selected)}
        entry={selected}
        ruName={ruName}
        onExit={() => setSelected(null)}
        awardXp={(score, total) => awardTheoryXp(selected, score, total)}
        user={user}
      />
    );
  }

  // ── List view ──
  const verticals = [...new Set(skillTheories.map(t => t.vertical_line_id).filter(Boolean))].sort();
  const grades = [...new Set(skillTheories.map(t => t.grade).filter(Boolean))].sort((a,b) => Number(a)-Number(b));

  const norm = s => (s||'').toLowerCase().replace(/ё/g,'е');
  const q = norm(search.trim());

  const filtered = skillTheories.filter(t => {
    if (filterSec !== 'all' && t.vertical_line_id !== filterSec) return false;
    if (filterGrade !== 'all' && String(t.grade) !== String(filterGrade)) return false;
    if (q) {
      const ruName = norm(namesMap[t.id] || namesMap[t.skill_id] || t.skill_id);
      const concept = norm(t.theory?.concept || '');
      const hints = norm((t.theory?.micro_hints||[]).map(h => typeof h==='object'?(h.rule||'')+(h.skill_name||''):String(h)).join(' '));
      if (!ruName.includes(q) && !concept.includes(q) && !hints.includes(q) &&
          !norm(t.vertical_line_id||'').includes(q) && !norm(String(t.grade||'')).includes(q)) return false;
    }
    return true;
  });

  // Highlight matching text
  const highlight = (text) => {
    if (!q || !text) return text;
    const idx = norm(text).indexOf(q);
    if (idx === -1) return text;
    return <>{text.slice(0,idx)}<mark style={{background:'rgba(212,175,55,0.35)',borderRadius:3,padding:'0 1px'}}>{text.slice(idx,idx+q.length)}</mark>{text.slice(idx+q.length)}</>;
  };

  // ── «Для тебя»: теория к активным/доступным/недавним навыкам ──
  const theoriesBySid = {};
  for (const t of skillTheories) theoriesBySid[sidOf(t)] = t;
  const readSet = new Set(theoryRead);

  const activeEntries = activeSids.map(id => theoriesBySid[id]).filter(Boolean);
  const availEntries  = availableSids.map(id => theoriesBySid[id]).filter(Boolean);
  const recentEntries = recentTheory
    .map(r => theoriesBySid[r?.id || r]).filter(Boolean).slice(0, 6);
  const noFilters = !q && filterSec === 'all' && filterGrade === 'all';

  // ── Жёсткие секции каталога: ВЕРТИКАЛЬ · КЛАСС ──
  const groupsMap = new Map(); // key → { vertical, grade, items[] }
  for (const t of filtered) {
    const v = t.vertical_line_id || 'прочее';
    const g = t.grade != null && t.grade !== '' ? String(t.grade) : null;
    const key = `${v}|${g ?? ''}`;
    if (!groupsMap.has(key)) groupsMap.set(key, { vertical: v, grade: g, items: [] });
    groupsMap.get(key).items.push(t);
  }
  const groups = [...groupsMap.values()].sort((a, b) =>
    a.vertical.localeCompare(b.vertical, 'ru') || (Number(a.grade ?? 99) - Number(b.grade ?? 99)));

  // ── Карточка темы (общая для всех секций) ──
  const renderCard = (t, { planet3d = false } = {}) => {
    const sid = sidOf(t);
    const ruName = namesMap[t.id] || namesMap[t.skill_id] || t.skill_id;
    const life = lifeFor(skillState[sid]);
    const isRead = readSet.has(sid);
    const conceptFull = t.theory?.concept || '';
    const concept = conceptFull.slice(0, 180) + (conceptFull.length > 180 ? '…' : '');
    const planetSize = planet3d ? 84 : 52;
    return (
      <div key={t.id} className="theme-card theory-card" onClick={() => openEntry(t)}
        style={{ position:'relative', background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:14, padding:'16px 18px', cursor:'pointer', transition:'all 0.2s', display:'flex', gap:14, alignItems:'flex-start' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor=THEME.primary; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor=THEME.border; }}>
        {/* Бейдж «прочитано» */}
        {isRead && (
          <span title="Прочитано" style={{ position:'absolute', top:10, right:10, width:20, height:20, borderRadius:'50%', background:'#22c55e', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, boxShadow:'0 1px 4px rgba(34,197,94,0.5)' }}>✓</span>
        )}
        {/* Мини-планета: 3D только в секции «Сейчас изучаешь» на десктопе
            (лимит WebGL-контекстов в браузере не позволяет 3D на всех 289
            карточках); остальные — статичный градиент того же фолбэка. */}
        {planet3d && !isMobile
          ? <LazyMount height={planetSize}>
              <div style={{ width:planetSize, height:planetSize, flexShrink:0 }}>
                <SkillPlanet3D fromLife={life} toLife={life} size={planetSize}/>
              </div>
            </LazyMount>
          : <PlanetDot life={life} size={planetSize}/>}
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:11, color:THEME.textLight, marginBottom:3 }}>{[ruVertical(t.vertical_line_id), t.grade ? `${t.grade} кл` : ''].filter(Boolean).join(' · ')}</div>
          <div style={{ fontWeight:700, fontSize:15, color:THEME.primary, marginBottom:6, paddingRight:isRead?20:0 }}>{highlight(ruName)}</div>
          {/* Превью теории: до 3 строк (раньше — одна) */}
          <div style={{ fontSize:13, color:THEME.textLight, lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{highlight(concept)}</div>
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {(t.theory?.micro_hints||[]).length > 0 && <span title={`${t.theory.micro_hints.length} микро-подсказок в теории`} style={{ fontSize:11, background:`${THEME.accent}20`, color:THEME.accent, padding:'2px 10px', borderRadius:99, fontWeight:600 }}>💡 {t.theory.micro_hints.length} подсказ.</span>}
            {(t.tasks||[]).length > 0 && <span title={`${t.tasks.length} задач для практики`} style={{ fontSize:11, background:'rgba(15,23,42,0.06)', color:THEME.textLight, padding:'2px 10px', borderRadius:99, fontWeight:600 }}>🏋️ {t.tasks.length} задач</span>}
          </div>
        </div>
      </div>
    );
  };

  const sectionTitle = (emoji, text, color) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, margin:'0 0 12px' }}>
      <span style={{ fontSize:16 }}>{emoji}</span>
      <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:15, color: color || THEME.primary, letterSpacing:'0.3px' }}>{text}</span>
    </div>
  );

  const cardGrid = (children) => (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(290px, 1fr))', gap:14 }}>{children}</div>
  );

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
      <AppTopbar title="📖 Теория" onBack={onBack} user={user} />
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'40px 20px' }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color:THEME.primary, marginBottom:6 }}>📖 Теория</h1>
          <p style={{ color:THEME.textLight, fontSize:15 }}>Твой персональный учебник — темы привязаны к навыкам на карте</p>
        </div>

        {loading && <div style={{ textAlign:'center', padding:80, color:THEME.textLight }}>Загрузка...</div>}
        {!loading && (
          <>
            {/* Поиск */}
            <div data-tour="theory-search" style={{ position:'relative', marginBottom:18 }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:THEME.textLight, pointerEvents:'none' }}>🔍</span>
              <input
                className="theme-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по теме, навыку, содержанию..."
                style={{ width:'100%', boxSizing:'border-box', padding:'12px 16px 12px 40px', borderRadius:12, border:`1.5px solid ${search ? THEME.primary : THEME.border}`, fontSize:15, outline:'none', background:'#fff', color:THEME.text, transition:'border-color 0.2s' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:THEME.textLight, lineHeight:1 }}>×</button>
              )}
            </div>

            {/* Фильтры: по разделу и по классу — в общей обёртке для подсветки тура */}
            <div data-tour="theory-filters">
              {verticals.length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  <button className={`theme-tab${filterSec==='all'?' active':''}`} onClick={() => setFilterSec('all')} style={{ padding:'6px 16px', borderRadius:20, border:`2px solid ${filterSec==='all'?THEME.primary:THEME.border}`, background:filterSec==='all'?THEME.primary:'transparent', color:filterSec==='all'?THEME.accent:THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>Все разделы</button>
                  {verticals.map(v => (
                    <button key={v} className={`theme-tab${filterSec===v?' active':''}`} onClick={() => setFilterSec(v)} style={{ padding:'6px 16px', borderRadius:20, border:`2px solid ${filterSec===v?THEME.primary:THEME.border}`, background:filterSec===v?THEME.primary:'transparent', color:filterSec===v?THEME.accent:THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>{ruVertical(v)}</button>
                  ))}
                </div>
              )}

              {grades.length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
                  <button className={`theme-tab${filterGrade==='all'?' active':''}`} onClick={() => setFilterGrade('all')} style={{ padding:'5px 14px', borderRadius:20, border:`2px solid ${filterGrade==='all'?'#6366f1':THEME.border}`, background:filterGrade==='all'?'#6366f1':'transparent', color:filterGrade==='all'?'#fff':THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>Все классы</button>
                  {grades.map(g => (
                    <button key={g} className={`theme-tab${filterGrade===String(g)?' active':''}`} onClick={() => setFilterGrade(String(g))} style={{ padding:'5px 14px', borderRadius:20, border:`2px solid ${filterGrade===String(g)?'#6366f1':THEME.border}`, background:filterGrade===String(g)?'#6366f1':'transparent', color:filterGrade===String(g)?'#fff':THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>{g} класс</button>
                  ))}
                </div>
              )}
            </div>

            {/* ── «ДЛЯ ТЕБЯ» — три персональные секции (скрываются при поиске/фильтрах) ── */}
            {noFilters && (activeEntries.length > 0 || availEntries.length > 0 || recentEntries.length > 0) && (
              <div style={{ marginBottom:30 }}>
                {activeEntries.length > 0 && (
                  <div style={{ marginBottom:22 }}>
                    {sectionTitle('⚡', 'Сейчас изучаешь', '#b45309')}
                    {cardGrid(activeEntries.map(t => renderCard(t, { planet3d: true })))}
                  </div>
                )}
                {availEntries.length > 0 && (
                  <div style={{ marginBottom:22 }}>
                    {sectionTitle('▶', 'Готово к старту', '#15803d')}
                    {cardGrid((showAllAvail ? availEntries : availEntries.slice(0, 6)).map(t => renderCard(t)))}
                    {availEntries.length > 6 && (
                      <button onClick={() => setShowAllAvail(v => !v)}
                        style={{ marginTop:10, padding:'8px 18px', borderRadius:10, border:`1px solid ${THEME.border}`, background:THEME.surface, color:'#15803d', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                        {showAllAvail ? 'Свернуть' : `Показать все доступные (${availEntries.length})`}
                      </button>
                    )}
                  </div>
                )}
                {recentEntries.length > 0 && (
                  <div style={{ marginBottom:22 }}>
                    {sectionTitle('🕐', 'Недавно открытые', THEME.textLight)}
                    {cardGrid(recentEntries.map(t => renderCard(t)))}
                  </div>
                )}
              </div>
            )}

            {/* Счётчик результатов */}
            {q && (
              <div style={{ fontSize:13, color:THEME.textLight, marginBottom:14 }}>
                {filtered.length > 0 ? `Найдено: ${filtered.length}` : 'Ничего не найдено'}
              </div>
            )}

            {/* ── Каталог: жёсткие секции «ВЕРТИКАЛЬ · КЛАСС», sticky, сворачиваемые ── */}
            {filtered.length > 0 ? (
              <div data-tour="theory-grid">
                {noFilters && (
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:15, color:THEME.primary, margin:'0 0 4px', letterSpacing:'0.3px' }}>📚 Все темы</div>
                )}
                {groups.map(gr => {
                  const key = `${gr.vertical}|${gr.grade ?? ''}`;
                  const isCollapsed = !!collapsed[key];
                  const title = [ruVerticalUpper(gr.vertical), gr.grade ? `${gr.grade} КЛАСС` : null].filter(Boolean).join(' · ');
                  return (
                    <div key={key} style={{ marginBottom: isCollapsed ? 2 : 18 }}>
                      <div onClick={() => setCollapsed(p => ({ ...p, [key]: !p[key] }))}
                        style={{ position:'sticky', top:0, zIndex:5, background:THEME.bg, display:'flex', alignItems:'center', gap:10, padding:'12px 4px 10px', cursor:'pointer', userSelect:'none', borderBottom:`1px solid ${THEME.border}`, marginBottom:isCollapsed?0:14 }}>
                        <span style={{ fontSize:12, color:THEME.textLight, width:14, display:'inline-block', transition:'transform 0.15s', transform:isCollapsed?'rotate(-90deg)':'none' }}>▼</span>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:THEME.primary, letterSpacing:'0.5px' }}>{title}</span>
                        <span style={{ fontSize:12, color:THEME.textLight, fontWeight:600 }}>({gr.items.length} {ruPlural(gr.items.length, ['тема','темы','тем'])})</span>
                      </div>
                      {!isCollapsed && cardGrid(gr.items.map(t => renderCard(t)))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'80px 20px' }}>
                <div style={{ fontSize:52, marginBottom:16 }}>{q ? '🔍' : '📭'}</div>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, color:THEME.primary, marginBottom:8 }}>
                  {q ? `По запросу «${search}» ничего не найдено` : 'Теория пока не добавлена'}
                </div>
                <div style={{ fontSize:14, color:THEME.textLight }}>
                  {q ? 'Попробуйте другой запрос или сбросьте фильтры' : 'Преподаватель добавит теоретические материалы в ближайшее время'}
                </div>
                {(q || filterSec !== 'all' || filterGrade !== 'all') && (
                  <button onClick={() => { setSearch(''); setFilterSec('all'); setFilterGrade('all'); }}
                    style={{ marginTop:16, padding:'8px 20px', borderRadius:10, border:`1px solid ${THEME.border}`, background:'#fff', color:THEME.primary, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    Сбросить фильтры
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
