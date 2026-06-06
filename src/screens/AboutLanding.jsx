import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/ui/Logo.jsx";

// Видео-заготовки (Vite импортирует mp4 → URL). Лежат в assets/marketing/videos/.
import diagnosticVid from "../../assets/marketing/videos/diagnostic.mp4";
import skillMapVid from "../../assets/marketing/videos/skill-map.mp4";
import leaderboardVid from "../../assets/marketing/videos/leaderboard.mp4";
import progressVid from "../../assets/marketing/videos/progress.mp4";

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

// ── встроенное видео-демо (телефон 9:16, autoplay, без звука) ───────────────────
// Видео портретные (720×1280) — подаём как устройство: ограничиваем ширину,
// чтобы карточки/hero не раздувались в высоту.
function VideoFrame({ src, label, accent = GOLD, maxW = 360, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "relative", width: "100%", maxWidth: maxW, margin: "0 auto", borderRadius: 28, overflow: "hidden",
        border: `1px solid ${accent}45`, boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 60px ${accent}1f`, aspectRatio: "9 / 16", background: "#0a0e1a", ...style }}
    >
      <video src={src} autoPlay muted loop playsInline preload="metadata"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      {label && (
        <div style={{ position: "absolute", left: 14, bottom: 14, background: "rgba(7,11,22,0.8)", backdropFilter: "blur(8px)",
          border: `1px solid ${accent}55`, color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 99 }}>
          {label}
        </div>
      )}
    </motion.div>
  );
}

// ── переключатель ролей ────────────────────────────────────────────────────────
function RoleToggle({ role, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
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
  const items = [["1600", "задач"], ["307", "навыков"], ["5–11", "класс"]];
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
  const stats = [["1600", "задач по школьной программе"], ["307", "навыков с прогрессом"], ["7", "классов · с 5 по 11"], ["2000 ₸", "в месяц · фиксированно"]];
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
    ["01", "Диагностика", "15 минут адаптивных задач — система точно определяет уровень и находит пробелы.", "≈ 15 минут"],
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

// ── карточка фичи с видео-демо (hover приподнимается) ──────────────────────────
function FeatureCard({ video, title, desc, accent = GOLD, i = 0 }) {
  return (
    <motion.div
      variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -8, transition: { duration: 0.25 } }}
      className="al-card al-feature" style={{ padding: 0, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", height: 420, display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: `1px solid rgba(255,255,255,0.06)`, background: `radial-gradient(circle at 50% 28%, ${accent}16, transparent 70%)` }}>
        <video src={video} autoPlay muted loop playsInline preload="metadata"
          style={{ height: "88%", width: "auto", maxWidth: "78%", objectFit: "contain", borderRadius: 18,
            boxShadow: `0 22px 50px rgba(0,0,0,0.55), 0 0 0 1px ${accent}33`, background: "#0a0e1a" }} />
      </div>
      <div style={{ padding: "26px 26px 30px" }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 8, letterSpacing: "-0.4px" }}>{title}</div>
        <div style={{ fontSize: 14.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>{desc}</div>
      </div>
    </motion.div>
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
          <Eyebrow color={accent}>Простая подписка</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, margin: "10px 0 8px" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(56px,11vw,104px)", fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: "-3px" }}>2000</span>
            <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>₸ / мес</span>
          </div>
          <Lead style={{ maxWidth: 440, margin: "0 auto 32px" }}>Полный доступ. Без скрытых платежей. Отменить можно в любой момент.</Lead>
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
//  ЛЕНДИНГ ДЛЯ РОДИТЕЛЯ
// ══════════════════════════════════════════════════════════════════════════════
function ParentLanding({ onCta }) {
  const features = [
    { video: diagnosticVid, t: "Умная диагностика", s: "Находит конкретные пробелы ребёнка точнее, чем репетитор за первые занятия." },
    { video: progressVid, t: "Прогресс по навыкам", s: "Каждый из 307 навыков отслеживается отдельно — видно, что освоено, а что в красной зоне." },
    { video: skillMapVid, t: "Карта обучения", s: "Ребёнок движется по понятному маршруту, а не по случайным задачам из учебника." },
    { video: leaderboardVid, t: "Мотивация без принуждения", s: "Лиги и рейтинг подстёгивают заниматься — ребёнок сам хочет заходить." },
  ];
  const safety = [
    ["🚫🤖", "Без AI-чатов", "Никаких генеративных собеседников — только задачи по школьной программе."],
    ["📵", "Без рекламы", "Ни баннеров, ни внешних ссылок, ни покупок внутри. Чистая среда обучения."],
    ["🛡️", "Без незнакомцев", "Никакого открытого общения с посторонними. Закрытое безопасное пространство."],
  ];
  const testimonials = [
    { quote: "За месяц увидела по отчёту, что у сына проседают дроби — раньше школа просто ставила тройку без объяснений.", name: "Айгерим", role: "мама ученика 6 класса", initial: "А" },
    { quote: "Дешевле одного часа репетитора, а ребёнок занимается каждый день сам. Для меня это главный аргумент.", name: "Дмитрий", role: "отец ученицы 8 класса", initial: "Д" },
    { quote: "Понравилось, что нет чатов и рекламы. Спокойно даю планшет — знаю, что там только математика.", name: "Гульнара", role: "мама ученика 5 класса", initial: "Г" },
  ];
  const perks = ["Адаптивная диагностика", "1600 задач 5–11 класса", "Теория к каждому навыку", "Прогресс по 307 навыкам", "Еженедельный отчёт", "Безопасная среда без чатов"];
  const faqs = [
    { q: "Это замена репетитору?", a: "Для большинства тем — да. Система находит пробелы точнее, чем репетитор за первые занятия, и ребёнок тренируется столько, сколько нужно. Для форсированной подготовки к экзамену можно сочетать." },
    { q: "Ребёнок не будет просто играть?", a: "Геймификация — это обёртка над реальными задачами по школьной программе. Награды даются за решённые навыки, а не за «время в приложении». Прогресс вы видите в отчёте." },
    { q: "С какого класса подходит?", a: "5–11 класс, по школьной программе Казахстана. Система сама определяет уровень ребёнка через диагностику и подбирает задачи." },
    { q: "Что если не понравится?", a: "Первая диагностика и старт — бесплатно. Подписка 2000 ₸/мес, отменить можно в любой момент. Без скрытых платежей." },
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
              <strong style={{ color: "#fff" }}>1600 задач · 307 навыков · 5–11 класс.</strong> Платформа находит слабые места и ведёт ребёнка по точному маршруту — за <strong style={{ color: GOLD }}>2000 ₸/мес</strong>, дешевле часа репетитора.
            </Lead>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
              <button className="al-btn-primary" style={{ fontSize: 16, padding: "17px 32px" }} onClick={onCta}>Попробовать бесплатно →</button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 16 }}>Первая диагностика бесплатно · Без банковской карты</p>
          </Reveal>
          <VideoFrame src={diagnosticVid} label="🔬 Умная диагностика" />
        </div>
      </Section>

      <StatsBand accent={GOLD} />

      <HowItWorks accent={GOLD} />

      {/* ЧТО ВНУТРИ */}
      <Section bg="rgba(255,255,255,0.018)">
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
            <Eyebrow>Что внутри</Eyebrow>
            <H2>Целая система вместо разовых занятий</H2>
            <Lead style={{ maxWidth: 560, margin: "0 auto" }}>Реальные экраны платформы — то, что увидите вы и ваш ребёнок.</Lead>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }} className="al-grid-2">
          {features.map((f, i) => <FeatureCard key={f.t} video={f.video} title={f.t} desc={f.s} accent={GOLD} i={i % 2} />)}
        </div>
      </Section>

      {/* БЕЗОПАСНО ДЛЯ РЕБЁНКА */}
      <Section>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
            <Eyebrow color="#34d399">Безопасно для ребёнка</Eyebrow>
            <H2>Спокойно даёте планшет</H2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="al-grid-3">
          {safety.map(([icon, t, s], i) => (
            <Reveal key={t} i={i}>
              <div className="al-card" style={{ height: "100%", textAlign: "center", padding: "40px 30px" }}>
                <div style={{ fontSize: 44, marginBottom: 18 }}>{icon}</div>
                <div style={{ fontWeight: 800, fontSize: 24, color: "#fff", marginBottom: 12, letterSpacing: "-0.5px" }}>{t}</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>{s}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Testimonials items={testimonials} accent={GOLD} />

      <PriceSection onCta={onCta} accent={GOLD} perks={perks} ctaText="Дайте ребёнку попробовать →" />

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
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ЛЕНДИНГ ДЛЯ УЧЕНИКА
// ══════════════════════════════════════════════════════════════════════════════
function StudentLanding({ onCta }) {
  const game = [
    { video: skillMapVid, t: "Карта мира", s: "Изучай навыки в своём порядке — открывай новые планеты на живой карте." },
    { video: progressVid, t: "Кристаллы и ачивки", s: "Награды за каждый освоенный навык и серию дней подряд." },
    { video: leaderboardVid, t: "Лидерборд", s: "Соревнуйся с друзьями по лигам и областям. Подиум топ-3 недели." },
    { video: diagnosticVid, t: "Streak и диагностика", s: "Держи серию дней и узнавай свой уровень — система строит точный маршрут." },
  ];
  const testimonials = [
    { quote: "Раньше математику ненавидел. Теперь захожу ради streak'а и чтобы обогнать друга в лиге. Реально затягивает.", name: "Арман", role: "ученик 7 класса", initial: "А" },
    { quote: "Карта как в игре — видно, какие планеты-навыки ещё закрыты. Хочется открыть все.", name: "Аружан", role: "ученица 6 класса", initial: "А" },
    { quote: "Поднялась до Золотой лиги за две недели. Кристаллы коплю на рамку для аватара.", name: "Дана", role: "ученица 9 класса", initial: "Д" },
  ];
  const perks = ["Карта-приключение с навыками", "Кристаллы, ачивки и streak", "Лидерборд и лиги с друзьями", "NPC-гид по сюжету", "Кастомизация аватара", "1600 задач с твоим уровнем"];
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
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
              <button className="al-btn-primary" onClick={onCta}
                style={{ background: `linear-gradient(135deg,${PURPLE},#7c3aed)`, color: "#fff", fontSize: 16, padding: "17px 32px" }}>Начать приключение →</button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 16 }}>Старт бесплатно · Без банковской карты</p>
          </Reveal>
          <VideoFrame src={skillMapVid} label="🗺️ Живая карта навыков" accent={PURPLE} />
        </div>
      </Section>

      <StatsBand accent={PURPLE} />

      <HowItWorks accent={PURPLE} />

      {/* ГЕЙМИФИКАЦИЯ */}
      <Section bg="rgba(255,255,255,0.018)">
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)" }}>
            <Eyebrow color={PURPLE}>Геймификация</Eyebrow>
            <H2>Твой путь героя математики</H2>
            <Lead style={{ maxWidth: 560, margin: "0 auto" }}>Реальные экраны игры — карта, кристаллы, рейтинг и серия дней.</Lead>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }} className="al-grid-2">
          {game.map((f, i) => <FeatureCard key={f.t} video={f.video} title={f.t} desc={f.s} accent={PURPLE} i={i % 2} />)}
        </div>
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

// ── FAQ-айтем (раскрывающийся, крупнее) ────────────────────────────────────────
function FaqItem({ q, a, delay = 0, accent = GOLD }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal i={delay}>
      <div className="al-card" style={{ padding: 0, overflow: "hidden" }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer",
            padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
            color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.2px" }}>
          {q}
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
export default function AboutLanding({ initialRole = null, user = null, onStart, onDashboard }) {
  const [role, setRole] = useState(() => initialRole || getRoleCookie() || "parent");
  const accent = role === "student" ? PURPLE : GOLD;

  const changeRole = useCallback((r) => {
    setRole(r);
    setRoleCookie(r);
    try { window.history.replaceState(null, "", r === "student" ? "/landing/students" : "/landing/parents"); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => { setRoleCookie(role); }, []); // запомнить стартовую роль

  const cta = user ? onDashboard : onStart;

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: BG, color: "#fff", minHeight: "100vh", overflowX: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .al-btn-primary{background:linear-gradient(135deg,${GOLD},#f59e0b);color:#0a0e1a;border:none;padding:16px 32px;border-radius:14px;font-family:'Inter',sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:transform .2s,box-shadow .2s;letter-spacing:.2px;}
        .al-btn-primary:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(212,175,55,.38);}
        .al-btn-ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.25);padding:11px 22px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;transition:.2s;font-family:'Inter',sans-serif;}
        .al-btn-ghost:hover{background:rgba(255,255,255,.07);}
        .al-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:28px 26px;transition:border-color .25s,box-shadow .25s;}
        .al-card:hover{border-color:rgba(255,255,255,.18);}
        .al-feature:hover{border-color:rgba(255,255,255,.22);box-shadow:0 24px 60px rgba(0,0,0,.45);}
        .al-nav{position:sticky;top:0;z-index:100;background:rgba(10,10,20,.82);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.07);padding:0 32px;min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        @media(max-width:880px){
          .al-grid-2,.al-grid-3,.al-grid-4{grid-template-columns:1fr!important;}
          .al-perks{grid-template-columns:1fr!important;}
          .al-nav{padding:12px 18px;min-height:0;}
          .al-nav-trust{display:none!important;}
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
        {/* ШАПКА */}
        <nav className="al-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Logo size={32} light />
            <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)" }} className="al-nav-trust" />
            <div className="al-nav-trust"><TrustAnchor /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <RoleToggle role={role} onChange={changeRole} />
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
