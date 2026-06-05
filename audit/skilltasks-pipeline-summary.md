# skillTasks — полный цикл фиксов (Шаги 1–6): сводка

Коллекция skillTasks: 307 банков, поля a/b/c, **26 187 задач**. Все правки — backup + dry-run + валидация.

## Применено в Firestore

| Шаг | Что | Применено | Backup |
|---|---|--:|---|
| 2 | Целевые render-фиксы (контрол-символы `rac`/`ight`/…, `(...)`→`$`) | 1645 полей / 33 банка | ✅ |
| 3 | Wrap безопасных опций | 3 поля | ✅ |
| 4 | Ключ-фикс (re-point correct из решённого) | 84 ключа | ✅×3 |
| 6 | Rewrite сломанных задач (опции/correct/explanation) | 174 задачи | ✅×2 |
| 5 | Чистка explanation (мусорные хвосты) | 85 explanation | ✅ |

Итого записей: render 1648 полей + 84 ключа + 174 rewrite + 85 explanation = **~1991 правка** в ~110 уникальных банках.

## Метрики качества

- **Рендер:** KaTeX parse-ошибок 942 → 6 (−99.4%); literal-LaTeX 81 → 28; контрол-символьная порча (149 полей) устранена.
- **Логика:** 99 банков аудита (8289 задач), 271 находка; спот-проверки 6/6; 84 ключа + 174 rewrite исправлены.
- **Explanation:** 85 хвостов саморедактирования вычищено (математика дословно сохранена).

## Осталось (follow-up, не применено)

| Категория | Кол-во | Файл |
|---|--:|---|
| Render: авторские KaTeX-ошибки + literal | ~34 | audit/skilltasks-render-issues.md |
| Логика: Шаг 6 отклонено валидатором | 13 | audit/_st6_result.json (rejected) |
| Логика: новые конфликты answer (из чистки) | 106 | audit/_st5_contradictions.json |
| Render: не-оборачиваемые (Unicode/смешанное) | ~31 | audit/skilltasks-render-issues.md |

106 конфликтов answer — это разборы, чья математика противоречит отмеченному ответу (вскрыто после снятия мусорного хвоста); кандидаты на ещё один rewrite-проход.

## Артефакты

- Отчёты: skilltasks-render-issues.md, skilltasks-logic-audit.md, skilltasks-fix-report.md
- Скрипты: fix-skilltasks-render.mjs, fix-skilltasks-wrap.mjs, fix-skilltasks-keys.mjs, apply-skilltasks-step6.mjs, apply-skilltasks-step5.mjs
- Бэкапы: migration/backups/2026-06-05T*-skilltasks-*