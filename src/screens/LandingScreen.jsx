import React, { useEffect } from "react";
import Logo from "../components/ui/Logo.jsx";
import AnimCounter from "../components/ui/AnimCounter.jsx";

// ── LANDING ───────────────────────────────────────────────────────────────────

function LandingScreen({ user, onStart, onDashboard }) {
  const exams = ["ЕНТ","SAT","NUET","Further Math","IGCSE"];

  React.useEffect(()=>{
    const els=document.querySelectorAll('[data-anim]');
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('anim-in'); io.unobserve(e.target); } });
    },{threshold:0.1,rootMargin:'0px 0px -50px 0px'});
    els.forEach(el=>io.observe(el));
    return ()=>io.disconnect();
  },[]);

  return (
    <div style={{fontFamily:"'Inter',sans-serif",color:"#1e293b",background:"#f8fafc",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800;900&display=swap');
        .land-btn-primary{background:#d4af37;color:#0f172a;border:none;padding:16px 36px;border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:16px;cursor:pointer;transition:all 0.2s;letter-spacing:0.3px;}
        .land-btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(212,175,55,0.45);}
        .land-btn-ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,0.3);padding:14px 28px;border-radius:12px;font-family:'Inter',sans-serif;font-weight:600;font-size:15px;cursor:pointer;transition:all 0.2s;}
        .land-btn-ghost:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.5);}
        .land-nav{position:sticky;top:0;z-index:100;background:rgba(15,23,42,0.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.07);padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between;}
        .land-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#d4af37,#f59e0b);border:2px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#0f172a;}
        .land-mech-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px 28px;transition:all 0.22s;}
        .land-mech-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.08);}
        .land-tcard{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:28px;transition:box-shadow 0.2s;}
        .land-tcard:hover{box-shadow:0 8px 32px rgba(0,0,0,0.15);}
        @keyframes pulse-glow{0%,100%{box-shadow:0 0 0 0 rgba(212,175,55,0.4);}50%{box-shadow:0 0 0 14px rgba(212,175,55,0);}}
        .pulse-btn{animation:pulse-glow 2.5s ease-in-out infinite;}
        @keyframes floatY{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
        @keyframes floatSlow{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
        @keyframes heroFadeIn{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}
        @keyframes heroBadgePop{0%{opacity:0;transform:scale(0.7);}70%{transform:scale(1.06);}100%{opacity:1;transform:scale(1);}}
        .land-float{animation:floatY 3.2s ease-in-out infinite;}
        .land-float-slow{animation:floatSlow 4s ease-in-out infinite;}
        .hero-anim-1{animation:heroFadeIn 0.7s 0.05s ease both;}
        .hero-anim-2{animation:heroFadeIn 0.7s 0.2s ease both;}
        .hero-anim-3{animation:heroFadeIn 0.8s 0.35s ease both;}
        .hero-anim-4{animation:heroFadeIn 0.7s 0.5s ease both;}
        .hero-anim-5{animation:heroFadeIn 0.7s 0.65s ease both;}
        .hero-badge-pop{animation:heroBadgePop 0.55s 0.8s ease both;}
        [data-anim]{opacity:0;transition:opacity 0.65s cubic-bezier(0.16,1,0.3,1),transform 0.65s cubic-bezier(0.16,1,0.3,1);}
        [data-anim="up"],[data-anim]{transform:translateY(28px);}
        [data-anim="left"]{transform:translateX(-30px);}
        [data-anim="right"]{transform:translateX(30px);}
        [data-anim="scale"]{transform:scale(0.9);}
        [data-anim].anim-in{opacity:1!important;transform:none!important;}
        @media(max-width:768px){
          .land-nav{padding:0 20px;}
          .land-hero-inner{padding:60px 20px!important;min-height:auto!important;}
          .land-grid-3{grid-template-columns:1fr!important;}
          .land-grid-4{grid-template-columns:1fr 1fr!important;}
          .land-grid-2{grid-template-columns:1fr!important;}
          .land-hero-btns{flex-direction:column!important;align-items:stretch!important;}
          .land-hero-title{font-size:38px!important;letter-spacing:-1px!important;}
          .land-pricing-inner{grid-template-columns:1fr!important;gap:24px!important;}
        }
        @media(max-width:480px){
          .land-hero-title{font-size:30px!important;letter-spacing:-0.5px!important;}
          .land-hero-inner{padding:44px 16px 36px!important;}
          .land-grid-4{grid-template-columns:1fr 1fr!important;}
          .land-btn-primary{padding:14px 24px!important;font-size:15px!important;}
          .land-nav{height:58px!important;}
        }
      `}</style>

      {/* NAV */}
      <nav className="land-nav">
        <Logo size={32} light/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {user ? (
            <>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>{user.firstName}</span>
              <button className="land-btn-primary" style={{padding:"10px 24px",fontSize:14}} onClick={onDashboard}>Войти в кабинет →</button>
            </>
          ) : (
            <>
              <button className="land-btn-ghost" style={{padding:"10px 20px",fontSize:14}} onClick={onStart}>Войти</button>
              <button className="land-btn-primary pulse-btn" style={{padding:"10px 24px",fontSize:14}} onClick={onStart}>Начать бесплатно</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#0f172a 100%)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-40%",right:"-20%",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(212,175,55,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div className="land-hero-inner" style={{maxWidth:920,margin:"0 auto",textAlign:"center",padding:"88px 24px 80px",position:"relative",zIndex:1}}>
          <div className="hero-anim-1" style={{display:"flex",alignItems:"center",gap:10,justifyContent:"center",marginBottom:28,flexWrap:"wrap"}}>
            <div style={{display:"flex",flexShrink:0}}>
              {["А","М","Д","К","С","Б"].map((l,i)=>(
                <div key={i} className="land-avatar" style={{marginLeft:i>0?-10:0,zIndex:6-i}}>{l}</div>
              ))}
            </div>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.65)"}}>
              <strong style={{color:"#fff"}}>50+ учеников</strong> уже готовятся к ЕНТ и SAT
            </span>
            <span style={{color:"#d4af37",letterSpacing:"2px",fontSize:13}}>★★★★★</span>
          </div>

          <div className="hero-anim-2" style={{display:"inline-flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:24}}>
            <span className="hero-badge-pop" style={{background:"rgba(212,175,55,0.15)",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:99}}>🎓 МАТЕМАТИКА 5–12 КЛАСС</span>
            <span className="hero-badge-pop" style={{background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.25)",color:"#10B981",fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:99,animationDelay:"0.95s"}}>✨ Диагностика · Теория · Навыки</span>
          </div>

          <h1 className="hero-anim-3 land-hero-title" style={{fontFamily:"'Montserrat',sans-serif",fontSize:62,fontWeight:900,color:"#fff",lineHeight:1.02,marginBottom:24,letterSpacing:"-2.5px"}}>
            Найди пробел.<br/>Закрой навык.<br/><span style={{color:"#d4af37"}}>Сдай экзамен.</span>
          </h1>
          <p className="hero-anim-4" style={{fontSize:18,color:"rgba(255,255,255,0.68)",lineHeight:1.75,maxWidth:580,margin:"0 auto 40px"}}>
            Система находит твои слабые места и строит точечный маршрут. Мини-группы <strong style={{color:"#d4af37"}}>от 4 000 тг/час</strong>. Первая диагностика — бесплатно.
          </p>

          <div className="hero-anim-5 land-hero-btns" style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
            <button className="land-btn-primary pulse-btn" style={{fontSize:17,padding:"17px 44px"}} onClick={onStart}>
              Пройти диагностику бесплатно →
            </button>
            <button className="land-btn-ghost" onClick={onStart}>Записаться в группу</button>
          </div>

          <p className="hero-anim-5" style={{fontSize:12,color:"rgba(255,255,255,0.25)",marginBottom:28,animationDelay:"0.72s"}}>Регистрация 2 минуты · Без карты · Результат сразу после теста</p>

          <div className="hero-anim-5" style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",animationDelay:"0.8s"}}>
            {[...exams,"5–12 класс"].map(e=>(
              <span key={e} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.45)",padding:"6px 16px",borderRadius:99,fontSize:12,fontWeight:600}}>{e}</span>
            ))}
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"32px 24px"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,textAlign:"center"}} className="land-grid-4">
          {[
            {label:"Активных учеников", counter:<AnimCounter to={50} suffix="+"/>},
            {label:"Мини-группа / час",  counter:<AnimCounter to={4000} suffix="₸"/>},
            {label:"1-я диагностика",    counter:<><AnimCounter to={100} suffix="%"/> бесплатно</>},
            {label:"Навыков в системе",   counter:<AnimCounter to={200} suffix="+"/>},
          ].map((s,i)=>(
            <div key={i} data-anim="up" style={{padding:"6px 0",transitionDelay:`${i*0.08}s`}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:30,fontWeight:900,color:"#0f172a",lineHeight:1}}>{s.counter}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:5,fontWeight:500}}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{background:"#0f172a",padding:"80px 24px"}}>
        <div style={{maxWidth:1080,margin:"0 auto"}}>
          <div data-anim="up" style={{textAlign:"center",marginBottom:52}}>
            <span style={{background:"rgba(212,175,55,0.15)",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",fontSize:11,fontWeight:800,padding:"5px 16px",borderRadius:99,display:"inline-block",marginBottom:14,letterSpacing:"0.8px"}}>КАК ЭТО РАБОТАЕТ</span>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontSize:36,fontWeight:900,color:"#fff",lineHeight:1.15,marginBottom:10}}>От регистрации до результата</h2>
            <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,maxWidth:420,margin:"0 auto"}}>4 шага — от первого теста до результата</p>
          </div>
          <div className="land-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:2}}>
            {[
              {num:"01",title:"Регистрация",desc:"Укажи имя, номер и цель — ЕНТ, SAT или другой экзамен. 2 минуты."},
              {num:"02",title:"Диагностика",desc:"Задания по разделам — без стресса. Просто покажи что знаешь сейчас."},
              {num:"03",title:"Отчёт эксперта",desc:"Преподаватель разбирает ответы и рукописи, составляет план работы."},
              {num:"04",title:"Теория → Практика → Следующий навык",desc:"Изучай точечный материал, тренируйся на задачах и закрывай навык за навыком."},
            ].map((s,i)=>(
              <div key={i} data-anim="up" style={{background:i%2===0?"rgba(255,255,255,0.04)":"rgba(212,175,55,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"28px 22px",transitionDelay:`${i*0.1}s`}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:38,fontWeight:900,color:"#d4af37",opacity:0.22,lineHeight:1,marginBottom:10}}>{s.num}</div>
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,color:"#fff",marginBottom:8}}>{s.title}</h3>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.65,margin:0}}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{marginTop:16,background:"rgba(212,175,55,0.05)",border:"1px solid rgba(212,175,55,0.18)",borderRadius:14,padding:"18px 28px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <span style={{fontSize:28}}>🔄</span>
            <div style={{flex:1,minWidth:220}}>
              <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,color:"#fff"}}>Замкнутый цикл: </span>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>после каждого теста система обновляет карту навыков — прогресс виден ученику и родителям.</span>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["🔴 Красная","🟡 Жёлтая","🟢 Зелёная"].map((z,i)=>(
                <span key={i} style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",padding:"4px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:99}}>{z}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section style={{background:"#fff",padding:"80px 24px"}}>
        <div style={{maxWidth:1080,margin:"0 auto"}}>
          <div data-anim="up" style={{textAlign:"center",marginBottom:52}}>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontSize:36,fontWeight:900,color:"#1e293b",lineHeight:1.15,marginBottom:10}}>Это не репетитор. <span style={{color:"#d4af37"}}>Это система.</span></h2>
            <p style={{color:"#64748b",fontSize:15,maxWidth:480,margin:"0 auto"}}>Три принципа, которые делают обучение точечным — без лишних часов и пройденного впустую материала</p>
          </div>

          {/* PILLAR 1 — Диагностика (полная ширина, тёмная) */}
          <div data-anim="up" style={{background:"#0f172a",borderRadius:24,padding:"40px 44px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center"}} className="land-grid-2">
            <div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:99,padding:"5px 14px",marginBottom:20}}>
                <span style={{fontSize:14}}>🔬</span>
                <span style={{fontSize:11,fontWeight:800,color:"#818cf8",letterSpacing:"0.6px"}}>ДИАГНОСТИКА</span>
              </div>
              <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:24,color:"#fff",lineHeight:1.25,marginBottom:16}}>
                Не «плохо знаешь алгебру» —<br/>
                <span style={{color:"#818cf8"}}>а конкретно какой навык западает</span>
              </h3>
              <p style={{fontSize:14,color:"rgba(255,255,255,0.55)",lineHeight:1.8,marginBottom:20}}>
                Диагностика разделена на разделы — проходишь те, что нужны. Система не просто ставит общий балл, а разбирает каждый ответ и определяет что именно не работает: логика, вычисления, понимание определения или перенос формулы.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  "Адаптируется под ответы в реальном времени",
                  "Выявляет корень проблемы, а не симптомы",
                  "Строит карту пробелов по каждому навыку",
                ].map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:13,color:"rgba(255,255,255,0.6)"}}>
                    <span style={{color:"#818cf8",fontWeight:700,flexShrink:0,marginTop:1}}>✓</span>{t}
                  </div>
                ))}
              </div>
            </div>
            {/* Mockup */}
            <div style={{background:"#1e293b",borderRadius:16,padding:"22px 20px",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.3)",letterSpacing:"1px",marginBottom:16}}>КАРТА НАВЫКОВ ПОСЛЕ ДИАГНОСТИКИ</div>
              {[
                {skill:"Квадратные уравнения",pct:42,color:"#EF4444"},
                {skill:"Тригонометрия",pct:68,color:"#F59E0B"},
                {skill:"Логарифмы",pct:91,color:"#10B981"},
                {skill:"Производные",pct:35,color:"#EF4444"},
                {skill:"Геом. прогрессии",pct:74,color:"#F59E0B"},
              ].map((s,i)=>(
                <div key={i} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                    <span style={{color:"rgba(255,255,255,0.65)"}}>{s.skill}</span>
                    <span style={{color:s.color,fontWeight:700}}>{s.pct}%</span>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,0.07)",borderRadius:99}}>
                    <div style={{height:"100%",width:`${s.pct}%`,background:s.color,borderRadius:99,transition:"width 1s"}}/>
                  </div>
                </div>
              ))}
              <div style={{marginTop:14,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#fca5a5",lineHeight:1.5}}>
                💡 Начни с квадратных уравнений — они блокируют продвижение в 4 других навыках
              </div>
            </div>
          </div>

          {/* PILLARS 2+3 — два в ряд */}
          <div className="land-grid-2" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>

            {/* PILLAR 2 — Теория */}
            <div data-anim="up" style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:22,padding:"32px 28px",transitionDelay:"0.1s"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:99,padding:"5px 14px",marginBottom:18}}>
                <span style={{fontSize:14}}>📖</span>
                <span style={{fontSize:11,fontWeight:800,color:"#10B981",letterSpacing:"0.6px"}}>ТЕОРИЯ</span>
              </div>
              <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:20,color:"#1e293b",lineHeight:1.25,marginBottom:12}}>
                Только то, что нужно<br/>именно для этого навыка
              </h3>
              <p style={{fontSize:13,color:"#64748b",lineHeight:1.75,marginBottom:20}}>
                Не огромный учебник целиком — а точечный материал под конкретный пробел. Коротко, структурировано, с разбором типичных ошибок. Читаешь — и сразу к задачам.
              </p>
              {/* Theory card mockup */}
              <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:15}}>📖</span>
                    <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>Дискриминант</span>
                  </div>
                  <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>≈ 3 мин</span>
                </div>
                <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",letterSpacing:"0.6px",marginBottom:6}}>КЛЮЧЕВАЯ ИДЕЯ</div>
                <div style={{background:"#f1f5f9",borderRadius:8,padding:"8px 12px",fontFamily:"monospace",fontSize:13,color:"#1e293b",marginBottom:10,textAlign:"center",fontWeight:600}}>
                  D = b² − 4ac
                </div>
                <div style={{fontSize:11,color:"#475569",lineHeight:1.6,marginBottom:12}}>
                  D &gt; 0 → два корня &nbsp;·&nbsp; D = 0 → один &nbsp;·&nbsp; D &lt; 0 → нет действительных
                </div>
                <div style={{display:"flex",gap:6}}>
                  <div style={{flex:1,background:"#6366F1",borderRadius:7,padding:"6px 0",textAlign:"center",fontSize:10,color:"#fff",fontWeight:700}}>Пример →</div>
                  <div style={{flex:1,background:"#f1f5f9",borderRadius:7,padding:"6px 0",textAlign:"center",fontSize:10,color:"#64748b",fontWeight:700}}>Практика →</div>
                </div>
              </div>
            </div>

            {/* PILLAR 3 — Система навыков */}
            <div data-anim="up" style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:22,padding:"32px 28px",transitionDelay:"0.2s"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:99,padding:"5px 14px",marginBottom:18}}>
                <span style={{fontSize:14}}>🧩</span>
                <span style={{fontSize:11,fontWeight:800,color:"#b45309",letterSpacing:"0.6px"}}>СИСТЕМА НАВЫКОВ</span>
              </div>
              <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:20,color:"#1e293b",lineHeight:1.25,marginBottom:12}}>
                Прогресс не по темам —<br/>по конкретным умениям
              </h3>
              <p style={{fontSize:13,color:"#64748b",lineHeight:1.75,marginBottom:20}}>
                Тема — это слишком широко. «Алгебра пройдена» ничего не говорит о том, что ты умеешь. Мы делим каждую тему на конкретные навыки и отслеживаем прогресс по каждому из них.
              </p>
              {/* Skills comparison mockup */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:"#dc2626",fontWeight:800,marginBottom:4}}>❌ ОБЫЧНЫЙ ПОДХОД</div>
                  <div style={{fontSize:12,color:"#7f1d1d",fontStyle:"italic"}}>"Алгебра — раздел пройден ✓"</div>
                </div>
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:"#10B981",fontWeight:800,marginBottom:8}}>✓ AAPA MATH — точно по навыкам</div>
                  {[
                    {s:"Раскладывать на множители",p:92,c:"#10B981"},
                    {s:"Решать через дискриминант",p:61,c:"#F59E0B"},
                    {s:"Применять теорему Виета",p:40,c:"#EF4444"},
                  ].map((x,i)=>(
                    <div key={i} style={{marginBottom:i<2?7:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                        <span style={{color:"#1e293b"}}>{x.s}</span>
                        <span style={{color:x.c,fontWeight:700}}>{x.p}%</span>
                      </div>
                      <div style={{height:4,background:"#e2e8f0",borderRadius:99}}>
                        <div style={{height:"100%",width:`${x.p}%`,background:x.c,borderRadius:99}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{background:"#f8fafc",padding:"80px 24px",borderTop:"1px solid #e2e8f0"}}>
        <div style={{maxWidth:1080,margin:"0 auto"}}>
          <div data-anim="up" style={{textAlign:"center",marginBottom:44}}>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontSize:36,fontWeight:800,color:"#1e293b",lineHeight:1.2,marginBottom:10}}>Занимайся в группе — <span style={{color:"#d4af37"}}>дешевле и эффективнее</span></h2>
            <p style={{color:"#64748b",fontSize:15,maxWidth:480,margin:"0 auto"}}>Мини-группы из 3–4 человек — здоровая конкуренция разгоняет прогресс быстрее, чем занятия в одиночку.</p>
          </div>
          <div style={{background:"linear-gradient(135deg,rgba(212,175,55,0.09) 0%,rgba(212,175,55,0.02) 100%)",border:"2px solid #d4af37",borderRadius:24,padding:"40px 40px",marginBottom:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,background:"#d4af37",color:"#0f172a",fontSize:10,fontWeight:800,padding:"7px 22px",borderRadius:"0 0 12px 0",letterSpacing:"0.8px"}}>⭐ РЕКОМЕНДУЕМ</div>
            <div className="land-pricing-inner" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:44,alignItems:"center"}}>
              <div>
                <div style={{fontSize:40,marginBottom:12}}>👥</div>
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:26,color:"#1e293b",marginBottom:6}}>Мини-группа</h3>
                <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6}}>
                  <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:48,color:"#d4af37"}}>4 000</span>
                  <span style={{fontSize:16,color:"#64748b",fontWeight:600}}>тг / час</span>
                </div>
                <div style={{fontSize:12,color:"#d4af37",fontWeight:700,background:"rgba(212,175,55,0.1)",display:"inline-block",padding:"4px 14px",borderRadius:99,marginBottom:18,border:"1px solid rgba(212,175,55,0.3)"}}>3–4 человека · экономия до 60%</div>
                <p style={{color:"#475569",fontSize:14,lineHeight:1.7,marginBottom:24}}>Каждый получает персональный план и полный доступ к платформе — диагностика, теория, практика по навыкам.</p>
                <button className="land-btn-primary pulse-btn" style={{fontSize:15,padding:"14px 32px"}} onClick={onStart}>Записаться в группу →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {icon:"💰",text:"В 2.5× дешевле индивидуального при том же качестве"},
                  {icon:"🔥",text:"Конкуренция в группе мотивирует лучше любой самодисциплины"},
                  {icon:"📊",text:"Персональная карта навыков и план работы — каждому участнику"},
                  {icon:"👫",text:"Можно прийти с другом, одноклассником или братом/сестрой"},
                  {icon:"📅",text:"Фиксированное расписание — легче выработать привычку"},
                ].map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,background:"#fff",borderRadius:10,padding:"9px 12px",border:"1px solid #e2e8f0"}}>
                    <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                    <span style={{fontSize:13,color:"#475569",lineHeight:1.5}}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"20px 28px",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
            <span style={{fontSize:28}}>👤</span>
            <div style={{flex:1,minWidth:200}}>
              <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,color:"#1e293b"}}>Индивидуально — </span>
              <span style={{color:"#64748b",fontSize:14}}>1 на 1 с преподавателем для форсированной подготовки.</span>
            </div>
            <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:900,fontSize:24,color:"#1e293b",flexShrink:0}}>10 000 <span style={{fontSize:13,fontWeight:600,color:"#64748b"}}>тг/час</span></span>
            <button onClick={onStart} style={{background:"transparent",border:"1px solid #e2e8f0",color:"#64748b",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>Узнать подробнее →</button>
          </div>
          <div style={{textAlign:"center",marginTop:18,fontSize:13,color:"#94a3b8"}}>
            💡 Первая диагностика <strong style={{color:"#1e293b"}}>бесплатна</strong> — оцени качество до записи в группу
          </div>
        </div>
      </section>

      {/* TESTIMONIALS + FINAL CTA */}
      <section style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",padding:"80px 24px"}}>
        <div style={{maxWidth:1080,margin:"0 auto"}}>
          {/* 2 testimonials */}
          <div data-anim="up" style={{textAlign:"center",marginBottom:40}}>
            <span style={{background:"rgba(212,175,55,0.15)",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",fontSize:11,fontWeight:800,padding:"5px 16px",borderRadius:99,display:"inline-block",marginBottom:14,letterSpacing:"0.8px"}}>ОТЗЫВЫ УЧЕНИКОВ</span>
            <h2 style={{fontFamily:"'Montserrat',sans-serif",fontSize:32,fontWeight:900,color:"#fff",lineHeight:1.15}}>Что говорят те, <span style={{color:"#d4af37"}}>кто уже занимается</span></h2>
          </div>
          <div className="land-grid-2" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:64}}>
            {[
              {name:"Амина К.",grade:"11 класс, ЕНТ",text:"После первой диагностики поняла где именно проседаю. Раньше учила всё подряд — теперь знаю точно на что тратить время. За месяц подтянула 3 темы из красной в зелёную.",score:"ЕНТ +18 баллов"},
              {name:"Данияр М.",grade:"10 класс",text:"Раньше казалось что всю алгебру надо переучивать заново. Диагностика показала конкретно три навыка которые западали — закрыл их за две недели и сразу почувствовал разницу.",score:"Закрыл 3 пробела"},
            ].map((t,i)=>(
              <div key={i} data-anim="up" className="land-tcard" style={{transitionDelay:`${i*0.12}s`}}>
                <div style={{color:"#d4af37",fontSize:16,letterSpacing:"3px",marginBottom:14}}>★★★★★</div>
                <p style={{fontSize:14,color:"rgba(255,255,255,0.78)",lineHeight:1.8,marginBottom:18,fontStyle:"italic"}}>«{t.text}»</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{t.name}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:2}}>{t.grade}</div>
                  </div>
                  <span style={{background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",color:"#10B981",fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:99}}>{t.score}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{textAlign:"center",position:"relative"}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:500,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(212,175,55,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
            <h2 data-anim="up" style={{fontFamily:"'Montserrat',sans-serif",fontSize:42,fontWeight:900,color:"#fff",marginBottom:14,lineHeight:1.1,position:"relative"}}>
              Начни сегодня.<br/><span style={{color:"#d4af37"}}>Первый шаг — бесплатно.</span>
            </h2>
            <p data-anim="up" style={{color:"rgba(255,255,255,0.55)",fontSize:16,marginBottom:36,lineHeight:1.7,transitionDelay:"0.12s",position:"relative"}}>Пройди диагностику — узнай точно какие навыки западают и с чего начать. Бесплатно, без карты.</p>
            <button data-anim="scale" className="land-btn-primary pulse-btn" style={{fontSize:17,padding:"18px 52px",transitionDelay:"0.22s",position:"relative"}} onClick={onStart}>
              Пройти диагностику бесплатно →
            </button>
            <p style={{marginTop:16,fontSize:12,color:"rgba(255,255,255,0.22)",position:"relative"}}>Регистрация 2 минуты · Без банковской карты</p>
            <div style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:8,background:"rgba(37,211,102,0.08)",border:"1px solid rgba(37,211,102,0.18)",borderRadius:10,padding:"8px 18px",position:"relative"}}>
              <span>💬</span>
              <span style={{fontSize:13,color:"rgba(255,255,255,0.55)"}}>Преподаватель свяжется с вами в <strong style={{color:"#25D366"}}>WhatsApp</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:"#0f172a",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"24px 40px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
        <Logo size={28} light/>
        <p style={{color:"rgba(255,255,255,0.22)",fontSize:12,margin:0}}>© 2026 AAPA — Ad Astra Per Aspera</p>
        <button onClick={user?onDashboard:onStart} style={{background:"transparent",border:"none",color:"#d4af37",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{user?"Войти в кабинет →":"Войти →"}</button>
      </footer>
    </div>
  );
}

export default LandingScreen;
