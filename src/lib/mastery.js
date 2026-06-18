// ── Каноническая метрика освоения программы (overallPct) ─────────────────────
// overallPct = ПЛОСКОЕ среднее процентов освоения по навыкам плана (каждый навык
// весит одинаково). Канон выбран осознанно:
//   • среднее-по-модулям («среднее средних») искажает при неравных модулях
//     (Симпсон): 1-навыковый модуль не должен весить как 10-навыковый;
//   • Cloud Functions физически не может считать модульную карту
//     (buildDiagModuleTree завязан на React + crossGradeLinks);
//   • снимки прогресса (progressSnapshots) уже хранят плоское значение — история
//     остаётся консистентной без переписывания.
//
// 🔴 АНТИ-ДРЕЙФ: бот держит ИДЕНТИЧНУЮ формулу inline в
//    functions/index.js → buildStudentReport (CJS-пакет functions/ не импортит
//    src/, общий модуль через границу сред невозможен). При ЛЮБОЙ правке формулы
//    или STAGE_PCT — менять ОБА места синхронно. Клиентские потребители
//    (ChildReport-донат «Освоено программы», IndividualPlanScreen «общий
//    прогресс») ссылаются СЮДА — единый источник на стороне кабинета.

// Стадия освоения навыка (stagesCompleted 0..3) → процент. Единый маппинг
// (тот же в buildDiagModuleTree для module.mastery и в боте).
export const STAGE_PCT = [0, 40, 80, 100];
export const pctOfStage = (stage) => STAGE_PCT[Math.min(Number(stage) || 0, 3)];

// Плоское среднее освоения по навыкам.
//   skillMastery — { [skillId]: { stagesCompleted } } (поле skillMastery.skills)
//   planSkillIds — навыки плана (канон-набор; зеркало bot planSkillIds)
//   fallbackIds  — если план пуст, среднее по этим навыкам (зеркало bot-фоллбэка)
export function flatOverallPct(skillMastery, planSkillIds, fallbackIds = null) {
  // Set-дедуп БЕЗ filter — байт-в-байт как бот: бот считает falsy-id как 0% в
  // знаменателе (НЕ выбрасывает). Любой фильтр здесь = расхождение с ботом.
  const plan = [...new Set(planSkillIds || [])];
  const ids = plan.length ? plan : [...new Set(fallbackIds || [])];
  if (!ids.length) return 0;
  const sum = ids.reduce((s, id) => s + pctOfStage(skillMastery?.[id]?.stagesCompleted), 0);
  return Math.round(sum / ids.length);
}
