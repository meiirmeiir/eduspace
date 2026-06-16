// Вердикт для родителя (серверная копия). 1:1 С `src/lib/parentVerdict.js`.
// ⚠️ SYNC: эта функция ДУБЛИРУЕТ клиентскую src/lib/parentVerdict.js (ESM не
// импортируется в functions). При ИЗМЕНЕНИИ порогов/логики — МЕНЯТЬ ОБА файла.
// Дрейф ловит юнит-тест tests/unit/parentVerdict.test.js (сверяет обе копии).
//
// АКТИВНОСТЬ (нед.очки) × КАЧЕСТВО (точность практики). Чистый модуль без сайд-
// эффектов (нужно для импорта в тест). Используется в buildStudentReport.

const VERDICT_THRESHOLDS = {
  WEEK_ACTIVE_MIN: 200,
  WEEK_LOW_MIN:    30,
  STRUGGLE_ACC:    0.40,
  MIN_ATTEMPTS:    20,
};

function computeVerdict({
  thisWeekPoints = 0,
  attempts = 0,
  correct = 0,
  totalPoints = 0,
  masteredCount = 0,
} = {}) {
  const T = VERDICT_THRESHOLDS;
  const acc = attempts > 0 ? correct / attempts : null;

  if (totalPoints === 0 && attempts === 0 && masteredCount === 0) {
    return { state: 'unknown', tone: 'gray',
      title: 'Мало данных для оценки — ребёнок только начинает' };
  }
  if (thisWeekPoints < T.WEEK_LOW_MIN) {
    return { state: 'idle', tone: 'gray',
      title: 'Давно не занимался' };
  }
  if (acc != null && attempts >= T.MIN_ATTEMPTS && acc < T.STRUGGLE_ACC) {
    return { state: 'struggle', tone: 'yellow',
      title: 'Занимается активно — точность стоит подтянуть' };
  }
  return { state: 'good', tone: 'green',
    title: 'Активно занимается и усваивает' };
}

module.exports = { VERDICT_THRESHOLDS, computeVerdict };
