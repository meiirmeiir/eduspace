import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/ui/Logo.jsx";

// Живые 3D/игровые компоненты платформы — показываем на ученическом лендинге
// то, что ученик реально увидит внутри (планеты навыков, герой, босс, корабль).
import SkillPlanet3D, { fallbackGradient } from "../components/SkillPlanet3D.jsx";
import Character3D from "../components/Character3D.jsx";
import ShipProgress from "../components/ShipProgress.jsx";
import Boss3D from "../components/Boss3D.jsx";
import BattleScene3D from "../components/BattleScene3D.jsx";
import { EQUIPMENT_SETS, getShopItem } from "../lib/shopItems.js";

// Видео-заготовки (Vite импортирует mp4 → URL). Лежат в assets/marketing/videos/.
import diagnosticVid from "../../assets/marketing/videos/diagnostic_v2.mp4";
import skillMapVid from "../../assets/marketing/videos/skill-map_v2.mp4";
import leaderboardVid from "../../assets/marketing/videos/leaderboard_v2.mp4";
import progressVid from "../../assets/marketing/videos/progress_v2.mp4";

// Скриншоты платформы (assets/marketing/screens/): устройства + экран задачи.
import deviceDesktopImg from "../../assets/marketing/screens/device-desktop.jpeg";
import deviceTabletImg from "../../assets/marketing/screens/device-tablet.jpeg";
import devicePhoneImg from "../../assets/marketing/screens/device-phone.jpeg";
import taskScreenImg from "../../assets/marketing/screens/task-screen.jpeg";
import bossBattleImg from "../../assets/marketing/screens/boss-battle-3d.jpeg";

/**
 * AboutLanding — тёмный лендинг AAPA в духе AngelList India + Opus Pro:
 * огромная типографика, видео-демо как главный элемент hero, чистая сетка,
 * много воздуха, мягкие scroll-анимации. Переключатель «Я родитель / Я ученик»
 * меняет контент; выбор роли запоминается в cookie.
 * Маршруты: '/', '/about', '/landing/parents', '/landing/students'.
 *
 * Props:
 *  - initialRole: 'parent' | 'student' | null — стартовая роль (из URL)
 *  - user: профиль (если залогинен — показываем «Войти в кабинет»)
 *  - onStart: CTA для гостя → открыть регистрацию/вход
 *  - onDashboard: для залогиненного → в кабинет
 */

// ── cookie-память роли (180 дней) ─────────────────────────────────────────────
const ROLE_COOKIE = "aapa_role";
function setRoleCookie(role) {
  try { document.cookie = `${ROLE_COOKIE}=${role};path=/;max-age=${60 * 60 * 24 * 180};samesite=lax`; } catch {}
}
function getRoleCookie() {
  try { const m = document.cookie.match(/aapa_role=(parent|student)/); return m ? m[1] : null; } catch { return null; }
}

const BG = "#0a0a14";
const GOLD = "#d4af37";
const PURPLE = "#a78bfa";
const MAXW = 1200;

// ── переиспользуемые анимации framer-motion ───────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] } }),
};
const Reveal = ({ children, i = 0, style, className }) => (
  <motion.div variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-70px" }} style={style} className={className}>
    {children}
  </motion.div>
);

// ── мобильный детект: на телефонах вместо WebGL-планет — статичные CSS-круги
//    (несколько 3D-канвасов на одной странице тормозят слабые GPU) ─────────────
function useIsMobile(bp = 880) {
  const [mobile, setMobile] = useState(() => {
    try { return window.matchMedia(`(max-width:${bp}px)`).matches; } catch { return false; }
  });
  useEffect(() => {
    try {
      const mq = window.matchMedia(`(max-width:${bp}px)`);
      const fn = (e) => setMobile(e.matches);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    } catch { return undefined; }
  }, [bp]);
  return mobile;
}

// ── ленивый маунт тяжёлого контента (3D-сцены) при приближении к viewport ─────
function LazyMount({ height, children, rootMargin = "260px" }) {
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

// ── планета навыка: 3D на десктопе (лениво), статичный градиент на мобильном ──
//    allowMobile=true — оставить 3D и на мобайле (для одиночных hero-инстансов,
//    где один канвас безопасен). По умолчанию на мобайле — CSS-градиент, чтобы
//    несколько 3D-канвасов не тормозили слабые GPU. LazyMount сохраняется в
//    обоих случаях: канвас монтируется только у вьюпорта и чистит контекст.
function PlanetView({ fromLife, toLife, size = 150, allowMobile = false }) {
  const mobile = useIsMobile();
  if (mobile && !allowMobile) {
    const s = Math.min(size, 240);
    return (
      <div aria-hidden="true" style={{ width: s, height: s, borderRadius: "50%", margin: "0 auto",
        background: fallbackGradient(toLife), boxShadow: toLife >= 0 ? "0 0 28px rgba(120,200,255,0.3)" : "none" }} />
    );
  }
  return <LazyMount height={size}><SkillPlanet3D fromLife={fromLife} toLife={toLife} size={size} /></LazyMount>;
}

// ── переключатель ролей ────────────────────────────────────────────────────────
function RoleToggle({ role, onChange }) {
  return (
    <div className="al-role-toggle" style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 99, padding: 4, position: "relative" }}>
      {[{ k: "parent", t: "Я родитель", c: GOLD }, { k: "student", t: "Я ученик", c: PURPLE }].map((o) => {
        const active = role === o.k;
        return (
          <button key={o.k} onClick={() => onChange(o.k)}
            style={{ position: "relative", zIndex: 1, border: "none", cursor: "pointer", background: "transparent",
              color: active ? "#0a0e1a" : "rgba(255,255,255,0.62)", fontWeight: 700, fontSize: 13, padding: "8px 18px",
              borderRadius: 99, fontFamily: "'Inter',sans-serif", transition: "color 0.25s", whiteSpace: "nowrap" }}>
            {active && (
              <motion.span layoutId="role-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }}
                style={{ position: "absolute", inset: 0, background: o.k === "student" ? `linear-gradient(135deg,${PURPLE},#7c3aed)` : `linear-gradient(135deg,${GOLD},#f59e0b)`, borderRadius: 99, zIndex: -1 }} />
            )}
            {o.t}
          </button>
        );
      })}
    </div>
  );
}

// ── секция-обёртка с большим воздухом ──────────────────────────────────────────
const Section = ({ children, bg = "transparent", style, narrow }) => (
  <section style={{ padding: "clamp(72px,11vw,140px) 24px", background: bg, position: "relative", ...style }}>
    <div style={{ maxWidth: narrow ? 860 : MAXW, margin: "0 auto" }}>{children}</div>
  </section>
);
const Eyebrow = ({ children, color = GOLD }) => (
  <span style={{ background: `${color}1f`, border: `1px solid ${color}45`, color, fontSize: 12, fontWeight: 800,
    padding: "6px 16px", borderRadius: 99, display: "inline-block", marginBottom: 20, letterSpacing: "1px", textTransform: "uppercase" }}>{children}</span>
);
const H2 = ({ children, style }) => (
  <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(30px,5vw,52px)", fontWeight: 800, color: "#fff",
    lineHeight: 1.1, letterSpacing: "-1.2px", margin: "0 0 16px", ...style }}>{children}</h2>
);
const Lead = ({ children, style }) => (
  <p style={{ fontSize: "clamp(15px,1.6vw,19px)", color: "rgba(255,255,255,0.62)", lineHeight: 1.7, margin: 0, ...style }}>{children}</p>
);

// ── якорь доверия (для шапки) ──────────────────────────────────────────────────
function TrustAnchor() {
  const items = [["40 000", "задач"], ["307", "навыков"], ["5–11", "класс"]];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      {items.map(([n, l], i) => (
        <React.Fragment key={l}>
          {i > 0 && <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>}
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
            <strong style={{ color: GOLD, fontWeight: 800 }}>{n}</strong> {l}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── секция «В ЦИФРАХ» (огромные числа в ряд, как AngelList) ─────────────────────
function StatsBand({ accent = GOLD }) {
  const stats = [["40 000", "задач по школьной программе"], ["307", "навыков с прогрессом"], ["7", "классов · с 5 по 11"], ["2000 ₸", "в месяц · цена раннего доступа"]];
  return (
    <Section bg="rgba(255,255,255,0.018)">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }} className="al-grid-4">
        {stats.map(([n, l], i) => (
          <Reveal key={l} i={i}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(44px,6vw,80px)", fontWeight: 800, color: accent,
                lineHeight: 1, letterSpacing: "-2px", marginBottom: 10 }}>{n}</div>
              <div style={{ fontSize: 14.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{l}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ── секция «КАК ЭТО РАБОТАЕТ» (3 шага с большими номерами) ──────────────────────
function HowItWorks({ accent = GOLD }) {
  const steps = [
    ["01", "Диагностика", "Длительность подстраивается: диагностика адаптивная и даёт больше задач там, где нужно точнее оценить уровень и найти пробелы.", "от 15 минут"],
    ["02", "Индивидуальный план", "Маршрут из навыков под конкретные слабые места, а не общий учебник для всех.", "персонально"],
    ["03", "Прогресс по неделям", "Решает, закрывает навыки, поднимается по карте. Прогресс виден каждую неделю.", "каждую неделю"],
  ];
  return (
    <Section>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,72px)" }}>
          <Eyebrow color={accent}>Как это работает</Eyebrow>
          <H2>Три шага — от первого входа до результата</H2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="al-grid-3">
        {steps.map(([n, t, s, tag], i) => (
          <Reveal key={n} i={i}>
            <div className="al-card" style={{ height: "100%", padding: "34px 30px" }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(48px,7vw,84px)", fontWeight: 800,
                color: `${accent}33`, lineHeight: 0.9, letterSpacing: "-3px", marginBottom: 18 }}>{n}</div>
              <div style={{ display: "inline-block", background: `${accent}1f`, color: accent, fontSize: 11, fontWeight: 800,
                padding: "4px 12px", borderRadius: 99, marginBottom: 14, letterSpacing: "0.5px" }}>{tag}</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 10, letterSpacing: "-0.4px" }}>{t}</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>{s}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ── слайды карусели «Что внутри / Геймификация» (общие для обеих ролей) ─────────
const CAROUSEL = [
  { video: diagnosticVid, t: "Умная диагностика", s: "Каждый ученик решает разные вопросы — адаптивная диагностика точно находит слабые места." },
  { video: progressVid, t: "Прогресс по навыкам", s: "Каждый из 307 навыков отслеживается отдельно — видно, что освоено, а что в процессе." },
  { video: skillMapVid, t: "Карта обучения", s: "Учебный материал по школьной программе, а не хаотическая выдача задач." },
  { video: leaderboardVid, t: "Мотивация без принуждения", s: "Лиги и рейтинги поддерживают мотивацию — ребёнок сам хочет заниматься." },
];

// ── горизонтальная карусель видео-демо ─────────────────────────────────────────
// Центральное видео крупно (телефон 9:16), соседи ghosted по бокам. Играет только
// центральное (остальные на паузе) — решает «неровно играют одновременно».
// Автопрокрутка 6с с паузой на hover, клик по соседу/точке, стрелки, свайп.
function VideoCarousel({ accent = GOLD }) {
  const slides = CAROUSEL;
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [W, setW] = useState(860);
  const stageRef = useRef(null);
  const videoRefs = useRef([]);

  // измеряем ширину сцены → считаем размеры в px (без скачков лейаута)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((entries) => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mobile = W < 768;
  const centerH = mobile ? Math.min(Math.round((W * 0.78 * 16) / 9), 500) : 520;
  const centerW = Math.round((centerH * 9) / 16);
  const offset = mobile ? Math.round(W * 0.9) : Math.round(centerW * 0.92 + 30);
  const neighborOpacity = mobile ? 0.22 : 0.4;

  const go = useCallback((dir) => setIndex((i) => (i + dir + n) % n), [n]);
  const goTo = useCallback((i) => setIndex(((i % n) + n) % n), [n]);

  // автопрокрутка (пауза на hover/драг)
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % n), 6000);
    return () => clearTimeout(id);
  }, [index, paused, n]);

  // только центральное видео играет, при переключении — с начала
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) { try { v.currentTime = 0; const p = v.play(); if (p) p.catch(() => {}); } catch {} }
      else { try { v.pause(); } catch {} }
    });
  }, [index]);

  const cur = slides[index];

  return (
    <div>
      {/* сцена со стрелками */}
      <div style={{ position: "relative" }}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div ref={stageRef} style={{ position: "relative", height: centerH, overflow: "hidden" }}>
          {slides.map((s, i) => {
            const rel = (i - index + n) % n; // 0 центр, 1 справа, n-1 слева, иначе скрыт
            const isCenter = rel === 0;
            const isRight = rel === 1;
            const isLeft = rel === n - 1;
            const visible = isCenter || isRight || isLeft;
            const x = isCenter ? 0 : isRight ? offset : isLeft ? -offset : 0;
            const scale = isCenter ? 1 : 0.85;
            const opacity = isCenter ? 1 : visible ? neighborOpacity : 0;
            const z = isCenter ? 3 : visible ? 2 : 0;
            return (
              <motion.div key={i}
                animate={{ x, scale, opacity }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: "absolute", top: 0, left: "50%", width: centerW, height: centerH,
                  marginLeft: -centerW / 2, zIndex: z, pointerEvents: visible ? "auto" : "none" }}>
                <motion.div
                  drag={isCenter ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }} dragElastic={0.16}
                  onDragStart={() => setPaused(true)}
                  onDragEnd={(e, info) => { setPaused(false); if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1); }}
                  onClick={() => { if (isRight) go(1); else if (isLeft) go(-1); }}
                  style={{ width: "100%", height: "100%", borderRadius: 28, overflow: "hidden",
                    border: `1px solid ${accent}${isCenter ? "55" : "33"}`, background: "#0a0e1a",
                    cursor: isCenter ? "grab" : "pointer",
                    boxShadow: isCenter ? `0 30px 80px rgba(0,0,0,0.55), 0 0 60px ${accent}22` : "0 16px 40px rgba(0,0,0,0.45)" }}>
                  <video ref={(el) => (videoRefs.current[i] = el)} src={s.video} muted loop playsInline preload="metadata"
                    style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                  {isCenter && (
                    <div style={{ position: "absolute", left: 14, bottom: 14, background: "rgba(7,11,22,0.8)", backdropFilter: "blur(8px)",
                      border: `1px solid ${accent}55`, color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 99 }}>
                      {index + 1} / {n}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
        {/* стрелки */}
        <button className="al-car-arrow" onClick={() => go(-1)} aria-label="Назад" style={{ left: 0 }}>‹</button>
        <button className="al-car-arrow" onClick={() => go(1)} aria-label="Вперёд" style={{ right: 0 }}>›</button>
      </div>

      {/* точки-индикаторы */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 28 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Слайд ${i + 1}`}
            style={{ width: i === index ? 30 : 10, height: 10, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
              background: i === index ? accent : "rgba(255,255,255,0.22)", transition: "width 0.35s ease, background 0.35s ease" }} />
        ))}
      </div>

      {/* описание текущего слайда (fade при смене) */}
      <div style={{ textAlign: "center", marginTop: 26, minHeight: 116, position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div key={index}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ fontWeight: 800, fontSize: "clamp(22px,3vw,30px)", color: "#fff", marginBottom: 12, letterSpacing: "-0.6px" }}>{cur.t}</div>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, maxWidth: 540, margin: "0 auto" }}>{cur.s}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── отзывы (заглушки) ──────────────────────────────────────────────────────────
function Testimonials({ items, accent = GOLD }) {
  return (
    <Section>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow color={accent}>Отзывы</Eyebrow>
          <H2>Что говорят о платформе</H2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="al-grid-3">
        {items.map((it, i) => (
          <Reveal key={i} i={i}>
            <div className="al-card" style={{ height: "100%", padding: "32px 30px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, color: `${accent}55`, lineHeight: 0.5, marginBottom: 16, fontFamily: "Georgia,serif" }}>“</div>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, margin: "0 0 24px", flex: 1 }}>{it.quote}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg,${accent},#7c3aed)`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#0a0e1a", flexShrink: 0 }}>{it.initial}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{it.role}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ── секция цены (огромная цифра + галочки) ──────────────────────────────────────
function PriceSection({ onCta, accent = GOLD, perks, ctaText }) {
  return (
    <Section>
      <Reveal>
        <div className="al-card" style={{ maxWidth: 720, margin: "0 auto", border: `2px solid ${accent}`,
          background: `linear-gradient(160deg,${accent}14,transparent)`, padding: "clamp(36px,6vw,60px) clamp(28px,5vw,56px)", textAlign: "center" }}>
          <Eyebrow color={accent}>Цена раннего доступа</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, margin: "10px 0 8px" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(56px,11vw,104px)", fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: "-3px" }}>2000</span>
            <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>₸ / мес</span>
          </div>
          <Lead style={{ maxWidth: 440, margin: "0 auto 32px" }}>Для первых учеников — закрепляется на год. Чем больше учеников на платформе, тем выше цена для новых; ранние сохраняют лоялти-условия.</Lead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px", maxWidth: 520, margin: "0 auto 34px", textAlign: "left" }} className="al-perks">
            {perks.map((p) => (
              <div key={p} style={{ display: "flex", gap: 10, fontSize: 15, color: "rgba(255,255,255,0.78)", alignItems: "flex-start" }}>
                <span style={{ color: accent, fontWeight: 800, flexShrink: 0 }}>✓</span>{p}
              </div>
            ))}
          </div>
          <button className="al-btn-primary" onClick={onCta}
            style={{ width: "100%", maxWidth: 420, fontSize: 17, padding: "18px 32px", background: accent === PURPLE ? `linear-gradient(135deg,${PURPLE},#7c3aed)` : `linear-gradient(135deg,${GOLD},#f59e0b)`, color: accent === PURPLE ? "#fff" : "#0a0e1a" }}>{ctaText}</button>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 14 }}>Первая диагностика бесплатно · Без банковской карты</p>
        </div>
      </Reveal>
    </Section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  СЕКЦИИ РОДИТЕЛЬСКОГО ЛЕНДИНГА (реальный продукт вместо абстракций)
// ══════════════════════════════════════════════════════════════════════════════
const BLUE = "#60a5fa";   // отчёты/аналитика
const GREEN = "#34d399";  // безопасность

// ── Мокап отчёта в кабинете родителя (hero-ноутбук, секция отчёта, слайд) ──
function ParentReportCard({ compact = false }) {
  const f = (n) => compact ? n * 0.78 : n; // компактный масштаб для маленьких экранов
  const topics = [["Дроби", 78], ["Уравнения", 64], ["Геометрия", 41]];
  return (
    <div style={{ height: "100%", background: "linear-gradient(170deg,#0e1530,#0a0e1f)", padding: f(22), fontFamily: "'Inter',sans-serif", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: f(14) }}>
        <span style={{ fontSize: f(13), fontWeight: 800, color: "#fff" }}>📊 Отчёт для родителя</span>
        <span style={{ fontSize: f(10.5), fontWeight: 700, color: BLUE, background: "rgba(96,165,250,0.14)", border: "1px solid rgba(96,165,250,0.4)", padding: `${f(3)}px ${f(9)}px`, borderRadius: 99 }}>неделя 23</span>
      </div>
      <div style={{ fontSize: f(11.5), color: "rgba(255,255,255,0.55)", marginBottom: f(12) }}>Аружан · 6 класс</div>
      <div style={{ display: "flex", gap: f(10), marginBottom: f(14) }}>
        {[["57%", "освоено программы"], ["12", "навыков освоено"], ["320", "очков за неделю"]].map(([n, l], i) => (
          <div key={l} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: f(10), padding: `${f(8)}px ${f(10)}px` }}>
            <div style={{ fontSize: f(17), fontWeight: 800, color: i === 2 ? GREEN : "#fff", lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: f(9.5), color: "rgba(255,255,255,0.45)", marginTop: f(4) }}>{l}</div>
          </div>
        ))}
      </div>
      {topics.map(([t, p]) => (
        <div key={t} style={{ marginBottom: f(9) }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: f(10.5), fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: f(4) }}>
            <span>{t}</span><span style={{ color: BLUE }}>{p}%</span>
          </div>
          <div style={{ height: f(7), borderRadius: 99, background: "rgba(255,255,255,0.07)" }}>
            <div style={{ height: "100%", width: `${p}%`, borderRadius: 99, background: `linear-gradient(90deg,${BLUE},#3b82f6)` }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: f(12), fontSize: f(10.5), color: "rgba(255,255,255,0.55)" }}>
        <span style={{ fontWeight: 700, color: "#f87171" }}>Слабые места:</span> деление дробей · площадь треугольника
      </div>
    </div>
  );
}

// ── Hero-визуал родителя: ноутбук с отчётом + телефон ребёнка + связка ────────
function ParentHeroVisual() {
  return (
    <Reveal i={1}>
      <div style={{ position: "relative", maxWidth: 560, margin: "0 auto", paddingBottom: 44, paddingRight: 24 }}>
        <DeviceFrame kind="laptop" label="Кабинет родителя"><ParentReportCard compact /></DeviceFrame>
        <div style={{ position: "absolute", right: -6, bottom: 0, width: "25%", zIndex: 2, filter: "drop-shadow(0 18px 36px rgba(0,0,0,0.6))" }}>
          <DeviceFrame kind="phone" img={devicePhoneImg} label="Кабинет ребёнка" />
        </div>
        <div className="parent-hero-capsule" style={{ position: "absolute", left: 0, bottom: 2, background: "rgba(7,11,22,0.85)", backdropFilter: "blur(8px)",
          border: `1px solid ${GOLD}55`, borderRadius: 99, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
          👀 Вы видите прогресс <span style={{ color: GOLD, margin: "0 4px" }}>→</span> 🎮 ребёнок учится в игре
        </div>
      </div>
    </Reveal>
  );
}

// ── «Что увидите вы»: ноутбук с отчётом + объяснение ──────────────────────────
function ParentReportSection() {
  const points = [
    ["📊", "Открываете в кабинете на сайте в любой момент"],
    ["📈", "Видно, где сильные места и где нужно помочь"],
    ["🧭", "Конкретика: какие темы решал, что западает"],
    ["🔔", "Telegram-уведомления — скоро"],
  ];
  return (
    <Section bg="rgba(255,255,255,0.018)">
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "clamp(28px,4vw,56px)", alignItems: "center" }} className="al-grid-2">
        <Reveal>
          <DeviceFrame kind="laptop" label="Кабинет родителя"><ParentReportCard /></DeviceFrame>
        </Reveal>
        <Reveal i={1}>
          <Eyebrow color={BLUE}>Что увидите вы</Eyebrow>
          <H2>Понятный отчёт без жаргона</H2>
          <Lead style={{ marginBottom: 24 }}>Не «образовательная аналитика», а простой ответ на вопрос «как дела у моего ребёнка по математике».</Lead>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {points.map(([ic, t]) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 15.5, color: "rgba(255,255,255,0.78)" }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{ic}</span>{t}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── «Спокойно даёте планшет»: большие карточки с реальным контентом ───────────
function ParentSafetySection() {
  return (
    <Section>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow color={GREEN}>Безопасно для ребёнка</Eyebrow>
          <H2>Спокойно даёте планшет</H2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="al-grid-3">
        {/* Без AI-чатов: реальный скриншот задачи */}
        <Reveal>
          <div className="al-card" style={{ height: "100%", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative", aspectRatio: "16 / 11", overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <img src={taskScreenImg} alt="Экран задачи" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }} />
              <span style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(7,11,22,0.85)", border: `1px solid ${GREEN}55`,
                color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "5px 12px", borderRadius: 99 }}>Только структурированные задачи</span>
            </div>
            <div style={{ padding: "24px 26px 28px" }}>
              <div style={{ fontWeight: 800, fontSize: 21, color: "#fff", marginBottom: 8 }}>🚫🤖 Без AI-чатов</div>
              <div style={{ fontSize: 14.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>Никаких генеративных собеседников. Задача → варианты → объяснение решения. Всё.</div>
            </div>
          </div>
        </Reveal>
        {/* Без рекламы: сравнение с «обычным приложением» */}
        <Reveal i={1}>
          <div className="al-card" style={{ height: "100%", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ aspectRatio: "16 / 11", display: "flex", gap: 10, padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {/* «обычное приложение» — баннеры и попапы */}
              <div style={{ flex: 1, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(248,113,113,0.35)", padding: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#f87171", textAlign: "center" }}>обычное приложение</div>
                <div style={{ flex: 1, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ height: 22, borderRadius: 6, background: "rgba(248,113,113,0.18)", border: "1px dashed rgba(248,113,113,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 800, color: "#f87171", letterSpacing: 1 }}>РЕКЛАМА</div>
                <div style={{ height: 22, borderRadius: 6, background: "rgba(248,113,113,0.18)", border: "1px dashed rgba(248,113,113,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 800, color: "#f87171", letterSpacing: 1 }}>КУПИ МОНЕТЫ</div>
              </div>
              {/* наш экран — чист */}
              <div style={{ flex: 1, borderRadius: 10, background: "rgba(52,211,153,0.06)", border: `1px solid ${GREEN}55`, padding: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: GREEN, textAlign: "center" }}>AAPA</div>
                <div style={{ flex: 1, borderRadius: 6, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: 0.5 }}>12 ÷ 4 = ?</div>
                <div style={{ height: 22, borderRadius: 6, background: "rgba(52,211,153,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: GREEN }}>только математика</div>
              </div>
            </div>
            <div style={{ padding: "24px 26px 28px" }}>
              <div style={{ fontWeight: 800, fontSize: 21, color: "#fff", marginBottom: 8 }}>📵 Без рекламы</div>
              <div style={{ fontSize: 14.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>Ни баннеров, ни внешних ссылок, ни покупок за деньги внутри. Кристаллы зарабатываются только решением задач.</div>
            </div>
          </div>
        </Reveal>
        {/* Без незнакомцев: замкнутая среда */}
        <Reveal i={2}>
          <div className="al-card" style={{ height: "100%", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ aspectRatio: "16 / 11", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(ellipse at 50% 40%, rgba(52,211,153,0.1), transparent 70%)" }}>
              <div style={{ width: 74, height: 74, borderRadius: "50%", background: "rgba(52,211,153,0.12)", border: `2px solid ${GREEN}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🔒</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Замкнутая среда</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["🧒 ученики", "🏫 учителя"].map((t) => (
                  <span key={t} style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "4px 10px", borderRadius: 99 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ padding: "24px 26px 28px" }}>
              <div style={{ fontWeight: 800, fontSize: 21, color: "#fff", marginBottom: 8 }}>🛡️ Без незнакомцев</div>
              <div style={{ fontSize: 14.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>Никакого открытого общения с посторонними. В рейтинге — только сверстники, без переписки.</div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── «Что увидит ребёнок»: игровая сторона глазами родителя ────────────────────
function ParentChildSideSection() {
  const LB_ROWS = [["🥇", "Арман", "1 340"], ["🥈", "Аружан", "1 180"], ["🥉", "Дана", "950"]];
  const caption = { fontWeight: 800, fontSize: 16, color: "#fff", marginTop: 14 };
  const sub = { fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, marginTop: 5 };
  const visual = { height: 190, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  return (
    <Section bg="rgba(255,255,255,0.018)">
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow>Что увидит ребёнок</Eyebrow>
          <H2>Игровая оболочка вокруг серьёзного содержания</H2>
          <Lead style={{ maxWidth: 620, margin: "0 auto" }}>Зачем это родителю: ребёнок сам хочет заходить — вы не воюете за домашку.</Lead>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }} className="al-grid-4">
        <Reveal>
          <div className="al-card" style={{ height: "100%", textAlign: "center", padding: "22px 16px 24px" }}>
            <div style={visual}><PlanetView fromLife={0.4} toLife={1} size={160} allowMobile /></div>
            <div style={caption}>Планеты навыков</div>
            <div style={sub}>Каждая тема — мир, который расцветает по мере освоения</div>
          </div>
        </Reveal>
        <Reveal i={1}>
          <div className="al-card" style={{ height: "100%", textAlign: "center", padding: "22px 16px 24px" }}>
            <div style={visual}>
              <LazyMount height={190}><Character3D gender="male" equipped={setToEquipped("astronaut-m")} height={190} autoSpin={0.35} lockVerticalDrag /></LazyMount>
            </div>
            <div style={caption}>Свой герой</div>
            <div style={sub}>Экипировка покупается за кристаллы — награду за решённые задачи</div>
          </div>
        </Reveal>
        <Reveal i={2}>
          <div className="al-card" style={{ height: "100%", textAlign: "center", padding: "22px 16px 24px" }}>
            <div style={{ ...visual, flexDirection: "column", gap: 8 }}>
              <div style={{ width: "85%" }}>
                <div style={{ height: 8, borderRadius: 99, background: "rgba(10,15,35,0.75)", border: "1px solid rgba(248,113,113,0.4)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "58%", background: "linear-gradient(90deg,#dc2626,#f87171)", borderRadius: 99 }} />
                </div>
              </div>
              {/* реальный 3D-босс из ежедневных задач (как в продукте) */}
              <div style={{ width: "100%" }}>
                <LazyMount height={150}><Boss3D type="dragon" hpPct={58} shake={false} height={150} /></LazyMount>
              </div>
            </div>
            <div style={caption}>Битвы с боссами</div>
            <div style={sub}>Битвы с боссом в ежедневных задачах — драматичная мотивация решать правильно</div>
          </div>
        </Reveal>
        <Reveal i={3}>
          <div className="al-card" style={{ height: "100%", textAlign: "center", padding: "22px 16px 24px" }}>
            <div style={{ ...visual, flexDirection: "column", justifyContent: "center", gap: 8 }}>
              {LB_ROWS.map(([m, n, p], i) => (
                <div key={n} style={{ width: "92%", display: "flex", alignItems: "center", gap: 10, background: i === 0 ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${i === 0 ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "8px 12px" }}>
                  <span style={{ fontSize: 17 }}>{m}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1, textAlign: "left" }}>{n}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>{p}</span>
                </div>
              ))}
            </div>
            <div style={caption}>Лиги с друзьями</div>
            <div style={sub}>Соревнование со сверстниками — без чатов и переписки</div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── Карусель «Что внутри» для родителя: разные ситуации, не 3 одинаковых
//    телефона. Слайды-компоненты + автопрокрутка + точки ───────────────────────
function ParentBarChart() {
  const weeks = [["нед 1", 32], ["нед 2", 41], ["нед 3", 47], ["нед 4", 58]];
  return (
    <div className="al-card" style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "28px 30px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Рост освоения по неделям</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: 99 }}>пример</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 180 }}>
        {weeks.map(([w, n], i) => (
          <div key={w} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: i === weeks.length - 1 ? GREEN : "rgba(255,255,255,0.7)" }}>{n}%</span>
            <motion.div initial={{ height: 0 }} whileInView={{ height: `${(n / 58) * 100}%` }} viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: "100%", maxWidth: 56, borderRadius: "8px 8px 3px 3px",
                background: i === weeks.length - 1 ? `linear-gradient(180deg,${GREEN},#10b981)` : `linear-gradient(180deg,${BLUE},#3b82f6)` }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParentShowcaseCarousel() {
  const slides = [
    { t: "Ребёнок занимается сам", s: "Адаптивные задачи держат в потоке: не слишком легко, не слишком сложно. 15–20 минут в день достаточно.",
      render: () => (
        <div style={{ maxWidth: 560, margin: "0 auto", position: "relative" }}>
          <DeviceFrame kind="laptop" img={taskScreenImg} label="Экран задачи" />
          <span style={{ position: "absolute", left: 18, bottom: 28, background: "rgba(7,11,22,0.85)", border: `1px solid ${GOLD}55`,
            color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 99 }}>🎯 Адаптивные задачи под уровень ребёнка</span>
        </div>
      ) },
    { t: "Вы видите общую картину", s: "Дашборд прогресса: сколько решено, какие навыки освоены, как идёт план.",
      render: () => <div style={{ maxWidth: 560, margin: "0 auto" }}><DeviceFrame kind="laptop" img={deviceDesktopImg} label="Дашборд" /></div> },
    { t: "Открываете когда удобно", s: "Заходите в кабинет на сайте в любой момент: вердикт, что освоено, над чем работать. Telegram-уведомления — скоро.",
      render: () => (
        <div style={{ maxWidth: 560, margin: "0 auto", position: "relative" }}>
          <DeviceFrame kind="laptop" label="Кабинет родителя"><ParentReportCard /></DeviceFrame>
          <span style={{ position: "absolute", left: 18, bottom: 28, background: "rgba(7,11,22,0.85)", border: `1px solid ${GOLD}55`,
            color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 99 }}>🔔 + уведомления в Telegram — скоро</span>
        </div>
      ) },
    { t: "Прогресс растёт измеримо", s: "Не ощущения, а цифры: динамика освоения программы по неделям.",
      render: () => <ParentBarChart /> },
  ];
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % n), 6000);
    return () => clearTimeout(id);
  }, [index, paused, n]);
  const cur = slides[index];
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ position: "relative", minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} style={{ width: "100%" }}>
            {cur.render()}
          </motion.div>
        </AnimatePresence>
        <button className="al-car-arrow" onClick={() => setIndex((i) => (i - 1 + n) % n)} aria-label="Назад" style={{ left: 0 }}>‹</button>
        <button className="al-car-arrow" onClick={() => setIndex((i) => (i + 1) % n)} aria-label="Вперёд" style={{ right: 0 }}>›</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 26 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => setIndex(i)} aria-label={`Слайд ${i + 1}`}
            style={{ width: i === index ? 30 : 10, height: 10, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
              background: i === index ? GOLD : "rgba(255,255,255,0.22)", transition: "width 0.35s ease, background 0.35s ease" }} />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 24, minHeight: 96 }}>
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            <div style={{ fontWeight: 800, fontSize: "clamp(20px,2.6vw,27px)", color: "#fff", marginBottom: 10, letterSpacing: "-0.5px" }}>{cur.t}</div>
            <p style={{ fontSize: 15.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, maxWidth: 540, margin: "0 auto" }}>{cur.s}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Цена в контексте: карточка + сравнение с репетитором ──────────────────────
function ParentPriceSection({ onCta, perks }) {
  return (
    <Section>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow>Цена раннего доступа</Eyebrow>
          <H2>Дешевле одного часа репетитора</H2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "clamp(24px,3.5vw,48px)", alignItems: "stretch" }} className="al-grid-2">
        <Reveal>
          <div className="al-card" style={{ height: "100%", border: `2px solid ${GOLD}`, background: `linear-gradient(160deg,${GOLD}14,transparent)`,
            padding: "clamp(30px,4vw,44px) clamp(24px,3.5vw,40px)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, margin: "0 0 8px" }}>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(52px,9vw,92px)", fontWeight: 800, color: GOLD, lineHeight: 1, letterSpacing: "-3px" }}>2000</span>
              <span style={{ fontSize: 21, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>₸ / мес</span>
            </div>
            <Lead style={{ maxWidth: 420, margin: "0 auto 26px" }}>Для первых учеников — закрепляется на год. Чем больше учеников на платформе, тем выше цена для новых; ранние сохраняют лоялти-условия.</Lead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", maxWidth: 480, margin: "0 auto 28px", textAlign: "left" }} className="al-perks">
              {perks.map((p) => (
                <div key={p} style={{ display: "flex", gap: 9, fontSize: 14.5, color: "rgba(255,255,255,0.78)", alignItems: "flex-start" }}>
                  <span style={{ color: GOLD, fontWeight: 800, flexShrink: 0 }}>✓</span>{p}
                </div>
              ))}
            </div>
            <button className="al-btn-primary" onClick={onCta} style={{ width: "100%", maxWidth: 400, margin: "0 auto", fontSize: 16.5, padding: "17px 30px" }}>Дайте ребёнку попробовать →</button>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 13 }}>Первая диагностика бесплатно · Без банковской карты</p>
          </div>
        </Reveal>
        {/* сравнение со столбцами */}
        <Reveal i={1}>
          <div className="al-card" style={{ height: "100%", padding: "clamp(26px,3.5vw,38px) clamp(22px,3vw,34px)", display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#fff", marginBottom: 6 }}>Сравните за месяц</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", marginBottom: 26 }}>Репетитор: 5 000 ₸/час × 8 занятий. Платформа — каждый день.</div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 32, minHeight: 220, padding: "0 10px" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#f87171" }}>40 000 ₸</span>
                <motion.div initial={{ height: 0 }} whileInView={{ height: "100%" }} viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: "100%", maxWidth: 110, borderRadius: "12px 12px 4px 4px", background: "linear-gradient(180deg,#7f1d1d,#450a0a)", border: "1px solid rgba(248,113,113,0.4)", maxHeight: 230 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>репетитор<br />8 часов в месяц</span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: GOLD }}>2 000 ₸</span>
                <motion.div initial={{ height: 0 }} whileInView={{ height: "8%" }} viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: "100%", maxWidth: 110, borderRadius: "8px 8px 4px 4px", background: `linear-gradient(180deg,${GOLD},#b8860b)`, boxShadow: `0 0 24px ${GOLD}44`, minHeight: 18 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>AAPA<br />каждый день</span>
              </div>
            </div>
            <div style={{ marginTop: 24, textAlign: "center", background: "rgba(212,175,55,0.08)", border: `1px solid ${GOLD}45`, borderRadius: 14, padding: "14px 18px" }}>
              <span style={{ fontSize: 15.5, fontWeight: 800, color: GOLD }}>В 20 раз дешевле</span>
              <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)" }}> — и занятия не 2 раза в неделю, а каждый день</span>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── «Безопасно и легально»: блок доверия перед футером ────────────────────────
function ParentTrustSection() {
  const items = [
    ["🛡️", "Детский контент", "Соответствует требованиям к контенту для детей. Возрастной рейтинг 5+."],
    ["📚", "Школьная программа РК", "Задачи 5–11 класса по программе казахстанской школы."],
    ["🔒", "Минимум данных", "Для работы нужны только имя и класс ребёнка. Никаких лишних персональных данных."],
  ];
  return (
    <Section bg="rgba(255,255,255,0.018)">
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(32px,5vw,52px)" }}>
          <Eyebrow color={GREEN}>Безопасно и легально</Eyebrow>
          <H2 style={{ fontSize: "clamp(26px,4vw,40px)" }}>Платформа, которой можно доверять</H2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="al-grid-3">
        {items.map(([ic, t, s], i) => (
          <Reveal key={t} i={i}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 18, padding: "22px 24px", height: "100%" }}>
              <span style={{ fontSize: 30, flexShrink: 0 }}>{ic}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16.5, color: "#fff", marginBottom: 5 }}>{t}</div>
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{s}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ЛЕНДИНГ ДЛЯ РОДИТЕЛЯ
// ══════════════════════════════════════════════════════════════════════════════
function ParentLanding({ onCta }) {
  const testimonials = [
    { quote: "За месяц увидела по отчёту, что у сына проседают дроби — раньше школа просто ставила тройку без объяснений.", name: "Айгерим", role: "мама ученика 6 класса", initial: "А" },
    { quote: "Дешевле одного часа репетитора, а ребёнок занимается каждый день сам. Для меня это главный аргумент.", name: "Дмитрий", role: "отец ученицы 8 класса", initial: "Д" },
    { quote: "Понравилось, что нет чатов и рекламы. Спокойно даю планшет — знаю, что там только математика.", name: "Гульнара", role: "мама ученика 5 класса", initial: "Г" },
  ];
  const perks = ["Адаптивная диагностика", "40 000 задач 5–11 класса", "Теория к каждому навыку", "Прогресс по 307 навыкам", "Кабинет с прогрессом ребёнка", "Безопасная среда без чатов"];
  const faqs = [
    { icon: "💰", defaultOpen: true, q: "Это замена репетитору?", a: "Для большинства тем — да. Система находит пробелы точнее, чем репетитор за первые занятия, и ребёнок тренируется столько, сколько нужно. Для форсированной подготовки к экзамену можно сочетать." },
    { icon: "🎮", q: "Ребёнок не будет просто играть?", a: "Геймификация — это обёртка над реальными задачами по школьной программе. Награды даются за решённые навыки, а не за «время в приложении». Прогресс вы видите в отчёте." },
    { icon: "⏱️", q: "Сколько времени в день нужно?", a: "15–20 минут в день достаточно. План разбит на короткие шаги: ребёнок решает несколько задач, закрывает этап навыка и видит прогресс. Регулярность важнее длительности — за это отвечает серия дней и ежедневные задания." },
    { icon: "😕", q: "А если ребёнок не любит математику?", a: "Чаще всего «не любит» = «не получается». Диагностика находит пробел, из-за которого всё валится, и план начинает именно с него. Когда начинает получаться, появляются награды и видимый прогресс — отношение меняется." },
    { icon: "🎓", q: "С какого класса подходит?", a: "5–11 класс, по школьной программе Казахстана. Система сама определяет уровень ребёнка через диагностику и подбирает задачи." },
    { icon: "👧👦", q: "Можно ли подключить нескольких детей?", a: "Да — у каждого ребёнка свой аккаунт со своей диагностикой, планом и прогрессом. Подписка оформляется на каждый аккаунт отдельно." },
    { icon: "🤔", q: "Что если не понравится?", a: "Первая диагностика и старт — бесплатно. Подписка 2000 ₸/мес, отменить можно в любой момент. Без скрытых платежей." },
  ];
  return (
    <>
      {/* HERO */}
      <Section style={{ paddingTop: "clamp(48px,7vw,90px)", paddingBottom: "clamp(56px,8vw,100px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: "clamp(36px,5vw,64px)", alignItems: "center" }} className="al-grid-2">
          <Reveal>
            <Eyebrow>Для родителей · математика 5–11</Eyebrow>
            <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(40px,7.5vw,80px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.02, letterSpacing: "-2.5px", margin: "0 0 24px" }}>
              Готовьте ребёнка<br />к школе <span style={{ color: GOLD }}>уверенно.</span>
            </h1>
            <Lead style={{ marginBottom: 18, maxWidth: 480 }}>
              <strong style={{ color: "#fff" }}>40 000 задач · 307 навыков · 5–11 класс.</strong> Платформа находит слабые места и ведёт ребёнка по точному маршруту — за <strong style={{ color: GOLD, whiteSpace: "nowrap" }}>2000 ₸/мес</strong>, дешевле часа репетитора.
            </Lead>
            <div className="al-hero-cta" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
              <button className="al-btn-primary" style={{ fontSize: 16, padding: "17px 32px" }} onClick={onCta}>Попробовать бесплатно →</button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 16 }}>Первая диагностика бесплатно · Без банковской карты</p>
          </Reveal>
          {/* Композиция «вы видите → ребёнок учится» вместо вечно грузящегося видео */}
          <ParentHeroVisual />
        </div>
      </Section>

      <StatsBand accent={GOLD} />

      <HowItWorks accent={GOLD} />

      {/* ЧТО УВИДИТЕ ВЫ — кабинет родителя (отчёт о прогрессе на сайте) */}
      <ParentReportSection />

      {/* БЕЗОПАСНО ДЛЯ РЕБЁНКА — большие карточки с реальным контентом */}
      <ParentSafetySection />

      {/* ЧТО УВИДИТ РЕБЁНОК — игровая сторона глазами родителя */}
      <ParentChildSideSection />

      {/* ЧТО ВНУТРИ — слайды с разными ситуациями использования */}
      <Section>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
            <Eyebrow>Что внутри</Eyebrow>
            <H2>Целая система вместо разовых занятий</H2>
            <Lead style={{ maxWidth: 560, margin: "0 auto" }}>Реальные экраны платформы — то, что увидите вы и ваш ребёнок.</Lead>
          </div>
        </Reveal>
        <ParentShowcaseCarousel />
      </Section>

      <Testimonials items={testimonials} accent={GOLD} />

      {/* ЦЕНА В КОНТЕКСТЕ — сравнение с репетитором */}
      <ParentPriceSection onCta={onCta} perks={perks} />

      {/* FAQ */}
      <Section narrow>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)" }}>
            <Eyebrow>Вопросы родителей</Eyebrow>
            <H2>Частые вопросы</H2>
          </div>
        </Reveal>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faqs.map((f, i) => <FaqItem key={i} {...f} delay={i} accent={GOLD} />)}
        </div>
      </Section>

      {/* БЕЗОПАСНО И ЛЕГАЛЬНО — блок доверия перед футером */}
      <ParentTrustSection />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  СЕКЦИИ УЧЕНИЧЕСКОГО ЛЕНДИНГА (живая геймификация платформы)
// ══════════════════════════════════════════════════════════════════════════════

// ── «Каждый навык — это мир»: 4 стадии жизни планеты ──────────────────────────
// При маунте каждая планета анимированно «оживает» из предыдущей стадии;
// hover проигрывает переход заново (на десктопе).
const PLANET_STAGES = [
  { life: -1,  prev: -1,  t: "Заблокирован", s: "Мёртвая скала. Сначала освой предыдущие навыки." },
  { life: 0,   prev: -1,  t: "Доступен",     s: "Серый камень ждёт твоего первого шага." },
  { life: 0.5, prev: 0,   t: "В процессе",   s: "Проступает вода, пробивается первая зелень." },
  { life: 1,   prev: 0.5, t: "Освоен",       s: "Цветущий мир с океанами, облаками и атмосферой." },
];

// Статичные PNG-рендеры планет-состояний (реальный SkillPlanet3D, прозрачный фон,
// 2× ретина). На мобайле показываем их вместо WebGL — ноль нагрузки на слабый GPU.
const PLANET_STAGE_IMG = { "-1": "locked", "0": "available", "0.5": "progress", "1": "mastered" };

function PlanetStageCard({ life, prev, t, s, i }) {
  const mobile = useIsMobile();
  const [replay, setReplay] = useState(0);
  const canAnimate = life !== prev;
  const stageImg = PLANET_STAGE_IMG[String(life)];
  return (
    <Reveal i={i}>
      <div className="al-card"
        onMouseEnter={() => { if (!mobile && canAnimate) setReplay((r) => r + 1); }}
        style={{ height: "100%", textAlign: "center", padding: "26px 16px 24px", cursor: (!mobile && canAnimate) ? "pointer" : "default" }}>
        {mobile && stageImg ? (
          // Мобайл: статичный PNG-рендер (вместо WebGL-планеты/градиента)
          <img src={`/previews/planets/${stageImg}.png`} alt={t} loading="lazy"
            style={{ width: 150, maxWidth: "100%", height: "auto", display: "block", margin: "0 auto" }} />
        ) : (
          // Десктоп: живая 3D-планета с анимацией «оживления»
          <PlanetView key={replay} fromLife={prev} toLife={life} size={150} />
        )}
        <div style={{ marginTop: 18, fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.3px" }}>
          {i > 0 && <span style={{ color: PURPLE, marginRight: 8 }}>→</span>}{t}
        </div>
        <div style={{ marginTop: 6, fontSize: 13.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{s}</div>
      </div>
    </Reveal>
  );
}

function PlanetStagesSection() {
  return (
    <Section>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow color={PURPLE}>Живая карта навыков</Eyebrow>
          <H2>Каждый навык — это мир</H2>
          <Lead style={{ maxWidth: 600, margin: "0 auto" }}>Твой прогресс виден сразу. Планеты оживают по мере освоения навыков — наведи на любую и посмотри.</Lead>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }} className="al-grid-4">
        {PLANET_STAGES.map((p, i) => <PlanetStageCard key={p.t} {...p} i={i} />)}
      </div>
    </Section>
  );
}

// ── «Создай своего героя»: 3D-минифигурка + сеты экипировки + фоны магазина ───
const SET_CARDS = [
  { id: "astronaut-m", icon: "🚀", name: "Астронавт", desc: "Белый скафандр, шлем и тяжёлые космо-ботинки" },
  { id: "swat-m",      icon: "🛡️", name: "Спецназ",   desc: "Тактическая броня, шлем с визором и берцы" },
  { id: "king-m",      icon: "👑", name: "Монарх",    desc: "Золотая корона, мантия и парадные сапоги" },
];
const SHOP_BG_PREVIEWS = [
  { name: "Манга",       src: "/shop/backgrounds/manga-style.svg" },
  { name: "Аниме город", src: "/shop/backgrounds/anime-city.jpg" },
  { name: "Сакура",      src: "/shop/backgrounds/sakura.jpg" },
  { name: "Cyberpunk",   src: "/shop/backgrounds/cyberpunk.jpg" },
];

// items в EQUIPMENT_SETS — itemId формата eq-{slot}-{set}; раскладываем по слотам.
function setToEquipped(setId) {
  const out = {};
  (EQUIPMENT_SETS[setId]?.items || []).forEach((id) => {
    const it = getShopItem(id);
    if (it) out[it.type] = id;
  });
  return out;
}

function CustomizeSection() {
  const [setId, setSetId] = useState("astronaut-m");
  return (
    <Section bg="rgba(255,255,255,0.018)">
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow color={PURPLE}>Кастомизация</Eyebrow>
          <H2>Прокачивай не только знания</H2>
          <Lead style={{ maxWidth: 600, margin: "0 auto" }}>Зарабатывай кристаллы за решённые задачи, покупай экипировку, меняй фоны. Сделай героя, который тебе нравится.</Lead>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(28px,4vw,56px)", alignItems: "center" }} className="al-grid-2">
        <Reveal>
          <div className="al-card" style={{ padding: "16px 10px 4px",
            background: "radial-gradient(ellipse at 50% 35%, rgba(124,58,237,0.16), transparent 70%), rgba(255,255,255,0.03)" }}>
            <LazyMount height={400}>
              <Character3D gender="male" equipped={setToEquipped(setId)} height={400} autoSpin={0.25} lockVerticalDrag />
            </LazyMount>
            <div style={{ textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.4)", padding: "8px 0 12px" }}>
              ↔ Покрути героя мышкой или пальцем
            </div>
          </div>
        </Reveal>
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SET_CARDS.map((c, i) => {
              const active = setId === c.id;
              return (
                <Reveal key={c.id} i={i}>
                  <button onClick={() => setSetId(c.id)} className="al-card"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                      padding: "16px 20px", fontFamily: "'Inter',sans-serif",
                      border: `1px solid ${active ? PURPLE : "rgba(255,255,255,0.09)"}`,
                      background: active ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.035)",
                      boxShadow: active ? "0 0 24px rgba(167,139,250,0.18)" : "none", transition: "border-color .25s, background .25s, box-shadow .25s" }}>
                    <span style={{ fontSize: 32, flexShrink: 0 }}>{c.icon}</span>
                    <span>
                      <span style={{ display: "block", fontWeight: 800, fontSize: 17, color: "#fff" }}>
                        {c.name}
                        <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 800, color: PURPLE, background: "rgba(167,139,250,0.14)",
                          border: "1px solid rgba(167,139,250,0.4)", padding: "2px 8px", borderRadius: 99, verticalAlign: "2px" }}>
                          сет-бонус +{EQUIPMENT_SETS[c.id].bonus} HP
                        </span>
                      </span>
                      <span style={{ display: "block", fontSize: 13.5, color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.5 }}>{c.desc}</span>
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>
          <Reveal i={3}>
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                Фоны профиля из магазина
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {SHOP_BG_PREVIEWS.map((b) => (
                  <div key={b.name} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", position: "relative", aspectRatio: "4 / 3", background: "#0a0e1a" }}>
                    <img src={b.src} alt={b.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 8px 6px", fontSize: 11, fontWeight: 700, color: "#fff",
                      background: "linear-gradient(transparent, rgba(7,11,22,0.85))", textAlign: "center" }}>{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

// ── «Сразись с боссом»: реальная 3D-сцена боя из ежедневных задач
// (BattleScene3D: герой в экипировке против босса) + тающий HP-бар.
// Демо-цикл: «правильный ответ» каждые ~1.6с — герой стреляет (attackSeq),
// босс теряет HP; на нуле возрождается. Крутится только пока секция видна.
// По умолчанию новые GLB-модели (как на ПК) рендерятся и на мобайле.
// BOSS_MOBILE_3D=false — быстрый откат на статичный кадр в одну строку
// (если на слабом Android будут лаги).
const BOSS_MOBILE_3D = true;
function BossBattleSection() {
  const hostRef = useRef(null);
  const mobile = useIsMobile();
  // staticBoss=true → старый статичный фоллбэк; false → живая 3D-сцена (GLB).
  const staticBoss = mobile && !BOSS_MOBILE_3D;
  const [active, setActive] = useState(false);
  // Статичный кадр снят на ~66 HP; живая сцена стартует со 160 (полный HP дракона).
  const startHp = staticBoss ? 66 : 160;
  const [hp, setHp] = useState(startHp);
  const hpRef = useRef(startHp);
  const [hit, setHit] = useState(0); // = attackSeq для BattleScene3D (выпад героя + лазер)
  const [defeated, setDefeated] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setActive(true); return; }
    const io = new IntersectionObserver((es) => setActive(es.some((e) => e.isIntersecting)), { rootMargin: "60px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (hpRef.current <= 0) { hpRef.current = 160; setHp(160); setDefeated(false); return; }
      hpRef.current = Math.max(0, hpRef.current - 20);
      setHp(hpRef.current);
      setHit((c) => c + 1);
      if (hpRef.current <= 0) setDefeated(true);
    }, 1600);
    return () => { clearInterval(id); };
  }, [active]);

  return (
    <Section>
      <div ref={hostRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(28px,4vw,56px)", alignItems: "center" }} className="al-grid-2">
        <Reveal>
          <Eyebrow color="#f87171">Битвы с боссами</Eyebrow>
          <H2>Сразись с боссом</H2>
          <Lead>
            В ежедневных задачах тебя ждут битвы с боссами. Решай правильно — наноси урон. Промахнулся — теряешь HP. Экипировка из магазина добавляет здоровья.
          </Lead>
          <Lead style={{ marginTop: 14, fontSize: 15, color: "rgba(255,255,255,0.55)" }}>
            У каждого босса свой запас HP — чем сильнее враг, тем больше урон за верный ответ.
          </Lead>
        </Reveal>
        <Reveal i={1}>
          <div className="al-card" style={{ padding: "26px 26px 30px", textAlign: "center", overflow: "hidden",
            background: "radial-gradient(ellipse at 50% 30%, rgba(220,38,38,0.14), transparent 70%), rgba(255,255,255,0.03)" }}>
            {/* арена — реальная сцена боя из ежедневных задач (герой + босс).
                HP-индикатор и имя босса показываются ВНУТРИ сцены (hud у
                BattleScene3D) — верхний дубль-бар (с неверным именем) убран. */}
            <div style={{ position: "relative", marginTop: 26, minHeight: 220 }}>
              {staticBoss ? (
                <img src={bossBattleImg} alt="Битва с боссом" loading="lazy"
                  style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 14, display: "block" }} />
              ) : (
                <LazyMount height={220}>
                  <BattleScene3D equipped={setToEquipped("astronaut-m")} bossId="dragon" bossHp={hp} attackSeq={hit} hitSeq={0} height={220} />
                </LazyMount>
              )}
              {/* всплывающий урон (на мобиле «−20» уже в статичном кадре).
                  Без AnimatePresence: exit предыдущего флоата перекрывался с
                  enter нового → два «−20» одновременно. Один motion.div с
                  keyframes сам затухает к концу такта. */}
              {hit > 0 && !defeated && !staticBoss && (
                <motion.div key={hit}
                  initial={false}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, -12, -28, -42], scale: [0.7, 1.1, 1.1, 1] }}
                  transition={{ duration: 1.1, times: [0, 0.18, 0.7, 1], ease: "easeOut" }}
                  style={{ position: "absolute", top: 28, right: "22%", fontWeight: 900, fontSize: 26, color: "#fbbf24",
                    textShadow: "0 2px 10px rgba(0,0,0,0.6)", pointerEvents: "none" }}>
                  −20
                </motion.div>
              )}
              {defeated && (
                <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(7,11,22,0.72)", borderRadius: 16, fontWeight: 900, fontSize: 24, color: "#fbbf24" }}>
                  💥 Босс повержен!
                </motion.div>
              )}
            </div>
            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
              ✅ Правильный ответ — <span style={{ color: "#fbbf24" }}>−20 HP боссу</span> · ❌ ошибка — урон тебе
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── «Собирай корабль прогресса»: живой ShipProgress с 70% плана ────────────────
function ShipSection() {
  // Сбрасываем «seen»-метку демо-uid, чтобы анимация сборки проигрывалась
  // при каждом посещении лендинга (ShipProgress пишет её в localStorage).
  useState(() => { try { localStorage.removeItem("aapa_ship_parts_landing-demo"); } catch {} return 0; });
  return (
    <Section bg="rgba(255,255,255,0.018)">
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)" }}>
          <Eyebrow color={PURPLE}>Корабль прогресса</Eyebrow>
          <H2>Собирай корабль прогресса</H2>
          <Lead style={{ maxWidth: 620, margin: "0 auto" }}>
            Твой учебный план — это космолёт. Каждые 10% освоенного плана открывают новую деталь корабля. На 100% — взлёт.
          </Lead>
        </div>
      </Reveal>
      <Reveal i={1}>
        {/* ShipProgress красит подписи из темы приложения (light по умолчанию) —
            на всегда-тёмном лендинге перебиваем цвета override-классом */}
        <style>{`.al-ship-stats div{color:rgba(255,255,255,0.55)!important;}
          .al-ship-stats b{color:#f5c518!important;}`}</style>
        <div className="al-card al-ship-stats" style={{ maxWidth: 640, margin: "0 auto", padding: "30px 28px 26px",
          background: "radial-gradient(ellipse at 50% 30%, rgba(102,178,255,0.1), transparent 70%), rgba(255,255,255,0.03)" }}>
          <LazyMount height={170}>
            <ShipProgress mastered={7} total={10} ready uid="landing-demo" />
          </LazyMount>
        </div>
      </Reveal>
      <Reveal i={2}>
        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14.5, color: "rgba(255,255,255,0.45)", maxWidth: 560, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Метафора простая: знания собираются по детали, как настоящий корабль. Видно, сколько уже готово — и сколько осталось до орбиты. 🚀
        </p>
      </Reveal>
    </Section>
  );
}

// ── CSS-фреймы устройств: ноутбук / планшет / телефон. Контент — либо img,
//    либо произвольные children (мокапы вроде отчёта родителя) ─────────────────
function DeviceFrame({ kind, img, label, children }) {
  const screen = { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block", background: "#0c1020" };
  const content = children
    ? <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#0c1020" }}>{children}</div>
    : <img src={img} alt={label} loading="lazy" style={screen} />;
  if (kind === "laptop") {
    return (
      <div>
        <div style={{ border: "10px solid #181c2c", borderBottomWidth: 18, borderRadius: "14px 14px 4px 4px", overflow: "hidden",
          aspectRatio: "16 / 10", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
          {content}
        </div>
        <div style={{ height: 13, width: "112%", margin: "0 -6%", borderRadius: "0 0 14px 14px",
          background: "linear-gradient(#2a3046,#161a28)", boxShadow: "0 10px 24px rgba(0,0,0,0.45)" }} />
      </div>
    );
  }
  if (kind === "tablet") {
    return (
      <div style={{ border: "12px solid #181c2c", borderRadius: 26, overflow: "hidden", aspectRatio: "3 / 4", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {content}
      </div>
    );
  }
  return (
    <div style={{ border: "9px solid #181c2c", borderRadius: 32, overflow: "hidden", aspectRatio: "9 / 19", position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", background: "#0c1020" }}>
      <div style={{ position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)", width: 64, height: 14, borderRadius: 99, background: "#181c2c", zIndex: 2 }} />
      {content}
    </div>
  );
}

function DevicesSection({ accent = PURPLE }) {
  return (
    <Section>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
          <Eyebrow color={accent}>На любом устройстве</Eyebrow>
          <H2>Учись где удобно</H2>
          <Lead style={{ maxWidth: 560, margin: "0 auto" }}>Платформа работает на компьютере, планшете и телефоне одинаково — прогресс общий.</Lead>
        </div>
      </Reveal>
      {/* Единая сцена устройств вместо трёх блоков в столбик: ноутбук крупно по
          центру/сзади, планшет и телефон меньше и внахлёст спереди по бокам.
          Позиции в % + aspect-ratio контейнера → композиция масштабируется под
          ширину (на мобайле секция заметно ниже, ничего не вытекает). Отдельные
          подписи убраны — единая сцена в них не нуждается. */}
      <Reveal>
        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto", aspectRatio: "16 / 9" }}>
          <div style={{ position: "absolute", left: "50%", top: "4%", transform: "translateX(-50%)", width: "70%", zIndex: 1 }}>
            <DeviceFrame kind="laptop" img={deviceDesktopImg} label="На компьютере" />
          </div>
          <div style={{ position: "absolute", left: "1%", bottom: 0, width: "30%", zIndex: 2 }}>
            <DeviceFrame kind="tablet" img={deviceTabletImg} label="На планшете" />
          </div>
          <div style={{ position: "absolute", right: "2%", bottom: "3%", width: "16%", zIndex: 3 }}>
            <DeviceFrame kind="phone" img={devicePhoneImg} label="На телефоне" />
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ЛЕНДИНГ ДЛЯ УЧЕНИКА
// ══════════════════════════════════════════════════════════════════════════════
function StudentLanding({ onCta }) {
  const mobile = useIsMobile();
  const testimonials = [
    { quote: "Раньше математику ненавидел. Теперь захожу ради streak'а и чтобы обогнать друга в лиге. Реально затягивает.", name: "Арман", role: "ученик 7 класса", initial: "А" },
    { quote: "Карта как в игре — видно, какие планеты-навыки ещё закрыты. Хочется открыть все.", name: "Аружан", role: "ученица 6 класса", initial: "А" },
    { quote: "Поднялась до Золотой лиги за две недели. Кристаллы коплю на рамку для аватара.", name: "Дана", role: "ученица 9 класса", initial: "Д" },
  ];
  const perks = ["Карта-приключение с навыками", "Кристаллы, ачивки и streak", "Лидерборд и лиги с друзьями", "NPC-гид по сюжету", "Кастомизация аватара", "40 000 задач с твоим уровнем"];
  const faqs = [
    { q: "Это сложно?", a: "Система сама определяет твой уровень через короткую диагностику и даёт задачи по силам. Не будет ни слишком легко, ни слишком трудно." },
    { q: "Что за кристаллы и лиги?", a: "За решённые навыки получаешь кристаллы и очки, поднимаешься в лигах от Бронзы до Алмаза и соревнуешься с друзьями в лидерборде." },
    { q: "Нужно платить?", a: "Старт и первая диагностика — бесплатно. Полный доступ стоит 2000 ₸/мес, это решают родители." },
  ];
  return (
    <>
      {/* HERO */}
      <Section style={{ paddingTop: "clamp(48px,7vw,90px)", paddingBottom: "clamp(56px,8vw,100px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: "clamp(36px,5vw,64px)", alignItems: "center" }} className="al-grid-2">
          <Reveal>
            <Eyebrow color={PURPLE}>Для учеников · математика</Eyebrow>
            <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(40px,7.5vw,80px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.02, letterSpacing: "-2.5px", margin: "0 0 24px" }}>
              Прокачай свою <span style={{ color: PURPLE }}>математику.</span>
            </h1>
            <Lead style={{ marginBottom: 18, maxWidth: 480 }}>
              Не учебник, а приключение. <strong style={{ color: "#fff" }}>Карта навыков, кристаллы, лидерборд и NPC-гид</strong> — учись так, будто играешь.
            </Lead>
            <div className="al-hero-cta" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
              <button className="al-btn-primary" onClick={onCta}
                style={{ background: `linear-gradient(135deg,${PURPLE},#7c3aed)`, color: "#fff", fontSize: 16, padding: "17px 32px" }}>Начать приключение →</button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 16 }}>Старт бесплатно · Без банковской карты</p>
          </Reveal>
          {/* ЖИВАЯ 3D-планета вместо видео: расцветает из камня при загрузке */}
          <Reveal i={1}>
            <div style={{ textAlign: "center", padding: mobile ? "12px 0 16px" : 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "rgba(255,255,255,0.62)", marginBottom: 16, letterSpacing: "0.2px" }}>
                Каждый навык — это планета. Освой её — и она расцветёт.
              </div>
              {/* На мобайле планета меньше (250 vs 420): воздух по бокам, не упирается в края */}
              <PlanetView fromLife={0} toLife={1} size={mobile ? 250 : 420} allowMobile />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* КАЖДЫЙ НАВЫК — ЭТО МИР (4 стадии планеты) */}
      <PlanetStagesSection />

      <StatsBand accent={PURPLE} />

      <HowItWorks accent={PURPLE} />

      {/* СОЗДАЙ СВОЕГО ГЕРОЯ (кастомизация) */}
      <CustomizeSection />

      {/* СРАЗИСЬ С БОССОМ (битвы) */}
      <BossBattleSection />

      {/* СОБИРАЙ КОРАБЛЬ ПРОГРЕССА */}
      <ShipSection />

      {/* НА ЛЮБОМ УСТРОЙСТВЕ */}
      <DevicesSection accent={PURPLE} />

      {/* КАК ЭТО РАБОТАЕТ — видео-демо реальных экранов (карусель сохранена) */}
      <Section bg="rgba(255,255,255,0.018)">
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
            <Eyebrow color={PURPLE}>Видео-демо</Eyebrow>
            <H2>Как это работает</H2>
            <Lead style={{ maxWidth: 560, margin: "0 auto" }}>Реальные экраны платформы — карта, кристаллы, рейтинг и серия дней.</Lead>
          </div>
        </Reveal>
        <VideoCarousel accent={PURPLE} />
      </Section>

      <Testimonials items={testimonials} accent={PURPLE} />

      <PriceSection onCta={onCta} accent={PURPLE} perks={perks} ctaText="Начать своё приключение →" />

      {/* FAQ */}
      <Section narrow>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)" }}>
            <Eyebrow color={PURPLE}>Вопросы учеников</Eyebrow>
            <H2>Частые вопросы</H2>
          </div>
        </Reveal>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faqs.map((f, i) => <FaqItem key={i} {...f} delay={i} accent={PURPLE} />)}
        </div>
      </Section>
    </>
  );
}

// ── FAQ-айтем (раскрывающийся, крупнее; опц. иконка и открыт по умолчанию) ─────
function FaqItem({ q, a, delay = 0, accent = GOLD, icon, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Reveal i={delay}>
      <div className="al-card" style={{ padding: 0, overflow: "hidden" }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer",
            padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
            color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.2px" }}>
          <span>{icon && <span style={{ marginRight: 12 }}>{icon}</span>}{q}</span>
          <motion.span animate={{ rotate: open ? 45 : 0 }} style={{ color: accent, fontSize: 24, flexShrink: 0, lineHeight: 1 }}>+</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
              <p style={{ padding: "0 26px 24px", fontSize: 15.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: 0 }}>{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ГЛАВНЫЙ КОМПОНЕНТ
// ══════════════════════════════════════════════════════════════════════════════
export default function AboutLanding({ initialRole = null, user = null, onStart, onDashboard, onDemo, invitePending = false }) {
  const [role, setRole] = useState(() => initialRole || getRoleCookie() || "parent");
  const accent = role === "student" ? PURPLE : GOLD;

  const changeRole = useCallback((r) => {
    setRole(r);
    setRoleCookie(r);
    try { window.history.replaceState(null, "", r === "student" ? "/landing/students" : "/landing/parents"); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => { setRoleCookie(role); }, []); // запомнить стартовую роль

  // Sticky-compact header: после ~80px скролла схлопываем шапку в одну тонкую
  // строку (лого + «Войти»), переключатель роли прячем. rAF-троттл — layout не
  // дёргается на каждый кадр. Compact-стили только в @media мобайла, поэтому на
  // десктопе класс эффекта не имеет.
  const [headerCompact, setHeaderCompact] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { setHeaderCompact(window.scrollY > 80); ticking = false; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Тёмный фон на сам body: без него белый canvas просвечивает при
  // overscroll/быстрой прокрутке и в недорисованных областях по краям.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = BG;
    return () => { document.body.style.background = prev; };
  }, []);

  // Гостевые «Попробовать»-CTA ведут на демо-диагностику без регистрации;
  // явный вход в кабинет — только по «Войти» (onStart) в шапке.
  const cta = user ? onDashboard : (onDemo || onStart);

  return (
    <div className="al-root" style={{ fontFamily: "'Inter',sans-serif", background: BG, color: "#fff", minHeight: "100vh", overflowX: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .al-btn-primary{background:linear-gradient(135deg,${GOLD},#f59e0b);color:#0a0e1a;border:none;padding:16px 32px;border-radius:14px;font-family:'Inter',sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:transform .2s,box-shadow .2s;letter-spacing:.2px;}
        .al-btn-primary:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(212,175,55,.38);}
        .al-btn-ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.25);padding:11px 22px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;transition:.2s;font-family:'Inter',sans-serif;}
        .al-btn-ghost:hover{background:rgba(255,255,255,.07);}
        .al-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:28px 26px;transition:border-color .25s,box-shadow .25s;}
        .al-card:hover{border-color:rgba(255,255,255,.18);}
        .al-car-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:5;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,10,20,.7);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:26px;line-height:1;cursor:pointer;transition:background .2s,border-color .2s,transform .2s;font-family:'Inter',sans-serif;}
        .al-car-arrow:hover{background:rgba(10,10,20,.92);border-color:rgba(255,255,255,.4);transform:translateY(-50%) scale(1.08);}
        .al-nav{position:sticky;top:0;z-index:100;background:rgba(10,10,20,.82);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.07);padding:0 32px;min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        /* десктоп: role+cta прижаты к правому краю (как было до разбивки на 3 ребёнка) */
        .al-nav-role{margin-left:auto;}
        @media(prefers-reduced-motion:reduce){.al-nav-role{transition:none!important;}}
        @media(max-width:880px){
          .al-grid-2,.al-grid-3,.al-grid-4{grid-template-columns:1fr!important;}
          .al-perks{grid-template-columns:1fr!important;}
          /* CTA-кнопка hero — центрируем ТОЛЬКО кнопку на мобайле; заголовок,
             подзаголовок и подпись под кнопкой остаются слева (отдельные блоки). */
          .al-hero-cta{justify-content:center;}
          /* overflow-x:clip вместо hidden — клипит горизонталь, но НЕ создаёт
             scroll-контейнер, поэтому position:sticky шапки на мобайле работает
             (overflow-x:hidden у body И корня его ломал). Десктоп — без изменений
             (там остаётся hidden, sticky-поведение как было). iOS 16+ поддерживает clip. */
          html,body{overflow-x:clip!important;}
          .al-root{overflow-x:clip!important;}
          /* Header — две строки: стр.1 лого + «Войти», стр.2 переключатель роли
             на всю ширину. Факты (al-nav-trust) убраны (дублируются в hero). */
          .al-nav{padding:10px 16px;min-height:0;gap:10px 12px;}
          .al-nav-trust{display:none!important;}
          .al-nav-left{order:0;}
          .al-nav-cta{order:1;margin-left:auto;}
          .al-nav-role{order:2;flex-basis:100%;margin-left:0;overflow:hidden;
            max-height:64px;opacity:1;transition:max-height .28s ease,opacity .2s ease;}
          .al-role-toggle{display:flex!important;width:100%;}
          .al-role-toggle button{flex:1;padding:14px 12px!important;font-size:14px!important;}
          /* Compact при скролле (>80px): прячем строку роли — header в одну тонкую строку. */
          .al-nav.header-compact .al-nav-role{max-height:0;opacity:0;margin-top:0;margin-bottom:0;}
          /* Анти-blowout сетки на мобайле: дети 1fr-колонки могут сжиматься уже
             своего контента (по умолчанию min-width:auto). На iOS 3D-канвас
             монтируется с inline width:360px (clientWidth=0 → фоллбэк) и распирал
             колонку шире вьюпорта — текст карточек вытекал вправо. */
          .al-grid-2>*,.al-grid-3>*,.al-grid-4>*{min-width:0;}
          .al-card{min-width:0;}
          .al-card canvas{max-width:100%;}
          /* Капсула «вы видите → ребёнок в игре»: ограничиваем левой зоной (правее —
             иллюстрация телефона) и разрешаем перенос, чтобы не вытекала за экран
             (iOS shrink-to-fit) и не наезжала на телефон. */
          .parent-hero-capsule{max-width:62%;white-space:normal;line-height:1.35;}
        }
        @media(max-width:520px){
          .al-perks{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* фоновые свечения */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-12%", right: "-15%", width: 680, height: 680, borderRadius: "50%", background: `radial-gradient(circle,${accent}22 0%,transparent 70%)`, transition: "background 0.5s" }} />
        <div style={{ position: "absolute", bottom: "-20%", left: "-12%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,#1e3a8a22 0%,transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Баннер приглашения в друзья (/invite/{code}) — гость зарегистрируется
            и автоматически станет другом пригласившего */}
        {invitePending && (
          <div style={{ background: `linear-gradient(90deg,${PURPLE}33,${GOLD}22)`, borderBottom: `1px solid ${PURPLE}55`,
            padding: "10px 20px", textAlign: "center", fontSize: 14, color: "#fff" }}>
            🎉 <strong>Друг приглашает тебя на платформу!</strong>
            <span style={{ color: "rgba(255,255,255,0.7)" }}> Зарегистрируйся — и вы сразу окажетесь в друзьях и общем рейтинге.</span>
            <button onClick={onStart} style={{ marginLeft: 12, background: PURPLE, color: "#fff", border: "none", borderRadius: 99,
              padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Присоединиться →</button>
          </div>
        )}
        {/* ШАПКА */}
        <nav className={`al-nav${headerCompact ? " header-compact" : ""}`}>
          <div className="al-nav-left" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Logo size={32} light />
            <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)" }} className="al-nav-trust" />
            <div className="al-nav-trust"><TrustAnchor /></div>
          </div>
          <div className="al-nav-role"><RoleToggle role={role} onChange={changeRole} /></div>
          <div className="al-nav-cta">
            {user ? (
              <button className="al-btn-primary" style={{ padding: "10px 22px", fontSize: 14 }} onClick={onDashboard}>Войти в кабинет →</button>
            ) : (
              <button className="al-btn-ghost" onClick={onStart}>Войти</button>
            )}
          </div>
        </nav>

        {/* КОНТЕНТ ПО РОЛИ */}
        <AnimatePresence mode="wait">
          <motion.div key={role} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            {role === "student" ? <StudentLanding onCta={cta} /> : <ParentLanding onCta={cta} />}
          </motion.div>
        </AnimatePresence>

        {/* ФУТЕР (минималистичный) */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "48px 32px 40px", marginTop: 20 }}>
          <div style={{ maxWidth: MAXW, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24 }}>
            <div>
              <Logo size={28} light />
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: "14px 0 0" }}>© 2026 AAPA — Ad Astra Per Aspera</p>
            </div>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap", fontSize: 14 }}>
              <a href="https://wa.me/77000000000" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>WhatsApp</a>
              <a href="mailto:hello@aapa.kz" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>hello@aapa.kz</a>
              <a href="/about#terms" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Условия</a>
              <a href="/about#privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Конфиденциальность</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
