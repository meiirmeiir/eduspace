import React, { useState, useEffect } from "react";
import { getContent } from "../lib/contentCache.js";
import { THEME } from "../lib/appConstants.js";
import Logo from "../components/ui/Logo.jsx";
import LatexText from "../components/ui/LatexText.jsx";

export default function TheoryBrowseScreen({ user, onBack, initialSkillId }) {
  const [skillTheories, setSkillTheories] = useState([]);
  const [namesMap, setNamesMap] = useState({}); // skill_id → Russian name
  const [loading, setLoading] = useState(true);
  const [filterSec, setFilterSec] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // skillTheory entry
  // Per-task inline practice state: array of {chosen, revealed}
  const [taskStates, setTaskStates] = useState([]);

  useEffect(() => {
    Promise.all([
      getContent('skillTheory'),
      getContent('skillHierarchies')
    ]).then(([theories, shItems]) => {
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
      setLoading(false);
      // Если передан initialSkillId — сразу открыть нужный навык
      if (initialSkillId) {
        const entry = theories.find(t => t.id === initialSkillId || t.skill_id === initialSkillId);
        if (entry) {
          setSelected(entry);
          setTaskStates((entry.tasks || []).map(() => ({ chosen: null, revealed: false })));
        }
      }
    }).catch(() => setLoading(false));
  }, []);

  const openEntry = (entry) => {
    setSelected(entry);
    setTaskStates((entry.tasks || []).map(() => ({ chosen: null, revealed: false })));
  };

  const handleChoose = (taskIdx, optIdx) => {
    setTaskStates(prev => prev.map((s, i) => i === taskIdx ? { chosen: optIdx, revealed: true } : s));
  };

  // ── Detail view ──
  if (selected) {
    const e = selected;
    const tasks = e.tasks || [];
    const ruName = namesMap[e.id] || namesMap[e.skill_id] || e.skill_id;

    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
        <nav data-inner-nav style={{ background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 40px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Logo size={28}/>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color:THEME.textLight }}>📖 Теория</div>
          <button onClick={() => setSelected(null)} style={{ background:'transparent', border:`1px solid ${THEME.border}`, borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, color:THEME.textLight }}>← Назад</button>
        </nav>
        <div style={{ maxWidth:780, margin:'0 auto', padding:'40px 20px 60px' }}>

          {/* Title */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:13, color:THEME.textLight, marginBottom:6 }}>{[e.vertical_line_id, e.grade ? `${e.grade} класс` : ''].filter(Boolean).join(' · ')}</div>
            <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:26, fontWeight:800, color:THEME.primary }}>{ruName}</h1>
          </div>

          {/* Theory concept */}
          {e.theory?.concept && (
            <div style={{ background:'#fff', borderRadius:18, border:`1px solid ${THEME.border}`, padding:'28px 32px', marginBottom:20, boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:14 }}>Теория</div>
              <div style={{ fontSize:16, lineHeight:1.85, color:THEME.text, fontFamily:"'Inter',sans-serif" }}>
                <LatexText text={e.theory.concept}/>
              </div>
            </div>
          )}

          {/* Micro-hints */}
          {(e.theory?.micro_hints||[]).length > 0 && (
            <div style={{ background:'#fff', borderRadius:18, border:`1px solid ${THEME.border}`, padding:'28px 32px', marginBottom:20, boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:16 }}>💡 Микро-подсказки</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {e.theory.micro_hints.map((hint, i) => {
                  if (hint && typeof hint === 'object') {
                    return (
                      <div key={i} style={{ background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:12, padding:'16px 20px' }}>
                        {hint.skill_name && <div style={{ fontWeight:700, fontSize:14, color:THEME.primary, marginBottom:6 }}>{hint.skill_name}</div>}
                        {hint.rule && <div style={{ fontSize:14, color:THEME.text, lineHeight:1.7, marginBottom:hint.example ? 8 : 0 }}><LatexText text={hint.rule}/></div>}
                        {hint.example && (
                          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:8, padding:'10px 14px', fontSize:14, color:'#92400e' }}>
                            <b>Пример: </b><LatexText text={hint.example}/>
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
            </div>
          )}

          {/* Inline practice tasks */}
          {tasks.length > 0 && (
            <div style={{ background:'#fff', borderRadius:18, border:`1px solid ${THEME.border}`, padding:'28px 32px', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:20 }}>🏋️ Тренировка</div>
              <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                {tasks.map((task, ti) => {
                  const ts = taskStates[ti] || { chosen: null, revealed: false };
                  const isCorrect = ts.revealed && ts.chosen === task.correct_index;
                  return (
                    <div key={ti} style={{ borderTop: ti > 0 ? `1px solid ${THEME.border}` : 'none', paddingTop: ti > 0 ? 24 : 0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:THEME.textLight, marginBottom:10 }}>Задача {ti + 1}</div>
                      <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:THEME.primary, lineHeight:1.5, marginBottom:16 }}>
                        <LatexText text={task.question_text}/>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {(task.options||[]).map((opt, oi) => {
                          let bg='#fff', border=`1px solid ${THEME.border}`, color=THEME.text;
                          if (ts.revealed) {
                            if (oi===task.correct_index) { bg='rgba(16,185,129,0.1)'; border=`2px solid ${THEME.success}`; color=THEME.success; }
                            else if (oi===ts.chosen) { bg='rgba(239,68,68,0.08)'; border=`2px solid ${THEME.error}`; color=THEME.error; }
                            else { bg='#f8fafc'; color=THEME.textLight; }
                          } else if (ts.chosen===oi) { bg='#f1f5f9'; border=`2px solid ${THEME.primary}`; }
                          return (
                            <div key={oi} onClick={() => !ts.revealed && handleChoose(ti, oi)}
                              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, background:bg, border, cursor:ts.revealed?'default':'pointer', transition:'all 0.15s' }}>
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
                        <div style={{ marginTop:12, padding:'12px 16px', borderRadius:10, background:isCorrect?'rgba(16,185,129,0.07)':'rgba(239,68,68,0.05)', border:`1px solid ${isCorrect?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.15)'}` }}>
                          <div style={{ fontWeight:700, fontSize:13, color:isCorrect?THEME.success:THEME.error, marginBottom:isCorrect?0:4 }}>{isCorrect?'✅ Верно!':'❌ Неверно'}</div>
                          {!isCorrect&&task.options&&<div style={{ fontSize:13, color:THEME.textLight }}>Правильный ответ: <b style={{ color:THEME.primary }}><LatexText text={task.options[task.correct_index]}/></b></div>}
                          {task.explanation&&<div style={{ marginTop:6, fontSize:13, color:THEME.text, lineHeight:1.6 }}>💡 <LatexText text={task.explanation}/></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
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

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
      <nav data-inner-nav style={{ background:THEME.surface, borderBottom:`1px solid ${THEME.border}`, padding:'0 40px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Logo size={28}/>
        <button onClick={onBack} className="cta-button active" style={{ width:'auto', padding:'8px 18px', fontSize:13 }}>← Главная</button>
      </nav>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'40px 20px' }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color:THEME.primary, marginBottom:6 }}>📖 Теория</h1>
          <p style={{ color:THEME.textLight, fontSize:15 }}>Теоретические материалы для подготовки</p>
        </div>

        {loading && <div style={{ textAlign:'center', padding:80, color:THEME.textLight }}>Загрузка...</div>}
        {!loading && (
          <>
            {/* Поиск */}
            <div data-tour="theory-search" style={{ position:'relative', marginBottom:18 }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:THEME.textLight, pointerEvents:'none' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по теме, навыку, содержанию..."
                style={{ width:'100%', boxSizing:'border-box', padding:'12px 16px 12px 40px', borderRadius:12, border:`1.5px solid ${search ? THEME.primary : THEME.border}`, fontSize:15, outline:'none', background:'#fff', color:THEME.text, transition:'border-color 0.2s' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:THEME.textLight, lineHeight:1 }}>×</button>
              )}
            </div>

            {/* Фильтр по разделу */}
            {verticals.length > 0 && (
              <div data-tour="theory-filters" style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                <button onClick={() => setFilterSec('all')} style={{ padding:'6px 16px', borderRadius:20, border:`2px solid ${filterSec==='all'?THEME.primary:THEME.border}`, background:filterSec==='all'?THEME.primary:'transparent', color:filterSec==='all'?THEME.accent:THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>Все разделы</button>
                {verticals.map(v => (
                  <button key={v} onClick={() => setFilterSec(v)} style={{ padding:'6px 16px', borderRadius:20, border:`2px solid ${filterSec===v?THEME.primary:THEME.border}`, background:filterSec===v?THEME.primary:'transparent', color:filterSec===v?THEME.accent:THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>{v}</button>
                ))}
              </div>
            )}

            {/* Фильтр по классу */}
            {grades.length > 0 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
                <button onClick={() => setFilterGrade('all')} style={{ padding:'5px 14px', borderRadius:20, border:`2px solid ${filterGrade==='all'?'#6366f1':THEME.border}`, background:filterGrade==='all'?'#6366f1':'transparent', color:filterGrade==='all'?'#fff':THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>Все классы</button>
                {grades.map(g => (
                  <button key={g} onClick={() => setFilterGrade(String(g))} style={{ padding:'5px 14px', borderRadius:20, border:`2px solid ${filterGrade===String(g)?'#6366f1':THEME.border}`, background:filterGrade===String(g)?'#6366f1':'transparent', color:filterGrade===String(g)?'#fff':THEME.textLight, fontWeight:600, fontSize:13, cursor:'pointer' }}>{g} класс</button>
                ))}
              </div>
            )}

            {/* Счётчик результатов */}
            {q && (
              <div style={{ fontSize:13, color:THEME.textLight, marginBottom:14 }}>
                {filtered.length > 0 ? `Найдено: ${filtered.length}` : 'Ничего не найдено'}
              </div>
            )}

            {filtered.length > 0 ? (
              <div data-tour="theory-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
                {filtered.map(t => {
                  const ruName = namesMap[t.id] || namesMap[t.skill_id] || t.skill_id;
                  const concept = (t.theory?.concept||'').slice(0,70) + ((t.theory?.concept||'').length>70?'…':'');
                  return (
                    <div key={t.id} onClick={() => openEntry(t)}
                      style={{ background:'#fff', border:`1px solid ${THEME.border}`, borderRadius:14, padding:'20px 22px', cursor:'pointer', transition:'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor=THEME.primary; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor=THEME.border; }}>
                      <div style={{ fontSize:11, color:THEME.textLight, marginBottom:4 }}>{[t.vertical_line_id, t.grade ? `${t.grade} кл` : ''].filter(Boolean).join(' · ')}</div>
                      <div style={{ fontWeight:700, fontSize:15, color:THEME.primary, marginBottom:6 }}>{highlight(ruName)}</div>
                      <div style={{ fontSize:13, color:THEME.textLight, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{highlight(concept)}</div>
                      <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                        {(t.theory?.micro_hints||[]).length > 0 && <span title={`${t.theory.micro_hints.length} микро-подсказок в теории`} style={{ fontSize:11, background:'rgba(99,102,241,0.08)', color:'#4338ca', padding:'2px 10px', borderRadius:99, fontWeight:600 }}>💡 {t.theory.micro_hints.length} подсказ.</span>}
                        {(t.tasks||[]).length > 0 && <span title={`${t.tasks.length} задач для практики`} style={{ fontSize:11, background:'rgba(15,23,42,0.06)', color:THEME.textLight, padding:'2px 10px', borderRadius:99, fontWeight:600 }}>🏋️ {t.tasks.length} задач</span>}
                      </div>
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
