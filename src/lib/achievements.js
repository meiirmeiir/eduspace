// Определения достижений — источник правды для UI (профиль/сундук).
// ВНИМАНИЕ: пороги выдачи продублированы в functions/index.js (Cloud Functions —
// отдельный пакет, не импортирует src/). При изменении порогов — синхронизировать.

export const ACHIEVEMENTS = [
  { id: 'scholar', icon: '🧠', name: 'Знаток',
    levels: [
      { level: 1, tier: 'bronze', desc: 'Освой 1 навык',    crystals: 25,  threshold: 1 },
      { level: 2, tier: 'silver', desc: 'Освой 5 навыков',  crystals: 75,  threshold: 5 },
      { level: 3, tier: 'gold',   desc: 'Освой 15 навыков', crystals: 150, threshold: 15 },
    ]},
  { id: 'streak', icon: '🔥', name: 'Стрик',
    levels: [
      { level: 1, tier: 'bronze', desc: '3 дня подряд',   crystals: 25,  threshold: 3 },
      { level: 2, tier: 'silver', desc: '14 дней подряд', crystals: 75,  threshold: 14 },
      { level: 3, tier: 'gold',   desc: '30 дней подряд', crystals: 150, threshold: 30 },
    ]},
  { id: 'accuracy', icon: '🎯', name: 'Точность',
    levels: [
      { level: 1, tier: 'bronze', desc: '70% из последних 50 ответов', crystals: 25,  threshold: 70 },
      { level: 2, tier: 'silver', desc: '80% из последних 50 ответов', crystals: 75,  threshold: 80 },
      { level: 3, tier: 'gold',   desc: '90% из последних 50 ответов', crystals: 150, threshold: 90 },
    ]},
  { id: 'wealth', icon: '💎', name: 'Богатство',
    levels: [
      { level: 1, tier: 'bronze', desc: '100 кристаллов накоплено',  crystals: 25,  threshold: 100 },
      { level: 2, tier: 'silver', desc: '500 кристаллов накоплено',  crystals: 75,  threshold: 500 },
      { level: 3, tier: 'gold',   desc: '2000 кристаллов накоплено', crystals: 150, threshold: 2000 },
    ]},
  { id: 'ranking', icon: '🏆', name: 'Рейтинг',
    levels: [
      { level: 1, tier: 'bronze', desc: 'Войди в топ 50%', crystals: 25 },
      { level: 2, tier: 'silver', desc: 'Войди в топ 25%', crystals: 75 },
      { level: 3, tier: 'gold',   desc: 'Войди в топ 10%', crystals: 150 },
    ]},
  { id: 'legend', icon: '👑', name: 'Легенда', exclusive: true,
    levels: [{ level: 1, tier: 'exclusive', desc: 'Топ-1 глобального рейтинга 3 раза', crystals: 300 }]},
  { id: 'master', icon: '🌟', name: 'Мастер', exclusive: true,
    levels: [{ level: 1, tier: 'exclusive', desc: 'Освой все навыки своего плана', crystals: 300 }]},
  { id: 'champion', icon: '⚔️', name: 'Чемпион', exclusive: true,
    levels: [{ level: 1, tier: 'exclusive', desc: 'Займи топ-1 в недельном рейтинге', crystals: 300 }]},
  { id: 'oracle', icon: '🔮', name: 'Оракул', exclusive: true,
    levels: [{ level: 1, tier: 'exclusive', desc: 'Пройди диагностику с результатом 90%+', crystals: 300 }]},
  { id: 'creator', icon: '⚡', name: 'Создатель AAPA', exclusive: true, superExclusive: true,
    levels: [{ level: 1, tier: 'exclusive', desc: 'Основатель и создатель платформы', crystals: 0 }]},
];

export const TIER_COLORS = { bronze: '#cd7f32', silver: '#94a3b8', gold: '#fbbf24', exclusive: '#a78bfa' };
