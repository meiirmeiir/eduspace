# Тех-долг: «Задачи для этого уровня ещё не добавлены» при заполненных skillTasks

**Статус:** открыт · обнаружен 2026-06-06 · разобраться после запуска (не блокер).

## Симптом
В карте навыков (План → модуль → «🚀 Продолжить экспедицию (Этап N)») экран этапа
показывает **«Задачи для этого уровня ещё не добавлены.»** даже для навыков, чьи
`skillTasks/{skillId}` РЕАЛЬНО заполнены.

## Воспроизведение
1. Тест-ученик (`bsZhaekYhxODSY9Xanxvh3WutIQ2`), навык `divisibility_rules_complex` выставлен
   `skillMastery.skills.divisibility_rules_complex.stagesCompleted = 1` (→ Этап 2 / level b).
2. План → модуль «Делимость чисел» → попап показывает «Этап 2 · 40%» (т.е. skillId резолвится
   в `divisibility_rules_complex` корректно) → «🚀 Продолжить экспедицию (Этап 2)».
3. Экран этапа: «Задачи для этого уровня ещё не добавлены.»

## Что проверено (данные В ПОРЯДКЕ)
- `skillTasks/divisibility_rules_complex` существует, ключи `a/b/c/skill_name/skill_id`,
  `b` — массив **25** задач `{id,text,options,correct,explanation}`. Не пусто.
- `SkillMasteryScreen.jsx:45` грузит `getDoc(doc(db,'skillTasks',skillId))`.
- `startStage()` (стр. 74-81): `pool = taskData?.[stageNum===1?'a':stageNum===2?'b':'c']` →
  для Этапа 2 это `taskData.b` (25 задач) → `shuffle(pool).slice(0,10)`.
- Сообщение (стр. 436): `{taskData ? 'Задачи для этого уровня ещё не добавлены.' : 'Задачи не найдены.'}`
  → рендерится когда `taskData` ЕСТЬ, но текущей задачи нет, т.е. **`tasks` (state) пуст**.

## Гипотеза
`tasks` остаётся `[]`, потому что **`startStage()` не вызывается** при входе в phase `'tasks'`
для навыка с `stagesCompleted>0` (стр. 59-64 ставят `phase='tasks'` напрямую, но populate
массива `tasks` идёт только из `startStage`, которая привязана к кнопке/действию). Возможна
гонка/пропущенный промежуточный экран выбора этапа. Нужно проверить, что вызывает `startStage`
при `phase==='tasks'` и почему он не отрабатывает для continued-навыка.

Альтернатива: `onStartTraining(sk.id)` из `DiagModulePopup` (DiagnosticModuleTree.jsx:437) передаёт
id, отличный от того, под которым лежат задачи (хотя попап-mastery совпал с моим write — против
этой версии). Стоит залогировать фактический `skillId` в `SkillMasteryScreen` и сверить с
`skillTasks` doc id.

## Связанное
- Кристаллы (`addCrystals(uid,10,'skill_mastered')`, SkillMasteryScreen.jsx:110) падают ТОЛЬКО за
  полное освоение (завершение Этапа 3), не за каждый этап. Важно для demo-solve-task (wow-эффект).
- Из-за этого бага не удалось записать маркетинговый ролик demo-solve-task с кристаллами
  (см. `scripts/record-demos.mjs`). Записать после фикса.

## Файлы
- `src/screens/SkillMasteryScreen.jsx` (загрузка задач, phase-машина, startStage)
- `src/components/diagTree/DiagnosticModuleTree.jsx` (попап модуля, onStartTraining)
