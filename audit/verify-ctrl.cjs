const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));
const samples = [
  ['basic_antiderivative_concept', 'a', 9, 'text'],
  ['func_composition', 'c', 21, 'text'],
  ['graphical_interpretation', 'b', 14, 'explanation'],
  ['addition_method', 'a', 16, 'text'],
];
for (const [bank, lvl, i, f] of samples) {
  const s = byId.get(bank)[lvl][i][f];
  const ctrl = [];
  [...s].forEach((ch, idx) => {
    const c = ch.codePointAt(0);
    if (c < 0x20 && c !== 0x0a && c !== 0x09) ctrl.push(`@${idx} U+${c.toString(16).padStart(4, '0').toUpperCase()} →"${s.slice(idx + 1, idx + 6)}"`);
  });
  console.log(`\n[${bank} ${lvl}[${i}] ${f}] len=${s.length}`);
  console.log('  ctrl(<0x20,не LF/TAB):', ctrl.length ? ctrl.join('  ') : 'НЕТ');
  console.log('  \\paren:', s.includes('\\(') , '| \\bracket:', s.includes('\\['));
}
// глобальная статистика контрол-символов по всему skillTasks
let withCtrl = 0, totalCtrl = 0;
const ctrlByCode = {};
for (const d of all) for (const lvl of ['a', 'b', 'c']) for (const t of d[lvl] || []) {
  for (const f of ['text', 'question', 'explanation', ...((t.options || []).map((_, k) => 'opt' + k))]) {
    const v = /^opt/.test(f) ? t.options[+f.slice(3)] : t[f];
    if (typeof v !== 'string') continue;
    let has = false;
    for (const ch of v) { const c = ch.codePointAt(0); if (c < 0x20 && c !== 0x0a && c !== 0x09 && c !== 0x0d) { has = true; totalCtrl++; ctrlByCode['U+' + c.toString(16).padStart(4, '0')] = (ctrlByCode['U+' + c.toString(16).padStart(4, '0')] || 0) + 1; } else if (c === 0x0d) { has = true; totalCtrl++; ctrlByCode['U+000d(CR)'] = (ctrlByCode['U+000d(CR)'] || 0) + 1; } }
    if (has) withCtrl++;
  }
}
console.log(`\n=== ГЛОБАЛЬНО: полей с контрол-символами (кроме LF/TAB): ${withCtrl}, всего символов: ${totalCtrl} ===`);
console.log(JSON.stringify(ctrlByCode, null, 0));
