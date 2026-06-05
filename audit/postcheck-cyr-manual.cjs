/**
 * postcheck-cyr-manual.cjs — детерминированная проверка 65 принятых правок Workflow.
 * Сверяет с РЕАЛЬНЫМ before из _cyr_manual_cases.json (по idx), не доверяя эху агента.
 * Проверки: (1) before агента == реальный fullText; (2) в $...$ после НЕТ голой кириллицы
 * (вне \text/\mathrm/\operatorname); (3) число кир. букв сохранено; (4) парность и число $;
 * (5) мультимножество чисел сохранено; (6) проза вне $...$ не изменилась.
 */
const fs = require('fs');
const cases = JSON.parse(fs.readFileSync('audit/_cyr_manual_cases.json', 'utf8')).map((c, idx) => ({ idx, ...c }));
const byIdx = new Map(cases.map((c) => [c.idx, c]));
const wf = JSON.parse(fs.readFileSync('audit/_cyr_manual_wf_result.json', 'utf8'));
const accepted = wf.accepted;

const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const CYR = /[а-яёА-ЯЁ]/;
const cyrCount = (s) => (s.match(/[а-яёА-ЯЁ]/g) || []).length;
const dollars = (s) => (s.match(/\$/g) || []).length;
const numbers = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).sort();
// убрать содержимое \text{...}/\mathrm{...}/\operatorname{...} (с учётом вложенности 1 уровень)
const stripText = (s) => s.replace(/\\(?:text|mathrm|operatorname|mbox)\s*\{[^{}]*\}/g, '');
// проза вне $...$
const prose = (s) => s.replace(MATHSPAN, '');

const problems = [];
for (const e of accepted) {
  const real = byIdx.get(e.idx);
  const tag = `[${e.id} q${e.qi} ${e.field} idx${e.idx}]`;
  if (!real) { problems.push(`${tag} нет в исходных кейсах`); continue; }
  // 1) before агента совпадает с реальным
  if (e.before !== real.fullText) problems.push(`${tag} before≠реальный fullText (дрейф эха)`);
  // 2) голая кириллица в $...$ после
  const spans = e.after.match(MATHSPAN) || [];
  for (const sp of spans) {
    const bare = stripText(sp);
    if (CYR.test(bare)) problems.push(`${tag} ОСТАЛАСЬ голая кириллица в math: ${bare.match(/[а-яёА-ЯЁ][а-яёА-ЯЁ .,()i-]*/)?.[0] || '?'}`);
  }
  // 3) число кир. букв сохранено (сверяем с реальным before)
  if (cyrCount(e.after) !== cyrCount(real.fullText)) problems.push(`${tag} изменилось число кир.букв ${cyrCount(real.fullText)}→${cyrCount(e.after)}`);
  // 4) $ парность и число
  if (dollars(e.after) % 2 !== 0) problems.push(`${tag} нечётное число $`);
  if (dollars(e.after) !== dollars(real.fullText)) problems.push(`${tag} изменилось число $ ${dollars(real.fullText)}→${dollars(e.after)}`);
  // 5) числа сохранены
  const nb = numbers(real.fullText), na = numbers(e.after);
  if (nb.join(',') !== na.join(',')) problems.push(`${tag} мультимножество чисел изменилось\n      было: ${nb.join(' ')}\n      стало: ${na.join(' ')}`);
  // 6) проза вне $...$ не изменилась
  if (prose(real.fullText) !== prose(e.after)) problems.push(`${tag} проза вне $...$ изменилась`);
}

console.log(`Принятых правок: ${accepted.length}`);
if (!problems.length) console.log('\n✅ ПОСТ-ЧЕК ПРОЙДЕН: ни одной проблемы.');
else { console.log(`\n⚠ Проблем: ${problems.length}`); problems.forEach((p) => console.log('  • ' + p)); }
