/* Генератор audit/remaining-render-issues.md из audit/_issues.json */
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(__dirname + '/_issues.json', 'utf8'));

const BS = '\\';                       // один литеральный backslash
const CMD_TYPE = 'literal-latex: ' + BS + 'cmd';
const LABEL = {
  'literal-latex: голая степень ^': 'голая степень `^` (нет `$`)',
  'literal-latex: голый индекс _': 'голый индекс `_` (нет `$`)',
  [CMD_TYPE]: '`' + BS + 'команда` вне `$`',
  'literal-latex: одиночный $': 'непарный `$`',
  'katex-error': 'KaTeX-ошибка (красный рендер)',
  'render-threw': 'падение рендера',
};
// экранируем для markdown-таблицы: пайп ломает ячейку даже внутри `code`
const escCell = (s) => String(s).replace(/\|/g, BS + '|').replace(/\n/g, ' ').trim();

const counts = {};
for (const i of j.issues) counts[i.type] = (counts[i.type] || 0) + 1;
const skills = new Set(j.issues.map((i) => i.skill));
const byField = {};
for (const i of j.issues) {
  const k = i.field.startsWith('options') ? 'options' : i.field;
  byField[k] = (byField[k] || 0) + 1;
}

const fieldOrd = (f) => (f === 'question' ? 0 : f === 'explanation' ? 2 : 1);
const optIdx = (f) => { const m = /options\[(\d+)\]/.exec(f); return m ? +m[1] : 0; };
const sorted = [...j.issues].sort(
  (a, b) =>
    a.skill.localeCompare(b.skill) || a.num - b.num ||
    fieldOrd(a.field) - fieldOrd(b.field) || optIdx(a.field) - optIdx(b.field)
);

const L = [];
L.push('# Оставшиеся проблемы рендера dailyTasks — Playwright sweep');
L.push('');
L.push('**Метод.** Vite-харнесс (`audit/harness/`) импортирует **настоящий** компонент `src/components/ui/LatexText.jsx`');
L.push('(тот же `react-katex` + `jsExprToLatex`, что и в проде) и рендерит каждый банк в живой DOM.');
L.push('Playwright (`browser_navigate` + `browser_evaluate`) инспектирует результат: банк за банком');
L.push('`mount → скан DOM → unmount`. Детектор ищет: (1) элементы `.katex-error` (битый LaTeX, красный рендер);');
L.push('(2) literal-LaTeX в текстовых узлах **вне** `.katex` — видимые `' + BS + 'frac`/`' + BS + 'sqrt`/`' + BS + 'команда`, `^{`/`_{`,');
L.push('голые `^`/`_` и непарные `$`. Узлы внутри `.katex` (включая скрытый MathML-`<annotation>` с исходным TeX) исключены.');
L.push('');
L.push('**Источник данных.** Свежий бэкап Firestore `migration/backups/2026-06-04T08-44-59/dailyTasks.json` (прод-состояние на 2026-06-04).');
L.push('');
L.push('**Покрытие.** 306 банков · 12 399 вопросов · 74 394 отрендеренных поля (question/options/explanation).');
L.push('');
L.push('## Итоговый count по типам');
L.push('');
L.push('| Тип проблемы | Кол-во |');
L.push('|---|---:|');
const order = [
  'katex-error', 'render-threw',
  'literal-latex: голая степень ^', 'literal-latex: голый индекс _',
  CMD_TYPE, 'literal-latex: одиночный $',
];
for (const t of order) if (counts[t]) L.push('| ' + LABEL[t] + ' | ' + counts[t] + ' |');
L.push('| **Всего** | **' + j.issues.length + '** |');
L.push('');
L.push('Затронуто навыков: **' + skills.size + '** из 306. По полям: ' +
  Object.entries(byField).map(([k, v]) => '`' + k + '` — ' + v).join(', ') + '.');
L.push('');
L.push('> 🟢 **`.katex-error` = 0, падений рендера = 0.** Класс «битый LaTeX, красный рендер» полностью закрыт');
L.push('> предыдущей кампанией фиксов (control-char + нормализация скобок). Все оставшиеся проблемы —');
L.push('> «математика без (или вне) `$`»: KaTeX к ним не вызывается, рендер не падает, но формула видна как сырой текст.');
L.push('');
L.push('## Корневые причины (все ' + j.issues.length + ' — literal-LaTeX без/вне `$`)');
L.push('');
L.push('1. **Частичное оборачивание `$`** — в строке *есть* `$`, поэтому `LatexText` пропускает авто-wrap');
L.push('   (`if (!raw.includes("$"))` ложно), и `' + BS + 'команда`/`^`/`_`, оказавшиеся **вне** `$`, утекают как текст.');
L.push('   Примеры: `"2' + BS + 'pi $R^2$"`, `"x = ' + BS + 'pm $' + BS + 'frac{5}{3}$"`, `"t = ' + BS + 'arctan(...) / 3"`. → фикс: обернуть всю формулу целиком.');
L.push('2. **Голые `^`/`_` без backslash и без `$`** — авто-wrap в `LatexText` срабатывает только на `' + BS + 'команду`/`Math.`,');
L.push('   а `2^x`, `a_n`, `log_2 7` не оборачиваются никогда. Примеры: `sequence_calculation` (explanation `a_10 = 10^2 - ...`),');
L.push('   `transcendental_integration` (options `5^x / ln 5 + C`), `log_foundations` (`log_2 7`). → фикс: обернуть в `$`.');
L.push('3. **Непарный/висячий `$`** (4 шт.) — `"243$"`, `"x=10$."`. → фикс: убрать лишний или дописать парный.');
L.push('');
L.push('## Полная таблица проблем');
L.push('');
L.push('| Навык | № вопроса | Поле | Проблемный фрагмент | Тип проблемы |');
L.push('|---|---:|---|---|---|');
for (const i of sorted) {
  L.push('| `' + i.skill + '` | ' + i.num + ' | `' + i.field + '` | `' + escCell(i.fragment) + '` | ' + (LABEL[i.type] || i.type) + ' |');
}
L.push('');
L.push('---');
L.push('');
L.push('### Воспроизведение');
L.push('');
L.push('```');
L.push('npx vite --port 5173 --strictPort');
L.push('# Playwright → http://localhost:5173/audit/harness/index.html');
L.push('# по завершении: window.__AUDIT.issues — массив {skill,num,field,fragment,type}');
L.push('```');
L.push('Харнесс и сырой результат: `audit/harness/`, `audit/_issues.json`.');
L.push('');

fs.writeFileSync(__dirname + '/remaining-render-issues.md', L.join('\n'));
console.log('OK rows=' + j.issues.length);
