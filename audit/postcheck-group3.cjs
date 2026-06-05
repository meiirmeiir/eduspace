/**
 * postcheck-group3.cjs — детерминированная проверка принятых правок Группы 3.
 * Сверяет before с РЕАЛЬНЫМ current из _group3_cases.json (по skill_id+qi).
 */
const fs = require('fs');
const cases = JSON.parse(fs.readFileSync('audit/_group3_cases.json', 'utf8'));
const realBy = new Map(cases.map((c) => [`${c.skill_id}#${c.qi}`, c.current]));
const accepted = JSON.parse(fs.readFileSync('audit/_group3_wf_result.json', 'utf8')).accepted;

const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const CYR = /[а-яёА-ЯЁ]/;
const stripText = (s) => s.replace(/\\(?:text|mathrm|operatorname|mbox)\s*\{[^{}]*\}/g, '');
const norm = (s) => String(s || '').replace(/\s+/g, '');

const problems = [];
for (const e of accepted) {
  const tag = `[${e.skill_id} qi${e.qi}]`;
  const real = realBy.get(`${e.skill_id}#${e.qi}`);
  if (!real) { problems.push(`${tag} нет в исходных кейсах`); continue; }
  // before == реальный current (текст + options)
  if (norm(e.before.text) !== norm(real.text)) problems.push(`${tag} before.text ≠ реальный current.text`);
  if (JSON.stringify(e.before.options) !== JSON.stringify(real.options)) problems.push(`${tag} before.options ≠ реальные`);
  const a = e.after;
  // формат
  if (!Array.isArray(a.options) || a.options.length !== 4) problems.push(`${tag} не 4 опции`);
  else if (new Set(a.options.map(String)).size !== 4) problems.push(`${tag} опции не уникальны`);
  if (!(a.correct >= 0 && a.correct <= 3)) problems.push(`${tag} correct вне 0..3: ${a.correct}`);
  if (e.verdict.solvedIndex !== a.correct) problems.push(`${tag} solvedIndex≠correct`);
  if (!a.explanation || !a.explanation.trim()) problems.push(`${tag} пустой explanation`);
  if (a.difficulty !== 'C') problems.push(`${tag} difficulty≠C: ${a.difficulty}`);
  // тема реально изменилась
  if (norm(a.text) === norm(real.text)) problems.push(`${tag} after.text == before (не изменён)`);
  // нет голой кириллицы в $...$ (консистентно с фиксом рендера)
  for (const sp of (a.text + ' ' + a.options.join(' ') + ' ' + a.explanation).match(MATHSPAN) || [])
    if (CYR.test(stripText(sp))) { problems.push(`${tag} голая кириллица в $...$: ${stripText(sp).match(/[а-яёА-ЯЁ][^$]*/)?.[0]?.slice(0,30)}`); break; }
}

console.log(`Принятых: ${accepted.length}`);
if (!problems.length) console.log('\n✅ ПОСТ-ЧЕК ПРОЙДЕН: 0 проблем.');
else { console.log(`\n⚠ Проблем: ${problems.length}`); problems.forEach((p) => console.log('  • ' + p)); }
