# Логик-аудит 207 базовых банков skillTasks (маркер-триаж)

**Метод.** Маркер-триаж explanation (ой ошибка / перепроверим / опечатка / сдвинуто / исправим / пусть будет / пересчёт / Подожди / Стоп) в a/b/c всех **207** ранее непроверенных банков → **80** подозрительных задач в **50** банках → Workflow (14 агентов решают каждую и сверяют с correct/explanation). Read-only.

## Итог: 80 маркер-задач → **65 реальных проблем** (15 ok = ложные маркеры)

- ошибки ключа: **34** · нет верного: **30** · противоречие explanation: **1**
- оценка чинимости: ключ-фикс (re-point correct из решённого) ≈ **32** · нужен rewrite/ручная ≈ **33**

Маркер-триаж показал высокую точность (**65/80**) — фразы саморедактирования надёжно указывают на сломанный ключ/ответ. Расширять до случайных 30 банков не потребовалось.

## Все находки

| Банк | Ур | # | Вид | Решено | corr | Заметка |
|---|--|--|---|---|--|---|
| `average_value_application` | c | 16 | no_correct | 212.5 | 0 | X=ab+bc+ca=637.5, mean=637.5/3=212.5 (explanation confirms 212.5). Нет в options; correct=0='11 |
| `combinatorics_enumeration` | a | 19 | key_error | 3 | 3 | КРОВ: согл К,Р,В(3)·гласн О(1)=3. Ответ 3=options[0], а correct=3='4'. |
| `continuity_analysis` | c | 9 | no_correct | перегиб в x=2, касательная | 2 | x=2 — перегиб, но y'(2)=0 => касательная ГОРИЗОНТАЛЬНА. options[2] утверждает 'вертикальна' — н |
| `coordinate_ray_plotting` | c | 12 | no_correct | x=6 | 1 | x=(x+6)/2 => x=6 (единственное решение). correct=1='Нет решений' неверен; 6 нет в options. |
| `counting_principles` | c | 11 | key_error | 2 - 2\sin 2\alpha | 3 | Sum = 2(cosα-sinα)^2 = 2-2sin2α = options[2]; correct points to 3 ($2$). Explanation also lands |
| `cum_freq_calc` | c | 25 | key_error | 750 | 3 | Frequencies 5,10,15,20; sum of squares 25+100+225+400=750 = options[1]; correct=3 (775). Explan |
| `curvature_analysis` | c | 22 | key_error | (-6, 8) | 2 | Foot of perpendicular is (-3,4); symmetric point = 2*foot = (-6,8) = options[0]. correct=2 give |
| `data_grouping_analysis` | c | 27 | key_error | 120 | 3 | (100+500+x)/16=45 => x=120 = options[0]; correct=3 (145). Explanation derives x=120. |
| `dec_round` | c | 31 | key_error | 2,7 | 3 | 7,2-4,55=2,65, округление до десятых=2,7 (options[1]); correct=3 указывает на 2,6. Маркер верен |
| `dec_round` | c | 36 | key_error | 10 | 1 | Сумма=6,6; округление до десятков=10 (options[2]); correct=1 указывает на 7. Ключ должен быть 2 |
| `diagram_data_analysis` | c | 38 | key_error | Осталась 30% | 1 | П:50->40 (-10), О:20->30 (+10), сумма=100, доля ржи остаётся 30% (options[0]); correct=1 даёт 2 |
| `discrete_rv_modeling` | b | 13 | key_error | 10 | 1 | (2x-5)*8=120 => x=10 (options[0]); correct=1 даёт 10,5. Ключ должен быть 0. |
| `frequency_table_construction` | c | 34 | no_correct | 26,67 (нет целого) | 2 | f7=20, прочие=40 => f8+f9=40, f8=f9/2 => f9=40/1,5=26,67 — не целое и не среди options. Условие |
| `func_inverse_full` | c | 37 | no_correct | 305 | 1 | (2,5*4-6)^3:0,2+10-25 = 4^3:0,2+10-25 = 64:0,2-15 = 320-15 = 305. Нет среди options. Explanatio |
| `gcd_lcm_calculation` | c | 29 | no_correct | \pm\sqrt2; \pm\sqrt5 | 1 | t=1,4 -> x=±√2,±√5. Ни один вариант не совпадает: opt1 '0;±√5' неверен, opt0 добавляет лишний 0 |
| `gcd_lcm_word_problems` | c | 7 | key_error | 20 мин | 1 | НОК(80,100,120)=1200 сек=20 мин = options[0], а correct=1 ('10 мин'). Ключ должен быть 0. |
| `graphical_systems` | c | 25 | no_correct | ни при каком m (для y=x+m) | 1 | Для y=x+m: x^2+mx-4=0, D=m^2+16>0 всегда 2 точки. Ответ '4 или -4' верен только для y=-x+m. Воп |
| `interval_notation_basics` | c | 2 | key_error | 21 | 0 | [-4;6]∩(0;10)=(0;6], целые 1..6, сумма=21 = options[1]; correct=0 ('15') неверен. Ключ должен б |
| `inv_trig_calc_base` | c | 2 | key_error | Ни один | 2 | x+2=3=>x=1; x=5 даёт 7≠3, x=2 не в ОДЗ. Ни один не корень = options[3]; correct=2 ('Только x=5' |
| `inv_trig_calc_base` | c | 8 | key_error | log_2 2=1 — не корень | 1 | log_2(3-1)=log_2 2=1≠2 — не корень = options[3]; correct=1 ('log_2 4=2 — корень') неверен. Ключ |
| `inv_trig_compositions` | b | 14 | key_error | 1/6 (=option[0]) | 1 | Сумм ≤4: 6 исходов из 36 = 1/6 = option[0]. Сам explanation даёт 1/6, но correct стоит на index |
| `inv_trig_compositions` | c | 3 | key_error | 455/969 (=option[1]) | 2 | C(5,1)·C(15,3)/C(20,4)=5·455/4845=455/969=option[1]. explanation также даёт 455/969, но correct |
| `inverse_proportional_division` | c | 22 | no_correct | 2166 (части 38,57,95; 57·3 | 1 | Обратно ∝ 1/2,1/3,1/5 → ∝2,3,5; 190/10=19 → 38,57,95; произведение средней·меньшей=57·38=2166,  |
| `irr_eq_substitution` | a | 7 | no_correct | (12/7; 11/7) | 1 | 5x-y=7,2x+y=5 → 7x=12 → x=12/7,y=11/7. Ни одна опция не удовлетворяет ОБА уравнения ((2;3):2·2+ |
| `irr_eq_substitution` | b | 19 | no_correct | x = 3 | 3 | Система даёт x=3 (y=4, проверка верна). Среди вариантов (1,2;2,5;1;1,5) нет 3. correct=3 указыв |
| `irr_eq_substitution` | c | 14 | no_correct | (13/3; 8/3) ≈ (4,33; 2,67) | 2 | Система 4x+7y=36, 7x+4y=41 даёт нецелое (13/3;8/3). Ни один вариант не подходит: (5;3) даёт 41  |
| `irr_eq_substitution` | c | 26 | no_correct | (1; 4) | 2 | 2x+y=6, x-2y=-7 → x=1, y=4. Пары (1;4) среди вариантов нет. correct=2 → (3;2), не решение (2·3- |
| `linear_absolute_value` | c | 33 | key_error | x = 1; -3 | 1 | \|3x+1\|=\|x-5\| → x=-3 и x=1. Это вариант [0] 'x=1; -3'. correct=1 указывает на 'x=1; -2' — не |
| `math_expectation_calc` | c | 38 | key_error | 0 | 0 | E(3X-2Y+4)=6-10+4=0 — это вариант [1] '0'. explanation сама приходит к 0. correct=0 указывает н |
| `math_induction_method` | c | 20 | key_error | 6 | 2 | x>=3,y>=4,x+y<10: x=3(y=4,5,6),x=4(y=4,5),x=5(y=4)=6 пар. Ответ '6' это options[0], а correct=2 |
| `poly_substitution_solving` | b | 0 | no_correct | -1±√2 | 0 | t=x^2+2x: t^2+6t-7=0 => t=1,-7. x^2+2x-1=0 => x=-1±√2 (иррац.), второй случай без корней. Ни од |
| `prime_factorization_mastery` | c | 18 | no_correct | 70 | 1 | 10!=2^8·3^4·5^2·7. Делители кратные 100=2^2·5^2: 2^x(x=2..8)=7, 5^2=1, 3^y=5, 7^z=2 => 7·5·2=70 |
| `proportional_problem_solving` | c | 8 | no_correct | 1:3 (9:27) | 0 | Спирт доли 1/3,1/4,1/6 на сосуд. При V=12: спирт 4+3+2=9, вода 8+9+10=27 => 9:27=1:3. Ни один в |
| `proportional_problem_solving` | c | 29 | no_correct | 33,3 литра (нет среди вари | 1 | 0.8x=(x+20)/2 → 0.6x=20 → x≈33,3. Условие задачи противоречиво, в explanation сам автор это при |
| `quad_intercepts_analysis` | c | 10 | no_correct | нет целого/табличного c: S | 2 | Для c=-3 S=√4·3=6≠3; c=-2 S=2√3≈3,46; c=-1,5 S≈2,37; c=-1 S≈1,41. Ни один вариант не даёт ровно |
| `quad_intercepts_analysis` | c | 13 | key_error | 2 (a=-1,1) | 2 | D=16-4a²>0 → -2<a<2, a≠0 → a=-1,1 → 2 значения. Это options[1]='2', а correct=2='3'. Сам explan |
| `quad_intercepts_analysis` | c | 28 | no_correct | при a=1 решений нет; '3 ил | 2 | С условием a=1: c=-2, x1·x2=-2, x2=2x1 → 2x1²=-2 нет действ. корней. explanation сам меняет a н |
| `quad_point_logic` | a | 6 | expl_contradiction | не все: B(2;1) не лежит (0 | 3 | explanation сам считает 0.5·2²=2 (отмечает 'ошибка в Б'), но всё равно делает вывод 'все подход |
| `radical_comparison_pivot` | b | 2 | key_error | √17 (idx 1) | 2 | √17≈4.123 ближе к 4 (Δ0.123), чем √15≈3.873 (Δ0.127). Ответ — вариант 1 (√17), а не 2 (Одинаков |
| `radical_comparison_pivot` | b | 11 | key_error | x>y (idx 2) | 1 | x²=8+2√15, y²=8+2√12, 15>12 ⇒ x>y. Верный вариант 2, а стоит 1 (x<y). Само explanation признаёт |
| `radical_comparison_pivot` | b | 18 | key_error | 0.6 (idx 0) | 2 | 0.6=√0.36 наименьшее (0.36<0.4<0.444). Верный вариант 0 (0.6), а стоит 2 (√0.4). |
| `ratio_basics` | b | 24 | no_correct | 48 м² | 0 | 12×200²=480000 см²=48 м². В options 48 нет (4.8/24/0.48/4800). correct=0 (4.8 м²) неверен. Само |
| `ratio_basics` | c | 38 | key_error | 12 см² (idx 1) | 2 | x=2, стороны 2 и 6, S=12. Верный вариант 1 (12), а стоит 2 (27). Explanation сам даёт S=12. |
| `std_comp` | c | 11 | key_error | Они равны | 3 | x=0.45см, y=0.45см — равны (опция2). Сама explanation указывает индекс 2, но correct=3. |
| `substitution_method` | a | 19 | no_correct | нет целого решения | 1 | 4y^2+y-6=0 даёт иррациональные корни; y=2 (опция, correct=1) не решает. Целого ответа среди опц |
| `substitution_method` | b | 10 | key_error | 4 (при игнорировании невып | 0 | Решения y=-1,x=3 и y=-3,x=5 дают x-y=4 или 8; условие x<y невыполнимо. Кейкнутое -4 неверно; 4= |
| `system_foundations` | b | 4 | no_correct | 2.8 | 1 | 5x=14 => x=2.8, чего нет в опциях (2.2,2.6,3,1.8). Explanation сама даёт 2.8. Ключ 2.6 неверен. |
| `system_foundations` | c | 1 | key_error | $k=3$ или $k=-2$ (оба дают | 1 | Оба корня k=3 и k=-2 дают условие пропорциональности коэф. при непропорц. свободных членах → си |
| `system_foundations` | c | 6 | no_correct | нет такого k | 1 | Для бескон. решений нужно k/1=4/k=(k+1)/2. k=±2 из k²=4, но при k=2 → 2,2,1.5; при k=-2 → -2,-2 |
| `system_graphical_solution` | c | 21 | no_correct | 5 целых точек | 3 | x²≤1 → x∈{-1,0,1}. x=0:y∈{-1,0,1}(3); x=±1:y=0(2). Итого 5. Ответ 5 отсутствует в [2,4,3,7]; те |
| `system_modeling` | b | 4 | no_correct | ≈6,67 ч (m=0.15) | 0 | m+u=0.25, 2m+3u=0.6 → u=0.1, m=0.15, время=1/0.15≈6.67ч. Нецелое, среди вариантов (5,6,8,10) не |
| `system_modeling` | b | 19 | no_correct | нет целочисленного решения | 3 | xy=120, x=y+5 → y²+5y-120=0, дискриминант 505 не полный квадрат, периметр нецелый. Ни один вари |
| `system_modeling` | c | 4 | no_correct | 24 км/ч | 0 | v1+v2=30; первый едет 3.25ч, второй 2ч: 3.25v1+2v2=90 → 1.25v1=30 → v1=24. 24 нет среди (18,15, |
| `system_modeling_tasks` | b | 15 | no_correct | 7·√(37/13)+√37 ≈ 17.89 | 3 | Условие противоречиво: при сторонах 3x,4x и угле 60° третья сторона = √(13)·x, т.е. 13x²=37. Пе |
| `system_modeling_tasks` | b | 23 | no_correct | 9 | 3 | b-1=2c, b=3(c-1) → c=4, b=9. Белых 9. Среди опций (5,10,12,7) числа 9 нет. explanation сам выво |
| `system_modeling_tasks` | b | 24 | key_error | 5 км/ч | 0 | 3x+2y=110,2x+3y=100 → x=26,y=16, u=(x-y)/2=5. Ответ 5 км/ч = idx3, но correct=0 (2). explanatio |
| `system_modeling_tasks` | c | 20 | no_correct | 160 руб. | 0 | x+2y=400, 1.2x+1.8y=408 → y=120, x=160. Цена конфет 160 руб., среди опций (200,150,250,180) нет |
| `trig_function_analysis` | c | 26 | key_error | 8 | 1 | Область значений [-4,3]; целых -4..3 = 8 чисел = idx2, но correct=1 (7). explanation сам подтве |
| `variable_manipulation` | c | 21 | key_error | 1600 кг | 1 | 250×400=100000 м²=10 га; 160·10=1600 кг = idx0, но correct=1 (160). explanation сам выводит 160 |
| `variance_std_dev_calc` | b | 1 | key_error | 9900 | 1 | E(X)=10, E(X^2)=10000, D=9900. Ответ 9900 на индексе 2, а correct=1 ('99'). Explanation сам при |
| `variance_std_dev_calc` | b | 3 | key_error | 0.49 | 3 | E(X)=2.1, E(X^2)=4.9, D=4.9-4.41=0.49. Ответ 0.49 на индексе 0, а correct=3 ('0.61'). Должен бы |
| `venn_problem_solving` | b | 23 | key_error | 3 | 3 | 5 оба, объединение 22, не пьют 25-22=3. Ответ 3 на индексе 1, а correct=3 ('5'). Должен быть ин |
| `venn_problem_solving` | b | 24 | key_error | 10 | 0 | 10 оба, объединение 25, не любят 35-25=10. Ответ 10 на индексе 1, а correct=0 ('5'). Должен быт |
| `venn_problem_solving` | c | 21 | no_correct | x = 100/9 ≈ 11.11 (нецелое | 1 | 60+50-x=100-0.1x → 0.9x=10 → x≈11.11. Не целое и нет среди options. Проверка x=20: ничего=2, об |
| `venn_problem_solving` | c | 30 | key_error | 0 | 2 | Каждый любит хотя бы одно: оба = 15+10-25 = 0. Ответ '0' = options[0], но correct=2 ('5'). Expl |