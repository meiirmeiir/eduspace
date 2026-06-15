// Вердикт для родителя по двум осям: АКТИВНОСТЬ (очки за неделю из leaderboard)
// × КАЧЕСТВО (точность по практике). Чистая функция — тестируемо, один источник
// порогов. Подключается в ChildReport (дашборд-плашка).
//
// ⚠️ PROVISIONAL: пороги выведены из МЕХАНИКИ очков (daily_correct=10 за верный,
// skill_mastered=100 и т.д.), НЕ из реальных учеников (на момент запуска их нет).
// Калибровать на реальном распределении после запуска — менять ТОЛЬКО здесь.
export const VERDICT_THRESHOLDS = {
  WEEK_ACTIVE_MIN: 200,   // нед.очки ≥200 = «активен» (для шкалы/цвета активности)
  WEEK_LOW_MIN:    30,    // <30 = не занимался на этой неделе (≈ <3 верных ответов)
  STRUGGLE_ACC:    0.40,  // точность <40% = «стоит подтянуть» (MCQ-угадывание≈25%, консервативно)
  MIN_ATTEMPTS:    20,    // минимум попыток, чтобы СУДИТЬ о точности (меньше ложных тревог)
};

// Возвращает { state, title, tone } —
//   state: 'good' | 'struggle' | 'idle' | 'unknown'
//   tone:  'green' | 'yellow'   | 'gray' | 'gray'  (для цвета плашки)
export function computeVerdict({
  thisWeekPoints = 0,
  attempts = 0,
  correct = 0,
  totalPoints = 0,
  masteredCount = 0,
} = {}) {
  const T = VERDICT_THRESHOLDS;
  const acc = attempts > 0 ? correct / attempts : null;

  // 1) Совсем нет данных — честно «мало данных», не выдаём ложный вердикт.
  if (totalPoints === 0 && attempts === 0 && masteredCount === 0) {
    return { state: 'unknown', tone: 'gray',
      title: 'Мало данных для оценки — ребёнок только начинает' };
  }

  // 2) Нет активности на этой неделе (история есть) — фактический сигнал, прямо.
  if (thisWeekPoints < T.WEEK_LOW_MIN) {
    return { state: 'idle', tone: 'gray',
      title: 'Давно не занимался' };
  }

  // 3) Активен + достаточно данных о точности + точность низкая → мягкое наблюдение.
  if (acc != null && attempts >= T.MIN_ATTEMPTS && acc < T.STRUGGLE_ACC) {
    return { state: 'struggle', tone: 'yellow',
      title: 'Занимается активно — точность стоит подтянуть' };
  }

  // 4) Активен (точность норм ИЛИ данных о ней мало → не пугаем, качество не судим).
  return { state: 'good', tone: 'green',
    title: 'Активно занимается и усваивает' };
}
