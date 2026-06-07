import React, { useState, useEffect } from "react";
import { doc, getDoc, db } from "../firestore-rest.js";
import { useTheme } from "../ThemeContext.jsx";
import { DAILY_QUESTS, WEEKLY_QUESTS } from "../lib/quests.js";
import { updateQuestProgress } from "../lib/questsUtils.js";
import { getMyWeeklyRank, getMondayUtcIso } from "../lib/pointsUtils.js";
import { getAlmatyNextMidnightAfter } from "../lib/srsUtils.js";
import InfoTooltip from "./InfoTooltip.jsx";

const fmtDaily = (ms) => {
  if (ms <= 0) return "0м";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
};
const fmtWeekly = (ms) => {
  if (ms <= 0) return "0ч";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} дн` : `${h}ч`;
};

// starterGate: онбординг-этап «starter» — задания недели скрыты, пока не
// выполнено хотя бы одно задание дня (новичка не грузим длинным списком).
// mockQuests: DEBUG-режим дашборда ({daily, weekly}) — без Firestore-фетча.
export default function QuestsWidget({ user, onUpdateUser, starterGate = false, mockQuests = null }) {
  const { theme: THEME } = useTheme();
  const uid = user?.uid || user?.id;
  const [daily, setDaily] = useState(null);   // users/{uid}.dailyQuests
  const [weekly, setWeekly] = useState(null);  // users/{uid}.weeklyQuests
  const [now, setNow] = useState(Date.now());

  // ── Загрузка прогресса + проверка квеста «топ 50%» ──────────────────────────
  useEffect(() => {
    if (mockQuests) { setDaily(mockQuests.daily || {}); setWeekly(mockQuests.weekly || {}); return; } // DEBUG-мок
    if (!uid) return;
    let cancelled = false;
    const load = async () => {
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists() ? snap.data() : {};
    };
    (async () => {
      try {
        const data = await load();
        if (cancelled) return;
        setDaily(data.dailyQuests || null);
        setWeekly(data.weeklyQuests || null);

        // weekly_top50 — проверка ранга (не событие). Считаем тут.
        const wq = data.weeklyQuests || {};
        if (!wq.weekly_top50?.completed) {
          const rank = await getMyWeeklyRank(uid, user?.details, user?.region);
          if (cancelled) return;
          const total = rank?.globalTotal || 0;
          const g = rank?.globalRank || 0;
          if (total > 0 && g > 0 && g <= Math.ceil(total / 2)) {
            await updateQuestProgress(uid, "ranking_top50", 1, user);
            const fresh = await load();
            if (cancelled) return;
            setDaily(fresh.dailyQuests || null);
            setWeekly(fresh.weeklyQuests || null);
            onUpdateUser?.({ ...user, crystals: fresh.crystals ?? user?.crystals, dailyQuests: fresh.dailyQuests, weeklyQuests: fresh.weeklyQuests });
          }
        }
      } catch (e) { console.warn("[quests] widget load:", e?.message || e); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // ── Таймер сброса — раз в минуту ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!uid) return null;

  const dailyResetMs  = getAlmatyNextMidnightAfter(new Date(now)).getTime() - now;
  const nextMondayMs  = new Date(getMondayUtcIso(new Date(now))).getTime() + 7 * 86400000 - now;

  const get = (bucket, id) => bucket?.[id] || { progress: 0, completed: false };
  const countDone = (defs, bucket) => defs.filter(q => get(bucket, q.id).completed).length;

  const Row = ({ q, st }) => {
    const partial = q.target > 1 && !st.completed;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
        opacity: st.completed ? 0.5 : 1,
      }}>
        <span style={{ fontSize: 17, width: 22, textAlign: "center", flexShrink: 0 }}>
          {st.completed ? "✅" : "☐"}
        </span>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{q.icon}</span>
        <span style={{
          flex: 1, fontSize: 13.5, fontWeight: 600, color: THEME.text,
          textDecoration: st.completed ? "line-through" : "none", minWidth: 0,
        }}>
          {q.title}
          {partial && (
            <span style={{ color: THEME.textLight, fontWeight: 700, marginLeft: 6 }}>
              [{st.progress}/{q.target}]
            </span>
          )}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0,
          color: st.completed ? THEME.textLight : "#a78bfa",
        }}>
          +{q.crystals} 💎{st.completed ? " ✓" : ""}
        </span>
      </div>
    );
  };

  const Bar = ({ done, total }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${total ? Math.round((done / total) * 100) : 0}%`,
          background: `linear-gradient(90deg, ${THEME.accent}, #f59e0b)`,
          borderRadius: 99, transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: THEME.textLight, whiteSpace: "nowrap" }}>
        {done}/{total}
      </span>
    </div>
  );

  const SectionHeader = ({ title, reset }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 13, color: THEME.text }}>{title}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textLight }}>{reset}</div>
    </div>
  );

  const dailyDone  = countDone(DAILY_QUESTS, daily);
  const weeklyDone = countDone(WEEKLY_QUESTS, weekly);

  return (
    <div className="dashboard-section" style={{ marginBottom: 0, padding: "22px 24px", flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <SectionHeader title={<>📋 Задания дня<InfoTooltip text="Выполняй задания дня и недели — получай кристаллы. Дневные сбрасываются каждый день, недельные — в понедельник." /></>} reset={`Сброс через ${fmtDaily(dailyResetMs)}`} />
        {DAILY_QUESTS.map(q => <Row key={q.id} q={q} st={get(daily, q.id)} />)}
        <Bar done={dailyDone} total={DAILY_QUESTS.length} />
      </div>

      {!(starterGate && dailyDone === 0) ? (
        <>
          <div style={{ height: 1, background: THEME.border, margin: "16px 0" }} />
          <div>
            <SectionHeader title="📅 Задания недели" reset={`Сброс через ${fmtWeekly(nextMondayMs)}`} />
            {WEEKLY_QUESTS.map(q => <Row key={q.id} q={q} st={get(weekly, q.id)} />)}
            <Bar done={weeklyDone} total={WEEKLY_QUESTS.length} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: THEME.textLight, marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔓</span> Выполни первое задание дня — откроются задания недели
        </div>
      )}
    </div>
  );
}
