# Шаг 4 — Логик-аудит skillTasks (99 банков: 20 пилот + 79 целевых)

Агент на банк решал каждую задачу a/b/c, сверял с `correct`. Спот-проверки (6/6) подтверждены. Паттерн — explanation выводит верный ответ, а `correct` указывает на другой вариант (index-shift).

- Задач проверено: **~8289** · находок: **271** (ключ-ошибки **151**, нет верного **113**, противоречие **7**)
- **Ключ-фикс применён: 84** (re-point correct из решённого, однозначное совпадение, backup)
- Осталось на Шаг 6 (rewrite условий/опций): **187** (no_correct + неоднозначные/нет-совпадения)

## Топ банков по находкам

| Банк | Находок |
|---|--:|
| `abs_ineq_visual` | 23 |
| `trig_systems_complex` | 20 |
| `log_systems_and_ineq` | 20 |
| `infinite_geometric_series` | 18 |
| `progression_modeling` | 15 |
| `transcendental_differentiation` | 14 |
| `exp_eq_methods` | 13 |
| `basic_modeling_x` | 9 |
| `poly_coefficients_theory` | 8 |
| `exp_systems_and_ineq` | 8 |
| `modulus_functional_eq` | 7 |
| `poly_standard_form` | 7 |
| `sphere_and_ball` | 6 |
| `addition_rules` | 6 |
| `irr_systems_solve` | 6 |
| `phys_diff_apps` | 6 |
| `modeling` | 5 |
| `calculus_power_functions` | 4 |
| `integer_representation` | 4 |
| `irr_eq_standard` | 4 |
| `joint_work_solving` | 4 |
| `log_foundations` | 4 |
| `poly_rational_roots` | 4 |
| `powers_and_notation` | 4 |
| `inv_trig_graphs` | 3 |

## Все находки

| Банк | Ур | # | Вид | Решено | corr | Заметка |
|---|--|--|---|---|--|---|
| `axis_intersections` | c | 13 | key_error | 4 | 1 | Точки пересечения: (0,0) и (2,0). Сумма квадратов всех координат = 0+0+4+0 = 4 = options[0 |
| `axis_intersections` | c | 23 | key_error | 16 | 3 | Расстояния от начала: до (0,4)=4, до (1,0)=1, до (4,0)=4. Произведение 4*1*4=16 = options[ |
| `sphere_and_ball` | c | 7 | key_error | 6.25 | 3 | Описанная сфера: R=(R_осн²+H²)/(2H)=(36+64)/16=6.25. R_осн=a/√3=6, H=8. Это вариант 0, а c |
| `sphere_and_ball` | c | 24 | no_correct | 64π/3 | 0 | Сегмент V=πh²(R−h/3)=π·4·(6−2/3)=64π/3. Среди вариантов (40π/3,20π/3,80π/3,16π/3) нет 64π/ |
| `sphere_and_ball` | c | 30 | key_error | πR³/3 | 1 | Угол 120°→полуугол 60°, h=R(1−cos60°)=R/2. V=(2/3)πR²·(R/2)=πR³/3 — это вариант 0, а corre |
| `sphere_and_ball` | c | 32 | key_error | 9π | 1 | Конус r=3,h=4,L=5; вписанная окружность осевого сечения r=Площ/p=12/8=1.5; S=4π·1.5²=9π —  |
| `sphere_and_ball` | c | 36 | no_correct | 112π | 1 | R_опис треуг. со стороной 6: 6/√3=2√3; R²=4²+12=28; S=4π·28=112π. Среди вариантов (52π,100 |
| `sphere_and_ball` | c | 39 | key_error | 28π | 3 | Вписанный шар r=2→H=4; V=(1/3)π·4·(1+16+4)=28π — это вариант 2 (и вариант 1 84π/3=28π), а  |
| `exp_eq_methods` | c | 4 | no_correct | x=2^(±√2) ≈ 2.665 или 0.37 | 1 | t=log2 x, (2+t)=t(1+t) → t²=2 → t=±√2, x=2^(±√2). Ни один вариант (√2,1/√2,2,1/2) не равен |
| `exp_eq_methods` | c | 5 | no_correct | произведение = 0,001 | 0 | (1+lgx)²+lgx=7 → lg²x+3lgx-6=0, сумма t=-3, x1·x2=10^(-3)=0,001. Нет среди вариантов (0,1; |
| `exp_eq_methods` | c | 9 | key_error | 0 | 3 | (x+1)(x+3)=3 → x²+4x=0 → x=0,-4; ОДЗ x>-1 даёт единственный корень x=0 (объяснение это под |
| `exp_eq_methods` | c | 13 | key_error | 1; 16 | 1 | √t=0,5t (t=log2 x) → t=0,4 → x=1,16. Проверка: x=4 даёт √2≠1, значит '1;4' неверно. Объясн |
| `exp_eq_methods` | c | 15 | key_error | 2 | 1 | 5^x-20=5^x/5 → (4/5)5^x=20 → 5^x=25 → x=2 (индекс 0). Объяснение даёт x=2. Ключ указывает  |
| `exp_eq_methods` | c | 17 | key_error | 1 | 2 | log3 x=±2 → x=9,1/9; произведение =9·(1/9)=1 (индекс 0). Объяснение пишет 'Произведение 1' |
| `exp_eq_methods` | c | 19 | expl_contradiction | x=1/2 и x=1/8 | 3 | К базе 4, t=log4 x: 8t²+16t+6=0 → t=-1/2,-3/2 → x=1/2,1/8 (оба в ОДЗ). Корни существуют, к |
| `exp_eq_methods` | c | 20 | key_error | 2 | 0 | 4^x+4=2·4^x-3·2^x, t=2^x: t²-3t-4=0 → t=4 → x=2 (индекс 1). Объяснение даёт x=2. Ключ '0'  |
| `exp_eq_methods` | c | 21 | key_error | 2 | 1 | log_x(2·8/4)=log_x4=2 → x²=4 → x=2 (индекс 0). Проверка: 1-2+3=2 ✓. Объяснение даёт x=2. К |
| `exp_eq_methods` | c | 28 | key_error | 27 | 0 | log3 x+2log3 x-log3 x=2log3 x=6 → log3 x=3 → x=27 (индекс 1). Объяснение само пишет 'расчё |
| `exp_eq_methods` | c | 33 | no_correct | x=2 и x=1/128 | 0 | u=log2 x: u²+6u-7=0 → u=1,-7 → x=2, 2^(-7)=1/128. Вариант 0 '1/4; 2' содержит 1/4=2^(-2)≠1 |
| `exp_eq_methods` | c | 36 | no_correct | x=2^(1±√2) ≈ 5.33 и 0.75 | 0 | t=log2 x: t²-2t-1=0 → t=1±√2 → x=2^(1±√2). Вариант 0 '2; 1/√2' (≈2 и 0.707) не равен корня |
| `exp_eq_methods` | c | 37 | no_correct | x=(13+√849)/4 ≈ 10.54 | 0 | (x-5)(2x-3)=100 → 2x²-13x-85=0, дискриминант 849 (не полный квадрат), x≈10.54. Проверка ва |
| `trig_systems_complex` | b | 6 | key_error | (π/2; 0) | 2 | Нужно sin^2 x=1, sin^2 y=0 при x+y=π/2 → x=π/2, y=0; sin^2(π/2)-sin^2(0)=1. Решение есть и |
| `trig_systems_complex` | b | 7 | no_correct | sin x=±1/2, cos y=∓1/2 (на | 2 | a+b=0, a^2+b^2=1/2 → a=±1/2: решения существуют, поэтому 'решений нет' (opt2) неверно. При |
| `trig_systems_complex` | b | 8 | no_correct | x-y = -π/6 + 2πn (sin(x-y) | 0 | sin(x-y)=1/4-3/4=-1/2, значит x-y=-π/6+2πn. opt0 (-π/2) даёт sin=-1, ни один вариант не со |
| `trig_systems_complex` | b | 12 | no_correct | cos y=1/2, x=y+π/2 (напр.  | 1 | sin x=cos y → 2cos y=1, cos y=1/2. opt1 (π/2;0) даёт 1+1=2≠1; все остальные варианты тоже  |
| `trig_systems_complex` | b | 21 | key_error | x=π/4 (общо π/4+πn/2) | 1 | cos y=sin x → sin^2 x=1/2, x=π/4+πn/2, НЕ 'любое x'. Среди вариантов верен opt0 (x=π/4); к |
| `trig_systems_complex` | c | 0 | no_correct | x+y=πm, x-y=-π/2+2πk (напр | 0 | opt0 'x=πn' даёт sin x=0 → sin x cos y=0≠-1/2. Реальное решение (π/4;3π/4) не представлено |
| `trig_systems_complex` | c | 1 | key_error | (π/6; 5π/6) | 2 | x=π/6,y=5π/6: sin сумма=1, cos x-cos y=√3/2-(-√3/2)=√3. Решение есть = opt0, ключ ставит ' |
| `trig_systems_complex` | c | 3 | key_error | 2 | 1 | В [0,π]^2: x+y∈{0,π,2π}, x-y=±π/2. Только x+y=π даёт (3π/4;π/4) и (π/4;3π/4) → 2 решения = |
| `trig_systems_complex` | c | 7 | key_error | π | 3 | cos((x+y)/2)=0 → x+y=π+2πn. Напр. (5π/6;π/6): sin=1, cos=0. Сумма π = opt0; ключ ставит 2π |
| `trig_systems_complex` | c | 9 | key_error | решений нет (D=1-2<0) | 1 | tan x tan y=1/2, tan x+tan y=1 → t^2-t+1/2=0, D<0. Верен opt0 'решений нет'; ключ ставит t |
| `trig_systems_complex` | c | 13 | key_error | 1 | 1 | |sin(sin x)|<|x| при x≠0 → единственное решение (0;0). 1 решение = opt0; ключ ставит 3 (op |
| `trig_systems_complex` | c | 14 | key_error | (π/2; π/6) | 2 | x=π/2,y=π/6: x+y=2π/3, sin(π/2)/sin(π/6)=2. Верен opt1; ключ ставит (π/3;π/3) (opt2), где  |
| `trig_systems_complex` | c | 15 | key_error | 2πn | 3 | cos(x-y)=0.75+0.25=1 → x-y=2πn = opt0; ключ ставит π/2+2πn (opt3). Explanation сам выводит |
| `trig_systems_complex` | c | 16 | key_error | (π/6; π/6) | 0 | x=y=π/6: sin сумма=1, x+y=π/3. Решение есть = opt1; ключ ставит 'решений нет' (opt0). Expl |
| `trig_systems_complex` | c | 22 | no_correct | (π/6; π/3) | 2 | x+y=π/2, y-x=π/6 → x=π/6,y=π/3 (проверка: 0.25 и 0.75 верны). opt2 (π/12;5π/12) неверен; в |
| `trig_systems_complex` | c | 23 | key_error | x=(-1)^n π/6+πn (напр. π/6 | 3 | sin^2 x+cos^2 y=0.5, s+c=1 → s=c=0.5, sin x=0.5. Проверка x=π/6,y=π/3: оба уравнения верны |
| `trig_systems_complex` | c | 25 | key_error | 3π/4 | 1 | tan(x+y)=(2+3)/(1-6)=-1, x+y∈(0,π) → 3π/4 = opt0 (=opt2 '135°'); ключ ставит π/2 (opt1). E |
| `trig_systems_complex` | c | 30 | key_error | (0; π/2) и (π/2; 0) | 2 | sin x+cos x=1 → x=0 или π/2; пары (0;π/2),(π/2;0) удовлетворяют. Верен opt0; ключ ставит ' |
| `trig_systems_complex` | c | 36 | key_error | x+y = -π/2 + 2πn | 1 | sin x=-cos y, cos x=-sin y совместны; sin(x+y)=-1 → x+y=-π/2+2πn. Напр. (-π/2;0) удовлетво |
| `trig_systems_complex` | c | 38 | no_correct | (5π/12; π/12) | 0 | cos x cos y=0.5-0.25=0.25, cos(x+y)=0; решение (5π/12;π/12) (sin·sin=0.25, cos(x-y)=0.5).  |
| `direct_prop_logic` | c | 31 | no_correct | (-3.2, -2.6) | 0 | Отражение (4,1) относительно y=-2x: проекция (0.4,-0.8), образ (2*0.4-4, 2*(-0.8)-1) = (-3 |
| `direct_prop_logic` | c | 33 | key_error | 4.5 | 2 | A(2,0),B(2,3),A'(0,2),B'(3,2). Выпуклый четырёхугольник на этих точках — дельтоид с перпен |
| `calc_and_domain` | c | 24 | key_error | 0,5 | 0 | sin(2π/3+π/6)=sin(5π/6)=sin150°=0,5 (idx1). correct=0 указывает на '1' — неверно. Explanat |
| `calc_and_domain` | c | 32 | key_error | 0,5 | 0 | 1500°=4·360°+60°, cos60°=0,5 (idx1). correct=0 указывает на '-0,5' — неверно. Explanation  |
| `physics_applications_integral` | c | 18 | no_correct | 20 км/ч | 2 | Пешеход V, велосипедист 3V, оба 60 км; вел. выехал на 2ч позже и прибыл одновременно: 60/V |
| `physics_applications_integral` | c | 19 | key_error | 6 ч | 3 | Совмещ. производительность 4/15; первая=t, вторая=t+4: 1/t+1/(t+4)=4/15 → 2t²-7t-30=0 → t= |
| `poly_coefficients_theory` | b | 9 | no_correct | 3888 | 1 | P(x)=(2x^2-3x+1)^5: P(1)=0, P(-1)=6^5=7776, S_even=(0+7776)/2=3888. Среди вариантов (32, 1 |
| `poly_coefficients_theory` | b | 13 | key_error | 0 | 1 | (x+1)^3-(x-1)^3=6x^2+2, коэффициент при x равен 0 = options[2]. Ключ указывает на options[ |
| `poly_coefficients_theory` | b | 15 | key_error | -3 | 3 | x(x-1)(ax+2)=ax^3+(2-a)x^2-2x, 2-a=5 => a=-3 = options[1]. Ключ указывает на options[3]='3 |
| `poly_coefficients_theory` | c | 5 | no_correct | a не существует | 1 | Делимость на (x-1)(x-2) требует P(1)=0 и P(2)=0: a+2=0 => a=-2, но 4a+17=0 => a=-4.25 — пр |
| `poly_coefficients_theory` | c | 6 | key_error | 4 | 2 | P(1): x+2=1 => x=-1, P(1)=(-1)^20-2(-1)+1=4 = options[3]. Ключ указывает на options[2]='3^ |
| `poly_coefficients_theory` | c | 11 | no_correct | -2 | 3 | Корни 1 и 2 => P(1)=a+b+2=0 => a+b=-2 (и третий корень -1/2 даёт a=-2.5,b=0.5,a+b=-2). Сре |
| `poly_coefficients_theory` | c | 14 | key_error | 11 | 2 | 3*5-2^2=15-4=11 = options[1]. Ключ указывает на options[2]='1' (неверно). Объяснение вывод |
| `poly_coefficients_theory` | c | 28 | no_correct | -1.5 | 0 | P(x)=(x-1)(x+2)(2x+1), корни 1,-2,-0.5, сумма=-1.5. Среди вариантов (-1,1,-0.5,0.5) нет -1 |
| `inv_trig_graphs` | c | 28 | no_correct | E(y)=[-3π/2; π/2] | 1 | y=arcsin(x)-arccos(x)=2arcsin(x)-π/2, arcsin∈[-π/2;π/2] => y∈[-3π/2;π/2]. Помеченный вариа |
| `inv_trig_graphs` | c | 31 | no_correct | E(y)=[π/2; 3π/2] | 1 | y=|arcsin x|+|arccos x|: на [0;1] =π/2; на [-1;0) =π/2-2arcsin x, при x=-1 даёт 3π/2. Реал |
| `inv_trig_graphs` | c | 37 | no_correct | max=2·arctan(0.5)=arctan(4 | 1 | Максимум arctan(x)-arctan(x-1) при x=0.5 равен 2arctan(1/2)=arctan(4/3)≈0.927, что НЕ π/4≈ |
| `double_inequality_analysis` | c | 16 | no_correct | Нет подходящего варианта;  | 0 | Нужно 1.5<(x-1)/x<2, т.е. x∈(-2,-1) строго. x=-1 даёт ровно 2 (граница, исключена при стро |
| `double_inequality_analysis` | c | 19 | key_error | Нет (вариант 0) | 1 | x=2: x²-5x+4=-2; левая часть -2<-2 ложна, значит неравенство НЕ выполняется → ответ 'Нет'  |
| `abs_ineq_visual` | b | 14 | no_correct | -2/15 | 0 | 22/30-21/30-5/30=-4/30=-2/15; среди вариантов (-1/30,1/30,-1/15,1/15) нет; correct указыва |
| `abs_ineq_visual` | b | 15 | no_correct | -1/5 | 2 | 21/30-22/30-5/30=-6/30=-1/5; среди вариантов нет; correct=-1/30. |
| `abs_ineq_visual` | b | 20 | no_correct | 1 19/30 | 1 | 6 1/10-4 7/15=183/30-134/30=49/30=1 19/30; среди вариантов нет; correct=1 2/3=1 20/30. |
| `abs_ineq_visual` | c | 0 | no_correct | 13/36 | 0 | 21/36-10/36-4/36+6/36=13/36; среди вариантов нет; correct=1/3=12/36 (даже explanation даёт |
| `abs_ineq_visual` | c | 7 | no_correct | 13/48 | 3 | 42/48-20/48-9/48=13/48; среди вариантов нет; correct=11/48 (explanation сам признаёт 13/48 |
| `abs_ineq_visual` | c | 12 | key_error | 7/6 | 3 | 5/12-(-3/4)=14/12=7/6=вариант idx2, но correct=3 (4/3); explanation тоже даёт 7/6. |
| `abs_ineq_visual` | c | 14 | no_correct | -1 2/5 | 2 | (22-42+10-11)/15=-21/15=-7/5=-1 2/5; среди вариантов (-7/15,-1/3,-2/5,-4/15) нет; correct= |
| `abs_ineq_visual` | c | 15 | key_error | -5/6 | 2 | (13-22+9-5)/6=-5/6; это idx0 (и дубль idx3), но correct=2 (-1/2). Варианты содержат дублик |
| `abs_ineq_visual` | c | 23 | no_correct | -3/7 | 2 | (98-52-31-21)/14=-6/14=-3/7; среди вариантов (±1/14,±3/14) нет; correct=1/14. |
| `abs_ineq_visual` | c | 20 | no_correct | -1/12 | 2 | (16-18+20-21+1)/24=-2/24=-1/12; среди вариантов (0,1/12,1/24,1/8) нет; correct=1/24. |
| `abs_ineq_visual` | c | 26 | no_correct | 1/18 | 3 | (20-21-2+5)/36=2/36=1/18; среди вариантов (-1/36,1/12,-1/12,1/36) нет; correct=1/36. |
| `abs_ineq_visual` | c | 31 | no_correct | -1/20 | 2 | (31-35-6+8)/40=-2/40=-1/20; среди вариантов (-3/20,1/40,-1/40,3/40) нет; correct=-1/40. |
| `abs_ineq_visual` | c | 32 | key_error | -1/20 | 1 | (11-15+4-1)/20=-1/20=idx0, но correct=1 (0); explanation тоже даёт -1/20. |
| `abs_ineq_visual` | c | 34 | no_correct | 1 11/12 | 3 | (82-45-11+20)/24=46/24=23/12=1 11/12; среди вариантов нет; correct=1 19/24. |
| `abs_ineq_visual` | c | 38 | no_correct | -5/12 | 2 | (-54+81-44+7)/24=-10/24=-5/12; среди вариантов (-1/2,0,1/2,-1/4) нет; correct=1/2. |
| `abs_ineq_visual` | c | 45 | no_correct | 1 | 1 | (30-20-15-12+77)/60=60/60=1; среди вариантов (2/3,3/4,5/6,7/12) нет; correct=3/4. |
| `abs_ineq_visual` | c | 47 | key_error | 1 | 2 | (214-141-43)/30=30/30=1=idx1, но correct=2 (1/3); explanation тоже даёт 1. |
| `abs_ineq_visual` | c | 49 | key_error | -1/7 | 3 | (-20-29+47)/14=-2/14=-1/7=idx2, но correct=3 (1/14); explanation тоже даёт -1/7. |
| `abs_ineq_visual` | c | 51 | key_error | -2 | 2 | (-4+22-13-28+7)/8=-16/8=-2=idx0, но correct=2 (-1 1/8); explanation тоже даёт -2. |
| `abs_ineq_visual` | c | 56 | key_error | 1/18 | 2 | (13-15-2+5)/18=1/18=idx1, но correct=2 (0); explanation тоже даёт 1/18. |
| `abs_ineq_visual` | c | 57 | no_correct | -1/18 | 2 | (11-3-14+5)/18=-1/18; среди вариантов (-1/6,-2/9,-1/9,0) нет; correct=-1/9. |
| `abs_ineq_visual` | c | 58 | no_correct | 1/18 | 1 | (5-3-2+1)/18=1/18; среди вариантов (1/9,0,1/6,-1/18) нет; correct=0. |
| `abs_ineq_visual` | c | 60 | no_correct | 31/10 | 1 | p-q=-11/6-10/3=-31/6; /(-5/3)=31/10=3.1; среди вариантов (1,3,-3,-1) нет; correct=3. Expla |
| `transcendental_differentiation` | b | 8 | key_error | 28 | 1 | Среднее=1260/44≈28,6. Ближайший вариант — 28 (idx0, |28,6-28|=0,6), а не 30 (idx1, |28,6-3 |
| `transcendental_differentiation` | c | 2 | key_error | 25 | 2 | Медиана: cum 4,16,34; Me=20+(25-16)/18·10=25 = option idx0, а не ≈23,9 (idx2). |
| `transcendental_differentiation` | c | 3 | no_correct | ≈27,1 | 0 | cum 3,13,30; Me=20+(25-13)/17·10≈27,1. Среди вариантов (23,9;24,7;25,1;22,1) такого нет; e |
| `transcendental_differentiation` | c | 6 | key_error | 4 | 0 | [10;17): 12,15,11,14 = 4 (idx2 'option 4'), а не 5 (idx0). Explanation сам выводит 4. |
| `transcendental_differentiation` | c | 7 | key_error | 150 | 0 | Дисперсия=15800/100=158. Ближайший вариант 150 (idx1), а не 130 (idx0). Explanation выводи |
| `transcendental_differentiation` | c | 12 | key_error | 30 | 0 | Q1: cum 6,20; Q1=20+(20-6)/14·10=30 = idx3, а не ≈27,1 (idx0). Explanation выводит 30. |
| `transcendental_differentiation` | c | 16 | key_error | 60 | 0 | Q3: cum 10,40,75; Q3=40+(75-40)/35·20=60 = idx1, а не ≈57,1 (idx0). Explanation выводит 60 |
| `transcendental_differentiation` | c | 17 | no_correct | 63 | 2 | Q3: cum 12,40,72; 75-е в [60;80): Q3=60+(75-72)/20·20=63. Вариантов 57,5/60/58,8/55 нет; e |
| `transcendental_differentiation` | c | 27 | key_error | ≈18,5 | 0 | Q1=20, Q3=30+(75-55)/25·10=38, IQR=18. Ближайший 18,5 (idx1), а не 21,7 (idx0). Explanatio |
| `transcendental_differentiation` | c | 30 | key_error | 17,5 | 0 | Медиана: cum 4,15,34; Me=15+(25-15)/19·5≈17,63. Ближайший 17,5 (idx1), а не 16,32 (idx0).  |
| `transcendental_differentiation` | c | 35 | key_error | 33 | 0 | Среднее=1980/60=33 = idx1, а не 32 (idx0). Explanation сам выводит 33. |
| `transcendental_differentiation` | c | 36 | key_error | ≈23,0 | 0 | Среднее=1130/50=22,6. Ближайший 23,0 (idx3, diff0,4), а не 21,4 (idx0). Explanation выводи |
| `transcendental_differentiation` | c | 39 | key_error | середина класса [8;12) | 2 | Медиана=8+(40-28)/24·4=10=середина [8;12) (idx1), а не 'граница 8' (idx2). Explanation сам |
| `transcendental_differentiation` | c | 41 | key_error | 1,8 | 1 | Сумма площадей = Σ(плотность·ширина)=(0,18)·10=1,8 = idx3, а не 0,18 (idx1, это лишь сумма |
| `addition_rules` | b | 20 | no_correct | -5 | 0 | Целые x при -4<x<2 это -3,-2,-1,0,1; их сумма = -5, которого нет среди options [-3,-6,-4,- |
| `addition_rules` | c | 14 | key_error | -1 | 2 | -3 4/7 + (-2 3/7) = -6; -6 + 5 = -1 = options[1]. Ключ указывает на options[2]=0. Explanat |
| `addition_rules` | c | 23 | key_error | Такого числа не существует | 2 | x+(-15)=|x|: при x>=0 невозможно, при x<0 даёт x=7.5 (противоречие). Решений нет = options |
| `addition_rules` | c | 25 | key_error | -8 + (-8) = -16 | 1 | Значения: -15, -14, -13, -16. Наименьшее -16 = options[3]. Ключ указывает на options[1] (- |
| `addition_rules` | c | 30 | no_correct | -2 | 2 | Четыре послед. целых с наименьшим -2: -2,-1,0,1; сумма = -2, которого нет среди options [- |
| `addition_rules` | c | 38 | key_error | 10 | 2 | Разность 5-10=-5, сумма 5+10=15; -5+15=10 = options[3]. Ключ указывает на options[2]=-10.  |
| `advanced_integration_methods` | c | 16 | no_correct | 2cos^2 x ≤ 1+cos x → (2cos | 1 | Для условия как написано (2cos^2 x ≤ 1+cos x) ответ cos x ≥ -1/2 = [-2π/3; 2π/3]+2πk, кото |
| `advanced_irrational_transform` | b | 21 | key_error | $16$ | 2 | √(3·12)+√(2·50)=√36+√100=6+10=16. Это вариант idx0, а correct=2 указывает на $14$. Сама ex |
| `approx_err` | c | 6 | no_correct | $[\frac{3\pi}{2}; \frac{11 | 2 | cos x>=0 => [0,pi/2]U[3pi/2,2pi]; sin x<=-1/2 => [7pi/6,11pi/6]. Пересечение = [3pi/2,11pi |
| `approx_err` | b | 5 | no_correct | $(-\frac{2\pi}{3}; -\frac{ | 1 | -1/2<cos x<=1/2 на [-pi,pi]: cos<=1/2 включает x=+-pi/3, cos>-1/2 исключает x=+-2pi/3. Вер |
| `basic_modeling_x` | c | 1 | key_error | Сумма целых решений = 0 (р | 3 | ОДЗ -2<=x<=3. Корень=0 при x=-2 и x=3 (решения). При корне>0: 1/(2x+5)>=1/(x+4) на (-2,3)  |
| `basic_modeling_x` | c | 2 | key_error | x in (-inf, 11/4) | 3 | При x>=2 условие даёт x<11/4=2.75; при x<2 верно везде в ОДЗ. Итог (-inf,11/4) = option id |
| `basic_modeling_x` | c | 5 | no_correct | 6 целых решений (-2,-1,0,1 | 1 | ОДЗ x>=-2; при x>-2 нужно x^2-9<=0 => x в [-2,3]. Целые: -2,-1,0,1,2,3 — их 6. В вариантах |
| `basic_modeling_x` | c | 7 | key_error | x in (-inf, -1] | 2 | ОДЗ x<=-1 или x>=2. При x>=1 возведение: 0>3x^2-7x+6 (D<0) — решений нет. Остаётся x<=-1 = |
| `basic_modeling_x` | c | 15 | no_correct | x in (7+sqrt7/2, 9] ~ (8.3 | 0 | sqrt(x-5)>1+sqrt(9-x). Сводится к 4x^2-56x+189>0 при x>7.5 => x>~8.32. Проверка x=8: sqrt3 |
| `basic_modeling_x` | c | 20 | expl_contradiction | x in (-inf,-1) U (1,2) | 3 | Числитель>=0; для дроби<0 нужен числитель>0 и знаменатель<0 => x<-1 или 1<x<2. Решения ест |
| `basic_modeling_x` | c | 25 | no_correct | x in (-inf,-2] U (2, +inf) | 2 | ОДЗ x<=-2 или x>=1. При x<0 верно на x<=-2; при x>=0 => x>2. Итог (-inf,-2]U(2,inf). x=-3  |
| `basic_modeling_x` | c | 30 | no_correct | Сумма = 14 (целые 2,3,4,5) | 1 | 2<=x<6, целые 2,3,4,5, сумма=14. В вариантах (18,20,15,12) нет 14. Explanation сам признаё |
| `basic_modeling_x` | c | 9 | no_correct | x in (-inf, -2) (открытый) | 2 | Числитель>=0; для <0 нужно числитель>0 и x<0 => x<-2. В x=-2 числитель=0 => выражение=0, н |
| `basic_power_rules` | b | 19 | key_error | $\frac{1}{x^2}$ (индекс 2) | 3 | x^{-2}=1/x^2 — это вариант 2 ($\frac{1}{x^2}$), а correct указывает на 3 ($x^2$). Сам expl |
| `basic_trig_equations` | c | 28 | no_correct | -\frac{\pi}{2} | 1 | Корни tan x=1 на [-π,π]: π/4 и -3π/4, сумма = -π/2. Среди опций (π/2, 0, π/4, -3π/4) нет - |
| `basic_trig_equations` | c | 30 | key_error | x=\pi n | 2 | sin(x+π)=sin x → -sin x=sin x → sin x=0 → x=πn (опция 0). Ключ указывает на "Корней нет" ( |
| `basic_trig_equations` | c | 36 | key_error | x=\pi n,\ x=-\frac{\pi}{2} | 3 | sin²x+sin x=0 → sin x=0 (x=πn) или sin x=-1 (x=-π/2+2πn). Полный ответ — опция 0. Ключ=3 д |
| `calculus_power_functions` | c | 13 | no_correct | (-1;1)∪(2;3) | 1 | (x-2)(x+1)/((x-1)(x-3))<0. Корни -1,1,2,3; знаки справа +,-,+,-,+. Отрицательно на (-1;1)∪ |
| `calculus_power_functions` | c | 20 | key_error | (-4;2] | 0 | (|x-3|-1)/(x^2-16)≤0. Числитель<0 при 2<x<4, знаменатель<0 при -4<x<4. Дробь≤0 только на ( |
| `calculus_power_functions` | c | 28 | no_correct | (-3;-1] | 0 | (|x-1|-2)/(x^2-9)≤0. Числитель<0 при -1<x<3, знаменатель<0 при -3<x<3. Дробь≤0 только на ( |
| `calculus_power_functions` | c | 36 | no_correct | (-5;-1] | 0 | (|x-2|-3)/(x^2-25)≤0. Числитель<0 при -1<x<5, знаменатель<0 при -5<x<5. Дробь≤0 только на  |
| `common_denominator_logic` | c | 12 | no_correct | -56 | 0 | Коэффициент при x^3 в (x^2-x+2)^4 = -56 (проверено разложением). Среди вариантов (-28, 28, |
| `complex_arithmetic_basic` | c | 21 | no_correct | z=(-11+27i)/5 | 1 | (2-i)z=1+13i → z=(1+13i)(2+i)/5=(2+i+26i-13)/5=(-11+27i)/5. Помеченный idx1 (1+13i)/5 неве |
| `complex_trig_transformations` | c | 4 | no_correct | -1.2 | 0 | Ветвь y=-0.6 даёт x^2-2x+0.6=0, D=1.6>0 (реальные корни, произведение 0.6), explanation ош |
| `complex_trig_transformations` | c | 7 | key_error | 1 | 3 | RHS = 3-x+x^2 = t+2, где t=x^2-x+1. Уравнение 3/t=t+2 -> t^2+2t-3=0 -> t=1 (t=-3 невозможн |
| `dec_seq` | c | 3 | key_error | 0,01024 | 3 | 0,1·0,2·0,4·0,8·1,6 = 0,01024 = options[0], а не options[3]=0,001024. Сама explanation сна |
| `exp_graph_and_monotony` | c | 30 | no_correct | Все четыре варианта лежат  | 2 | Вопрос некорректен: все 4 точки удовлетворяют y=2^(x+2)-1, нет единственного верного ответ |
| `exp_systems_and_ineq` | b | 6 | key_error | x ≤ 4 | 1 | 0,3<1 ⇒ x+3 ≥ 2x-1 ⇒ x ≤ 4 (вариант 0). Explanation сам выводит x≤4, но correct указывает  |
| `exp_systems_and_ineq` | b | 21 | key_error | x < 5 | 1 | (1/5)^{3-x}<25 ⇒ 5^{x-3}<5^2 ⇒ x-3<2 ⇒ x<5 (вариант 0). Explanation выводит x<5, но correc |
| `exp_systems_and_ineq` | b | 3 | no_correct | ((1-√13)/2; (1+√13)/2) ≈ ( | 3 | x^2-x-3<0, корни (1±√13)/2. Ни один вариант не равен (-1,30;2,30); keyed (-1;2) неверен. E |
| `exp_systems_and_ineq` | c | 11 | key_error | Нет решений | 0 | Коэффициент 1-3,5·0,4+1,5·0,16 = -0,16 <0, значит 0,4^x·(-0,16)>0 не имеет решений (вариан |
| `exp_systems_and_ineq` | c | 12 | key_error | x > 0 | 0 | -20·2^x > -20·5^x ⇒ 2^x<5^x ⇒ (2/5)^x<1 ⇒ x>0 (вариант 2). correct указывает на 'x>-1' (ва |
| `exp_systems_and_ineq` | c | 21 | key_error | (2; 1) | 1 | 2^x·3^y=12, 2^y·3^x=18: деление даёт (2/3)^{x-y}=2/3 ⇒ x-y=1, x+y=3 ⇒ (2;1) (вариант 0). П |
| `exp_systems_and_ineq` | c | 38 | key_error | (3; 2) | 1 | x+1=2y, x=y+1 ⇒ y=2, x=3 ⇒ (3;2) (вариант 2). Проверка: 2^4=4^2, 3-2=1. Explanation сам пи |
| `exp_systems_and_ineq` | c | 15 | expl_contradiction | (4; ±√2) | 3 | a=9,b=2 ⇒ 3^{x/2}=9 (x=4), 2^{y^2/2}=2 ⇒ y^2=2 ⇒ y=±√2. Explanation выводит y^2=2, что про |
| `extrema_analysis` | c | 6 | key_error | (1; -9) | 3 | y''=20x^3-20=20(x^3-1), единственный действительный корень x=1, y(1)=-9. В x=0 y''=-20≠0,  |
| `frac_multiplication_division` | c | 2 | key_error | 2.5 | 2 | (2½)³·(2/5)² = (125/8)·(4/25) = 5/2 = 2.5, что соответствует option[1]='2.5', а не option[ |
| `fraction_to_decimal_conv` | c | 15 | key_error | -2a | 3 | ⁶√(a⁶)-∛(a³) при a<0: |a|-a = -a-a = -2a. Это option[2] ('$-2a$'). Ключ указывает на optio |
| `fsu_equations_inequalities` | c | 3 | no_correct | 5/3 | 3 | (x-1)^3 - x^2(x-3) = 3x-1 = 4 => x=5/3; среди вариантов (0,1,-1,5) верного нет. Сама expla |
| `fsu_equations_inequalities` | c | 15 | key_error | 3 | 1 | Нужны x^2-9=0 (x=±3) и x^2-3x=0 (x=0,3); общий корень x=3 = option[0]. Ключ указывает на o |
| `fsu_equations_inequalities` | c | 32 | key_error | -1 | 1 | x^3+8=x^2-2x+4 => (x^2-2x+4)(x+1)=0; квадратный множитель без действ. корней => x=-1 = opt |
| `func_basics` | c | 22 | key_error | [-2; 0] ∪ [2; +∞) | 2 | x^3-4x≥0 → x(x-2)(x+2)≥0 → [-2;0]∪[2;+∞), что соответствует варианту idx1. Сама explanatio |
| `func_transformations` | c | 9 | key_error | -4,5 | 0 | $-3{,}75-(-1{,}5)-2{,}25 = -3{,}75+1{,}5-2{,}25 = -4{,}5$. Это options[1], а correct указы |
| `graph_analysis_pro` | c | 7 | key_error | a = 3 (idx 0) | 2 | y=x^4-4x^2+3: лок. макс при x=0, y=3; минимумы при x=±√2, y=-1. Прямая y=a даёт ровно 3 то |
| `graph_construction_base` | b | 6 | key_error | Первая четверть (index 0) | 2 | При x>0: -x<0, arcctg(-x)∈(π/2;π); вычитая π/2 получаем y∈(0;π/2). Значит x>0 и y>0 — перв |
| `infinite_geometric_series` | a | 9 | key_error | 2+2√2 | 1 | S=√2/(1-1/√2)=2(√2+1)=2+2√2 = option[2]; correct=1 указывает на '2+√2' (неверно). |
| `infinite_geometric_series` | b | 1 | key_error | 5 | 1 | q=1/5, S=4/(4/5)=5 = option[0]; correct=1 указывает на '5/4'. Даже explanation выводит 5. |
| `infinite_geometric_series` | b | 4 | no_correct | (3√3+3)/2 | 0 | S=√3/(1-1/√3)=3(√3+1)/2≈4.10. Среди options нет: option[0]='(3+√3)/2'≈2.37 — не равно. |
| `infinite_geometric_series` | b | 8 | no_correct | ≈10.9 | 0 | b1=2, сумма квадратов=12: 4/(1-q²)=12→q²=2/3→S=2/(1-√(2/3))≈10.9. Нет среди [3,4,6,2.5]; e |
| `infinite_geometric_series` | b | 13 | key_error | 6a | 1 | P1=3a, q=1/2, S=3a/0.5=6a = option[3]; correct=1 указывает на '2a'. Explanation тоже вывод |
| `infinite_geometric_series` | b | 24 | key_error | 4.5 | 0 | Спрашивается b3. b1=18, b3=18·0.25=4.5 = option[1]; correct=0='18' (это b1, а не b3). Expl |
| `infinite_geometric_series` | c | 0 | key_error | b1=2, q=1/3 | 0 | (1-q)/(1+q)=4.5/9=0.5→q=1/3, b1=2 = option[1]; correct=0='b1=1.5,q=0.5' даёт сумму квадрат |
| `infinite_geometric_series` | c | 2 | key_error | 1.5 | 2 | 4q²-17q+4=0→q=1/4, b1=2·3/4=1.5 = option[0]; correct=2='1.2'. Explanation выводит 1.5. |
| `infinite_geometric_series` | c | 8 | no_correct | 1/√5 | 0 | S=6.25, S4=6: q⁴=1/25→q=1/√5≈0.447. Нет среди [1/5,1/2,2/3,0.8]; explanation сам останавли |
| `infinite_geometric_series` | c | 14 | key_error | 32 | 2 | q=1/2, b1=18/1.125=16, S=32 = option[0]; correct=2='27'. Explanation выводит 32. |
| `infinite_geometric_series` | c | 26 | no_correct | 4/3 | 2 | x+x²/2+...=x/(1-x/2)=4→x=4/3 (при x=2 ряд расходится). 4/3 нет среди [1,1.5,2,3]; correct= |
| `infinite_geometric_series` | c | 27 | no_correct | 3√3≈5.196 | 3 | S=9, b1-b2=3: 9(1-q)²=3→b1=9/√3=3√3≈5.20. Нет среди [4,12,3,6]; explanation признаёт ошибк |
| `infinite_geometric_series` | c | 28 | no_correct | 4.8 | 0 | 6q²+5q-1=0→q=1/6, S=4/(5/6)=24/5=4.8. Нет среди [6,5,8,12]; correct=0='6' неверно, explana |
| `infinite_geometric_series` | c | 30 | key_error | 1/2 | 2 | S_even=Sq/(1+q)=4q/(1+q)=4/3→8q=4→q=1/2 = option[1]; correct=2='1/3'. Explanation выводит  |
| `infinite_geometric_series` | c | 31 | key_error | 1.2 | 3 | b1=3q, 3q/(1-q)=2→q=0.4, b1=1.2 = option[2]; correct=3='1.5'. Explanation выводит 1.2. |
| `infinite_geometric_series` | c | 34 | key_error | √2+1 | 1 | q=√2-1, S=√2/(2-√2)=√2+1 = option[3]; correct=1='2+√2'. Explanation выводит √2+1. |
| `infinite_geometric_series` | c | 35 | no_correct | q²=3/4 | 0 | 1/(1-q)=4(1+q)→1-q²=1/4→q²=3/4. Нет среди [1/2,1/3,1/4,...]; correct=0='1/2' неверно, expl |
| `infinite_geometric_series` | c | 38 | key_error | Корней нет | 2 | 1+(x+1)/(x-1)=0→2x=0→x=0 (исключён; нужно |x|>1). Решений нет = option[3]; correct=2='-2'  |
| `integer_representation` | c | 8 | key_error | 1 | 1 | Сумма коэффициентов = P(1) = (1-3+1)^10 = (-1)^10 = 1. Верный ответ 1 находится в idx0, а  |
| `integer_representation` | c | 16 | key_error | 5 | 2 | (x^2+y)^3 - x^6 = 3x^4y+3x^2y^2+y^3; старшая степень 4+1=5. Верный ответ 5 в idx1, а corre |
| `integer_representation` | c | 24 | key_error | 4 | 1 | (x^3-x+1)^2-(x^2+1)^3 = -5x^4+2x^3-2x^2-2x; степень 4 (x^6 сокращаются). Верный ответ 4 в  |
| `integer_representation` | c | 34 | no_correct | 2x^2+2x+1 | 1 | (x^2+x+1)^2 - x^2(x+1)^2 = 2x^2+2x+1. Среди options такого варианта нет (idx1 = '2x^3+x^2+ |
| `interval_logic` | b | 15 | no_correct | 4 | 1 | lim x→2 (x^3-4)=8-4=4; среди вариантов (0,2,8,-4) нет 4; correct=1 указывает на '2'. Сама  |
| `interval_logic` | c | 17 | key_error | 2 | 1 | ∫_1^2 (x+1/x^2)dx=[x^2/2-1/x]_1^2=(2-0,5)-(0,5-1)=1,5+0,5=2. Верный вариант — индекс 0 ('2 |
| `inv_trig_equations` | c | 7 | key_error | 0.5 | 3 | arccos(1/2)=π/3; arcsin x=π/2−π/3=π/6 ⇒ x=0.5, что находится в опции index 0, а correct ук |
| `inv_trig_equations` | c | 13 | no_correct | {sin 1; sin 0.5} | 1 | t=arcsin x: 2t²−3t+1=0 ⇒ t=1 или t=0.5 ⇒ x=sin1 и x=sin0.5. Опция index 1 ('sin 1; 1') нев |
| `inv_trig_equations` | c | 21 | no_correct | −√3/3 | 1 | arcctg x=π−arccos(0.5)=π−π/3=2π/3 ⇒ x=ctg(2π/3)=−1/√3=−√3/3. Среди опций только положитель |
| `irr_eq_standard` | b | 1 | no_correct | нет корней (уравнение √(3x | 3 | Задача сломана: ни один вариант (1,16) не удовлетворяет √(3x)=x-4. x=16: √48≈6.93≠12. expl |
| `irr_eq_standard` | b | 23 | key_error | -2; 3 | 3 | √(x+4)=√(x²-2): x²-x-6=0 → x=3,-2. При x=-2: обе части √2=√2, ОДЗ выполнено (x+4=2≥0, x²-2 |
| `irr_eq_standard` | c | 16 | no_correct | нет корней | 0 | √(2x+5)+√(5x+6)=9: ни один вариант не решает. x=2→3+4=7, x=10→5+√56, x=6→√17+6, x=5→√15+√3 |
| `irr_eq_standard` | c | 34 | key_error | 5 | 2 | √(2x-1)+√(x-1)=5: при x=5 → √9+√4=3+2=5 (единственный корень; x=145 посторонний). Верный в |
| `irr_ineq_logic` | c | 6 | expl_contradiction | система y=x^3 и y=-8/x не  | 2 | Помечен ответ (-2;8), но он не удовлетворяет ни y=x^3 ((-2)^3=-8), ни y=-8/x (=4). Сама ex |
| `irr_ineq_logic` | c | 16 | no_correct | 6√26 (=√936) | 0 | x^3-9x=0 → x=0,±3; точки (3;15),(-3;-15); AB=√(36+900)=√936=6√26. Помечен вариант 3√26=√23 |
| `irr_systems_solve` | a | 18 | key_error | (1;4) или (4;1) | 2 | √x+√y=3, xy=4 → u+v=3,uv=2 → корни 1,2 → (1;4) или (4;1) = idx0. idx2 (1;2)/(2;1) даёт √1+ |
| `irr_systems_solve` | b | 12 | key_error | (4;9), (9;4) | 0 | √x+√y=5, √xy=6 → √x,√y корни t²-5t+6 → 2,3 → x=4,y=9 = idx1. idx0 (9;16) даёт 3+4=7≠5. Exp |
| `irr_systems_solve` | c | 5 | key_error | 10 | 3 | a=√(x+y),b=√(x-y), ab=√(x²-y²)=8, a+b=6 → {2,4} → x=10 в обоих случаях = idx1. correct=3 ( |
| `irr_systems_solve` | c | 27 | key_error | Любые x+y=0 | 2 | √(x+y)+√(x+y+1)=1: при x+y=0 даёт 0+1=1 ✓ (функция возрастает, s=0 единств.) → бесконечно  |
| `irr_systems_solve` | c | 29 | key_error | (13;12) | 0 | x+y=25, 25+25(x-y)=50 → x-y=1 → x=13,y=12 = idx1. idx0 (15;10) даёт 25+125=150≠50. Explana |
| `irr_systems_solve` | c | 35 | key_error | (36;16) | 1 | √x-√y=2, x-y=20 → √x+√y=10 → √x=6,√y=4 → x=36,y=16 = idx0. idx1 (121;81) даёт 121-81=40≠20 |
| `joint_work_solving` | c | 11 | key_error | $e^{2x}(2\sin 3x+3\cos 3x) | 3 | f'=2e^{2x}sin3x+3e^{2x}cos3x=e^{2x}(2sin3x+3cos3x) — это вариант idx0, а correct=3 указыва |
| `joint_work_solving` | c | 25 | key_error | $f(x)\cdot\dfrac{1}{2}\lef | 1 | Верный ответ — idx0 (f'=f·½[...]). correct=1 указывает на (1/2)f(x), что неверно. Explanat |
| `joint_work_solving` | c | 27 | key_error | $\dfrac{3t}{2}$ | 3 | dy/dx=3t^2/(2t)=3t/2 — это idx0. correct=3 указывает на 3t (неверно). Explanation выводит  |
| `joint_work_solving` | c | 35 | key_error | $e^{-x^2}$ | 3 | По теореме Барроу f'(x)=e^{-x^2} — это idx1. correct=3 указывает на xe^{-x^2} (неверно). E |
| `last_digit` | c | 0 | no_correct | (-1; 1] ∪ (2; 3) | 0 | |x-1|<2 даёт -1<x<3, а не 0<x<3 (ошибка в explanation: '-1<x-1<2 ⇒ 0<x<3'). Первое неравен |
| `linear_relations` | c | 3 | key_error | $(-\infty, -2]$ | 3 | Аргумент x^2-2x+10 имеет минимум 9 при x=1; основание 1/3<1, значит max функции = log_{1/3 |
| `linear_relations` | c | 15 | key_error | $(2+e, +\infty)$ | 3 | ln(x-2)-1>0 => x-2>e => x>2+e. Верный вариант — индекс 1 ($(2+e,+infty)$), а correct=3 ука |
| `log_foundations` | c | 14 | key_error | -7/12 | 2 | 1/4-1=-3/4; 1/2-(-3/4)=5/4; 2/3-5/4=-7/12 = индекс 0, а не 2 (-13/12). Explanation сама пр |
| `log_foundations` | c | 17 | no_correct | 4.5 | 1 | 5.5-6.5=-1; 4.5-(-1)=5.5; 3.5-5.5=-2; 2.5-(-2)=4.5. Значения 4.5 нет среди options [0,1,2, |
| `log_foundations` | c | 27 | key_error | 0 | 0 | 3/10-(0.5-1/5)=0.3-0.3=0. Ответ 0 = индекс 1 (или 2), но correct=0 указывает на 0.1. Expla |
| `log_foundations` | c | 35 | key_error | 3 | 1 | 4-5=-1; 3-(-1)=4; 2-4=-2; 1-(-2)=3. Ответ 3 = индекс 2, а correct=1 указывает на -2. |
| `log_systems_and_ineq` | b | 13 | key_error | 9 (целые 2,3,4; сумма 9) | 1 | Сумма целых решений = 2+3+4 = 9 = вариант A (idx0), а correct указывает на B (7). Explanat |
| `log_systems_and_ineq` | b | 23 | no_correct | (0; 2^{-√2})∪(1; 2^{√2}) ≈ | 1 | t<2/t → log2 x∈(-∞,-√2)∪(0,√2). Истинные границы иррациональны; ни один вариант не совпада |
| `log_systems_and_ineq` | c | 1 | no_correct | (1; 2) | 3 | Числитель log2(x+3)>0 всегда; знаменатель log3(x-1)<0 при 1<x<2 → дробь<0. x=1.5 — решение |
| `log_systems_and_ineq` | c | 4 | key_error | (2; 4) | 2 | a=1,b=2 → x=2,y=4 = вариант A (idx0). Explanation сам пишет '(2;4) — вариант А', но correc |
| `log_systems_and_ineq` | c | 5 | key_error | (1; 3) | 1 | Свёртка даёт log2(1/(x+1))>-2 → x<3, ОДЗ x>1 → (1;3) = вариант A (idx0). Explanation призн |
| `log_systems_and_ineq` | c | 6 | key_error | (-∞; -1) | 1 | (x-1)/(x+1)≥1 → x<-1; пересечение с ОДЗ даёт (-∞;-1) = вариант A (idx0). Explanation призн |
| `log_systems_and_ineq` | c | 7 | no_correct | (√5; 3) | 0 | log2(x²-4)·log_{0.5}(x-2)>0 ⟺ совпадение знаков; решение (√5;3). x=2.5 (в A=(2;√5)) даёт п |
| `log_systems_and_ineq` | c | 8 | no_correct | (-∞;-1)∪(-1;0)∪(1;∞) | 2 | При |x|<1 ветка даёт также (-1;0) (x=-0.5: log_{0.5}(0.75)>0 — решение). C=(-∞;-1)∪(1;∞) и |
| `log_systems_and_ineq` | c | 9 | no_correct | решений нет (как записано) | 1 | xy=4, x+y=2·1.5=3 → дискриминант<0, действительных решений нет. (2;2) даёт log2(x+y)=2≠log |
| `log_systems_and_ineq` | c | 13 | no_correct | решений нет (как записано) | 0 | y=x², x+11=y+1 → x²-x-10=0, корни иррациональны. (3;9): log_{10}(14)≠1. Ни один вариант не |
| `log_systems_and_ineq` | c | 14 | no_correct | (1; 1.25]∪(3; 9] | 0 | t∈(-∞,-2]∪(1,3] → x∈(1;1.25]∪(3;9] (совпадает с explanation). Но correct=0 = (1;2)∪[9;∞),  |
| `log_systems_and_ineq` | c | 17 | key_error | решений нет | 0 | При 2<|x|<3: числитель log_{0.3}(|x|-2)>0, знаменатель x²-9<0 → дробь<0; при |x|>3 — тоже< |
| `log_systems_and_ineq` | c | 18 | no_correct | (0;0.5)∪(1;2)∪(3;6) | 0 | Рационализация: (2x-1)(x-1)(x-6)<0 с ОДЗ → (0;0.5)∪(1;2)∪(3;6). x=1.5 (база3, arg0.75): lo |
| `log_systems_and_ineq` | c | 20 | no_correct | ≈(-1.618;-1)∪(0.618;2)\{1} | 1 | x=1 даёт arg=(x-1)²=0 — вне ОДЗ, поэтому {1} недопустимо. x=1.5 (база3.75, arg0.25): log<0 |
| `log_systems_and_ineq` | c | 22 | key_error | решений нет | 1 | x²+3x-4=0 → x=1 (база недопустима) или x=-4 (x>0 нарушено) → решений нет = вариант C (idx2 |
| `log_systems_and_ineq` | c | 24 | no_correct | (1;√10)∪(10;∞) | 0 | (2t-1)/(t(1-t))<0 → t∈(0,0.5)∪(1,∞) → x∈(1;√10)∪(10;∞) (совпадает с explanation). Но corre |
| `log_systems_and_ineq` | c | 26 | no_correct | (0; (3-√5)/2)∪(1; (3+√5)/2 | 0 | x²-3x+1<0 для x>1 → (1;2.62); A=(1;∞) неверно: x=10 даёт log_{10}(2.11)<1 — не решение. Ис |
| `log_systems_and_ineq` | c | 30 | no_correct | (0; 0.5)∪(1; 3) | 0 | При 0<x<1 знак меняется: x+2<3-x → x<0.5 → (0;0.5); при x>1 → (1;3). x=0.3 — решение, но A |
| `log_systems_and_ineq` | c | 35 | no_correct | (-2; (1-√21)/2)∪((1+√21)/2 | 2 | x²-2x-8<0 → (-2;4), ОДЗ x²-x-5>0 даёт две ветки. x=-1.9 — решение (отрицательная ветка), н |
| `log_systems_and_ineq` | c | 34 | key_error | (2; ∞) | 0 | При x>2 база>1: x>x-1 верно всегда → (2;∞) = вариант C (idx2). Explanation сам пишет 'Отве |
| `modeling` | c | 3 | no_correct | 4,5 км/ч | 1 | 15/(18-x)+20/(18+x)=2 даёт 2x^2-5x-18=0, x=4,5. Среди вариантов (3,2,4,2,5) нет 4,5; помеч |
| `modeling` | c | 11 | no_correct | 0 км/ч | 3 | 8 км по озеру при скорости 13 даёт 8/13; 5/(13+x)=5/13 => x=0. Помеченный вариант 2 даёт 0 |
| `modeling` | c | 15 | no_correct | 20 км/ч | 2 | 60/v=60/(v+10)+1 => v^2+10v-600=0 => v=20. Проверка: 60/20-60/30=3-2=1. Среди вариантов (4 |
| `modeling` | c | 29 | no_correct | 6 км/ч | 0 | 192/(x^3-4x)=1 => x^3-4x=192 => x=6 (по теч 24/8=3, против 24/4=6, итого 9; озеро 48/6=8;  |
| `modeling` | c | 38 | expl_contradiction | ≈44,7 кг (нет точного вари | 2 | m1=0,6·m3, сумма 2,35x=105 => x≈44,7. Помеченный 48 даёт 0,6·48+0,75·48+48=112,8≠105; объя |
| `modulus_functional_eq` | c | 1 | key_error | 2; 4 | 1 | Условие x>=2: случаи дают x=2,4,2; различные корни {2,4}. Ключ указывает на опцию1 '2;4;2' |
| `modulus_functional_eq` | c | 4 | no_correct | 7/3 | 0 | Корни 0,2,5; среднее (0+2+5)/3=7/3≈2.33. Среди опций [3.5,4,3,2] нет 7/3; explanation сам  |
| `modulus_functional_eq` | b | 15 | no_correct | 11/3; 9/7 | 3 | |5x-10|=|2x+1|: x=11/3 и x=9/7. Ключевая опция '3; 9/7' содержит ошибочное 3 вместо 11/3;  |
| `modulus_functional_eq` | c | 24 | no_correct | 1; -2 | 0 | |x-1|=x^2-1, ОДЗ |x|>=1: корни {1,-2}. Опции [1;0],[1;0;-2],[1;-1],[0;1;-2] — набора {1,-2 |
| `modulus_functional_eq` | c | 33 | key_error | 6 | 2 | Корни 2,-1,-3; произведение 2*(-1)*(-3)=6. Ключ указывает на опцию2 '0', верно опция0 '6'; |
| `modulus_functional_eq` | c | 35 | key_error | 1 | 0 | Целые корни |x^2-5|=x+1: только x=3 (второй кейс даёт иррациональные). Один целый корень.  |
| `modulus_functional_eq` | c | 37 | no_correct | 2,5 | 0 | Корни 1 и 4; среднее (1+4)/2=2.5. Среди опций [2,3,4,1] нет 2.5; explanation сам выводит 2 |
| `nonlinear_construction` | c | 13 | key_error | k=12 (опция idx 0) | 1 | Пересечение 3x-y=5 и x+y=7: x=3, y=4, k=x*y=12. Это опция idx 0 ('12'), а ключ указывает i |
| `nonlinear_construction` | c | 16 | no_correct | a=-1/24 | 0 | Касание прямой y=-x+6 и y=ax^2: ax^2+x-6=0, D=1+24a=0 -> a=-1/24. Все опции положительны ( |
| `phys_diff_apps` | a | 3 | key_error | $5a^2b$ (idx 2) | 3 | Стандартный вид — это $5a^2b$ (idx 2). Вариант idx 3 ($-1ab\cdot a$) не в стандартном виде |
| `phys_diff_apps` | a | 10 | key_error | $m^6n$ (idx 1) | 2 | $m^2\cdot n\cdot m^4 = m^{2+4}n = m^6n$ = idx 1. Сама explanation выводит $m^6n$, но corre |
| `phys_diff_apps` | b | 15 | key_error | $x^9$ (idx 0) | 3 | $-x^2\cdot(-x)^3\cdot(-x)^4 = -x^2\cdot(-x^3)\cdot x^4$; знаки $(-1)(-1)(+1)=+1$, итог $x^ |
| `phys_diff_apps` | c | 8 | expl_contradiction | условие неразрешимо: $3k+6 | 1 | При заявленной степени 13: $3k+6=13$ не даёт целого k. Explanation сама признаёт ошибку ус |
| `phys_diff_apps` | c | 9 | key_error | -2 (idx 1) | 3 | $-(-\tfrac12 x^2)^4\cdot32 = -\tfrac{1}{16}\cdot32 = -2$ = idx 1. Explanation сама пишет ' |
| `phys_diff_apps` | c | 36 | key_error | $a^{10}$ (idx 0) | 1 | Сумма показателей знака: $(-1)^{1+2+3+4}=(-1)^{10}=+1$, итог $a^{10}$ = idx 0. Explanation |
| `poly_classification` | b | 19 | key_error | Координату и скорость точк | 3 | Кинематически y(x0)=y0 — координата, y'(x0)=y1 — скорость; это вариант idx 2 («Координату  |
| `poly_classification` | c | 22 | key_error | x^2 y'' + x y' + (x^2 - p^ | 3 | Канонический вид Бесселя x^2 y''+x y'+(x^2-p^2)y=0 находится в options[1], а не options[3] |
| `poly_rational_roots` | c | 15 | key_error | 4 | 3 | 8^(1+2+3)=8^6, 6 mod4=2 → 8^2=64 → последняя цифра 4. Вариант '4' стоит на индексе 1, а co |
| `poly_rational_roots` | c | 24 | key_error | 7 | 0 | 3^(1+2+3+4+5)=3^15, 15 mod4=3 → 3^3=27 → последняя цифра 7. Вариант '7' на индексе 3, а co |
| `poly_rational_roots` | c | 27 | key_error | 4 | 3 | 14^1+14^2+14^3 → 4+6+4=14 → последняя цифра 4. Вариант '4' на индексе 0, а correct=3 ('2') |
| `poly_rational_roots` | c | 39 | no_correct | 7 | 3 | 3^10→9, 3^11→7, 3^12→1; 9+7+1=17 → последняя цифра 7. В options ['3','9','1','0'] цифры 7  |
| `poly_standard_form` | b | 3 | key_error | a^2+b^2 (opt0) | 3 | (a^3-b^3)/(a-b)-ab = a^2+ab+b^2-ab = a^2+b^2 = opt0. correct=3 указывает на (a+b)^2 = a^2+ |
| `poly_standard_form` | b | 8 | key_error | 1/x (opt0) | 1 | 1/(x(x+1))+1/(x+1)=(1+x)/(x(x+1))=1/x = opt0 (упрощённая форма). correct=1 указывает на не |
| `poly_standard_form` | b | 17 | key_error | (2x-9)/(x^2-9) (opt0) | 1 | 3/(x+3)-x/(x^2-9)=(3(x-3)-x)/(x^2-9)=(2x-9)/(x^2-9)=opt0. correct=1 указывает на (2x-3)/(x |
| `poly_standard_form` | c | 6 | no_correct | ±10/3 | 1 | Выражение = 2(a^2+b^2)/(a^2-b^2)=10/(a^2-b^2). При a^2+b^2=5, ab=2: (a+b)^2=9, (a-b)^2=1,  |
| `poly_standard_form` | c | 12 | no_correct | -(x-y)(y-z)(z-x)/((x+y)(y+ | 1 | Числовая проверка x=2,y=1,z=0: сумма=1/3, а opt1 (положительное произведение)=-1/3 — невер |
| `poly_standard_form` | c | 20 | expl_contradiction | 1/(x+1) (opt0) | 1 | x/(x^2-1)+1/(2(x+1))-1/(2(x-1))=(2x-2)/(2(x^2-1))=1/(x+1)=opt0. Explanation явно выводит 1 |
| `poly_standard_form` | c | 36 | no_correct | (a-b)/b = (a^2-ab)/ab | 0 | (a^2-b^2)/ab-(a-b)/a=(a^2-b^2-ab+b^2)/ab=(a^2-ab)/ab=(a-b)/b. Ни одна опция не равна этому |
| `powers_and_notation` | b | 15 | no_correct | 10^{6-4-5}=10^{-3}=0,001 | 3 | 10^6·10^-4/10^5=10^-3=0,001; среди вариантов (10,100,1,0,01) нет 0,001. Explanation сам пр |
| `powers_and_notation` | c | 1 | key_error | 5 | 1 | (5^2)^3·(5^3)^2/5^11=5^6·5^6/5^11=5^12/5^11=5. Это вариант idx3, а correct=1 (1/5). Explan |
| `powers_and_notation` | c | 2 | key_error | 26 | 2 | Приписать цифру десятков (2) в конец 26 → 262; 262-26=236. Ответ 26 = idx1, а correct=2 (' |
| `powers_and_notation` | c | 29 | key_error | 8 | 2 | (0,2^2)^3=0,04^3=0,000064; 0,008·0,001=0,000008; частное=8 = idx0. correct=2 ('80') неверн |
| `progression_modeling` | c | 1 | key_error | 2, 5, 8 | 3 | Числа 5-d,5,5+d; +1,4,19 даёт GP при d=3 → 2,5,8 (проверка: 3,9,27 GP). Это вариант idx2 « |
| `progression_modeling` | c | 3 | no_correct | 123525 | 1 | Числа ≡1(mod4): 101..997, n=225, S=549·225=123525. Нет среди опций (123750 лишь приближени |
| `progression_modeling` | c | 4 | key_error | q=0,5 | 2 | S=b1/(1-q)=4, Σкв=16/3 → (1-q)/(1+q)=1/3 → q=0,5. Это idx0 «0,5», а correct=2 «1/4». Expla |
| `progression_modeling` | c | 6 | no_correct | 300 | 0 | a5=4,a11=16 → d=2,a1=-4; a20=34; S20=15·20=300. Опции 380/400/420/440 — нет 300; explanati |
| `progression_modeling` | c | 7 | no_correct | нет целого n (Sn=1145 недо | 1 | a1=5,d=3: S25=1025,S26=1105,S27=1188 — ни одно не равно 1145; 3n²+7n-2290=0 не имеет целых |
| `progression_modeling` | c | 9 | no_correct | b1=14/9 | 1 | b3+b6=q(b2+b5) → 56=28q → q=2; 18·b1=28 → b1=14/9≈1,56. Среди опций (2/4/1/3) нет; explana |
| `progression_modeling` | c | 10 | key_error | d=4 | 2 | 7-d,7,7+d → 7-d,6,8+d GP: 36=(7-d)(8+d) → d²+d-20=0 → d=4. Это idx3 «4», а correct=2 «2».  |
| `progression_modeling` | c | 11 | no_correct | 3240 | 3 | Сумма 10..99=4905, кратные 3=1665, разность=3240. Среди опций нет (3270 лишь «ближайшее»); |
| `progression_modeling` | c | 13 | no_correct | 3980 | 1 | Числа ≡2(mod5) в 1..200: 2..197, n=40, S=199·20=3980. Среди опций нет (4100 лишь приближен |
| `progression_modeling` | c | 15 | key_error | q=5 | 3 | b4-b2=24, b2+b3=6 → (q²-1)/(1+q)=q-1=4 → q=5. Это idx2 «5», а correct=3 «2». Explanation с |
| `progression_modeling` | c | 18 | key_error | b1=6 | 2 | b1/(1-q)=9, b1(1+q)=8 → q²=1/9, q=1/3, b1=6. Это idx0 «6», а correct=2 «3». Explanation са |
| `progression_modeling` | c | 24 | no_correct | a1=-3, d=8 | 1 | 2a1+4d=26, 2a1+3d=18 → d=8, a1=-3. Ни одна опция не удовлетворяет обоим уравнениям (провер |
| `progression_modeling` | c | 25 | no_correct | совпадений при n>1 нет | 0 | a_n=4n-1, b_n=3·2^(n-1): n=2→7/6, n=3→11/12, n=4→15/24 — расходятся, равенства при n>1 нет |
| `progression_modeling` | c | 30 | key_error | n=11 | 1 | a1=10,d=4: S10=280, S11=330>300 → n=11. Это idx0 «11», а correct=1 «12». Explanation сам в |
| `progression_modeling` | c | 37 | no_correct | 3663 | 1 | Кратные 11 в 100..300: 110..297, n=18, S=407·9=3663. Среди опций нет (3630 лишь «ближайший |
| `proportion_application` | c | 10 | key_error | 2 | 2 | ||x|-5|=2x-1, x>=0.5 so |x|=x → |x-5|=2x-1. Case x<5: 5-x=2x-1 → 3x=6 → x=2 (verify: |2-5| |