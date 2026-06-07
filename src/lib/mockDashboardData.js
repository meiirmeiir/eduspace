// ── DEBUG-режим дашборда: ?dashboard_debug=new|beginner|active|advanced ──────
// ВРЕМЕННЫЙ инструмент для визуальной проверки дашборда на разных стадиях
// пользователя без реальных аккаунтов. Подменяет данные ТОЛЬКО на чтение
// (user-поля, masteryStatus, rankInfo, planSkills, квесты) — записи в
// Firestore никак не блокируются, поэтому не жми кнопки покупок/квестов
// в этом режиме. Удалить файл + 4 точки подключения, когда отпадёт нужда.
//
// Точки подключения:
//   DashboardScreen.jsx — user/masteryStatus/rankInfo/planSkills/progressData
//   QuestsWidget.jsx    — prop mockQuests

// XP подобраны под уровни через getLevelInfo (xpForLevel = 50·l·(l+1)):
//   200 → ур.2 · 6200 → ур.7 · 58000 → ур.15

// Реалистичные skill_id (формат как в individualPlans.skills_list).
const SKILLS_POOL = [
  'alg_g5_equations_component',      'alg_g5_coord_ray_compare',
  'arith_g5_divisibility_sum',       'arith_g5_natural_sort',
  'alg_g6_identity_concept',         'alg_g6_rational_arithmetic',
  'alg_g6_rational_coord_compare',   'alg_g7_monomial_standard',
  'alg_g7_polynomial_methods',       'alg_g7_power_integer_exp',
  'alg_g8_frac_rational_equations',  'alg_g8_real_numbers_roots',
  'alg_g9_combinatorics_rules',      'arith_g6_integers_sets',
];

// Детерминированная «активность» за N дней (без Math.random — стабильные скрины).
function genActivity(daysBack, density, peak) {
  const out = {};
  const now = new Date();
  for (let i = 0; i < daysBack; i++) {
    // псевдослучай от индекса: пропуски и волны интенсивности
    const wave = Math.abs(Math.sin(i * 1.7)) // 0..1
    if (wave < (1 - density)) continue;      // день пропущен
    const d = new Date(now.getTime() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out[key] = Math.max(1, Math.round(wave * peak));
  }
  return out;
}

// recentAnswers: порядок не влияет на расчёт точности — первые `correct` true.
const answers = (total, correct) => Array.from({ length: total }, (_, i) => i < correct);

const MOCKS = {
  // ── Совсем новый: диагностика не пройдена → NewUserDashboard ──
  new: {
    user: {
      smartDiagDone: false, xp: 0, streak: 0, crystals: 0, weekPoints: 0,
      recentAnswers: [], activity: {}, equipped: {}, inventory: [], avatarUrl: '',
      dailyQuests: {}, weeklyQuests: {},
    },
    masteryStatus: { hasMastered: false, masteredCount: 0, hasDueToday: false, completedToday: false },
    rankInfo: null,
    planSkills: null,
    progressData: { topics: {}, skills: {} },
    quests: { daily: {}, weekly: {} },
  },

  // ── Начинающий: 1-2 навыка, стрик 3, уровень 2, 1 дейлик сделан ──
  beginner: {
    user: {
      smartDiagDone: true, xp: 200, streak: 3, crystals: 85, weekPoints: 45,
      recentAnswers: answers(12, 9), activity: genActivity(4, 0.9, 6),
      equipped: { helmet: 'eq-helmet-pilot' }, inventory: ['eq-helmet-pilot'],
    },
    masteryStatus: { hasMastered: true, masteredCount: 1, hasDueToday: true, completedToday: false },
    rankInfo: { globalRank: 38, globalTotal: 52, gradeRank: 9, regionRank: 14, myPoints: 45, weekChange: 45 },
    planSkills: SKILLS_POOL.slice(0, 8),
    progressData: { topics: {}, skills: {} },
    quests: {
      daily: {
        daily_questions:   { progress: 5, completed: true },
        daily_skill_stage: { progress: 0, completed: false },
        daily_streak:      { progress: 1, completed: true },
      },
      weekly: {
        weekly_questions: { progress: 9,  completed: false },
        weekly_streak:    { progress: 3,  completed: false },
      },
    },
  },

  // ── Активный: 4 навыка освоено, стрик 12, уровень 7 ──
  active: {
    user: {
      smartDiagDone: true, xp: 6200, streak: 12, crystals: 420, weekPoints: 380,
      recentAnswers: answers(50, 42), activity: genActivity(25, 0.8, 16),
      equipped: { helmet: 'eq-helmet-pilot', top: 'eq-top-jacket' },
      inventory: ['eq-helmet-pilot', 'eq-top-jacket', 'eq-bottom-pants', 'bg-minecraft'],
    },
    masteryStatus: { hasMastered: true, masteredCount: 4, hasDueToday: true, completedToday: false },
    rankInfo: { globalRank: 12, globalTotal: 52, gradeRank: 3, regionRank: 5, myPoints: 380, weekChange: 120 },
    planSkills: SKILLS_POOL.slice(0, 12),
    progressData: { topics: {}, skills: {} },
    quests: {
      daily: {
        daily_questions:   { progress: 5, completed: true },
        daily_skill_stage: { progress: 1, completed: true },
        daily_streak:      { progress: 1, completed: true },
      },
      weekly: {
        weekly_top50:     { progress: 1,  completed: true },
        weekly_skills:    { progress: 1,  completed: false },
        weekly_questions: { progress: 22, completed: false },
        weekly_streak:    { progress: 5,  completed: false },
      },
    },
  },

  // ── Продвинутый: 12 навыков, стрик 45, уровень 15, полная экипировка ──
  advanced: {
    user: {
      smartDiagDone: true, xp: 58000, streak: 45, crystals: 1850, weekPoints: 1340,
      recentAnswers: answers(50, 46), activity: genActivity(110, 0.95, 26),
      equipped: { helmet: 'eq-helmet-cyber', top: 'eq-top-armor', bottom: 'eq-bottom-armor', boots: 'eq-boots-jet', frame: 'frame-fire', background: 'bg-anime-city', title: 'title-king-formulas' },
      inventory: [
        'eq-helmet-cyber', 'eq-top-armor', 'eq-bottom-armor', 'eq-boots-jet',
        'eq-helmet-pilot', 'eq-top-jacket', 'eq-bottom-pants', 'eq-boots-pilot',
        'frame-fire', 'bg-anime-city', 'theme-galaxy', 'title-king-formulas',
      ],
    },
    masteryStatus: { hasMastered: true, masteredCount: 12, hasDueToday: false, completedToday: true },
    rankInfo: { globalRank: 2, globalTotal: 52, gradeRank: 1, regionRank: 1, myPoints: 1340, weekChange: 210 },
    planSkills: SKILLS_POOL.slice(0, 14),
    progressData: { topics: {}, skills: {} },
    quests: {
      daily: {
        daily_questions:   { progress: 5, completed: true },
        daily_skill_stage: { progress: 1, completed: true },
        daily_streak:      { progress: 1, completed: true },
      },
      weekly: {
        weekly_top50:     { progress: 1,  completed: true },
        weekly_skills:    { progress: 3,  completed: true },
        weekly_questions: { progress: 30, completed: true },
        weekly_streak:    { progress: 7,  completed: true },
      },
    },
  },
};

// ── Захват параметра ПРИ ЗАГРУЗКЕ БАНДЛА (side-effect импорта) ───────────────
// Роутинг приложения — кастомный hash-based, и на пути гостя/редиректов есть
// replaceState('/'), стирающие query до того, как DashboardScreen отрендерится.
// Поэтому параметр ловим в момент исполнения модуля (раньше любого React-кода)
// и кладём в sessionStorage (живёт до закрытия вкладки).
// Поддерживаются оба формата:
//   ?dashboard_debug=new#dashboard   (query до hash)
//   #dashboard?dashboard_debug=new   (query внутри hash — вычищается из URL,
//                                     иначе строгий hash-роутер App не узнает экран)
// Выключение: ?dashboard_debug=off или закрыть вкладку.
const SS_KEY = 'dashboard_debug';
function captureFromUrl() {
  try {
    const before = sessionStorage.getItem(SS_KEY);
    let v = new URLSearchParams(window.location.search).get(SS_KEY);
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (!v && qIdx >= 0) v = new URLSearchParams(hash.slice(qIdx + 1)).get(SS_KEY);
    if (qIdx >= 0) {
      // срезать query из hash ДО инициализации роутера App (#dashboard?x → #dashboard)
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hash.slice(0, qIdx));
    }
    if (!v) return false;
    if (v === 'off') sessionStorage.removeItem(SS_KEY);
    else if (MOCKS[v]) sessionStorage.setItem(SS_KEY, v);
    return sessionStorage.getItem(SS_KEY) !== before;
  } catch { return false; /* SSR/приватный режим — дебаг просто не активируется */ }
}
captureFromUrl();
// Смена hash на лету (#dashboard?dashboard_debug=advanced) не перезагружает
// бандл — ловим событие и, если режим изменился, перезагружаем страницу,
// чтобы все виджеты перечитали мок. Слушаем именно popstate: он стреляет
// ПЕРВЫМ (до hashchange), а App-овский popstate-роутер переписывает hash и
// успел бы срезать query. Наш листенер регистрируется при загрузке бандла —
// раньше App-овского useEffect → выполняется первым в цепочке popstate.
try {
  const onNav = () => { if (captureFromUrl()) window.location.reload(); };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav); // запасной путь
} catch { /* no-op */ }

// null, если режим не включён или state неизвестен.
export function getDashboardMock() {
  try {
    const state = sessionStorage.getItem(SS_KEY);
    return state && MOCKS[state] ? MOCKS[state] : null;
  } catch {
    return null;
  }
}
