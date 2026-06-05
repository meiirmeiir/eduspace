# Playwright визуальный аудит отображения dailyTasks — полный прогон (306 банков)

Метод: вход админом → Администрирование → Ежедневные задачи → раскрытие каждого банка
(`👁 Просмотр`) → задачи рендерятся через настоящий `LatexText`/KaTeX. Для каждой задачи:
`.katex-error` (ошибки KaTeX — рендерятся красным) + текстовые узлы ВНЕ `.katex` с видимыми
`$` / `\frac`\\`\sqrt`\\`\команда` / `^` / `_` (математика, «свалившаяся» в plain text).
Исключены: `.katex` (включая скрытый MathML-`<annotation>`), `<style>`, кнопки.

## Прогресс по батчам (по 50 банков)
| Батч | Банки | Проблем |
|---|---|---|
| 1 | 1–50 | 13 |
| 2 | 51–100 | 27 |
| 3 | 101–150 | 8 |
| 4 | 151–200 | 38 |
| 5 | 201–250 | 30 |
| 6 | 251–300 | 106 |
| 7 | 301–306 | 8 |
| **Итого** | **306** | **~230** |

## Сводка по типам
| Тип | Кол-во (≈) | Серьёзность | Автоматизация |
|---|---|---|---|
| **KaTeX-ошибка** (рендер красным/битый) | ~55 задач / 26 навыков | 🔴 высокая | частично авто (см. корневые причины) |
| **Bare-математика в options** (видимые `^`/`_`/`\cmd` без `$`) | ~60 | 🟠 средняя | полу-авто (обернуть в `$`) |
| **Bare-математика в explanation** (видимые `^`/`_` без `$`) | ~70 | 🟠 средняя | полу-авто (обернуть в `$`) |
| **Непарный `$`** (виден литеральный `$`) | ~8 | 🟠 средняя | ручная |

## Корневые причины KaTeX-ошибок (важно)
1. **Управляющие символы вместо escape** — самая коварная. В части строк команда, начинающаяся
   на `\b`/`\f`/`\r`, содержит невидимый control-char вместо обратного слеша:
   `\frac`→[FF]`rac`, `\bar`→[BS]`ar`, `\right`→`\night`. KaTeX даёт «Unexpected character».
   Навыки: `calc_advanced`, `dispersion_analysis`, `event_classification_logic`,
   `poly_substitution_solving`, `trig_systems_complex`, `trig_unit_circle_values`,
   `inv_trig_compositions/graphs`, `trig_ineq_final`. → **авто-фикс** (заменить control-char + остаток на `\<cmd>`).
2. **Лишняя/смещённая скобка `\frac{A}}{B}`** (и `10^{-\frac{N}}{...}`, `10^{}`): «Extra }».
   Навыки: `app_model`, `approx_err`, `npower_props`, `npower_calc`, `std_arith`, `std_comp`,
   `nstd_rep`, `table_integration_rules`, `log_properties_application`, `quadratic_inequality_intervals`,
   `lim_algebraic_solving`, `func_inverse_full`. → **авто-фикс** (нормализовать скобки).
3. **Незакрытые/мусорные скобки** (`y^{k+1`, `\\frac{{x}{...}\}`, `sqrt[3]\frac{{x}{2}+4}`):
   `factoring_common_out`, `factorial_mastery`, `range_determination`, `definite_integral_newton_leibniz`,
   `dispersion_analysis #39`. → ручная.

## Детально: KaTeX-ошибки (рендер красным)
| Навык | № задач | Пример | Причина |
|---|---|---|---|
| `app_model` | #11, #19 | `10^{-\frac{10}}{10^{}-15}` | лишняя `}` |
| `approx_err` | #31 | `10^{-\frac{4}}{(5 \cdot 10^{-3})}` | лишняя `}` |
| `calc_advanced` | #3, #5, #38 | `y = [FF]rac{x+1}{x-1}` | control-char `\frac` |
| `definite_integral_newton_leibniz` | #39 | `\int_{\\frac{pi}{2}^}\pi` | мусор/двойной слеш |
| `dispersion_analysis` | #1,#4,#9,#12,#19,#35,#37,#39 | `(x_i - [BS]ar{x})^2` | control-char `\bar` |
| `event_classification_logic` | #10 | `P([BS]ar{A}) = 1 - P(A)` | control-char `\bar` |
| `factorial_mastery` | #7 | `P_{n+\frac{1}}{P_{n}-1}` | лишняя `}` |
| `factoring_common_out` | #26 | `y^{k+3} - y^{k+2} + y^{k+1` | незакрытая `{` |
| `func_inverse_full` | #22 | `sqrt[3]\frac{{x}{2} + 4}` | мусор скобок |
| `inv_trig_compositions` | #18,#35,#39 | `\arccos\left(\cos\left(...\night))` | `\right`→`\night` |
| `inv_trig_graphs` | #29,#33,#36 | `y = [FF]rac{2}{\pi}\arctan(x)` | control-char `\frac` |
| `lim_algebraic_solving` | #3,#25 | `\frac{2 - \frac{3}{x} + \frac{1}{x^2}{5}` | смещённая `}` |
| `log_properties_application` | #6,#19 | `a^{\log_b \frac{c}}{c^{}\log_b a}` | лишняя `}` |
| `npower_calc` | #19 | `5^{n+\frac{2}}{5^{n}+1}` | лишняя `}` |
| `npower_props` | #12,#26,#32,#34 | `6^{n+\frac{1}}{6^n}` | лишняя `}` |
| `poly_substitution_solving` | #3,#13,#14,#17,#21,#22,#32 | `x^2 + [FF]rac{1}{x}` | control-char `\frac` |
| `quadratic_inequality_intervals` | #33 | `\sqrt{x^2 - 3x - \frac{4}}{(x-5)}` | лишняя `}` |
| `range_determination` | #31 | `\\frac{{x}{(x+1)}\}` | мусор скобок |
| `std_arith` | #11,#21 | `10^{-\frac{3}}{(5 \cdot 10^{-2})}` | лишняя `}` |
| `std_comp` | #28 | `A = 10^{-\frac{2}}{10^{}-5}` | лишняя `}` |
| `nstd_rep` | #36 | `1.23 \cdot 10^5 \cdot 10^{-\frac{2}}{0.001}` | лишняя `}` |
| `table_integration_rules` | #5 | `x^{-\frac{1}}{(-1)}` | лишняя `}` |
| `trig_ineq_final` | #25 | `-[FF]rac{4\pi}{3}` | control-char `\frac` |
| `trig_systems_complex` | #3,#24,#26,#29,#33,#35 | `[FF]rac{\sin(x+y)}{\cos x \cos y}` | control-char `\frac` |
| `trig_unit_circle_values` | #1,#13,#37 | `\sin([FF]rac{25\pi}{6})` | control-char `\frac` |

## Детально: bare-математика без `$` (видимые `^`/`_`/`\cmd`)
| Навык | Поле | № задач | Пример |
|---|---|---|---|
| `sequence_calculation` | explanation | #1–#40 (почти все) | `a_10 = 10^2 - 5*10 + 6 = 56` |
| `transcendental_integration` | options | #8,#9,#13,#16,#21,#24,#26,#30,#36,#39 | `5^x / ln 5 + C`, `e^(3x) + C`, `log_2 e` |
| `log_foundations` | options | #3,#10,#14,#18,#21,#23,#30,#37 | `log_2 7`, `2^8` |
| `log_properties_application` | options | #1,#2,#9 | `log_3 6`, `log_2 3` |
| `vieta_method` | explanation | #6,#31,#32,#33,#34,#37,#38,#40 | `(x1 + x2)^2 - 2*x1*x2 = 73` |
| `sqrt_graphing` | explanation | #4,#5,#8,#18,#20,#21,#35,#36 | `m = 1,5^2 = 2,25`, `(1-0)^2` |
| `sqrt_domain_id` | explanation | #5,#8,#10,#18,#35 | `(x+1)^2`, `-(x-3)^2 >= 0` |
| `exp_graph_and_monotony` | options | #14,#26,#27,#40 | `y = (0.5)^x`, `log_2(x+3)`, `x_1 < x_2` |
| `linear_relations` | options | #23 | `k_1 = k_2`, `b_1 = b_2 = 0` |
| `nonlinear_properties` | options | #8,#29 | `f(x_1) < f(x_2)`, `(x+3)^2` |
| `poly_coefficients_theory` | options | #17,#30 | `2^{50}`, `(1-3^{10})/2` |
| `quad_combined_transform` | options | #18 | `y = -2(x+1)^2 + 5` |
| `physical_modeling` | options | #35 | `10^6 * e`, `10^8` |
| `poly_classification` | options | #6 | `2^{10}` |
| `npower_calc / npower_props` | options | #19,#29 / #15 | `5^n`, `3^n`, `12^2` |
| `ident_theory` | options | #10 | `(a - b)^2 = a^2 - b^2` |
| `binomial_dist_mastery` | options | #17 | `4 * (0,75)^15` |
| `bayes_total_prob_analysis` | explanation | #5,#20 | `P(R_trans) = 0.5`, `0.9*0.2 + 0.1*0.8` |
| `de_fundamentals` | options | #20 | `C_1 = 0` |
| `irr_eq_substitution` | options | #2 | `x = \pm` (видимая `\pm`) |
| `harmonic_osc` | options | #17 | `t = \arctan(` (видимая `\arctan`) |
| `infinite_geometric_series` | options | #20 | `2\pi`, `1.5\pi` (видимая `\pi`) |
| `log_graph_and_domain` | options | #14 | `y = \log_2 (`, `y = \log_{` |

## Детально: непарный `$` (виден литеральный `$`)
| Навык | № | Фрагмент |
|---|---|---|
| `complete_square_method` | #18 | `… = 8 - 2(x-3)^2$. Максимум 8.` |
| `grouped_mean_calc` | #2 | `x=10$.` |
| `interval_notation_basics` | #6 | `[-1; 3]$.` |
| `npower_props` | #39 | `$(2^4)^2 / 2^7 = 2^8 / 2^7 = 2^1 = 2.` |
| `seq_pattern` | #14 (option) | `243$` |
| `symmetry_transformations_mastery` | #11 (option) | `-3$` |
| `systems_representation` | #16 | `\emptyset$.` |

## Замечания
- `.katex-error` действительно срабатывает в этом приложении (react-katex рендерит ошибку
  красным с классом) — это надёжный сигнал «битый LaTeX».
- Bare-`^`/`_` в options/explanation — KaTeX отрендерил бы их корректно, **если бы** строка
  была в `$…$`; проблема в отсутствии разделителей (`LatexText` оборачивает только `\команды`,
  не голые `a_n`/`2^x`). Это та же «формула без `$`», что и в `audit/display-issues.md`, но
  здесь подтверждено визуально на рендере.
- Скриншот рабочего рендера (для контраста): `playwright-abs_ineq_visual.jpeg`.

## Рекомендация по фиксам
1. 🔴 **Сначала KaTeX-ошибки** (ломают рендер): авто-скрипт на (а) control-char-команды
   (искать `\x08\x0c\x0d` + остаток → `\bar`/`\frac`/…; `\night`→`\right`) и (б) `\frac{A}}{B}`/
   `10^{}` нормализацию. Остаток (незакрытые скобки) — ручками (~6 задач).
2. 🟠 **Затем bare-математика без `$`**: полу-авто оборачивание (особенно целые explanation
   в `sequence_calculation` и options в `transcendental_integration`/`log_*`).
3. 🟠 **Непарные `$`** (~8) — ручками.

---

## ПОСЛЕ применения `fix-katex-errors.mjs` (control-символы)
Применено 146 восстановлений (`\frac`/`\bar`/`\times`/`\rho`/`\to`/`\text`/`\ne`/`\neq`/`\tan`/`\right`/`\theta`)
в 20 документах. Бэкап `migration/backups/2026-05-28T16-15-21/`.

**Исчезли** (были control-char): `calc_advanced`, `trig_unit_circle_values`, `inv_trig_compositions`,
`geometric_probability_calculation`, `event_classification_logic`, `dispersion_analysis` (кроме #39),
`trig_systems_complex` (кроме одного), `inv_trig_graphs`.

**Осталось 24 KaTeX-ошибки в 17 навыках — Тип-2 (смещённые/лишние скобки `\frac{A}{B}}`, `10^{-\frac{N}}{…}`) — РУЧНАЯ правка:**
| Навык | Ошибок | Навык | Ошибок |
|---|---|---|---|
| npower_props | 4 | std_comp | 1 |
| app_model | 2 | nstd_rep | 1 |
| lim_algebraic_solving | 2 | table_integration_rules | 1 |
| log_properties_application | 2 | trig_systems_complex | 1 |
| std_arith | 2 | dispersion_analysis (#39) | 1 |
| approx_err | 1 | func_inverse_full | 1 |
| factorial_mastery | 1 | npower_calc | 1 |
| factoring_common_out | 1 | quadratic_inequality_intervals | 1 |
| range_determination | 1 | | |

Эти ~24 — неоднозначные смещения скобок (интент нельзя восстановить автоматически без риска
исказить математику), поэтому правятся вручную. Тип-3 (bare-математика без `$`) — отдельный
аккуратный проход.
