// Русские названия вертикальных линий (категорий навыков).
// В данных (skillTheory.vertical_line_id, taskBank.vertical_line_id и т.д.)
// категории хранятся английскими id — этот маппинг используется ВЕЗДЕ, где
// категория показывается пользователю. Неизвестный id показывается как есть.

export const RU_VERTICALS = {
  ALGEBRA:        'Алгебра',
  ARITHMETIC:     'Арифметика',
  GEOMETRY:       'Геометрия',
  NUMBER_THEORY:  'Теория чисел',
  PROBABILITY:    'Вероятность',
  STATISTICS:     'Статистика',
  WORD_PROBLEMS:  'Текстовые задачи',
  FUNCTIONS:      'Функции',
  TRIGONOMETRY:   'Тригонометрия',
  CALCULUS:       'Математический анализ',
  LOGIC:          'Логика',
};

// «GEOMETRY» → «Геометрия»; неизвестное — как есть.
export function ruVertical(id) {
  if (!id) return '';
  return RU_VERTICALS[String(id).toUpperCase()] || String(id);
}

// Для заголовков секций: «ГЕОМЕТРИЯ»
export function ruVerticalUpper(id) {
  return ruVertical(id).toUpperCase();
}
