import React, { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * DemoResultScreen — «Твой персональный план» после мини-диагностики.
 * Показывает счёт, сильные/слабые темы, упрощённую карту навыков (псевдо-данные)
 * и CTA на регистрацию. Не требует авторизации.
 *
 * Props:
 *  - result: {correctCount, total, weakTopics[], strongTopics[]} | null
 *  - onRegister: переход к регистрации (EmailAuthScreen from=demo)
 *  - onRestart:  пройти демо заново
 *  - onExit:     вернуться на лендинг
 */

const GOLD = "#d4af37";
const PURPLE = "#a78bfa";
const BG = "#0a0a14";
const GREEN = "#34d399";
const RED = "#f87171";
const ease = [0.16, 1, 0.3, 1];

function getRoleAccent() {
  try { const m = document.cookie.match(/aapa_role=(parent|student)/); return m && m[1] === "parent" ? GOLD : PURPLE; }
  catch { return PURPLE; }
}

// упрощённая «карта навыков»: 30 узлов, цвет по псевдо-уровню + подсветка тем демо
function MiniSkillMap({ accent, weakCount, strongCount }) {
  const NODES = 30;
  const tiles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < NODES; i++) {
      let kind = "locked";
      if (i < strongCount) kind = "mastered";
      else if (i >= NODES - weakCount) kind = "weak";
      else if (i % 3 === 0) kind = "progress";
      arr.push(kind);
    }
    return arr;
  }, [weakCount, strongCount]);

  const color = (k) => k === "mastered" ? GREEN : k === "weak" ? RED : k === "progress" ? accent : "rgba(255,255,255,0.12)";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 9, maxWidth: 360, margin: "0 auto" }} className="dr-map">
        {tiles.map((k, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.012, duration: 0.3, ease }}
            style={{ aspectRatio: "1", borderRadius: 7, background: color(k),
              boxShadow: k !== "locked" ? `0 0 12px ${color(k)}55` : "none" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", marginTop: 18, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
        {[["Освоено", GREEN], ["В процессе", accent], ["Пробел", RED], ["Закрыто", "rgba(255,255,255,0.18)"]].map(([l, c]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, background: c, display: "inline-block" }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function Chips({ items, color, empty }) {
  if (!items || !items.length) return <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>{empty}</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((t) => (
        <span key={t} style={{ background: `${color}1a`, border: `1px solid ${color}55`, color, fontSize: 13.5, fontWeight: 700, padding: "6px 14px", borderRadius: 99 }}>{t}</span>
      ))}
    </div>
  );
}

const Card = ({ children, style, i = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.6, ease }}
    style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, padding: "26px 24px", ...style }}>
    {children}
  </motion.div>
);

export default function DemoResultScreen({ result, onRegister, onRestart, onExit }) {
  const accent = useMemo(getRoleAccent, []);

  // нет результата (прямой заход/обновление) — предложить пройти демо
  if (!result || typeof result.correctCount !== "number") {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Демо ещё не пройдено</div>
          <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>Пройди мини-диагностику из 5 задач — это займёт пару минут.</p>
          <button onClick={onRestart} style={{ border: "none", borderRadius: 14, padding: "15px 30px", fontSize: 16, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "'Inter',sans-serif", background: `linear-gradient(135deg,${accent},#7c3aed)` }}>Пройти диагностику →</button>
        </div>
      </div>
    );
  }

  const { correctCount, total, weakTopics = [], strongTopics = [] } = result;
  const pct = Math.round((correctCount / total) * 100);
  const verdict = pct >= 80 ? "Сильный старт! Видно крепкую базу."
    : pct >= 40 ? "Хорошая база — и есть что подтянуть."
    : "Нашли пробелы — это уже половина успеха.";

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter',sans-serif", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @media(max-width:560px){ .dr-grid2{grid-template-columns:1fr!important;} }
      `}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: 560, height: 560, borderRadius: "50%", background: `radial-gradient(circle,${accent}22 0%,transparent 70%)` }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "clamp(40px,8vw,72px) 22px 60px" }}>
        {/* заголовок + счёт */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} style={{ textAlign: "center", marginBottom: 36 }}>
          <span style={{ background: `${accent}1f`, border: `1px solid ${accent}45`, color: accent, fontSize: 12, fontWeight: 800, padding: "6px 16px", borderRadius: 99, letterSpacing: "1px", textTransform: "uppercase" }}>Твой персональный план</span>
          <h1 style={{ fontSize: "clamp(30px,6vw,50px)", fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.05, margin: "20px 0 16px" }}>
            Решено правильно <span style={{ color: accent }}>{correctCount} из {total}</span>
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>{verdict}</p>
        </motion.div>

        {/* сильные / слабые */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="dr-grid2">
          <Card i={1}>
            <div style={{ fontSize: 14, fontWeight: 800, color: GREEN, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>✓ Сильные стороны</div>
            <Chips items={strongTopics} color={GREEN} empty="Пока без идеально решённых тем — потренируемся." />
          </Card>
          <Card i={2}>
            <div style={{ fontSize: 14, fontWeight: 800, color: RED, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>◎ Над чем поработать</div>
            <Chips items={weakTopics} color={RED} empty="Ошибок не было — отличный результат!" />
          </Card>
        </div>

        {/* мини-карта навыков */}
        <Card i={3} style={{ marginBottom: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 6 }}>Карта навыков</div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>Это лишь фрагмент — в программе <strong style={{ color: "#fff" }}>307 навыков</strong> 5–11 класса</p>
          </div>
          <MiniSkillMap accent={accent} weakCount={Math.max(weakTopics.length, 1)} strongCount={Math.max(strongTopics.length, 1)} />
        </Card>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.6, ease }}
          style={{ borderRadius: 22, border: `2px solid ${accent}`, background: `linear-gradient(160deg,${accent}16,transparent)`, padding: "clamp(28px,5vw,40px) clamp(22px,4vw,36px)", textAlign: "center", marginTop: 8 }}>
          <div style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, letterSpacing: "-0.6px", lineHeight: 1.2, marginBottom: 12 }}>
            <span style={{ color: accent }}>307 навыков</span> программы — твой персональный маршрут по уровню и пробелам
          </div>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 26px" }}>
            Зарегистрируйся — сохраним результаты этой диагностики, подсветим пробелы и построим персональный маршрут.
          </p>
          <button onClick={onRegister}
            style={{ width: "100%", maxWidth: 420, border: "none", borderRadius: 14, padding: "17px 32px", fontSize: 17, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "'Inter',sans-serif", background: `linear-gradient(135deg,${accent},#7c3aed)`, boxShadow: `0 14px 36px ${accent}38` }}>
            Зарегистрироваться и получить план →
          </button>
          <div style={{ marginTop: 18, display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onRestart} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif", textDecoration: "underline" }}>Пройти ещё раз</button>
            <button onClick={onExit} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif", textDecoration: "underline" }}>На главную</button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
