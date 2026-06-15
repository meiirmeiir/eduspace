// Дашборд по ребёнку (Шаг 6, редизайн) — под-вью ParentScreen. READ-ONLY.
// Блоки: шапка (publicProfiles+уровень) · сводка (overallPct+сегменты из
// buildDiagModuleTree) · награды (medals/achievements) · над чем работать+сильные
// (passRate из by_vertical) · по темам (вертикали) · детали (категории навыков).
// Доступ к данным ребёнка открыт rules Шага 4; medals/achievements read:isSignedIn.
import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, getDocs, collection, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { fetchFriendProfiles } from "../lib/friendsUtils.js";
import { buildDiagModuleTree } from "./diagTree/DiagnosticModuleTree.jsx";
import { getLevelInfo } from "../lib/levelUtils.js";
import { ACHIEVEMENTS } from "../lib/achievements.js";
import { getWeekId } from "../lib/pointsUtils.js";
import { computeVerdict } from "../lib/parentVerdict.js";

// Тёмная космо-палитра (родительский дашборд — всегда тёмный, в духе карты).
const C = {
  bg: "#0d1224", card: "#141a2e", cardHi: "#1a2236", border: "rgba(255,255,255,0.08)",
  text: "#e6edf3", dim: "rgba(230,237,243,0.58)", gold: "#d4af37",
  green: "#22c55e", yellow: "#f59e0b", red: "#ef4444", blue: "#6366f1", gray: "#64748b",
};
const VERTICAL_NAMES = {
  ALGEBRA: "Алгебра", GEOMETRY: "Геометрия", NUMBERS: "Числа", FUNCTIONS: "Функции",
  PROBABILITY: "Вероятность", TRIGONOMETRY: "Тригонометрия", CALCULUS: "Анализ", STATISTICS: "Статистика",
};
const vName = v => VERTICAL_NAMES[v] || (v ? v[0] + v.slice(1).toLowerCase() : "Тема");
const humanizeSkillId = id => !id ? "Навык" : String(id).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const MEDAL_COLOR = { gold: "#fbbf24", silver: "#cbd5e1", bronze: "#cd7f32" };

function Avatar({ p, size = 56 }) {
  const initials = ((p?.firstName?.[0] || "") + (p?.lastName?.[0] || "")).toUpperCase() || "?";
  const base = { width: size, height: size, borderRadius: "50%", border: `2px solid ${C.gold}`, flexShrink: 0 };
  return p?.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ ...base, objectFit: "cover", display: "block" }} />
    : <div style={{ ...base, background: "linear-gradient(135deg,#6366f1,#a78bfa)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: size * 0.34 }}>{initials}</div>;
}

const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 28px -10px rgba(0,0,0,0.5)" };

export default function ChildReport({ childUid }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [d, setD] = useState(null);

  useEffect(() => {
    if (!childUid) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(false);
      try {
        // Очки за неделю — из leaderboard (ключ по неделе; publicProfiles.weekPoints
        // сбрасывается лениво → ложно «активен» забросившему).
        const thisWeekId = getWeekId();
        const lastWeekId = getWeekId(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const [planSnap, masterySnap, progressSnap, cg, hier, profMap, medalSnap, achSnap, lbThis, lbLast] = await Promise.all([
          getDoc(doc(db, "individualPlans", childUid)),
          getDoc(doc(db, "skillMastery", childUid)),
          getDoc(doc(db, "skillProgress", childUid)),
          getContent("crossGradeLinks"),
          getContent("skillHierarchies"),
          fetchFriendProfiles([childUid]),
          getDocs(collection(db, `users/${childUid}/medals`)),
          getDocs(collection(db, `users/${childUid}/achievements`)),
          getDoc(doc(db, "leaderboard", thisWeekId, "entries", childUid)),
          getDoc(doc(db, "leaderboard", lastWeekId, "entries", childUid)),
        ]);
        if (cancelled) return;
        const thisWeekPoints = lbThis.exists() ? Number(lbThis.data()?.points || 0) : 0;
        const lastWeekPoints = lbLast.exists() ? Number(lbLast.data()?.points || 0) : 0;

        const namesMap = {};
        (hier || []).forEach(h => (h.clusters || []).forEach(cl =>
          (cl.pivot_skills || []).forEach(ps => { if (ps.skill_id && ps.skill_name) namesMap[ps.skill_id] = ps.skill_name; })));
        const nameOf = id => namesMap[id] || humanizeSkillId(id);

        const plan = planSnap.exists() ? planSnap.data() : null;
        const mastery = masterySnap.exists() ? (masterySnap.data()?.skills || {}) : {};
        const skillProgress = progressSnap.exists() ? (progressSnap.data()?.skills || {}) : {};
        const profile = profMap?.[childUid] || {};

        // Сводка из карты модулей
        const diag = plan ? buildDiagModuleTree(plan, skillProgress, cg || [], namesMap, mastery) : { modules: [] };
        const mods = diag.modules || [];
        const seg = {
          mastered: mods.filter(m => m.mastery >= 100).length,
          inProgress: mods.filter(m => !m.isLocked && m.mastery > 0 && m.mastery < 100).length,
          available: mods.filter(m => !m.isLocked && m.mastery === 0).length,
          locked: mods.filter(m => m.isLocked && m.mastery < 100).length,
        };
        const overallPct = mods.length ? Math.round(mods.reduce((s, m) => s + Math.min(m.mastery || 0, 100), 0) / mods.length) : 0;

        // by_vertical: vertical -> [{id, passRate}]; passRate = диагностика
        const byVert = {}; // vertical -> [{id, passRate, name, stages}]
        const allSkills = [];
        (plan?.modules || []).forEach(m => {
          const bv = m?.by_vertical || {};
          Object.entries(bv).forEach(([vert, arr]) => {
            (arr || []).forEach(sk => {
              const id = sk?.id; if (!id) return;
              const stages = Number(mastery[id]?.stagesCompleted || 0);
              const row = { id, name: nameOf(id), passRate: Number(sk?.passRate ?? 0), stages };
              (byVert[vert] = byVert[vert] || []).push(row);
              allSkills.push(row);
            });
          });
        });
        // Сильные/слабые по passRate (не зоны — зоны пусты до запуска)
        const ranked = [...allSkills].sort((a, b) => a.passRate - b.passRate);
        const weak = ranked.filter(s => s.passRate < 60).slice(0, 4);
        const strong = [...ranked].reverse().filter(s => s.passRate >= 70).slice(0, 4);
        // По темам: вертикаль -> освоено/всего + средний passRate
        const themes = Object.entries(byVert).map(([vert, rows]) => ({
          vert, name: vName(vert), total: rows.length,
          mastered: rows.filter(r => r.stages >= 3).length,
          avgPass: rows.length ? Math.round(rows.reduce((s, r) => s + r.passRate, 0) / rows.length) : 0,
        })).sort((a, b) => b.total - a.total);

        // Категории навыков (универсум план∪mastery; «нужно» — только плановые)
        const planSet = new Set(allSkills.map(s => s.id));
        const universe = Array.from(new Set([...planSet, ...Object.keys(mastery)]));
        const cats = { mastered: [], inProgress: [], need: [] };
        for (const id of universe) {
          const stages = Number(mastery[id]?.stagesCompleted || 0);
          const item = { id, name: nameOf(id) };
          if (stages >= 3) cats.mastered.push(item);
          else if (stages > 0) cats.inProgress.push(item);
          else if (planSet.has(id)) cats.need.push(item);
        }
        const byName = (a, b) => a.name.localeCompare(b.name, "ru");
        cats.mastered.sort(byName); cats.inProgress.sort(byName); cats.need.sort(byName);

        // Зоны точности (dailyAttempts>10) — деградируют, если пусто
        const zones = [];
        for (const [id, v] of Object.entries(mastery)) {
          const att = Number(v?.dailyAttempts || 0), cor = Number(v?.dailyCorrect || 0);
          if (att > 10) { const acc = Math.round(cor / att * 100); zones.push({ id, name: nameOf(id), acc }); }
        }
        zones.sort((a, b) => a.acc - b.acc);

        // Награды
        const medals = (medalSnap.docs || []).map(x => x.data());
        const achievements = (achSnap.docs || []).map(x => x.data())
          .map(a => { const def = ACHIEVEMENTS.find(z => z.id === a.achievementId); return { ...a, icon: def?.icon || "🏅", title: def?.name || a.achievementId }; });

        const level = profile.xp != null ? getLevelInfo(Number(profile.xp) || 0) : null;

        // Вердикт: активность (очки за неделю) × качество (кумулятивная точность)
        let cumAtt = 0, cumCor = 0, masteredCount = 0;
        for (const v of Object.values(mastery)) {
          cumAtt += Number(v?.dailyAttempts || 0);
          cumCor += Number(v?.dailyCorrect || 0);
          if (Number(v?.stagesCompleted || 0) >= 3) masteredCount++;
        }
        const verdict = computeVerdict({
          thisWeekPoints, attempts: cumAtt, correct: cumCor,
          totalPoints: Number(profile.totalPoints || 0), masteredCount,
        });

        setD({ profile, hasData: !!plan || Object.keys(mastery).length > 0, overallPct, seg, themes, weak, strong, cats, zones, medals, achievements, level, verdict, thisWeekPoints, lastWeekPoints });
      } catch (e) { console.error("[ChildReport] load failed", e?.message || e); if (!cancelled) setError(true); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [childUid]);

  if (loading) return <div style={{ ...card, color: C.dim, textAlign: "center" }}>Загрузка отчёта…</div>;
  if (error) return <div style={{ ...card, color: C.red, textAlign: "center" }}>Не удалось загрузить отчёт.</div>;

  const { profile, hasData, overallPct, seg, themes, weak, strong, cats, zones, medals, achievements, level, verdict, thisWeekPoints, lastWeekPoints } = d;
  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Ребёнок";
  const VTONE = { green: C.green, yellow: C.yellow, gray: C.gray };
  const vColor = VTONE[verdict?.tone] || C.gray;
  const weekDelta = (thisWeekPoints || 0) - (lastWeekPoints || 0);

  if (!hasData) {
    return (
      <div style={{ ...card, color: C.dim, textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🌱</div>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>Ребёнок ещё не начал</div>
        <div style={{ fontSize: 13.5 }}>Когда появится план и прогресс — здесь будет дашборд.</div>
      </div>
    );
  }

  const SkillChips = ({ items, dot }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {items.map(s => (
        <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, background: C.cardHi, borderRadius: 999, padding: "4px 10px" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} /> {s.name}
        </span>
      ))}
    </div>
  );
  const SegTile = ({ label, val, color }) => (
    <div style={{ flex: 1, minWidth: 64, textAlign: "center", background: C.cardHi, borderRadius: 12, padding: "10px 6px" }}>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 20, color }}>{val}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: C.bg, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Адаптив: 2 колонки на десктопе, 1 на мобильном. min(100%,…) гасит
          overflow на узких экранах (классический баг auto-fit minmax). */}
      <style>{`
        .cr-grid { display:grid; gap:14px; align-items:start;
          grid-template-columns:repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
      `}</style>

      {/* 0. ВЕРДИКТ-ПЛАШКА — ответ за секунду */}
      <div style={{ ...card, borderLeft: `4px solid ${vColor}`,
        background: `linear-gradient(90deg, ${vColor}1f, ${C.card} 55%)`,
        display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: vColor, flexShrink: 0,
          boxShadow: `0 0 12px -1px ${vColor}` }} />
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 17, color: C.text }}>
          {verdict?.title || "—"}
        </div>
      </div>

      {/* 1. ШАПКА */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar p={profile} size={60} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 18, color: C.text }}>{fullName}</div>
          <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 6 }}>
            {profile.details || ""}{level ? ` · ${level.tier?.name || ""}` : ""}
            {profile.streak ? `  ·  🔥 ${profile.streak}` : ""}
          </div>
          {level && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.dim, marginBottom: 3 }}>
                <span>Ур. {level.level}</span><span>{Number(profile.xp || 0).toLocaleString("ru-RU")} XP</span>
              </div>
              <div style={{ height: 6, background: C.cardHi, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((level.progress || 0) * 100)}%`, background: level.tier?.color || C.gold }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1.5 АКТИВНОСТЬ ЗА НЕДЕЛЮ (очки из leaderboard, не «рост знаний») */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 26, color: C.text, lineHeight: 1 }}>
            {(thisWeekPoints || 0).toLocaleString("ru-RU")}
          </div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>очков · активность за неделю</div>
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
          color: weekDelta > 0 ? C.green : weekDelta < 0 ? C.yellow : C.dim,
          background: weekDelta > 0 ? "rgba(34,197,94,0.12)" : weekDelta < 0 ? "rgba(245,158,11,0.12)" : C.cardHi,
        }}>
          {weekDelta > 0 ? `+${weekDelta}` : weekDelta < 0 ? `${weekDelta}` : "±0"} к прошлой неделе
        </div>
      </div>

      {/* ─ РАЗДЕЛ «Что освоено» (ось знаний — вторая ось вердикта) ─ */}
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: C.dim, margin: "4px 2px -2px" }}>📚 Что освоено</div>
      {/* Средние блоки: 2 колонки на десктопе (сводка, над-чем, темы) */}
      <div className="cr-grid">
      {/* 2. СВОДКА: кольцо + сегменты */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ width: 96, height: 96, borderRadius: "50%", flexShrink: 0,
          background: `conic-gradient(${C.gold} ${overallPct * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 22px -4px ${C.gold}66` }}>
          <div style={{ width: 74, height: 74, borderRadius: "50%", background: C.card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 22, color: C.text }}>{overallPct}%</div>
            <div style={{ fontSize: 10, color: C.dim }}>освоено</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SegTile label="Освоено" val={seg.mastered} color={C.green} />
          <SegTile label="В работе" val={seg.inProgress} color={C.yellow} />
          <SegTile label="Доступно" val={seg.available} color={C.blue} />
          <SegTile label="Закрыто" val={seg.locked} color={C.gray} />
        </div>
      </div>

      {/* 4. НАД ЧЕМ РАБОТАТЬ + СИЛЬНЫЕ (по passRate диагностики) */}
      {(weak.length > 0 || strong.length > 0) && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>🎯 По итогам диагностики</div>
          {weak.length > 0 && <>
            <div style={{ fontSize: 12.5, color: C.red, marginTop: 8, fontWeight: 600 }}>Над чем работать</div>
            {weak.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>{s.passRate}%</span>
              </div>
            ))}
          </>}
          {strong.length > 0 && <>
            <div style={{ fontSize: 12.5, color: C.green, marginTop: 12, fontWeight: 600 }}>Сильные стороны</div>
            {strong.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.green }}>{s.passRate}%</span>
              </div>
            ))}
          </>}
          {/* Зоны точности — отдельно, грациозно */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, marginBottom: zones.length ? 6 : 0 }}>Точность по практике</div>
            {zones.length === 0 ? (
              <div style={{ fontSize: 12, color: C.dim }}>Появится, когда ребёнок решит больше 10 задач по навыку.</div>
            ) : zones.map(z => (
              <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: z.acc > 90 ? C.green : z.acc >= 50 ? C.yellow : C.red }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: z.acc > 90 ? C.green : z.acc >= 50 ? C.yellow : C.red }}>{z.acc}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. ПО ТЕМАМ */}
      {themes.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>📚 По темам</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {themes.map(t => {
              const pct = t.total ? Math.round(t.mastered / t.total * 100) : 0;
              return (
                <div key={t.vert}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: C.text, fontWeight: 600 }}>{t.name}</span>
                    <span style={{ color: C.dim }}>{t.mastered}/{t.total} · диагн. {t.avgPass}%</span>
                  </div>
                  <div style={{ height: 7, background: C.cardHi, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.gold})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>{/* ── /cr-grid ── */}

      {/* 📈 РОСТ ОСВОЕНИЯ — заглушка (реальный график появится с накоплением снимков, Часть 3) */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14,
        background: `linear-gradient(90deg, ${C.blue}14, ${C.card} 60%)`, borderStyle: "dashed" }}>
        <div style={{ fontSize: 30, flexShrink: 0 }}>📈</div>
        <div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 3 }}>Рост освоения</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
            Копим данные о прогрессе — график динамики появится примерно через месяц занятий.
          </div>
        </div>
      </div>

      {/* ─ РАЗДЕЛ «Подробности» ─ */}
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: C.dim, margin: "4px 2px -2px" }}>🔎 Подробности</div>

      {/* Награды (перенесены из верхней сетки в детали) */}
      {(medals.length > 0 || achievements.length > 0) && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>🏆 Награды</div>
          {achievements.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: medals.length ? 10 : 0 }}>
              {achievements.map((a, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, background: C.cardHi, borderRadius: 10, padding: "5px 10px" }}>
                  <span style={{ fontSize: 15 }}>{a.icon}</span> {a.title}{a.level > 1 ? ` ${a.level}` : ""}
                </span>
              ))}
            </div>
          )}
          {medals.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.dim }}>
              🏅 {medals.length} {medals.length === 1 ? "медаль" : "медалей"}:
              {["gold", "silver", "bronze"].map(t => {
                const n = medals.filter(m => m.type === t).length;
                return n ? <span key={t} style={{ color: MEDAL_COLOR[t], fontWeight: 700 }}>{n} ●</span> : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* Категории навыков (компактно) */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>
          📋 Навыки: <span style={{ color: C.green }}>{cats.mastered.length}</span> / <span style={{ color: C.yellow }}>{cats.inProgress.length}</span> / <span style={{ color: C.dim }}>{cats.need.length}</span>
          <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>  (изучено / в работе / нужно)</span>
        </div>
        {cats.inProgress.length > 0 && <><div style={{ fontSize: 12, color: C.yellow, marginTop: 8 }}>🔄 В работе</div><SkillChips items={cats.inProgress} dot={C.yellow} /></>}
        {cats.mastered.length > 0 && <><div style={{ fontSize: 12, color: C.green, marginTop: 10 }}>✅ Изучено</div><SkillChips items={cats.mastered} dot={C.green} /></>}
        {cats.need.length > 0 && <><div style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>📝 Нужно изучить</div><SkillChips items={cats.need} dot={C.gray} /></>}
      </div>
    </div>
  );
}
