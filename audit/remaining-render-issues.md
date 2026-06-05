# Проблемы рендера dailyTasks — Playwright sweep (финал: 0)

**Статус на 2026-06-04: 🟢 0 проблем рендера.** 306 банков · 12 399 вопросов проверены —
ни одного `.katex-error` (красный рендер) и ни одного literal-LaTeX вне `$` (видимые
`\frac`/`\sqrt`/`\команда`, `^{`/`_{`, голые `^`/`_`, непарные `$`).

**Метод.** Vite-харнесс (`audit/harness/`) импортирует **настоящий** компонент
`src/components/ui/LatexText.jsx` (тот же `react-katex` + `jsExprToLatex`, что и в проде) и
рендерит каждый банк в живой DOM. Playwright (`browser_navigate` + `browser_evaluate`)
инспектирует результат: банк за банком `mount → скан DOM → unmount`. Детектор ищет
(1) `.katex-error` и (2) literal-LaTeX в текстовых узлах вне `.katex` (включая скрытый
MathML-`<annotation>` с исходным TeX — исключён).

Тот же пайплайн воспроизведён в Node (`audit/render-check.mjs`) для проверки без браузера —
**совпадает с браузерным sweep байт-в-байт** (146 = 146, diff 0 на исходном прогоне).

**Источник данных.** Прод-состояние Firestore `dailyTasks` на 2026-06-04 (после применения фиксов).

## История кампании

| Этап | Проблем | Действие |
|---|---:|---|
| Исходный Playwright sweep | **146** | обнаружение (`.katex-error` = 0, всё — literal-LaTeX без/вне `$`) |
| `scripts/fix-partial-wrap.mjs` | 146 → **25** | 112 авто-фиксов (валидированы рендером), запись 22 документов |
| `scripts/fix-manual-latex.mjs` | 25 → **0** | 24 ручные семантические правки (`\frac`/`\ln`/`\sin`/`\sqrt`, непарные `$`), 11 документов |
| **Итог** | **0** | — |

### Что чинилось

- **Битый LaTeX (`.katex-error`)** — на момент sweep уже 0 (закрыто более ранней кампанией
  control-char + нормализация скобок).
- **Частичное оборачивание `$`** (`2\pi $R^2$`, `x = \pm $\frac{5}{3}$`) → обёрнуто целиком.
- **Голые `^`/`_` без `$`** (`a_10`, `(0,75)^15`, `log_2 7`) → обёрнуто (минимально в прозе,
  целиком в pure-math).
- **Деление `/` в pure-math** (`6^x / \ln 6`, `2^4 / 4! = 16/24`) → корректный `\frac`/`\ln` вручную.
- **Непарные `$`** (7) → закрыты по контексту.
- **`sqrt(x)`-литерал** (`sqrt_graphing #35`) → `\sqrt{x}` + переоформление выражения.

## Воспроизведение

```
# браузерный sweep
npx vite --port 5173 --strictPort
# Playwright → http://localhost:5173/audit/harness/index.html
# по завершении: window.__AUDIT.issues — массив {skill,num,field,fragment,type}

# headless-проверка (Node, без браузера)
node --input-type=module -e 'import {analyzeCorpus} from "./audit/render-check.mjs"; ...'
```

Артефакты: харнесс `audit/harness/`, валидатор `audit/render-check.mjs`,
отчёты фиксов `audit/fix-partial-wrap-report.md`, `audit/fix-manual-latex-report.md`.
Бэкапы перед записью: `migration/backups/2026-06-04T09-27-42-prefix-fix/`,
`migration/backups/2026-06-04T09-52-18-manual-latex/`.
