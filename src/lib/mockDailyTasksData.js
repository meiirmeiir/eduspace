// ── DEBUG-режим ежедневных задач: ?dailytasks_debug=
//    start|empty|active|in_progress|combo|completed|
//    probe_standard|probe_gold|probe_delivery|probe_landed|probe_live ──
// ВРЕМЕННЫЙ инструмент для визуальной проверки DailyTasksScreen во всех
// состояниях без реальных SRS-данных. Подменяет ТОЛЬКО локальный state экрана
// (queue/qIdx/correct/wrong/phase…); все записи в Firestore (награды, SRS,
// recentAnswers, стрик) в этом режиме отключены гардами в DailyTasksScreen.
// Удалить файл + точки подключения в DailyTasksScreen.jsx, когда отпадёт нужда.
//
// Точки подключения (DailyTasksScreen.jsx):
//   - load(): early return с применением мок-state
//   - handleChoose(): гард на блок наград (points/crystals/xp/квесты)
//   - handleNext(): гард на бонус за босса
//   - saveSession(): early return (ничего не пишем)

import { getAlmatyDateStr } from './srsUtils.js';

// Очередь из 5 реалистичных задач (формат как в dailyTasks/{skillId}.questions:
// поле question + options[] + correct-индекс + explanation; кириллица вне $…$).
const QUEUE = [
  {
    skillId: 'mock_divisibility', skillName: 'Признаки делимости', reviewStage: 2,
    task: {
      question: 'Какое из чисел делится на $9$ без остатка?',
      options: ['$1253$', '$2034$', '$1454$', '$2155$'],
      correct: 1,
      explanation: 'Число делится на $9$, если сумма его цифр делится на $9$. Для $2034$: $2 + 0 + 3 + 4 = 9$ — делится.',
    },
  },
  {
    skillId: 'mock_equations', skillName: 'Решение уравнений', reviewStage: 1,
    task: {
      question: 'Решите уравнение: $x + 2.7 = 5.3$',
      options: ['$x = 2.4$', '$x = 2.6$', '$x = 8$', '$x = 3.4$'],
      correct: 1,
      explanation: 'Чтобы найти неизвестное слагаемое, вычитаем известное слагаемое из суммы: $x = 5.3 - 2.7 = 2.6$.',
    },
  },
  {
    skillId: 'mock_fractions', skillName: 'Сложение дробей', reviewStage: 1,
    task: {
      question: 'Вычислите: $\\frac{2}{7} + \\frac{3}{7}$',
      options: ['$\\frac{5}{14}$', '$\\frac{6}{7}$', '$\\frac{5}{7}$', '$\\frac{1}{7}$'],
      correct: 2,
      explanation: 'При одинаковых знаменателях складываем только числители: $\\frac{2+3}{7} = \\frac{5}{7}$.',
    },
  },
  {
    skillId: 'mock_rational', skillName: 'Действия с рациональными числами', reviewStage: 3,
    task: {
      question: 'Вычислите: $-3.5 + 7.2$',
      options: ['$-3.7$', '$10.7$', '$-10.7$', '$3.7$'],
      correct: 3,
      explanation: 'Знаки разные — вычитаем модули: $7.2 - 3.5 = 3.7$; знак ответа — у числа с большим модулем, то есть плюс.',
    },
  },
  {
    skillId: 'mock_perimeter', skillName: 'Периметр прямоугольника', reviewStage: 2,
    task: {
      question: 'Длина прямоугольника равна $12$ см, ширина — $7$ см. Найдите его периметр.',
      options: ['$19$ см', '$38$ см', '$84$ см', '$26$ см'],
      correct: 1,
      explanation: 'Периметр прямоугольника: $P = 2(a + b) = 2 \\cdot (12 + 7) = 38$ см.',
    },
  },
];

const MOCKS = {
  // ── Экран старта миссии: стрик 12 дней → множитель ×1.5 ──
  start: {
    phase: 'intro',
    queue: QUEUE,
    streak: 12, // дневной стрик (подменяет user.streak в дебаге) → множитель ×1.2
  },

  // ── Задач нет: всё повторено, ближайшее повторение через 2 дня + статистика ──
  empty: {
    phase: 'empty',
    emptyReason: 'wait-until',
    nextReviewDate: getAlmatyDateStr(2),
    stats: { streak: 12, weekTasks: 47, weekPoints: 340 }, // мини-карточки мотивации
  },

  // ── Середина сессии: 2 верно, 1 неверно (combo сброшен), активна 4-я, 5-я впереди ──
  active: {
    phase: 'playing',
    queue: QUEUE,
    qIdx: 3,
    correct: ['mock_divisibility', 'mock_equations'],
    wrong: ['mock_fractions'],
    degraded: [],
    skillLives: { mock_fractions: 1 },
    chosen: null,
    revealed: false,
    // Геймификация: ответы по задачам (сегменты), live-награды
    answers: [true, true, false],
    combo: 0,
    sessionXp: 20,
    sessionCrystals: 4,
  },

  // ── Экран решения: ответ выбран (верный), фидбек + объяснение, combo ×2 ──
  in_progress: {
    phase: 'playing',
    queue: QUEUE,
    qIdx: 1,
    correct: ['mock_divisibility', 'mock_equations'],
    wrong: [],
    degraded: [],
    skillLives: {},
    chosen: 1,
    revealed: true,
    answers: [true, true],
    combo: 2,
    sessionXp: 20,
    sessionCrystals: 4,
    xpFloat: '+10 XP',
  },

  // ── Момент PERFECT COMBO ×5: последняя задача решена верно, оверлей + бейдж ──
  combo: {
    phase: 'playing',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_equations', 'mock_fractions', 'mock_rational', 'mock_perimeter'],
    wrong: [],
    degraded: [],
    skillLives: {},
    chosen: 1, // верный ответ последней задачи (периметр)
    revealed: true,
    answers: [true, true, true, true, true],
    combo: 5,
    sessionXp: 78,
    sessionCrystals: 15,
    xpFloat: '+20 XP (×2)',
    perfectFlash: true,
    hadPerfect: true, // чип «🔥 Perfect combo!» на итоговом экране
  },

  // ── Сессия завершена: итог дня — 4 из 5 верно, 1 навык на повтор завтра ──
  completed: {
    phase: 'done',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_equations', 'mock_rational', 'mock_perimeter'],
    wrong: ['mock_fractions'],
    degraded: [],
    skillLives: { mock_fractions: 1 },
    chosen: null,
    revealed: false,
    answers: [true, true, false, true, true],
    combo: 2,
    sessionXp: 40,
    sessionCrystals: 8,
    // Зонд: 4/5 → усиленный (silver), статично открытый (для скриншота)
    probeTier: 'silver',
    probeCrystals: 24,
    probeOpened: true,
    friendsCount: 2,
  },

  // ── Витрина 3D-зондов (скриншоты тиров и фаз доставки) ──
  probe_standard: {
    phase: 'done',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_fractions', 'mock_perimeter'],
    wrong: ['mock_equations', 'mock_rational'],
    degraded: [],
    skillLives: { mock_equations: 1, mock_rational: 1 },
    answers: [true, false, true, false, true], // 3/5 → грузовой зонд ×1
    sessionXp: 30,
    sessionCrystals: 6,
    probeTier: 'standard',
    probeCrystals: 9,
    probeOpened: true,
    friendsCount: 2,
  },
  probe_gold: {
    phase: 'done',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_equations', 'mock_fractions', 'mock_rational', 'mock_perimeter'],
    wrong: [],
    degraded: [],
    skillLives: {},
    answers: [true, true, true, true, true], // 5/5 PERFECT → легендарный ×3
    hadPerfect: true,
    sessionXp: 78,
    sessionCrystals: 15,
    probeTier: 'gold',
    probeCrystals: 33,
    probeOpened: true,
    friendsCount: 2,
  },
  // Дрон завис с грузом на тросе (статичная поза фазы доставки)
  probe_delivery: {
    phase: 'done',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_equations', 'mock_rational', 'mock_perimeter'],
    wrong: ['mock_fractions'],
    degraded: [],
    skillLives: { mock_fractions: 1 },
    answers: [true, true, false, true, true],
    sessionXp: 40,
    sessionCrystals: 8,
    probeTier: 'silver',
    probeCrystals: 24,
    probeOpened: false,
    probeFreeze: 'delivery',
    friendsCount: 2,
  },
  // Зонд на площадке, кнопка «Открыть зонд»
  probe_landed: {
    phase: 'done',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_equations', 'mock_rational', 'mock_perimeter'],
    wrong: ['mock_fractions'],
    degraded: [],
    skillLives: { mock_fractions: 1 },
    answers: [true, true, false, true, true],
    sessionXp: 40,
    sessionCrystals: 8,
    probeTier: 'silver',
    probeCrystals: 24,
    probeOpened: false,
    probeFreeze: 'landed',
    friendsCount: 2,
  },
  // Живая анимация всей сцены (доставка → сброс → отлёт → открытие по клику)
  probe_live: {
    phase: 'done',
    queue: QUEUE,
    qIdx: 4,
    correct: ['mock_divisibility', 'mock_equations', 'mock_rational', 'mock_perimeter'],
    wrong: ['mock_fractions'],
    degraded: [],
    skillLives: { mock_fractions: 1 },
    answers: [true, true, false, true, true],
    sessionXp: 40,
    sessionCrystals: 8,
    probeTier: 'silver',
    probeCrystals: 24,
    probeOpened: false,
    liveAnim: true, // полная 3D-анимация даже в debug
    friendsCount: 2,
  },
};

// ── Захват параметра ПРИ ЗАГРУЗКЕ БАНДЛА (side-effect импорта) ───────────────
// Тот же приём, что в mockDashboardData.js: кастомный hash-роутер App делает
// replaceState('/') и срезает query до рендера экрана, поэтому параметр ловим
// в момент исполнения модуля и кладём в sessionStorage (живёт до закрытия вкладки).
// Поддерживаются оба формата:
//   ?dailytasks_debug=active#daily   (query до hash)
//   #daily?dailytasks_debug=active   (query внутри hash — вычищается из URL,
//                                     иначе строгий hash-роутер App не узнает экран)
// Выключение: ?dailytasks_debug=off или закрыть вкладку.
const SS_KEY = 'dailytasks_debug';
function captureFromUrl() {
  try {
    const before = sessionStorage.getItem(SS_KEY);
    let v = new URLSearchParams(window.location.search).get(SS_KEY);
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (!v && qIdx >= 0) v = new URLSearchParams(hash.slice(qIdx + 1)).get(SS_KEY);
    if (qIdx >= 0) {
      // срезать query из hash ДО инициализации роутера App (#daily?x → #daily)
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hash.slice(0, qIdx));
    }
    if (!v) return false;
    if (v === 'off') sessionStorage.removeItem(SS_KEY);
    else if (MOCKS[v]) sessionStorage.setItem(SS_KEY, v);
    return sessionStorage.getItem(SS_KEY) !== before;
  } catch { return false; /* SSR/приватный режим — дебаг просто не активируется */ }
}
captureFromUrl();
// Смена hash на лету не перезагружает бандл — ловим навигацию и, если режим
// изменился, перезагружаем страницу. Слушаем popstate: он стреляет ПЕРВЫМ
// (до hashchange), а наш листенер зарегистрирован при загрузке бандла —
// раньше App-овского popstate-роутера, который успел бы срезать query.
try {
  const onNav = () => { if (captureFromUrl()) window.location.reload(); };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav); // запасной путь
} catch { /* no-op */ }

// null, если режим не включён или state неизвестен.
export function getDailyTasksMock() {
  try {
    const state = sessionStorage.getItem(SS_KEY);
    return state && MOCKS[state] ? MOCKS[state] : null;
  } catch {
    return null;
  }
}
