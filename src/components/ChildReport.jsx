// Отчёт по навыкам ребёнка (Шаг 6) — рендерится в под-вью ParentScreen.
// Доступ к данным ребёнка (individualPlans/skillMastery/skillProgress) открыт
// rules Шага 4 (isParentOf). Чистый фронт: категоризация навыков по
// stagesCompleted + зоны точности из счётчиков dailyAttempts/dailyCorrect (Шаг 1).
import React, { useEffect, useState } from "react";
import { doc, getDoc, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { useTheme } from "../ThemeContext.jsx";

// Простой fallback названия навыка, если нет в справочнике skillHierarchies.
function humanizeSkillId(id) {
  if (!id) return "Навык";
  return String(id).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function ChildReport({ childUid }) {
  const { theme: THEME } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null); // { categories, zones, hasMastery, planCount }

  useEffect(() => {
    if (!childUid) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(false);
      try {
        const [planSnap, masterySnap, , hier] = await Promise.all([
          getDoc(doc(db, "individualPlans", childUid)),
          getDoc(doc(db, "skillMastery", childUid)),
          getDoc(doc(db, "skillProgress", childUid)), // зарезервировано для карты (Шаг 7)
          getContent("skillHierarchies"),
        ]);

        // namesMap: skill_id -> skill_name из skillHierarchies
        const namesMap = {};
        (hier || []).forEach(h => {
          (h.clusters || []).forEach(cl => {
            (cl.pivot_skills || []).forEach(ps => {
              if (ps.skill_id && ps.skill_name) namesMap[ps.skill_id] = ps.skill_name;
            });
          });
        });
        const nameOf = id => namesMap[id] || humanizeSkillId(id);

        const mastery = masterySnap.exists() ? (masterySnap.data()?.skills || {}) : {};
        const plan = planSnap.exists() ? planSnap.data() : null;
        const planSkills = plan ? (plan.modules || []).flatMap(m => (m && m.skills_list) || []) : [];
        const planSet = new Set(planSkills);

        // Категории:
        //   Изучено  = stages>=3 (любой навык skillMastery)
        //   В работе = 0<stages<3 (любой навык skillMastery)
        //   Нужно    = ТОЛЬКО навыки ПЛАНА со stages=0 (назначено, но не начато)
        // Универсум = план ∪ ключи skillMastery, но навыки со stages=0 ВНЕ плана
        // отбрасываем — это осиротевшие mastery-ключи (мусор), не назначенные ребёнку.
        const universe = Array.from(new Set([...planSkills, ...Object.keys(mastery)]));
        const mastered = [], inProgress = [], need = [];
        for (const id of universe) {
          const stages = Number(mastery[id]?.stagesCompleted || 0);
          const item = { id, name: nameOf(id), stages };
          if (stages >= 3) mastered.push(item);
          else if (stages > 0) inProgress.push(item);
          else if (planSet.has(id)) need.push(item); // «нужно» — только плановые непройденные
          // else: stages=0 и не в плане → осиротевший ключ, пропускаем
        }
        const byName = (a, b) => a.name.localeCompare(b.name, "ru");
        mastered.sort(byName); inProgress.sort(byName); need.sort(byName);

        // Зоны точности: только навыки с dailyAttempts > 10
        const zones = [];
        for (const [id, v] of Object.entries(mastery)) {
          const attempts = Number(v?.dailyAttempts || 0);
          const correct = Number(v?.dailyCorrect || 0);
          if (attempts > 10) {
            const acc = Math.round((correct / attempts) * 100);
            const zone = acc > 90 ? "green" : acc >= 50 ? "yellow" : "red";
            zones.push({ id, name: nameOf(id), acc, attempts, zone });
          }
        }
        zones.sort((a, b) => a.acc - b.acc); // слабые сверху

        if (!cancelled) {
          setData({
            categories: { mastered, inProgress, need },
            zones,
            hasMastery: Object.keys(mastery).length > 0,
            planCount: planSkills.length,
          });
        }
      } catch (e) {
        console.error("[ChildReport] load failed", e?.message || e);
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [childUid]);

  const card = {
    background: THEME.surface, borderRadius: 16, padding: "16px 18px",
    boxShadow: "0 8px 28px -8px rgba(10,25,47,0.12), 0 2px 8px rgba(10,25,47,0.05)",
  };

  if (loading) return <div style={{ ...card, textAlign: "center", color: THEME.textLight }}>Загрузка отчёта…</div>;
  if (error)   return <div style={{ ...card, textAlign: "center", color: "#dc2626" }}>Не удалось загрузить отчёт.</div>;

  const { categories, zones, hasMastery } = data;
  const { mastered, inProgress, need } = categories;

  // Пусто: ни плана, ни прогресса
  if (!hasMastery && need.length === 0 && inProgress.length === 0 && mastered.length === 0) {
    return (
      <div style={{ ...card, textAlign: "center", color: THEME.textLight }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🌱</div>
        <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 4 }}>Ребёнок ещё не начал</div>
        <div style={{ fontSize: 13.5 }}>Когда появится план и прогресс, здесь будет отчёт по навыкам.</div>
      </div>
    );
  }

  const ZONE_COLOR = { green: "#22c55e", yellow: "#f59e0b", red: "#ef4444" };
  const Stat = ({ icon, label, val, color }) => (
    <div style={{ flex: 1, textAlign: "center", padding: "10px 6px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color }}>{val}</div>
      <div style={{ fontSize: 12, color: THEME.textLight, marginTop: 2 }}>{icon} {label}</div>
    </div>
  );
  const SkillList = ({ items, dot }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {items.map(s => (
        <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
          color: THEME.text, background: THEME.bg, borderRadius: 999, padding: "4px 10px", border: `1px solid ${THEME.border}` }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} /> {s.name}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Сводка категорий */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 8 }}>📊 Навыки</div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Stat icon="✅" label="Изучено"  val={mastered.length}   color="#22c55e" />
          <Stat icon="🔄" label="В работе" val={inProgress.length} color="#f59e0b" />
          <Stat icon="📝" label="Нужно"    val={need.length}       color={THEME.textLight} />
        </div>
      </div>

      {inProgress.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: THEME.text }}>🔄 Сейчас в работе</div>
          <SkillList items={inProgress} dot="#f59e0b" />
        </div>
      )}
      {mastered.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: THEME.text }}>✅ Изучено</div>
          <SkillList items={mastered} dot="#22c55e" />
        </div>
      )}
      {need.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: THEME.text }}>📝 Нужно изучить</div>
          <SkillList items={need} dot={THEME.textLight} />
        </div>
      )}

      {/* Зоны точности */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 8 }}>🎯 Точность по навыкам</div>
        {zones.length === 0 ? (
          <div style={{ fontSize: 13, color: THEME.textLight }}>
            Недостаточно данных — зоны появятся, когда ребёнок решит больше 10 задач по навыку.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {zones.map(z => (
              <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ZONE_COLOR[z.zone], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: THEME.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: ZONE_COLOR[z.zone] }}>{z.acc}%</span>
                <span style={{ fontSize: 11.5, color: THEME.textLight }}>({z.attempts} задач)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
