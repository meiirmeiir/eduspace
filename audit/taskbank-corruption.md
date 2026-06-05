# taskBank — порча кириллицы (литеральные `?` / U+003F): инцидент и восстановление

## Что было
Кириллица в части документов `taskBank` была заменена на литеральные `?` (U+003F) —
порча кодировки при импорте (текст прошёл через charset без кириллицы; каждый
кириллический символ → один `?`). Математика `$...$`, числа, латиница, индекс верного
ответа — **целы**. Не шрифт и не React — порча в самих данных Firestore.

Обнаружено при прохождении диагностики 5 класса на проде: вопрос показывал
`?????? ?????????:` вместо «Решите уравнение:» (skill `complex_equation_solving`,
task `complex_eq_std_1`). Кодпоинты в DOM = U+003F (буквальные `?`), а не кириллица.

## Масштаб (полный скан 307 документов)
**3 документа, 9 задач, 66 полей** (детектор — руны `?{2,}`; одиночные `?` = легитимные
концы вопросов):

| taskBank doc | задач | полей | task_id |
|---|--:|--:|---|
| `complex_equation_solving` | 3 | 30 | complex_eq_std_1, complex_eq_ctx_2, complex_eq_hard_3 |
| `sequence_generation` | 3 | 24 | sequence_gen_std_1, sequence_gen_cont_2, sequence_gen_comp_3 |
| `mixed_improper_logic` | 3 | 12 | mixed_improper_std_1, mixed_improper_context_2, mixed_improper_compound_3 |

Испорченные поля задачи: `question_text`, `explanation`, `skills_tested[]` (и единицы в
`options`, напр. «20 ??» = «20 см»).

> Ложные срабатывания (исключены): 4 банка (`gcd_lcm_word_problems`, `percent_computations`,
> `proportional_problem_solving`, `unit_circle_coordinates`) — там `?` это легитимные знаки
> вопроса, кириллица цела.

## Прочие коллекции — чисты
`questions` (1600), `sections` (100), `skills` (1206) — **0 порчи**. Диагностика 5 класса
тянет скилл-вопросы из `taskBank`, поэтому ломались именно эти.

## Восстановление (источник: seed `audit/tasks_grade_5.json`, якорь = математика `$...$`)
| Метод | Задач | Как |
|---|--:|---|
| Полное из seed | 4 | якорь + options + correct совпали → text/explanation/skills (`scripts/restore-taskbank.mjs`) |
| question+skills из seed (tier-2) | +4 | якорь+options совпали, correct разошёлся → восстановлены не-ответные поля |
| explanation из seed (верифиц.) | 2 | seed-разбор выводит ответ taskBank → `scripts/restore-taskbank-expl2.mjs` |
| LLM-регенерация (переписчик+валидатор) | 3 | seed-разбор был ошибочен/оборван/др. опции → `scripts/apply-taskbank-regen.mjs` |

**Итог: 66 → 0 испорченных полей. Все 9 задач восстановлены, ответы сохранены, `?` нет.**
Заодно исправлены 2 авторские ошибки ответа в seed (seed.correct ≠ верному; taskBank.correct
был прав — подтверждено решением).

Бэкапы: `migration/backups/2026-06-05T12-38..47-taskbank-*` (5 шт).
Скрипты: `restore-taskbank.mjs`, `restore-taskbank-expl2.mjs`, `apply-taskbank-regen.mjs`;
сканеры/экстракторы — `audit/scan-taskbank-all.mjs`, `find-taskbank-corruption.mjs`,
`taskbank-restore-explore.mjs`, `extract-taskbank-regen.mjs`.
