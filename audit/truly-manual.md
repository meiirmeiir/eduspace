# Финальная ручная корзина — действительно непочинимо

Остатки после авто-починки 3 групп (skillTasks/dailyTasks/questions). Эти **8** задач требуют ручного редизайна автором: либо нужен рисунок/чертёж без текстового эквивалента, либо задача внутренне противоречива/неоднозначна, либо это нематематический (English) дефект.

| Коллекция | Локация | Причина | Суть |
|---|---|---|---|
| skillTasks | `system_modeling_tasks b[15]` | валидатор: solved=1≠corr=0 | По теореме косинусов 37=13x^2, x≈1,687; сумма двух сторон 7x≈11,81≈12, поэтому приближённый периметр 12+√37 (idx0). Опции приведены к единому LaTeX-фо |
| dailyTasks | `net_operations #47` | agent:manual (нужен рисунок) | manual: ответ зависит от конкретной развертки и направлений стрелок на ней, которые заданы только рисунком. Без чертежа задача однозначно не определяе |
| dailyTasks | `net_operations #61` | agent:manual (нужен рисунок) | manual: формы кусков из 2 и 4 квадратов не заданы (они определяются только рисунком), поэтому число способов соединения не определено. Без чертежа зад |
| dailyTasks | `optimization_tasks #11` | вердикт не прошёл (solved=0 corr=0 math=false fmt=true 4uniq=true) | fix(rewrite): исходно с S=1600 оптимум 40√2×20√2 (L≈113.1) не попадал ни в одну опцию (и были дубли 40×40). Переписал на S=800 с целочисленным оптимум |
| questions (compound) | `2tbFDirEN2rZbDRLLRrx` | валидатор !ok | x^2+(3x-5)^2=25 -> 10x^2-30x=0 -> x=0 or x=3. Only the pair whose y lies in the options is x=0 -> y=3*0-5=-5. So sub0 x=0 (idx2, was wrongly '5'), sub |
| questions (compound) | `LxqpdYusguZi4lVjk2Ru` | agent:manual | System x^2-y=4, x+y^2=10 -> y=x^2-4, substitute: x^4-8x^2+x+6=0, only rational root x=1 (others irrational), giving y=-3. Neither x=1 nor y=-3 is amon |
| questions (mcq) | `gX4SvL26uxxyo6xTkDD4` | валидатор !ok | Two independent clauses ('Many historians argue...urban centers' / 'others emphasize...changes') joined by conjunctive adverb 'however'. Among given o |
| questions (generated) | `cvCKIu8C7RQlsgaYOPCa` | agent:manual | Template inconsistent. With a<c and '<', solving a*x+b<c*x+d gives x > (d-b)/(a-c). Since d=(c-a)*x_val+b, bound = -x_val, i.e. x > -x_val: a LOWER bo |

## Детали

### `system_modeling_tasks b[15]` (skillTasks)
- **Причина:** валидатор: solved=1≠corr=0
- **Заметка переписчика:** По теореме косинусов 37=13x^2, x≈1,687; сумма двух сторон 7x≈11,81≈12, поэтому приближённый периметр 12+√37 (idx0). Опции приведены к единому LaTeX-формату с единицами, correct→0, explanation переписан.
- **Вердикт валидатора:** Закон косинусов при угле 60° и сторонах 3k,4k даёт третью сторону c²=9k²+16k²-12k²=13k², т.е. c=k√13 — никогда не √37. Условие «угол 60° и третья сторона √37» внутренне противоречиво. √37 получается только при угле 120° (c²=9+16+12=37) и k=1, тогда стороны 3 и 4, периметр 7+√37 (вариант 1). Если буквально верить «третья сторона √37» и взять k=1, ответ — вариант 1. Опции различны, читаемы, LaTeX ко

### `net_operations #47` (dailyTasks)
- **Причина:** agent:manual (нужен рисунок)
- **Заметка переписчика:** manual: ответ зависит от конкретной развертки и направлений стрелок на ней, которые заданы только рисунком. Без чертежа задача однозначно не определяется; честно переписать в текст с единственным числовым/однозначным ответом нельзя.
- **Вердикт валидатора:** непроверяемо

### `net_operations #61` (dailyTasks)
- **Причина:** agent:manual (нужен рисунок)
- **Заметка переписчика:** manual: формы кусков из 2 и 4 квадратов не заданы (они определяются только рисунком), поэтому число способов соединения не определено. Без чертежа задача не имеет однозначного ответа.
- **Вердикт валидатора:** непроверяемо

### `optimization_tasks #11` (dailyTasks)
- **Причина:** вердикт не прошёл (solved=0 corr=0 math=false fmt=true 4uniq=true)
- **Заметка переписчика:** fix(rewrite): исходно с S=1600 оптимум 40√2×20√2 (L≈113.1) не попадал ни в одну опцию (и были дубли 40×40). Переписал на S=800 с целочисленным оптимумом x=40,y=20; единственный истинно верный вариант '40 м и 20 м'.
- **Вердикт валидатора:** нет верной опции

### `2tbFDirEN2rZbDRLLRrx` (questions)
- **Причина:** валидатор !ok
- **Заметка переписчика:** x^2+(3x-5)^2=25 -> 10x^2-30x=0 -> x=0 or x=3. Only the pair whose y lies in the options is x=0 -> y=3*0-5=-5. So sub0 x=0 (idx2, was wrongly '5'), sub1 y=-5 (idx0, was wrongly '7'). Options already contain correct values; only keys fixed.
- **Вердикт валидатора:** Подставляя y=3x−5 в x²+y²=25: x²+(3x−5)²=25 → 10x²−30x=0 → x(x−3)=0, значит x=0 ИЛИ x=3. В подзадаче 0 ("какое значение может иметь x") среди опций ДВА верных ответа: индекс 2 (=0) и индекс 3 (=3). Предложенный correct=2 указывает лишь на одно из двух правильных значений — задача с одним правильным ответом дефектна (неоднозначна), поэтому исправление нельзя считать верным. (Подзадача 1 сама по себ

### `LxqpdYusguZi4lVjk2Ru` (questions)
- **Причина:** agent:manual
- **Заметка переписчика:** System x^2-y=4, x+y^2=10 -> y=x^2-4, substitute: x^4-8x^2+x+6=0, only rational root x=1 (others irrational), giving y=-3. Neither x=1 nor y=-3 is among the offered options, and sub0 'find x from the first equation alone' is ill-posed (first eq alone cannot determine x). Skill labels ('однородные системы') are also wrong. Not fixable without rewriting the item.

### `gX4SvL26uxxyo6xTkDD4` (questions)
- **Причина:** валидатор !ok
- **Заметка переписчика:** Two independent clauses ('Many historians argue...urban centers' / 'others emphasize...changes') joined by conjunctive adverb 'however'. Among given options the only one supplying both the adverb and required punctuation is 'centers, however,' (index 0). Stored correct=2 ('centers') yields a run-on/fused sentence. newCorrect=0.
- **Вердикт валидатора:** Two independent clauses ("Many historians argue...urban centers" and "others emphasize...") need a semicolon before the conjunctive adverb "however": "...urban centers; however, others...". Proposed correct=0 "centers, however," uses only a comma before "however," producing a comma splice — grammatically incorrect. All five options are flawed (1, 3 = comma splice; 2, 4 = fused run-on), so no optio

### `cvCKIu8C7RQlsgaYOPCa` (questions)
- **Причина:** agent:manual
- **Заметка переписчика:** Template inconsistent. With a<c and '<', solving a*x+b<c*x+d gives x > (d-b)/(a-c). Since d=(c-a)*x_val+b, bound = -x_val, i.e. x > -x_val: a LOWER bound, so 'largest integer value of x' is unbounded/undefined. answerFormula 'x_val-1' is wrong on all value sets (verified for (a,c,x_val,const)=(2,5,3,2),(3,7,5,1),(2,6,2,3)). For answer to equal x_val-1 the inequality would need an upper bound at x_val, requiring a>c or operator '>', i.e. changes to the text/constraint/derivedVars d which genFix cannot make. Needs human redesign.
