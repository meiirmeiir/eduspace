import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/ui/Logo.jsx";

// Видео-заготовки (Vite импортирует mp4 → URL). Лежат в assets/marketing/videos/.
import diagnosticVid from "../../assets/marketing/videos/diagnostic.mp4";
import skillMapVid from "../../assets/marketing/videos/skill-map.mp4";
import leaderboardVid from "../../assets/marketing/videos/leaderboard.mp4";
import progressVid from "../../assets/marketing/videos/progress.mp4";

/**
 * AboutLanding — тёмный аниме-лендинг AAPA с переключателем «Я родитель / Я ученик».
 * Контент разный для двух ролей, дизайн общий. Выбор роли запоминается в cookie.
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

const GOLD = "#d4af37";
const PURPLE = "#a78bfa";

// ── переиспользуемые анимации framer-motion ───────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] } }),
};
const Reveal = ({ children, i = 0, style, className }) => (
  <motion.div variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} style={style} className={className}>
    {children}
  </motion.div>
);

// ── встроенное видео (autoplay, без звука, в рамке) ────────────────────────────
function VideoFrame({ src, label, accent = GOLD, maxW = 300 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "relative", maxWidth: maxW, margin: "0 auto", borderRadius: 22, overflow: "hidden",
        border: `1px solid ${accent}40`, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${accent}22` }}
    >
      <video src={src} autoPlay muted loop playsInline preload="metadata"
        style={{ display: "block", width: "100%", height: "auto", background: "#0a0e1a" }} />
      {label && (
        <div style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(7,11,22,0.78)", backdropFilter: "blur(6px)",
          border: `1px solid ${accent}55`, color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 99 }}>
          {label}
        </div>
      )}
    </motion.div>
  );
}

// ── переключатель ролей ────────────────────────────────────────────────────────
function RoleToggle({ role, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
      <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 99, padding: 4, position: "relative" }}>
        {[{ k: "parent", t: "Я родитель" }, { k: "student", t: "Я ученик" }].map((o) => {
          const active = role === o.k;
          return (
            <button key={o.k} onClick={() => onChange(o.k)}
              style={{ position: "relative", zIndex: 1, border: "none", cursor: "pointer", background: "transparent",
                color: active ? "#0a0e1a" : "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 13, padding: "7px 16px",
                borderRadius: 99, fontFamily: "'Inter',sans-serif", transition: "color 0.25s" }}>
              {active && (
                <motion.span layoutId="role-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg,${GOLD},#f59e0b)`, borderRadius: 99, zIndex: -1 }} />
              )}
              {o.t}
            </button>
          );
        })}
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)" }}>Мы показываем разное родителям и ученикам</span>
    </div>
  );
}

// ── секция-обёртка ─────────────────────────────────────────────────────────────
const Section = ({ children, bg = "transparent", style }) => (
  <section style={{ padding: "84px 24px", background: bg, position: "relative", ...style }}>
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>{children}</div>
  </section>
);
const Eyebrow = ({ children, color = GOLD }) => (
  <span style={{ background: `${color}22`, border: `1px solid ${color}45`, color, fontSize: 11, fontWeight: 800,
    padding: "5px 16px", borderRadius: 99, display: "inline-block", marginBottom: 14, letterSpacing: "0.8px" }}>{children}</span>
);
const H2 = ({ children, style }) => (
  <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1.18, letterSpacing: "-0.5px", margin: "0 0 12px", ...style }}>{children}</h2>
);

// ── якорь доверия ──────────────────────────────────────────────────────────────
function TrustAnchor({ compact }) {
  const items = [["1600", "задач"], ["307", "навыков"], ["5–11", "класс по школьной программе"]];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: compact ? 14 : 22, flexWrap: "wrap", justifyContent: "center" }}>
      {items.map(([n, l], i) => (
        <React.Fragment key={l}>
          {i > 0 && <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>}
          <span style={{ fontSize: compact ? 12 : 13, color: "rgba(255,255,255,0.55)" }}>
            <strong style={{ color: GOLD, fontWeight: 800 }}>{n}</strong> {l}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ЛЕНДИНГ ДЛЯ РОДИТЕЛЯ
// ══════════════════════════════════════════════════════════════════════════════
function ParentLanding({ onCta }) {
  const pains = [
    { icon: "💸", t: "Репетитор — 5000 ₸/час", s: "8 000–20 000 ₸ в месяц за пару занятий" },
    { icon: "🏫", t: "Школа не даёт практики", s: "30 человек в классе, нет времени на каждого" },
    { icon: "🌫️", t: "Не знаете слабые места", s: "«Тройка по алгебре» — а что именно западает?" },
  ];
  const parentSees = [
    { icon: "📈", t: "Еженедельный отчёт", s: "Что ребёнок прошёл, сколько навыков освоил, где застрял — на почту раз в неделю." },
    { icon: "🎯", t: "Слабые места по темам", s: "Конкретные навыки в красной зоне, а не размытая оценка. Видно, на что тратить время." },
    { icon: "🛡️", t: "Безопасная среда", s: "Без AI-чатов, без общения с незнакомцами, без рекламы. Только обучение." },
  ];
  const faqs = [
    { q: "Это замена репетитору?", a: "Для большинства тем — да. Система находит пробелы точнее, чем репетитор за первые занятия, и ребёнок тренируется столько, сколько нужно. Для форсированной подготовки к экзамену можно сочетать." },
    { q: "Ребёнок не будет просто играть?", a: "Геймификация — это обёртка над реальными задачами по школьной программе. Награды даются за решённые навыки, а не за «время в приложении». Прогресс вы видите в отчёте." },
    { q: "С какого класса подходит?", a: "5–11 класс, по школьной программе Казахстана. Система сама определяет уровень ребёнка через диагностику и подбирает задачи." },
    { q: "Что если не понравится?", a: "Первая диагностика и старт — бесплатно. Подписка 2000 ₸/мес, отменить можно в любой момент. Без скрытых платежей." },
  ];
  return (
    <>
      {/* HERO */}
      <Section style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="al-grid-2">
          <Reveal>
            <Eyebrow>ДЛЯ РОДИТЕЛЕЙ · МАТЕМАТИКА 5–11</Eyebrow>
            <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: 46, fontWeight: 800, color: "#fff", lineHeight: 1.08, letterSpacing: "-1.5px", margin: "0 0 18px" }}>
              Готовьте ребёнка к школе <span style={{ color: GOLD }}>уверенно.</span>
            </h1>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: "0 0 14px" }}>
              <strong style={{ color: "#fff" }}>2000 ₸/мес</strong> — дешевле одного часа репетитора. Платформа находит слабые места и ведёт ребёнка по точному маршруту.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }} className="al-hero-btns">
              <button className="al-btn-primary" onClick={onCta}>Дайте ребёнку попробовать бесплатно →</button>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 14 }}>Первая диагностика бесплатно · Без банковской карты</p>
          </Reveal>
          <VideoFrame src={diagnosticVid} label="🔬 Умная диагностика" maxW={300} />
        </div>
      </Section>

      {/* БОЛЬ */}
      <Section bg="rgba(255,255,255,0.015)">
        <Reveal><div style={{ textAlign: "center", marginBottom: 40 }}><Eyebrow color="#f87171">ЗНАКОМО?</Eyebrow><H2>Подготовка по математике — это дорого и непонятно</H2></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="al-grid-3">
          {pains.map((p, i) => (
            <Reveal key={p.t} i={i}>
              <div className="al-card" style={{ height: "100%" }}>
                <div style={{ fontSize: 30, marginBottom: 12 }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 6 }}>{p.t}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{p.s}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* РЕШЕНИЕ С ЦИФРАМИ */}
      <Section>
        <Reveal><div style={{ textAlign: "center", marginBottom: 40 }}><Eyebrow>РЕШЕНИЕ</Eyebrow><H2>Целая система вместо разовых занятий</H2></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="al-grid-3">
          {[["1600", "задач по школьной программе"], ["307", "навыков с отслеживанием прогресса"], ["5–11", "класс — уровень подбирается автоматически"]].map(([n, l], i) => (
            <Reveal key={l} i={i}>
              <div className="al-card" style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 44, fontWeight: 800, color: GOLD, lineHeight: 1, marginBottom: 8 }}>{n}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ЧТО УВИДИТЕ ВЫ */}
      <Section bg="rgba(255,255,255,0.015)">
        <Reveal><div style={{ textAlign: "center", marginBottom: 40 }}><Eyebrow color="#34d399">КОНТРОЛЬ</Eyebrow><H2>Что увидите <span style={{ color: GOLD }}>вы</span></H2></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="al-grid-3">
          {parentSees.map((p, i) => (
            <Reveal key={p.t} i={i}>
              <div className="al-card" style={{ height: "100%" }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 8 }}>{p.t}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>{p.s}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ЧТО УВИДИТ РЕБЁНОК */}
      <Section>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", marginBottom: 36 }} className="al-grid-2">
          <Reveal>
            <Eyebrow color={PURPLE}>МОТИВАЦИЯ</Eyebrow>
            <H2>Что увидит ваш <span style={{ color: PURPLE }}>ребёнок</span></H2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, margin: "0 0 16px" }}>
              Дети не учатся по принуждению. Мы используем элементы геймификации — <strong style={{ color: "#fff" }}>серии дней, прогресс по уровням, награды</strong>. Ребёнок <strong style={{ color: PURPLE }}>сам хочет</strong> заходить в приложение.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Карта-приключение вместо скучного списка тем", "Кристаллы и достижения за реальные навыки", "Соревнование с друзьями подстёгивает заниматься"].map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ color: PURPLE, fontWeight: 700 }}>✓</span>{t}
                </div>
              ))}
            </div>
          </Reveal>
          <VideoFrame src={progressVid} label="🚀 Прогресс как сборка корабля" accent={PURPLE} maxW={290} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="al-grid-2">
          <VideoFrame src={leaderboardVid} label="🏆 Лидерборд с друзьями" maxW={340} />
          <VideoFrame src={skillMapVid} label="🗺️ Карта навыков" accent={PURPLE} maxW={340} />
        </div>
      </Section>

      {/* ЦЕНА */}
      <Section bg="rgba(255,255,255,0.015)">
        <Reveal>
          <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            <div className="al-card" style={{ border: `2px solid ${GOLD}`, background: `linear-gradient(160deg,${GOLD}14,transparent)`, padding: "40px 36px" }}>
              <Eyebrow>ПРОСТАЯ ПОДПИСКА</Eyebrow>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, margin: "8px 0 6px" }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 56, fontWeight: 800, color: GOLD }}>2000</span>
                <span style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>₸ / мес</span>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: "0 0 22px" }}>
                Полный доступ: диагностика, теория, 1600 задач, прогресс, отчёты. <strong style={{ color: "#fff" }}>Без скрытых платежей.</strong>
              </p>
              <button className="al-btn-primary" onClick={onCta} style={{ width: "100%" }}>Дайте ребёнку попробовать бесплатно →</button>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 12 }}>Отменить можно в любой момент</p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* FAQ */}
      <Section>
        <Reveal><div style={{ textAlign: "center", marginBottom: 36 }}><Eyebrow>ВОПРОСЫ РОДИТЕЛЕЙ</Eyebrow><H2>Частые вопросы</H2></div></Reveal>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map((f, i) => <FaqItem key={i} {...f} delay={i} />)}
        </div>
      </Section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ЛЕНДИНГ ДЛЯ УЧЕНИКА
// ══════════════════════════════════════════════════════════════════════════════
function StudentLanding({ onCta }) {
  const features = [
    { icon: "🗺️", t: "Карта мира с навыками", s: "Изучай в любом порядке — открывай новые планеты-навыки." },
    { icon: "💎", t: "Кристаллы, ачивки, серии", s: "Награды за каждый освоенный навык и серию дней подряд." },
    { icon: "🏆", t: "Соревнуйся с друзьями", s: "Лидерборд по очкам, лигам и областям. Подиум топ-3." },
    { icon: "🤖", t: "NPC-гид по сюжету", s: "Помощник ведёт тебя по приключению и подсказывает." },
    { icon: "🎨", t: "Кастомизация аватара", s: "Снаряжение, рамки, титулы — собери свой образ." },
    { icon: "🔬", t: "Умная диагностика", s: "Система находит твои пробелы и строит точный маршрут." },
  ];
  return (
    <>
      {/* HERO */}
      <Section style={{ paddingTop: 64, paddingBottom: 56 }}>
        <div style={{ textAlign: "center" }}>
          <Reveal>
            <Eyebrow color={PURPLE}>ДЛЯ УЧЕНИКОВ · МАТЕМАТИКА</Eyebrow>
            <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1.05, letterSpacing: "-2px", margin: "0 0 18px" }}>
              Прокачай свою <span style={{ color: PURPLE }}>математику</span>
            </h1>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 30px" }}>
              Не учебник, а приключение. Карта навыков, кристаллы, лидерборд и NPC-гид — учись так, как будто играешь.
            </p>
          </Reveal>
          <VideoFrame src={skillMapVid} label="🗺️ Живая карта навыков" accent={PURPLE} maxW={320} />
          <Reveal i={2}>
            <div style={{ marginTop: 30 }}>
              <button className="al-btn-primary" onClick={onCta} style={{ background: `linear-gradient(135deg,${PURPLE},#7c3aed)`, color: "#fff" }}>Начать своё приключение →</button>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ФИЧИ */}
      <Section bg="rgba(255,255,255,0.015)">
        <Reveal><div style={{ textAlign: "center", marginBottom: 40 }}><Eyebrow color={PURPLE}>ЧТО ВНУТРИ</Eyebrow><H2>Твой путь героя математики</H2></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="al-grid-3">
          {features.map((f, i) => (
            <motion.div key={f.t} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="al-card" style={{ height: "100%" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 6 }}>{f.t}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{f.s}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ДЕМО */}
      <Section>
        <Reveal>
          <div className="al-card" style={{ textAlign: "center", maxWidth: 620, margin: "0 auto", border: `1px solid ${PURPLE}45`, background: `linear-gradient(160deg,${PURPLE}12,transparent)` }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>⚡</div>
            <H2 style={{ fontSize: 26 }}>Попробуй прямо сейчас</H2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: "0 0 22px" }}>
              5 задач из мини-диагностики — без регистрации. Узнай свой уровень за пару минут.
            </p>
            <button className="al-btn-primary" onClick={onCta} style={{ background: `linear-gradient(135deg,${PURPLE},#7c3aed)`, color: "#fff" }}>Решить 5 задач →</button>
          </div>
        </Reveal>
      </Section>

      {/* СОЦ-ДОКАЗАТЕЛЬСТВО */}
      <Section bg="rgba(255,255,255,0.015)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="al-grid-2">
          <Reveal>
            <Eyebrow>СООБЩЕСТВО</Eyebrow>
            <H2>Уже <span style={{ color: GOLD }}>50+ учеников</span> проходят свой путь</H2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, margin: "0 0 20px" }}>
              Поднимайся в лигах от Бронзы до Алмаза, попадай на подиум недели и обгоняй друзей. Каждый навык — шаг к вершине рейтинга.
            </p>
            <button className="al-btn-primary" onClick={onCta} style={{ background: `linear-gradient(135deg,${PURPLE},#7c3aed)`, color: "#fff" }}>Начать своё приключение →</button>
          </Reveal>
          <VideoFrame src={leaderboardVid} label="🏆 Рейтинг и подиум" maxW={340} />
        </div>
      </Section>
    </>
  );
}

// ── FAQ-айтем (раскрывающийся) ─────────────────────────────────────────────────
function FaqItem({ q, a, delay = 0 }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal i={delay}>
      <div className="al-card" style={{ padding: 0, overflow: "hidden" }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer",
            padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "'Inter',sans-serif" }}>
          {q}
          <motion.span animate={{ rotate: open ? 45 : 0 }} style={{ color: GOLD, fontSize: 20, flexShrink: 0 }}>+</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
              <p style={{ padding: "0 22px 20px", fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: 0 }}>{a}</p>
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

  const changeRole = useCallback((r) => {
    setRole(r);
    setRoleCookie(r);
    try { window.history.replaceState(null, "", r === "student" ? "/landing/students" : "/landing/parents"); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => { setRoleCookie(role); }, []); // запомнить стартовую роль

  const cta = user ? onDashboard : onStart;

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "#070b16", color: "#fff", minHeight: "100vh", overflowX: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .al-btn-primary{background:linear-gradient(135deg,${GOLD},#f59e0b);color:#0a0e1a;border:none;padding:15px 30px;border-radius:12px;font-family:'Inter',sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:transform .2s,box-shadow .2s;letter-spacing:.2px;}
        .al-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(212,175,55,.4);}
        .al-btn-ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.25);padding:10px 20px;border-radius:11px;font-weight:600;font-size:14px;cursor:pointer;transition:.2s;font-family:'Inter',sans-serif;}
        .al-btn-ghost:hover{background:rgba(255,255,255,.07);}
        .al-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:24px 22px;transition:border-color .2s;}
        .al-card:hover{border-color:rgba(255,255,255,.18);}
        .al-nav{position:sticky;top:0;z-index:100;background:rgba(7,11,22,.82);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.07);padding:0 32px;min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        @media(max-width:820px){
          .al-grid-2,.al-grid-3{grid-template-columns:1fr!important;}
          .al-nav{padding:10px 18px;min-height:0;}
        }
      `}</style>

      {/* фоновые свечения */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "-15%", width: 620, height: 620, borderRadius: "50%", background: `radial-gradient(circle,${role === "student" ? PURPLE : GOLD}1f 0%,transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,#1e3a8a22 0%,transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ШАПКА */}
        <nav className="al-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Logo size={30} light />
            <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.12)" }} className="al-divider" />
            <TrustAnchor compact />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <RoleToggle role={role} onChange={changeRole} />
            {user ? (
              <button className="al-btn-primary" style={{ padding: "9px 20px", fontSize: 14 }} onClick={onDashboard}>Войти в кабинет →</button>
            ) : (
              <button className="al-btn-ghost" onClick={onStart}>Войти</button>
            )}
          </div>
        </nav>

        {/* КОНТЕНТ ПО РОЛИ */}
        <AnimatePresence mode="wait">
          <motion.div key={role} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            {role === "student" ? <StudentLanding onCta={cta} /> : <ParentLanding onCta={cta} />}
          </motion.div>
        </AnimatePresence>

        {/* ФУТЕР */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "32px 32px", marginTop: 20 }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18 }}>
            <div>
              <Logo size={26} light />
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, margin: "10px 0 0" }}>© 2026 AAPA — Ad Astra Per Aspera</p>
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13 }}>
              <a href="https://wa.me/77000000000" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>💬 WhatsApp</a>
              <a href="mailto:hello@aapa.kz" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>✉️ hello@aapa.kz</a>
              <a href="/about#terms" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Условия использования</a>
              <a href="/about#privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Конфиденциальность</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
