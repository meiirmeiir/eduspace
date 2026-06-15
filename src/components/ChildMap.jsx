// Карта модулей ребёнка (Шаг 7) — рендерится в под-вью ParentScreen.
// READ-ONLY: родитель только смотрит карту (никакой записи в данные ребёнка,
// без training-кнопки, без localStorage — см. readOnly у DiagnosticModuleTree).
// Доступ к individualPlans/skillProgress/skillMastery ребёнка открыт rules Шага 4.
// Загрузка независима от ChildReport (Шаг 6) — по образцу IndividualPlanScreen.
import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, db } from "../firestore-rest.js";
import { getContent } from "../lib/contentCache.js";
import { useTheme } from "../ThemeContext.jsx";
import DiagnosticModuleTree, { buildDiagModuleTree } from "./diagTree/DiagnosticModuleTree.jsx";

export default function ChildMap({ childUid }) {
  const { theme: THEME } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoPlan, setAutoPlan] = useState(null);
  const [skillProgress, setSkillProgress] = useState({});
  const [skillMastery, setSkillMastery] = useState({});
  const [cgLinks, setCgLinks] = useState([]);
  const [namesMap, setNamesMap] = useState({});

  useEffect(() => {
    if (!childUid) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(false);
      try {
        const [planSnap, progressSnap, masterySnap, cg, hier] = await Promise.all([
          getDoc(doc(db, "individualPlans", childUid)),
          getDoc(doc(db, "skillProgress", childUid)),
          getDoc(doc(db, "skillMastery", childUid)),
          getContent("crossGradeLinks"),
          getContent("skillHierarchies"),
        ]);
        if (cancelled) return;
        setAutoPlan(planSnap.exists() ? planSnap.data() : null);
        setSkillProgress(progressSnap.exists() ? (progressSnap.data()?.skills || {}) : {});
        setSkillMastery(masterySnap.exists() ? (masterySnap.data()?.skills || {}) : {});
        setCgLinks(cg || []);
        const nm = {};
        (hier || []).forEach(h => (h.clusters || []).forEach(cl =>
          (cl.pivot_skills || []).forEach(ps => { if (ps.skill_id && ps.skill_name) nm[ps.skill_id] = ps.skill_name; })));
        setNamesMap(nm);
      } catch (e) {
        console.error("[ChildMap] load failed", e?.message || e);
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [childUid]);

  const diagData = useMemo(() => {
    if (!autoPlan) return { modules: [], edges: [] };
    return buildDiagModuleTree(autoPlan, skillProgress, cgLinks, namesMap, skillMastery);
  }, [autoPlan, skillProgress, cgLinks, namesMap, skillMastery]);

  const card = {
    background: THEME.surface, borderRadius: 16, padding: "16px 18px",
    boxShadow: "0 8px 28px -8px rgba(10,25,47,0.12), 0 2px 8px rgba(10,25,47,0.05)",
  };

  if (loading) return <div style={{ ...card, textAlign: "center", color: THEME.textLight }}>Загрузка карты…</div>;
  if (error)   return <div style={{ ...card, textAlign: "center", color: "#dc2626" }}>Не удалось загрузить карту.</div>;
  if (!autoPlan) {
    return (
      <div style={{ ...card, textAlign: "center", color: THEME.textLight }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 4 }}>Карта не сформирована</div>
        <div style={{ fontSize: 13.5 }}>Появится, когда ребёнок пройдёт диагностику.</div>
      </div>
    );
  }

  // DiagnosticModuleTree саморазмерный (76vh, свой бордер/радиус) — как в
  // IndividualPlanScreen; высоту НЕ навязываем (иначе карта обрежется).
  return (
    <div>
      <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 8 }}>🗺️ Карта модулей</div>
      <DiagnosticModuleTree diagData={diagData} skillMastery={skillMastery} readOnly />
    </div>
  );
}
