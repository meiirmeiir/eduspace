import React, { useState } from "react";
import { THEME } from "../lib/appConstants.js";
import { updateDoc, doc, db } from "../firestore-rest.js";
import Logo from "../components/ui/Logo.jsx";

// ── ОНБОРДИНГ ─────────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    icon: "🎯",
    title: "Добро пожаловать в AAPA Math!",
    desc: "AAPA Math — это умная платформа для подготовки к экзаменам и ликвидации пробелов в математике. Здесь каждый ученик получает персональный маршрут, а не стандартный учебник.",
    tip: null,
  },
  {
    icon: "🔍",
    title: "Диагностика — твой первый шаг",
    desc: "Пройди короткий тест по своей теме. Система анализирует не только правильность ответов, но и твою уверенность в каждом из них. Это даёт точную картину твоего уровня.",
    tip: "💡 Отвечай честно — система работает лучше, когда ты указываешь реальную уверенность.",
  },
  {
    icon: "🗺️",
    title: "Карта навыков",
    desc: "После диагностики ты получишь карту навыков с тремя зонами: красная (критичные пробелы), жёлтая (требует внимания), зелёная (освоено хорошо).",
    tip: "💡 Карта обновляется автоматически по мере прохождения тестов.",
  },
  {
    icon: "📋",
    title: "Индивидуальный план",
    desc: "На основе результатов диагностики преподаватель составит персональный план обучения. Ты увидишь точный список тем и порядок их изучения.",
    tip: "💡 Чем больше диагностик ты пройдёшь — тем точнее будет план.",
  },
  {
    icon: "🚀",
    title: "Готов начать?",
    desc: "Первая диагностика покажет твой текущий уровень. Это займёт около 15–20 минут. После этого ты увидишь свою карту навыков и сможешь начать работу над пробелами.",
    tip: null,
  },
];

function OnboardingScreen({ user, onFinish }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const total = ONBOARDING_STEPS.length;
  const s = ONBOARDING_STEPS[step];
  const isLast = step === total - 1;

  const finish = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { onboardingDone: true });
    } catch(e) { console.error(e); }
    setSaving(false);
    onFinish();
  };

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg, ${THEME.primary} 0%, #1e1b4b 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Inter',sans-serif"}}>
      {/* Progress dots */}
      <div style={{display:"flex",gap:8,marginBottom:40}}>
        {ONBOARDING_STEPS.map((_,i)=>(
          <div key={i} onClick={()=>setStep(i)} style={{width:i===step?28:8,height:8,borderRadius:4,background:i===step?"#d4af37":i<step?"rgba(212,175,55,0.5)":"rgba(255,255,255,0.2)",cursor:"pointer",transition:"all 0.3s"}}/>
        ))}
      </div>

      {/* Card */}
      <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:28,padding:"48px 40px",maxWidth:520,width:"100%",textAlign:"center",color:"#fff",boxShadow:"0 24px 64px rgba(0,0,0,0.3)"}}>
        <div style={{fontSize:72,marginBottom:24,lineHeight:1}}>{s.icon}</div>
        <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:26,fontWeight:800,marginBottom:16,lineHeight:1.3,color:"#fff"}}>{s.title}</h1>
        <p style={{fontSize:16,lineHeight:1.7,color:"rgba(255,255,255,0.8)",marginBottom:s.tip?20:32}}>{s.desc}</p>
        {s.tip&&<div style={{background:"rgba(212,175,55,0.12)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:12,padding:"12px 16px",marginBottom:32,fontSize:14,color:"#d4af37",lineHeight:1.5,textAlign:"left"}}>{s.tip}</div>}

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {isLast ? (
            <button onClick={finish} disabled={saving} style={{background:"#d4af37",color:THEME.primary,border:"none",borderRadius:14,padding:"16px 32px",fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.3px",opacity:saving?0.7:1}}>
              {saving ? "Сохраняем..." : "Начать диагностику →"}
            </button>
          ) : (
            <button onClick={()=>setStep(s=>s+1)} style={{background:"#d4af37",color:THEME.primary,border:"none",borderRadius:14,padding:"16px 32px",fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.3px"}}>
              Далее →
            </button>
          )}
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.6)",borderRadius:14,padding:"12px 32px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
              ← Назад
            </button>
          )}
          {!isLast && (
            <button onClick={finish} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",fontSize:13,cursor:"pointer",padding:"4px"}}>
              Пропустить
            </button>
          )}
        </div>
      </div>

      {/* Step counter */}
      <div style={{marginTop:24,color:"rgba(255,255,255,0.4)",fontSize:13}}>{step+1} из {total}</div>
    </div>
  );
}

export default OnboardingScreen;
