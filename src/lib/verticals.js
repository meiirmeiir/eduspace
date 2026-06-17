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

// Оттенок (hue°) планеты раздела — чтобы темы на карте теории различались по цвету
// (а не были одинаково серыми). 11 различимых оттенков по кругу. Единый источник.
export const VERTICAL_HUE = {
  PROBABILITY:     0,   // красный
  ARITHMETIC:     35,   // оранжевый
  WORD_PROBLEMS:  60,   // жёлтый
  TRIGONOMETRY:  100,   // лайм
  GEOMETRY:      150,   // зелёный
  STATISTICS:    190,   // циан
  ALGEBRA:       220,   // синий
  CALCULUS:      245,   // индиго
  NUMBER_THEORY: 275,   // фиолетовый
  FUNCTIONS:     305,   // магента
  LOGIC:         335,   // розовый
};

// vertical id → hue°. Неизвестное → нейтральный (210, синевато-серый).
export function verticalHue(id) {
  if (!id) return 210;
  const h = VERTICAL_HUE[String(id).toUpperCase()];
  return h == null ? 210 : h;
}
