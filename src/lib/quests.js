// Определения ежедневных и еженедельных заданий (квестов).
// type — ключ события, по которому updateQuestProgress находит квест и его bucket
// (DAILY → users/{uid}.dailyQuests, WEEKLY → users/{uid}.weeklyQuests).

export const DAILY_QUESTS = [
  { id: 'daily_questions',    icon: '🎯', title: 'Реши 5 вопросов',     desc: 'Ответь правильно на 5 вопросов в ежедневных задачах', crystals: 15, target: 5, type: 'daily_correct' },
  { id: 'daily_skill_stage',  icon: '📚', title: 'Пройди этап навыка',  desc: 'Заверши любой этап навыка (1, 2 или 3)',               crystals: 20, target: 1, type: 'skill_stage' },
  { id: 'daily_streak',       icon: '🔥', title: 'Не прерывай стрик',   desc: 'Зайди сегодня и реши хотя бы 1 вопрос',                crystals: 10, target: 1, type: 'login_answer' },
];

export const WEEKLY_QUESTS = [
  { id: 'weekly_top50',     icon: '🏆', title: 'Войди в топ 50%',  desc: 'Набери больше очков чем половина участников', crystals: 50,  target: 1,  type: 'ranking_top50' },
  { id: 'weekly_skills',    icon: '🧠', title: 'Освой 3 навыка',   desc: 'Полностью освой 3 навыка за неделю',          crystals: 100, target: 3,  type: 'weekly_mastered' },
  { id: 'weekly_questions', icon: '⚡', title: 'Реши 30 вопросов', desc: 'Ответь правильно на 30 вопросов за неделю',   crystals: 75,  target: 30, type: 'weekly_correct' },
  { id: 'weekly_streak',    icon: '🔥', title: '7 дней подряд',    desc: 'Заходи на платформу 7 дней подряд',          crystals: 200, target: 7,  type: 'streak_7' },
];
