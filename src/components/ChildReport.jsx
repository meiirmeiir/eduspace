// Дашборд по ребёнку (Шаг 6, редизайн) — под-вью ParentScreen. READ-ONLY.
// Вердикт + 4 метрики + баланс (хорошо освоено/над чем работать по passRate) +
// по темам (вертикали). «Подробнее»: рост (линия из progressSnapshots ≥2 точек,
// иначе заглушка) + точность-зоны + навыки-чипы + карта. Палитра — из темы (light/dark).
// Доступ к данным ребёнка открыт rules Шага 4. Награды НЕ показываем (игровая
// мотивация ученика ≠ ответ родителю «есть ли прогресс»).
import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, getDocs, collection, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { fetchFriendProfiles } from "../lib/friendsUtils.js";
import { buildDiagModuleTree } from "./diagTree/DiagnosticModuleTree.jsx";
import { getLevelInfo } from "../lib/levelUtils.js";
import { getWeekId } from "../lib/pointsUtils.js";
import { computeVerdict } from "../lib/parentVerdict.js";
import ChildMap from "./ChildMap.jsx";
import { useTheme } from "../ThemeContext.jsx";

const VERTICAL_NAMES = {
  ALGEBRA: "Алгебра", GEOMETRY: "Геометрия", NUMBERS: "Числа", FUNCTIONS: "Функции",
  PROBABILITY: "Вероятность", TRIGONOMETRY: "Тригонометрия", CALCULUS: "Анализ", STATISTICS: "Статистика",
};
const vName = v => VERTICAL_NAMES[v] || (v ? v[0] + v.slice(1).toLowerCase() : "Тема");
const humanizeSkillId = id => !id ? "Навык" : String(id).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function ChildReport({ childUid }) {
  const { theme: THEME, dark } = useTheme();
  // Палитра дашборда — ИЗ темы проекта (light/dark), не хардкод. Единый синий
  // акцент (данные) + функциональные цвета с адаптивным оттенком (читаемы на обеих).
  const C = {
    bg: THEME.bg, card: THEME.surface,
    cardHi: dark ? "rgba(255,255,255,0.08)" : "#eef2f7",   // тонкая заливка (треки/чипы)
    border: THEME.border, text: THEME.text, dim: THEME.textLight,
    accent: "#3b82f6",
    green: dark ? "#22c55e" : "#16a34a",
    amber: dark ? "#f59e0b" : "#d97706",
    red:   dark ? "#ef4444" : "#dc2626",
    gray:  THEME.textLight,
  };
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px",
    boxShadow: dark ? "0 8px 28px -10px rgba(0,0,0,0.5)" : "0 8px 24px -12px rgba(10,25,47,0.12)" };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [d, setD] = useState(null);
  const [showDetails, setShowDetails] = useState(false);   // collapse «Подробнее»

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
        const [planSnap, masterySnap, progressSnap, cg, hier, profMap, lbThis, lbLast, snapsSnap] = await Promise.all([
          getDoc(doc(db, "individualPlans", childUid)),
          getDoc(doc(db, "skillMastery", childUid)),
          getDoc(doc(db, "skillProgress", childUid)),
          getContent("crossGradeLinks"),
          getContent("skillHierarchies"),
          fetchFriendProfiles([childUid]),
          getDoc(doc(db, "leaderboard", thisWeekId, "entries", childUid)),
          getDoc(doc(db, "leaderboard", lastWeekId, "entries", childUid)),
          getDocs(collection(db, `progressSnapshots/${childUid}/weeks`)),   // история для графика роста
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

        // Общий % освоения — средний mastery по модулям карты (buildDiagModuleTree)
        const diag = plan ? buildDiagModuleTree(plan, skillProgress, cg || [], namesMap, mastery) : { modules: [] };
        const mods = diag.modules || [];
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

        // История снимков (для графика роста): сортируем по weekId, берём overallPct
        const snapshots = (snapsSnap.docs || []).map(x => x.data())
          .map(s => ({ weekId: s.weekId || "", overallPct: Number(s.overallPct || 0) }))
          .filter(s => s.weekId)
          .sort((a, b) => a.weekId.localeCompare(b.weekId));

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

        setD({ profile, hasData: !!plan || Object.keys(mastery).length > 0, overallPct, themes, weak, strong, cats, zones, snapshots, level, verdict, thisWeekPoints, lastWeekPoints });
      } catch (e) { console.error("[ChildReport] load failed", e?.message || e); if (!cancelled) setError(true); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [childUid]);

  if (loading) return <div style={{ ...card, color: C.dim, textAlign: "center" }}>Загрузка отчёта…</div>;
  if (error) return <div style={{ ...card, color: C.red, textAlign: "center" }}>Не удалось загрузить отчёт.</div>;

  const { profile, hasData, overallPct, themes, weak, strong, cats, zones, snapshots, level, verdict, thisWeekPoints, lastWeekPoints } = d;
  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Ребёнок";
  const VTONE = { green: C.green, yellow: C.amber, gray: C.gray };
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
          <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: "50%", background: dot }} /> {s.name}
        </span>
      ))}
    </div>
  );
  // Метрика-плитка: нейтральная цифра (белая), подпись приглушённая. Без цвета-декора.
  const Metric = ({ value, label, sub }) => (
    <div style={{ ...card, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 6, minHeight: 104, justifyContent: "center" }}>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 32, color: C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: C.dim }}>{label}</div>
      {sub}
    </div>
  );
  // Чистый донат для % (тонкое кольцо, единый акцент, БЕЗ свечения)
  const Donut = ({ pct, size = 66 }) => {
    const r = (size - 7) / 2, circ = 2 * Math.PI * r, off = circ * (1 - Math.min(pct, 100) / 100);
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.cardHi} strokeWidth={6} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.accent} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, color: C.text }}>{pct}%</div>
      </div>
    );
  };

  return (
    <div style={{ background: C.bg, borderRadius: 18, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        .cr-metrics { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(min(100%,150px),1fr)); }
        .cr-5050 { display:grid; gap:14px; align-items:start; grid-template-columns:1fr 1fr; }
        .cr-5050 > * { min-width:0; }   /* фикс overflow: иначе длинное имя распирает колонку шире 1fr */
        @media (max-width:760px){ .cr-5050 { grid-template-columns:1fr; } }
        /* Темы — плитки auto-fit: 1 тема = компактная плитка, много = ряд (не пустая ширина) */
        .cr-themes { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(min(100%,240px),1fr)); }
        .cr-themes > * { min-width:0; }
      `}</style>

      {/* ВЕРДИКТ — тонкая акцентная полоса слева (3px), без заливки/свечения */}
      <div style={{ ...card, padding: "22px 24px", borderLeft: `3px solid ${vColor}`, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 20, color: C.text, lineHeight: 1.25 }}>{verdict?.title || "—"}</div>
        <div style={{ fontSize: 13, color: C.dim }}>
          {fullName}{profile.details ? ` · ${profile.details}` : ""}{level ? ` · ${level.tier?.name || ""}` : ""}
        </div>
      </div>

      {/* 4 МЕТРИКИ — нейтральные; «освоено» = чистый донат. Без фейк «+N% за месяц» */}
      <div className="cr-metrics">
        <div style={{ ...card, padding: "18px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, minHeight: 104 }}>
          <Donut pct={overallPct} />
          {/* minWidth:0 + flexWrap: на узкой плитке (2 кол. × ~156px) подпись переносится под донат, не вылезает за край */}
          <div style={{ fontSize: 12.5, color: C.dim, minWidth: 0, lineHeight: 1.3, overflowWrap: "break-word" }}>Освоено программы</div>
        </div>
        <Metric value={cats.mastered.length} label="Навыков освоено" />
        <Metric value={Number(profile.streak || 0)} label="Дней подряд" />
        <Metric value={(thisWeekPoints || 0).toLocaleString("ru-RU")} label="Очков за неделю"
          sub={<div style={{ fontSize: 11.5, fontWeight: 600, color: weekDelta > 0 ? C.green : C.dim }}>
            {weekDelta > 0 ? `+${weekDelta} к прошлой` : weekDelta < 0 ? `${weekDelta} к прошлой` : "—"}
          </div>} />
      </div>

      {/* БАЛАНС: «Хорошо освоено» и «Над чем работать» — РАВНОПРАВНЫЕ блоки 50/50.
          Родитель видит успехи так же ясно, как зоны роста (без алармизма). */}
      <div className="cr-5050">
        <div style={{ ...card, borderLeft: `3px solid ${C.green}` }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>✅ Хорошо освоено</div>
          {strong.length === 0 ? (
            <div style={{ fontSize: 13, color: C.dim }}>Сильные навыки появятся по мере занятий.</div>
          ) : strong.slice(0, 3).map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 7 }}>
              {/* 2 строки вместо 1+ellipsis: на мобильном родитель читает название; процент держится у верха (flex-start) */}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.text, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: C.green }}>{s.passRate}%</span>
            </div>
          ))}
        </div>
        <div style={{ ...card, borderLeft: `3px solid ${C.amber}` }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>🎯 Над чем работать</div>
          {weak.length === 0 ? (
            <div style={{ fontSize: 13, color: C.dim }}>Слабых мест по диагностике не выявлено.</div>
          ) : weak.slice(0, 3).map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 7 }}>
              {/* 2 строки вместо 1+ellipsis: на мобильном родитель читает название; процент держится у верха (flex-start) */}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.text, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: C.amber }}>{s.passRate}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* По разделам — плитки auto-fit (1 раздел = компактная, много = ряд; без пустой ширины) */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 12 }}>📚 По разделам</div>
        {themes.length === 0 ? (
          <div style={{ fontSize: 13, color: C.dim }}>Данных по разделам пока нет.</div>
        ) : (
          <div className="cr-themes">
            {themes.map(t => {
              const pct = t.total ? Math.round(t.mastered / t.total * 100) : 0;
              return (
                <div key={t.vert} style={{ background: C.cardHi, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13.5, marginBottom: 6 }}>
                    <span style={{ color: C.text, fontWeight: 700 }}>{t.name}</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 7, background: dark ? "rgba(255,255,255,0.10)" : "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: C.accent, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.dim }}>освоено {t.mastered}/{t.total} · диагностика {t.avgPass}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ПОДРОБНЕЕ ↓ (collapse: рост/награды/зоны/навыки/карта) */}
      <button type="button" onClick={() => setShowDetails(v => !v)}
        style={{ ...card, cursor: "pointer", textAlign: "center", color: C.text, fontWeight: 700, fontSize: 14, padding: 13 }}>
        {showDetails ? "Свернуть ↑" : "Подробнее ↓"}
      </button>

      {showDetails && <>
        {/* Рост освоения: ≥2 снимков → линия overallPct по неделям; иначе заглушка */}
        {snapshots.length >= 2 ? (
          <div style={card}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 12 }}>📈 Рост освоения</div>
            {(() => {
              const n = snapshots.length, W = 300, H = 100;
              const xs = i => (i / (n - 1)) * W;
              const ys = p => H - (Math.min(Math.max(p, 0), 100) / 100) * H;
              const pts = snapshots.map((s, i) => `${xs(i).toFixed(1)},${ys(s.overallPct).toFixed(1)}`).join(" ");
              const first = snapshots[0].overallPct, last = snapshots[n - 1].overallPct, delta = last - first;
              return (
                <>
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 110, display: "block" }}>
                    <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dim, marginTop: 8 }}>
                    <span>{snapshots[0].weekId}: {first}%</span>
                    <span style={{ color: delta > 0 ? C.green : C.dim, fontWeight: 700 }}>{delta > 0 ? `+${delta}` : delta} % за период</span>
                    <span>{snapshots[n - 1].weekId}: {last}%</span>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div style={{ ...card, borderStyle: "dashed", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 26, flexShrink: 0, opacity: 0.7 }}>📈</div>
            <div>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 3 }}>Рост освоения</div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>График динамики появится через 1-2 недели — копим данные о прогрессе.</div>
            </div>
          </div>
        )}

        {/* Точность по практике (зоны) */}
        <div style={card}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>🎯 Точность по практике</div>
          {zones.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.dim }}>Появится, когда ребёнок решит больше 10 задач по навыку.</div>
          ) : zones.map(z => (
            <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
              <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", background: z.acc > 90 ? C.green : z.acc >= 50 ? C.amber : C.red }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: z.acc > 90 ? C.green : z.acc >= 50 ? C.amber : C.red }}>{z.acc}%</span>
            </div>
          ))}
        </div>

        {/* Навыки-чипы */}
        <div style={card}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>
            📋 Навыки: <span style={{ color: C.green }}>{cats.mastered.length}</span> / <span style={{ color: C.amber }}>{cats.inProgress.length}</span> / <span style={{ color: C.dim }}>{cats.need.length}</span>
            <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>  (изучено / в работе / нужно)</span>
          </div>
          {cats.inProgress.length > 0 && <><div style={{ fontSize: 12, color: C.amber, marginTop: 8 }}>🔄 В работе</div><SkillChips items={cats.inProgress} dot={C.amber} /></>}
          {cats.mastered.length > 0 && <><div style={{ fontSize: 12, color: C.green, marginTop: 10 }}>✅ Изучено</div><SkillChips items={cats.mastered} dot={C.green} /></>}
          {cats.need.length > 0 && <><div style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>📝 Нужно изучить</div><SkillChips items={cats.need} dot={C.gray} /></>}
        </div>

        {/* Карта модулей (перенесена внутрь «Подробнее») */}
        <ChildMap childUid={childUid} />
      </>}
    </div>
  );
}
