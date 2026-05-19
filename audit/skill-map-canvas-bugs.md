# SkillMapCanvas — pre-existing React key duplication (TODO)

Обнаружено во время Playwright-прогона на 7.7 (экстракт AdminScreen).
Баг существовал и до 7.7 — просто на вкладке «🗺️ Карта навыков» админ
обычно не нажимал. AdminScreen только вызывает `<SkillMapCanvas/>` —
сам по себе AdminScreen не виноват.

## Симптом

В DEV-консоли при открытии вкладки «🗺️ Карта навыков» в админке:

```
Warning: Encountered two children with the same key, `…`.
Keys should be unique so that components maintain their identity
across updates. Non-unique keys may cause children to be duplicated
and/or omitted — the behavior is unsupported and could change in a
future version.
  at div
  at div
  at div
  at div
  at div
  at SkillMapCanvas (src/components/admin/SkillMapCanvas.jsx:20:42)
  at AdminScreen
```

Затрагивает как минимум:
  - «Запись разложения бинома Ньютона»
  - «Применение основного тригонометрического тождества»
  - «Применение формул понижения степени»

## Причина

`SkillMapCanvas` рендерит список навыков, используя `skill.skill_name`
(русское название) как `key`. В данных есть навыки с одинаковыми
именами (но разными `skill_id`) — React видит коллизию.

## Фикс (план)

Заменить `key={skill.skill_name}` на `key={skill.skill_id}` (или
`key={skill.id}`, в зависимости от того, что хранится в данных). Это
правильно: skill_id должен быть уникальным per-row, skill_name — нет.

## Зачем не правлю сейчас

Стадия 7.7 — экстракт AdminScreen 1:1. Любые правки в
`components/admin/SkillMapCanvas.jsx` выходят за её рамки. Сделать
отдельным bugfix-коммитом после завершения этапа 7.
