# Логик-аудит generated-вопросов коллекции questions (1233)

**Метод.** Read-only. Workflow (103 агента, по чанку ~12). Механику считал НАСТОЯЩИЙ `generateQuestion` (mathUtils.js) через `audit/gen-eval.mjs`: подстановка значений + вычисление `answerFormula`/опций. Агент решал резолвнутый шаблон сам и сверял с вычисленным ответом на 3+ наборах значений. Прод не трогался.

## Итог: 113 находок в 111 из 1233 вопросов (~9%)

Спот-проверил вручную 4 (по одной на категорию) — все подтвердились, вскрыв ДВА системных корневых бага.

## 🔴 Корневой баг 1 — integer-формат округляет дробные/иррациональные ответы

У многих вопросов `answerDisplay` отсутствует → дефолт «целое». Если истинный ответ дробный/иррациональный, он округляется и становится **математически неверным**, а правильного значения нет среди опций.
- `0AfVm4ZErE7mAaHS30an` (вектор-середина): k=0.5 → показывается «1». 
- `0IIFMcpG66Htf0ZCw0TP` (полупериметр): 7.5 → «8». 
- E(X)=n/2 при нечётном n; arcsin+arccos=π/2 → «2»; вероятности b/(a+b) → «0»/«1»; перевод в радианы a/180 → «0».

**Фикс:** проставить корректный `answerDisplay` (fraction/decimal) этим вопросам, либо сузить диапазоны переменных, чтобы ответ всегда был целым.

## 🔴 Корневой баг 2 — эвалуатор формул не поддерживает `Math.*`/тригонометрию

`derivedVars`/`wrongFormulas` с `Math.sin/cos/PI/sqrt` бросают исключение в `preprocessFormula`/`evalFormulaRaw` → переменные обнуляются (ra=0, R=0), `answerFormula` даёт 0, а нерезолвнутые `wrongFormulas` показываются ученику **сырым JS-кодом** в опциях.
- `7APawJMr3cEolqtaoOT1` (трение): опции содержат `"m*9.8*Math.sin(ra)-P"` как текст. 
- `8ZNf4lQw8X3VsYCwBH1j`, `3NXSWrth3zqfNkbof0QS`, `6TxPMsqNj0T7A0pbAD4t` и др. (механика/NUET).

**Фикс (код):** в `mathUtils.js` `preprocessFormula`/`evalFormulaRaw` поддержать `Math.*`-функции (или предобработать их как делает MathText). Чинит разом все физико-механические шаблоны.

## ИТОГ по типам проблем

| Категория | Кол-во |
|---|---:|
| округление integer-формата | 42 |
| невычисленные vars (Math.*) | 32 |
| дистрактор=правильный | 15 |
| answerFormula неверна | 13 |
| непроверяемо | 8 |
| NaN/пустой ответ | 3 |
| **Всего** | **113** |

(Программный прескан 1233 нашёл лишь 1 NaN-ответ + 6 схлопываний дистракторов — округление и сырые формулы он не ловит, их вскрыл только семантический аудит агентами.)

## Полная таблица находок

| ID | Тема | Шаблон | answerFormula | Ломается при | Тип |
|---|---|---|---|---|---|
| `0AfVm4ZErE7mAaHS30an` | Векторы на плоскости | Точка M делит отрезок AB пополам. Вектор OM можно выраз… | `0.5` | a=1 (все прогоны) | answerFormula неверна |
| `0IIFMcpG66Htf0ZCw0TP` | Решение треугольников | Стороны треугольника равны {a} см, {b} см и {c} см. Най… | `(a+b+c)/2` | a=4,b=4,c=5 и a=5,b=4,c=6 | answerFormula неверна (ответ округляется |
| `0RVWIE2UAquIDCefFLPH` | Conservation of momentum | Two particles P and Q of masses m and k*m respectively … | `a/b` | a=7,b=2 | answerFormula неверна |
| `2hVhxUrjWRUu8x2KwP8v` | Элементы комбинаторики и | Вероятность попадания в мишень равна {p}. Какова вероят… | `1-p` | p=0.1 | answerFormula неверна / непроверяемо |
| `3U2wiNcWFBtTp3J7kZO9` | Перпендикулярность в про | Отрезок длиной {L} см не пересекает плоскость. Его конц… | `k*4` | L=5,h1=2,h2=6 | answerFormula неверна |
| `3U2wiNcWFBtTp3J7kZO9` | Перпендикулярность в про | Отрезок длиной {L} см не пересекает плоскость. Его конц… | `k*4` | L=5,h1=2,h2=6 | дистрактор совпадает с правильным |
| `3NXSWrth3zqfNkbof0QS` | Resolving forces | A force of magnitude {F} N acts at an angle of {th}° ab… | `F*Math.cos(rad)` | F=10,th=21,rad=0 | непроверяемо |
| `3Csm5Z6BbqzTJyA3K0L6` | Площади многоугольников | Катеты прямоугольного треугольника равны {a} см и {b} с… | `a*b/2` | a=9,b=9 | ответ NaN/пустой на части значений |
| `3Ya2ZdK444ravua8PMCE` | Координатная плоскость | Для точки A=({x};{y}) укажи ее абсциссу… | `x` | x=0,y=1 | дистрактор совпадает с правильным |
| `3vq5Jv8dpqlACJaHGDtk` | Элементы теории вероятно | В коробке {n} карандашей, из них {m} красных. Наугад до… | `(n-m)/n` | n=20,m=4 → правильный 0.8; n=15,m=5 → 0. | ответ NaN/пустой на части значений |
| `3z9R4uz2Rvd9rEtTR7JU` | Элементы теории вероятно | Игральную кость (кубик) бросают один раз. Какова вероят… | `0.5` | константа | ответ NaN/пустой на части значений |
| `4JtCsVoPFyoP1kKCcuT0` | M2. Number | Find the lowest common multiple of {k}*{x} and {k}*{y} … | `k*x*y` | k=4,x=2,y=6 → реальный НОК(8,24)=24; k=2 | answerFormula неверна |
| `5yTM6Gd5oag1b4axDnyc` | Элементы теории вероятно | В классе {a} мальчиков и {b} девочек. Для дежурства нау… | `b/(a+b)` | a=11,b=10 | answerFormula неверна |
| `6HcqCsIcPZzi1YrYByGr` | Рациональные числа и дей | Найди расстояние между точками {a} и {b}… | `abs(a-b)` | a=-9,b=6 (также a=-1,b=1; a=5,b=-8; a=-6 | дистрактор совпадает с правильным |
| `6TxPMsqNj0T7A0pbAD4t` | Resolving forces | Two forces act on a particle. The first is {P} N at {a}… | `Math.atan(ry/rx)*180/Math.PI` | P=18,Q=6,a=54,b=22 | непроверяемо |
| `7APawJMr3cEolqtaoOT1` | Friction and static part | A particle of mass {m} kg is held at rest on a rough pl… | `mu*R` | m=5,a=12,P=42,mu=0,R=0 | непроверяемо |
| `7StodFhOlmRGUkugzMFW` | Случайные величины и их  | Случайная величина распределена по биномиальному закону… | `n/2` | n=7 (а также n=5, n=9) | answerFormula неверна |
| `869tqWJTObkwXhvuglz9` | Тригонометрия | Переведите угол {a} градусов в радианную меру. В ответ … | `a/180` | a=84 (и a=110, a=95) | answerFormula неверна (ответ округляется |
| `8ZNf4lQw8X3VsYCwBH1j` | Impulse | A ball of mass {g} g is dropped from a height of {h1} m… | `m*(u+v)` | g=266,h1=5,h2=2 (u=0,v=0) | ответ NaN/пустой/нулевой на всех значени |
| `8aQZ690PyoP4wUuE4lNj` | Обратные тригонометричес | Чему равна сумма arcsin({v}) + arccos({v})? (где v - чи… | `pi/2` | v=0.2 | answerFormula неверна (иррациональный от |
| `9JgDePHaEFKh4imsKf3r` | Развертки пространственн | Прямоугольный параллелепипед имеет размеры {a} см, {b} … | `2` | a=4,b=4,c=4 | answerFormula неверна |
| `9GvNRKwNW4TTYc6SXZqX` | Friction | A particle of mass {m} kg is at rest on a rough horizon… | `P` | — | непроверяемо |
| `A4SbjD2Qq7gomOcv1vqO` | Элементы теории вероятно | В урне лежат {a} белых и {b} черных шаров. Наугад выним… | `a/(a+b)` | a=5,b=5 → правильный ответ 0.5, но answe | ответ NaN/пустой на части значений |
| `AEb5BEbAv7SAnk5gpg61` | Линейное уравнение с одн | Реши уравнение… | `a:2:5,b:2:12,c:1:6` | — | непроверяемо |
| `AcOnPwVEQf42yVGxlHkc` | Friction | A particle of mass {m} kg moves along a rough horizonta… | `mu*m*9.8` | m=8,mu=0.4 (текст 'is 0'); m=10,mu=0.5 ( | непроверяемо |
| `AzlnBz7iWVZngULJJY8v` | Friction | A particle of mass {m} kg is pulled along a rough horiz… | `(P-mu*m*9.8)/m` | m=10,P=68,mu=0.3 (текст показывает 0) | непроверяемо |
| `B6JoxKC0Ai4CSENsQbER` | Тригонометрические уравн | Найдите корни уравнения: {k} * sin(x) - {k} = 0. (где k… | `pi/2 + 2*pi*k` | k=2 (answer=14), k=4 (answer=27), k=5 (a | непроверяемо |
| `BISJe58xNEaEbxeHyDMe` | Многочлены | Даны два равных многочлена: {a}x^2 + bx + c = 5x^2 - 3x… | `5` | a=5,k=5 | дистрактор совпадает с правильным |
| `C3AMK3D9VAbiY1eI49mI` | Логарифмы | Вычислите: log_{a}({b}) + log_{a}({c}).… | `p1+p2` | a=3,p1=1,p2=3,b=0,c=0 | непроверяемо |
| `CRlvRKcsmuzLFmJmFh8W` | M4. Algebra | Find the gradient of a line perpendicular to y = {m}*x … | `(-1)/m` | m=2,c=2 | answerFormula неверна |
| `CfTfHrta2QC01c8HF5Hb` | Элементы комбинаторики и | В урне лежат {a} белых и {b} черных шаров. Наугад выним… | `a/(a+b)` | a=4,b=8 | answerFormula неверна |
| `DANkzxPEd4kAf42pjpWR` | Friction and static part | A particle of mass {m} kg rests on a rough horizontal s… | `mu*m*9.8` | — | непроверяемо |
| `E3eRFTV3oSYJwmOomwSn` | Inclined planes | A particle of mass {m} kg is pulled up a smooth slope i… | `(P-m*9.8*Math.sin(ra))/m` | m=2,a=29,P=22,ra=0; m=6,a=30,P=62,ra=0;  | непроверяемо / ответ NaN/пустой на части |
| `GID72muyAxCsjRekspYa` | Тригонометрия | Известно, что tg(x) = {t} и x в первой четверти. Найдит… | `1/t` | t=5 (my=0.2, key=0); t=3 (my≈0.333, key= | answerFormula неверна (округление до цел |
| `GID72muyAxCsjRekspYa` | Тригонометрия | Известно, что tg(x) = {t} и x в первой четверти. Найдит… | `1/t` | t=5,3,4 | дистрактор совпадает с правильным |
| `HC1NxbhJAtfL9LFyAse8` | Координатная плоскость | Горизонтальный отрезок y={a} и вертикальный отрезок x={… | `({b};{a})` | — | дистрактор совпадает с правильным |
| `HH7HBK4Jpg3iStq1XxLt` | Тригонометрия | Угол поворота равен {a} * pi. Чему равен cos этого угла… | `1` | a=5 | непроверяемо |
| `HLYVgswyi2AaCD9gHUTI` | Координатная плоскость | Отрезок задан концами C(0;{y1}) и D(0;{y2}). Найдите ко… | `(y1+y2)/2` | y1=5,y2=10 | answerFormula неверна |
| `J0A24Z6me8H4ptNxpMzu` | Разложение на множители | У многочлена {a}x<sup>{n}</sup>y<sup>{m}</sup> + {b}x<s… | `a+b` | a=2,b=4 (run1) | answerFormula неверна |
| `JnCizK2feL8qLKenx3RJ` | Resolving forces | A box of mass {m} kg is pulled along a smooth horizonta… | `m*9.8-F*Math.sin(rad)` | m=6,F=19,th=27,rad=0 | непроверяемо |
| `JugkRzugu6jBsR2LOAR2` | Статистика. Комбинаторик | Найдите среднее арифметическое двух чисел: {a} и {b}.… | `m` | a=15.5,b=24.5 (текст показывает 16 и 25) | answerFormula неверна |
| `KIc1aPMAQQhRRomtkDWk` | Тригонометрические функц | Чему равен основной период функции y = tg({k}x)?… | `pi/{k}` | k=3; k=2; k=4 | answerFormula неверна (ответ непроверяем |
| `KeCGEaO1d2QcWevjfd57` | Элементы комбинаторики и | Игральную кость бросают один раз. Какова вероятность то… | `0.5` | a=1 (все прогоны) | answerFormula неверна (ответ непроверяем |
| `LBnInIPRxn79uXwzaGf0` | Тригонометрия | Вычислите с помощью формул сложения: sin({a} градусов) … | `sin(s)` | a=13,b=18,s=31; a=30,b=38,s=68; a=13,b=3 | answerFormula неверна |
| `LBrtxGlbwafgYUbTqNta` | Рациональные числа и дей | Вычислите значение выражения: (-1)^{n} * {a}.… | `a` | n=9,a=3 (и n=7,a=5) | answerFormula неверна |
| `LXklQJ01lFI4l8H2nJOW` | Weight and Gravity | Find the weight (in N) of a particle of mass {m} kg. (U… | `m9.8` | m=15 → ожидается 147, key='m9.8' | непроверяемо |
| `La8PqDWYZvi4ReuRH6Dp` | Friction and static part | A particle of mass {m} kg is on a rough plane inclined … | `m*9.8*Math.sin(ra)-mu*R` | все прогоны: ra=0,R=0 | непроверяемо |
| `Lqy93mqDYc29FQiTdCsu` | Уравнения, неравенства и | Решите биквадратное уравнение: x^4 - {b}x^2 + {c} = 0. … | `t1^0.5` | t1=3, t2=13, b=16, c=39 (x^4-16x^2+39=0) | answerFormula неверна (нецелый корень ок |
| `LtXHIP8I3o1l6hRsAIJ1` | Static particles | A particle is in equilibrium under a horizontal force o… | `Math.atan(Q/P)*180/Math.PI` | P=20,Q=20 (а также P=8,Q=8 и P=17,Q=17) | дистрактор совпадает с правильным (при P |
| `MNwuBfyFe5bZlpT0ky2P` | Pulleys | A particle of mass {m1} kg rests on a smooth horizontal… | `m2/(m1+m2)` | m1=2,m2=1 и m1=2,m2=3 | ответ NaN/пустой на части значений |
| `NuJIMaC4OtO7XZo4FGEI` | Vertical motion under gr | A ball is projected vertically upwards from the ground … | `uu/19.6` | u=13 (и все остальные) | ответ NaN/пустой на части значений |
| `Nzi4eGxJC6DbYbNIs9X1` | Случайные величины и их  | Случайная величина X принимает значения {x1} и {x2} с о… | `(x1+x2)/2` | x1=4,x2=7 (также 8,17 / 8,13 / 3,10) | answerFormula неверна (округление искажа |
| `ORb3OHJNfYR2SFa2pnUE` | Статистика. Комбинаторик | Найдите медиану ряда чисел: {a}, {b}, {c}, {d} (числа р… | `(b+c)/2` | a=3,b=9,c=10,d=16 (также 2,7,10,16) | answerFormula неверна (округление искажа |
| `OFUPs3aOcFrg0Ii3yi0P` | Диаграммы | На круговой диаграмме сектор, составляющий половину кру… | `180` | a=1 (всегда) | непроверяемо (шаблон бессмысленный/самоп |
| `PUTXjcOpwPEuikoXteM6` | Тригонометрические уравн | Сколько корней имеет уравнение sin(x) = {a} на отрезке … | `2` | a=1.2 | answerFormula неверна |
| `QMZ7Graqw3JpXHAgUnhY` | Действия над рациональны | Представь дробь {a}/{b} в виде десятичной… | `a/b` | a=1,b=12 | дистрактор совпадает с правильным (short |
| `Qoh0fbpv1jeQmxC5J5yv` | Площадь фигур | Найдите площадь прямоугольного треугольника с катетами … | `(a*b)/2` | a=7, b=15 | answerFormula неверна |
| `RFQJcFen1p1EG4jAenk1` | Координатная плоскость | Точка A имеет координаты ({x};{y}). Найди координаты то… | `({-x};{-y})` | x=-4,y=2 | ответ NaN/пустой на части значений |
| `RUQHeq7pF26mbsblfLju` | Окружность. Многоугольни | В правильный шестиугольник вписана окружность радиуса {… | `r*2/3` | r=8 | answerFormula неверна |
| `RqfZIUJzBfVOKOsR1xF2` | Connected Particles | A car of mass {M} kg tows a trailer of mass {m} kg usin… | `D/(M+m)` | M=1184,m=227,D=0 | непроверяемо |
| `Rwe0p64hesD1q5vRRkqT` | Friction | A particle of mass {m} kg is pulled up a rough slope in… | `(P*Math.cos(rb)-m*9.8*Math.sin(ra)-mu*R)/m` | m=15,a=10,P=80,b=19,mu=0.2,ra=0,rb=0,R=0 | непроверяемо |
| `RxO9dJZw07V6f97nQYmc` | Pulleys | Two particles of mass {m1} kg and {m2} kg (where {m1} >… | `(m1-m2)/(m1+m2)` | m1=6,m2=2 | answerFormula неверна |
| `S8q6TgqLcR1YPzx2uA6U` | Делимость натуральных чи | Найди все делители числа {n}… | `ДЕЛИТЕЛЬ(n)` | n=13 | ответ NaN/пустой на части значений |
| `SFmMQhR82oapIssbBUga` | Friction and static part | A particle of mass {m} kg is on a rough horizontal surf… | `m*9.8` | m=5,mu=0.3 -> текст 'is 0'; m=12,mu=0.5  | непроверяемо |
| `SxkK2XCEinhN2VrmUjvp` | Modelling with statics | A particle of mass {m} kg rests on a smooth plane incli… | `m*9.8*Math.cos(ra)` | ra=0 при a=18 (и все остальные прогоны) | ответ NaN/пустой на части значений |
| `Ui0c9vR2PcBUOs1s4YJr` | Десятичные дроби и дейст | Переведи дробь {p}/{q} в десятичную… | `p/q` | p=2,q=20 | дистрактор совпадает с правильным |
| `V9WX4bQ2jPq353bON6ov` | Показательные неравенств | Найдите наименьшее целое решение неравенства 2^x > {a}.… | `b+1` | a=0 (b=5..8 во всех прогонах) | непроверяемо |
| `VZ0S2AbHN9XKWMB2uOgV` | Элементы теории вероятно | В лотерее {n} билетов, из которых {m} выигрышных. Каков… | `m/n` | m=6,n=54 → answer 0 (надо 0.11); m=7,n=5 | ответ NaN/пустой на части значений |
| `VrnqUv5oJ7aR8stCaPn2` | M2. Number | A distance is {d} m correct to the nearest metre. What … | `d-0.5` | d=33 → answer 33; d=46 → answer 46 | answerFormula неверна |
| `VvdFEiTovjEqvfwz0ejm` | Линейное уравнение с одн | Реши уравнение… | `a:1:12` | x=9, ={a=0 | непроверяемо |
| `WZPwlIySQYDyiQuxd4MA` | Pulleys | Two particles of mass {m1} kg and {m2} kg (where {m1} >… | `(2m1m2)/(m1+m2)` | m1=7,m2=2 | непроверяемо |
| `XSEAbpcpkKkbWHgbK3j4` | Координатная плоскость | Точка A имеет координаты ({x};{y}). Найди координаты то… | `({x};{-y})` | x=-1,y=-5 (ответ "(-1;{-y})" вместо "(-1 | ответ NaN/пустой на части значений |
| `XsnONP286zfQdh363B7H` | M4. Algebra | A straight line passes through the points ({x1}, {y1}) … | `dy/dx` | x1=2,y1=5,x2=5,y2=7 | answerFormula неверна |
| `YOGzppRsJHnyKEc0S72A` | Тригонометрические функц | Переведите угол {a} градусов в радианную меру. Запишите… | `a/180` | a=93 | answerFormula неверна |
| `Z3wd6nMlI1TQCpsjQ1Wz` | M3. Ratio and proportion | A sequence is defined by the iteration x_{n+1} = {k}*x_… | `start*k*k` | start=6,k=2 / start=8,k=2 | дистрактор совпадает с правильным |
| `ZRFDkVJPmQXHp4QZDhus` | Resolving forces | Two forces act on a particle. One is {P} N at {a}° abov… | `Math.sqrt(sx*sx+sy*sy)` | P=18,Q=15,a=44,b=36,ra=0,rb=0,sx=0,sy=0 | непроверяемо |
| `bnuNfhvRv6DkSgPzzbth` | Resolving forces | A force of magnitude {F} N acts at an angle of {th}° ab… | `F*Math.sin(rad)` | F=31,th=32,rad=0 | ответ NaN/пустой на части значений |
| `bpNauJ0W1ogYLCfSOYJH` | Линейное уравнение с одн | Реши уравнение {a}*x={b}… | `x` | a=6,b=41,x=6.833 | непроверяемо |
| `ckFrXYwaza8d0O0s0ZBs` | Площади многоугольников | Стороны прямоугольника равны {a} см и {b} см. Найдите е… | `a*b` | a=11,b=11 | дистрактор совпадает с правильным |
| `cvCKIu8C7RQlsgaYOPCa` | M4. Algebra | Solve the inequality: {a}*x + {b} < {c}*x + {d}. Find t… | `x_val-1` | a=2,c=5,x_val=3,b=0,d=0 | непроверяемо |
| `dS4QNxNIoqLh634Ej5KD` | Координатная плоскость | Отрезок задан концами A({x1};0) и B({x2};0). Найдите ко… | `(x1+x2)/2` | x1=5,x2=10 | answerFormula неверна |
| `eIsHtt91yb9Jnz3l8hDC` | Обратные тригонометричес | Вычислите: arcsin(-1/2).… | `-pi/6` | a=1 (все прогоны, text='Вычислите: arcsi | answerFormula неверна / ответ некорректе |
| `e2UlxMBzPBrQ14otniN5` | Friction | A particle slides down a rough slope inclined at {a}° t… | `(9.8*Math.sin(ra)-acc)/(9.8*Math.cos(ra))` | ra=0, acc=0 во всех прогонах при a=25, m | непроверяемо / вырожденная подстановка |
| `foD7PEhZQstgNP52MK5x` | Friction | A particle slides down a rough slope inclined at {a}° t… | `9.8*Math.sin(ra)-mu*9.8*Math.cos(ra)` | a=26,mu=0.2,ra=0 | непроверяемо / ответ не вычислен |
| `fpCBVDCjtHlX1o7m1XIc` | M4. Algebra | Line L1 has a gradient of {m}. Line L2 is perpendicular… | `(-1)/m` | m=2 | answerFormula неверна (целочисленное усе |
| `iFLMZspcT6JEoP5EszpG` | Тригонометрия | Примените формулу косинуса разности: cos({a} градусов) … | `cos(d)` | a=48,b=28,d=20 | answerFormula неверна / непроверяемо |
| `iFxBFoodPNSQf1rdWFCL` | Friction and static part | A particle of mass {m} kg rests on a rough plane inclin… | `mu*R` | m=7,a=13,mu=0.5,R=0 | непроверяемо / ответ всегда 0 |
| `iIqxAe7WabgU8kCU1aXI` | M2. Number | Find the highest common factor (HCF) of {A} and {B}.… | `k` | k=3,x=3,y=6,A=9,B=18 | answerFormula неверна |
| `j5xaCQMO77Vi4Xy30Smn` | Элементы теории вероятно | Вероятность попадания в мишень равна {p}. Какова вероят… | `1-p` | p=0.1 | answerFormula неверна / непроверяемо |
| `jC74FMJtkvGLduPH3K1x` | Friction and static part | A particle of mass {m} kg rests on a rough plane inclin… | `m*9.8*Math.cos(ra)` | ra=0 во всех прогонах (m=6,a=21) | дистрактор совпадает с правильным + непр |
| `javbNq7G51ohcuOvAFGk` | Элементы теории вероятно | Стрелок стреляет по мишени дважды. Вероятность попадани… | `p*p` | p=0.6 (my=0.36, key=0); p=1.6 (вероятнос | answerFormula неверна / непроверяемо |
| `kCbDjpYpV8gd056nvgwY` | Тригонометрия | Известно, что sin(x) = {s} / {h} и угол x находится в п… | `c` | run1 {c:5,h:7,s:4.898979485566356} текст | непроверяемо / шаблон выдаёт противоречи |
| `lBKnKWCTWxxsNgAJly2X` | Friction and static part | A particle of mass {m} kg is on a rough plane inclined … | `m*9.8*Math.sin(ra)+mu*R` | m=5,a=28,mu=0.1,ra=0,R=0 | непроверяемо |
| `lEZOQCSmxKcaQ4iTVOr6` | Алгебраические выражения | В выражении {a}x + {b}y вынесли за скобки наибольший об… | `k` | a=6,b=12 (k=2) | answerFormula неверна |
| `lQvzRMZejYDcQrItq781` | M2. Number | The length of a rectangle is {L} cm correct to the near… | `L+0.5` | L=25 | answerFormula неверна / ответ не среди о |
| `mCqvUNNKtqAsM8glIzbx` | M4. Algebra | Evaluate the following expression using fractional inde… | `k` | a=4, k=2 | дистрактор совпадает с правильным |
| `ngUOR6tANtGShwace3wk` | Modelling with statics | A particle of mass {m} kg rests on a smooth plane incli… | `m*9.8*Math.sin(ra)` | ra=0 при a=28,17,29,... | ответ NaN/пустой на части значений |
| `pGX64XbjDxFVObt2t3Ft` | Текстовые задачи | Найди {p}/{q} от числа {n}… | `n*p/q` | p=3,q=3,n=72 | дистрактор совпадает с правильным |
| `pmEgqll5FXatTiG9z7A1` | Friction | A particle of mass {m} kg is at rest on a rough horizon… | `mu*m*9.8` | m=12,mu=0.6 (text='is 1'); m=5,mu=0.1 (t | непроверяемо |
| `qqacMdM7wwZZoRlCVsH8` | Делимость натуральных чи | Число {n} разложили на простые множители: 2 * 3 * x. На… | `x` | n=36, x=6 | непроверяемо/некорректная постановка |
| `r9HY0W8j0PRGntb7AUqe` | Обратные тригонометричес | Вычислите: arctg(1).… | `pi/4` | a=1 (все прогоны) | answerFormula неверна |
| `rDUqtRowIoSebcaxWVJt` | Force and Acceleration | A constant force F acts on a particle of mass {m} kg fo… | `m*k` | m=3,t=3,k=2,b=6 | непроверяемо (частично) |
| `s4iMlEkep4Fo93WcGAxD` | Обратные тригонометричес | Вычислите значение: arcsin(1/2).… | `pi/6` | a=1 (все прогоны) | answerFormula неверна / непроверяемо |
| `rgmFuTaGlmIJNNaLpo1z` | Зависимости между величи | В формуле прямой пропорциональности y = {k}x значение п… | `2` | k=2 | дистрактор совпадает с правильным |
| `sjwsbxVyZ77VifcTgnGW` | Nonlinear functions | A population of bacteria doubles every {d} hours. If th… | `P*Math.pow(2,cycles)` | P=42,d=2,cycles=2,t=4 | ответ NaN/пустой на части значений |
| `t5MQSWa88wGnx88KC3fX` | Тригонометрические функц | Чему равен основной период функции y = sin({k}x)?… | `2*pi/{k}` | k=5; k=2; k=3 | answerFormula неверна / непроверяемо |
| `t5VFyIiLUKTPj2WSSouX` | Элементы комбинаторики и | В коробке {n} карандашей, из них {m} красных. Наугад до… | `(n-m)/n` | n=25,m=5; n=9,m=3; n=4,m=2 | answerFormula неверна / непроверяемо |
| `vrlws8ElZny39oGpXEPZ` | Текстовые задачи | Найди число, если его {p}/{q} часть равна {a}… | `a/(p/q)` | p=5,q=5,a=20 и p=2,q=2,a=19 | дистрактор совпадает с правильным |
| `x2cCQKQRfiGtLjJ723QI` | Обратные тригонометричес | Вычислите значение: arccos(1/2).… | `pi/3` | a=1 (все прогоны) | answerFormula неверна / непроверяемо |
| `x7dWjzP0IzAjq7FA8R8z` | Элементы теории вероятно | Из слова "МАТЕМАТИКА" наугад выбирают одну букву. Каков… | `0.3` | a=1 (все прогоны) | answerFormula неверна |
| `xeOCUPSzJP5qdsXJVw57` | Тригонометрия | Определите знак выражения: sin({a} градусов) * cos({b} … | `плюс` | a=161,b=224 (а также a=120,b=242; a=142, | answerFormula неверна |
| `ybXRxUqobpdpK9DFy2C7` | Resolving forces | Two forces of magnitudes {P} N and {Q} N act with an an… | `Math.sqrt(P*P+Q*Q+2*P*Q*Math.cos(rad))` | P=17,Q=6,th=67,rad=0 | непроверяемо |
| `z7sJ7whGEUsfMKiukHTO` | M5. Geometry | Evaluate the exact value of {a}*sin(30).… | `a/2` | a=9 (text '9*sin(30)') и a=3 (text '3*si | answerFormula неверна |


---

# ПОСЛЕ ФИКСА mathUtils.js (commit c941166)

Повторный аудит тех же 111 вопросов (gen-eval импортирует фикснутый код):

| | Было | Стало |
|---|---:|---:|
| Находок | 113 | 29 |
| Вопросов с проблемой | 111 | 28 |

**Починилось автоматически: 83 из 111 вопросов (75%)** — два код-фикса закрыли классы «округление integer» (42) и «Math.* обнуление/сырые строки» (большинство из 32).

## Осталось 29 — ДРУГИЕ классы багов (не лечатся этими 2 фиксами, нужны правки данных/отдельный код)

| Категория | Кол-во |
|---|---:|
| переменные вне ограничений условия | 10 |
| дистрактор совпадает с правильным | 6 |
| сломанный шаблон (нет условия) | 4 |
| нерезолвнутый {-var} в формуле | 4 |
| answerFormula неверна по смыслу | 2 |
| опечатка в формуле (пропущен *) | 2 |
| прочее/непроверяемо | 1 |

| ID | Тема | answerFormula | Проблема |
|---|---|---|---|
| `3U2wiNcWFBtTp3J7kZO9` | Перпендикулярность в п | `k*4` | answerFormula неверна |
| `4JtCsVoPFyoP1kKCcuT0` | M2. Number | `k*x*y` | answerFormula неверна |
| `2hVhxUrjWRUu8x2KwP8v` | Элементы комбинаторики | `1-p` | ответ NaN/пустой на части значений |
| `AEb5BEbAv7SAnk5gpg61` | Линейное уравнение с о | `a:2:5,b:2:12,c:1:6` | непроверяемо |
| `6HcqCsIcPZzi1YrYByGr` | Рациональные числа и д | `abs(a-b)` | дистрактор совпадает с правильным |
| `B6JoxKC0Ai4CSENsQbER` | Тригонометрические ура | `pi/2 + 2*pi*k` | непроверяемо |
| `HH7HBK4Jpg3iStq1XxLt` | Тригонометрия | `1` | answerFormula неверна |
| `HC1NxbhJAtfL9LFyAse8` | Координатная плоскость | `({b};{a})` | дистрактор совпадает с правильным |
| `LBnInIPRxn79uXwzaGf0` | Тригонометрия | `sin(s)` | answerFormula неверна |
| `LBrtxGlbwafgYUbTqNta` | Рациональные числа и д | `a` | answerFormula неверна |
| `LXklQJ01lFI4l8H2nJOW` | Weight and Gravity | `m9.8` | ответ NaN/пустой на части значений |
| `Nzi4eGxJC6DbYbNIs9X1` | Случайные величины и и | `(x1+x2)/2` | дистрактор совпадает с правильным |
| `OFUPs3aOcFrg0Ii3yi0P` | Диаграммы | `180` | непроверяемо |
| `PUTXjcOpwPEuikoXteM6` | Тригонометрические ура | `2` | answerFormula неверна |
| `QMZ7Graqw3JpXHAgUnhY` | Действия над рациональ | `a/b` | дистрактор совпадает с правильным |
| `RFQJcFen1p1EG4jAenk1` | Координатная плоскость | `({-x};{-y})` | непроверяемо |
| `RqfZIUJzBfVOKOsR1xF2` | Connected Particles | `D/(M+m)` | дистрактор совпадает с правильным |
| `S8q6TgqLcR1YPzx2uA6U` | Делимость натуральных  | `ДЕЛИТЕЛЬ(n)` | ответ NaN/пустой на части значений |
| `VvdFEiTovjEqvfwz0ejm` | Линейное уравнение с о | `a:1:12` | непроверяемо |
| `WZPwlIySQYDyiQuxd4MA` | Pulleys | `(2m1m2)/(m1+m2)` | непроверяемо |
| `WZPwlIySQYDyiQuxd4MA` | Pulleys | `(2m1m2)/(m1+m2)` | дистрактор совпадает с правильным |
| `XSEAbpcpkKkbWHgbK3j4` | Координатная плоскость | `({x};{-y})` | непроверяемо |
| `cvCKIu8C7RQlsgaYOPCa` | M4. Algebra | `x_val-1` | непроверяемо |
| `iFLMZspcT6JEoP5EszpG` | Тригонометрия | `cos(d)` | answerFormula неверна |
| `iIqxAe7WabgU8kCU1aXI` | M2. Number | `k` | answerFormula неверна |
| `lEZOQCSmxKcaQ4iTVOr6` | Алгебраические выражен | `k` | answerFormula неверна |
| `pGX64XbjDxFVObt2t3Ft` | Текстовые задачи | `n*p/q` | дистрактор совпадает с правильным (shortOp |
| `qqacMdM7wwZZoRlCVsH8` | Делимость натуральных  | `x` | непроверяемо |
| `xeOCUPSzJP5qdsXJVw57` | Тригонометрия | `плюс` | answerFormula неверна |
