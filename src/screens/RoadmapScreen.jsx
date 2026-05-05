import React, { useState } from "react";
import { THEME } from "../lib/appConstants.js";
import { VERTICAL_LABELS } from "../lib/diagnosticUtils.js";
import Logo from "../components/ui/Logo.jsx";

function RoadmapScreen({ roadmap, user, onBack, onViewPlan }) {
  const [expandedStep, setExpandedStep] = useState(0);
  const { total_gap_skills, roadmap: steps = [], isPerfectStudent } = roadmap || {};
  const totalSteps = steps.length;

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(180deg,#080e1f 0%,#0d1a35 60%,#0a1228 100%)',color:'#fff',fontFamily:"'Inter',sans-serif"}}>

      {/* Nav */}
      <nav style={{padding:'18px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.06)',position:'sticky',top:0,backdropFilter:'blur(12px)',background:'rgba(8,14,31,0.85)',zIndex:100}}>
        <Logo size={28}/>
        <button onClick={onBack} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.7)',borderRadius:8,padding:'8px 18px',cursor:'pointer',fontSize:13,fontFamily:"'Inter',sans-serif"}}>
          На главную →
        </button>
      </nav>

      <div style={{maxWidth:680,margin:'0 auto',padding:'44px 20px 80px'}}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div style={{textAlign:'center',marginBottom:44}}>
          <div style={{fontSize:56,marginBottom:16,lineHeight:1}}>🗺️</div>
          <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,marginBottom:12,letterSpacing:-0.5,lineHeight:1.2}}>
            Твоя дорожная карта
          </h1>
          {isPerfectStudent ? (
            <p style={{color:'rgba(255,255,255,0.55)',fontSize:15,lineHeight:1.7,maxWidth:440,margin:'0 auto 28px'}}>
              Отличный результат! Ты прошёл диагностику <b style={{color:'#D4AF37'}}>без ошибок</b>.<br/>
              Твой план — закрепить целевые темы 11 класса на отлично.
            </p>
          ) : (
            <p style={{color:'rgba(255,255,255,0.55)',fontSize:15,lineHeight:1.7,maxWidth:440,margin:'0 auto 28px'}}>
              Умная диагностика выявила <b style={{color:'#D4AF37'}}>{total_gap_skills}</b> навыков с пробелами.<br/>
              Изучай с фундамента — так новый материал встаёт на своё место.
            </p>
          )}

          {/* Stats */}
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',marginBottom:4}}>
            {[
              {icon:'🔍',val:total_gap_skills,lbl:'пробелов найдено'},
              {icon:'📚',val:totalSteps,lbl:'уровня в плане'},
              {icon:'⬇️',val:'фундамент',lbl:'начинаем отсюда'},
            ].map(s=>(
              <div key={s.lbl} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:12,padding:'14px 20px',textAlign:'center',minWidth:120}}>
                <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:'#D4AF37'}}>{s.val}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.38)',marginTop:3}}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Insight banner ────────────────────────────────────────────────── */}
        <div style={{background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:14,padding:'16px 22px',marginBottom:32,display:'flex',alignItems:'flex-start',gap:14}}>
          <div style={{fontSize:22,lineHeight:1,flexShrink:0,marginTop:2}}>💡</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.7}}>
            <b style={{color:'#D4AF37'}}>Почему снизу вверх?</b> Большинство ошибок в 11 классе — это следствие пробелов в 7–9 классе.
            Закрой корни — и сложные темы откроются сами.
          </div>
        </div>

        {/* ── Timeline ──────────────────────────────────────────────────────── */}
        <div style={{position:'relative'}}>
          {/* Вертикальная линия таймлайна */}
          {totalSteps > 1 && (
            <div style={{position:'absolute',left:25,top:52,bottom:52,width:2,background:'linear-gradient(180deg,#D4AF37 0%,rgba(212,175,55,0.08) 100%)',zIndex:0,borderRadius:2}}/>
          )}

          {steps.map((step, idx) => {
            const isExpanded = expandedStep === idx;
            const vertEntries = Object.entries(step.by_vertical || {});

            return (
              <div key={step.step} style={{position:'relative',zIndex:1,marginBottom:idx < totalSteps - 1 ? 12 : 0}}>
                <div
                  onClick={() => !step.is_locked && setExpandedStep(isExpanded ? -1 : idx)}
                  style={{
                    background: step.is_active
                      ? 'linear-gradient(135deg,rgba(212,175,55,0.13) 0%,rgba(212,175,55,0.04) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: step.is_active
                      ? '1px solid rgba(212,175,55,0.38)'
                      : '1px solid rgba(255,255,255,0.07)',
                    borderRadius:16,padding:'20px 20px 20px 24px',
                    cursor: step.is_locked ? 'default' : 'pointer',
                    opacity: step.is_locked ? 0.5 : 1,
                    transition:'all 0.18s',
                  }}
                  onMouseEnter={e => { if(!step.is_locked) e.currentTarget.style.transform='translateX(3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; }}
                >
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    {/* Кружок шага */}
                    <div style={{
                      width:50,height:50,borderRadius:'50%',flexShrink:0,
                      background: step.is_active
                        ? 'linear-gradient(135deg,#D4AF37,#b8960c)'
                        : 'rgba(255,255,255,0.07)',
                      border: step.is_active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:step.is_locked?20:18,
                      color: step.is_active ? '#0a0f1e' : 'rgba(255,255,255,0.25)',
                    }}>
                      {step.is_locked ? '🔒' : step.step}
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                        <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:15,color: step.is_active ? '#D4AF37' : 'rgba(255,255,255,0.65)'}}>
                          {step.title}
                        </span>
                        {step.is_active && (
                          <span style={{background:'#D4AF37',color:'#0a0f1e',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:800,letterSpacing:0.5,flexShrink:0}}>
                            СТАРТ
                          </span>
                        )}
                      </div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.35)'}}>
                        {step.skills_count} навыков · {vertEntries.length} {vertEntries.length===1?'раздел':'раздела'}
                      </div>
                    </div>

                    {!step.is_locked && (
                      <div style={{fontSize:16,color:'rgba(255,255,255,0.25)',transform: isExpanded ? 'rotate(180deg)' : 'none',transition:'transform 0.2s',flexShrink:0}}>▾</div>
                    )}
                  </div>

                  {/* Раскрытые детали */}
                  {isExpanded && !step.is_locked && vertEntries.length > 0 && (
                    <div style={{marginTop:20,paddingTop:18,borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                      {vertEntries.map(([vertId, skills]) => (
                        <div key={vertId} style={{marginBottom:16}}>
                          <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.38)',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
                            {VERTICAL_LABELS[vertId] || vertId}
                          </div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                            {skills.map(skill => (
                              <div key={skill.id} style={{
                                background:'rgba(255,255,255,0.05)',
                                border:'1px solid rgba(255,255,255,0.09)',
                                borderRadius:8,padding:'5px 11px',
                                fontSize:12,color:'rgba(255,255,255,0.65)',
                                display:'flex',alignItems:'center',gap:7,
                              }}>
                                <span style={{
                                  width:7,height:7,borderRadius:'50%',flexShrink:0,
                                  background: skill.passRate >= 30 ? '#f59e0b' : '#ef4444',
                                }}/>
                                <span>{skill.id}</span>
                                <span style={{color:'rgba(255,255,255,0.25)',fontSize:11}}>{skill.passRate}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{marginTop:8,fontSize:12,color:'rgba(255,255,255,0.28)',fontStyle:'italic'}}>
                        🟠 жёлтый = частичные знания · 🔴 красный = нет знаний
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <div style={{marginTop:40}}>
          {/* Первичный CTA: Начать обучение */}
          {onViewPlan && (
            <button
              onClick={onViewPlan}
              style={{
                display:'block',width:'100%',
                background:'linear-gradient(135deg,#D4AF37,#b8960c)',
                color:'#0a0f1e',border:'none',borderRadius:14,
                padding:'18px 44px',marginBottom:12,
                fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:17,
                cursor:'pointer',
                boxShadow:'0 4px 20px rgba(212,175,55,0.35)',
              }}
            >
              {isPerfectStudent ? 'Перейти к плану повторения →' : 'Начать обучение — Уровень 1 →'}
            </button>
          )}

          {/* Вторичный: На главный экран */}
          <button
            onClick={onBack}
            style={{
              display:'block',width:'100%',
              background:'transparent',
              color:'rgba(255,255,255,0.45)',
              border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:14,padding:'14px 44px',
              fontFamily:"'Montserrat',sans-serif",fontWeight:600,fontSize:14,
              cursor:'pointer',
            }}
          >
            На главный экран
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoadmapScreen;
