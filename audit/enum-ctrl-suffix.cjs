const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const NAME = { 8: 'BS\\b', 9: 'TAB\\t', 11: 'VT\\v', 12: 'FF\\f', 13: 'CR\\r', 10: 'LF\\n' };
const combos = {}; // "CTRL+suffix" -> count
let fieldsWithCtrl = 0;
function scan(v) {
  if (typeof v !== 'string') return;
  let found = false;
  for (let i = 0; i < v.length; i++) {
    const c = v.codePointAt(i);
    if (c === 8 || c === 9 || c === 11 || c === 12 || c === 13 || c === 10) {
      // суффикс = последующие буквы (макс 6)
      const m = v.slice(i + 1).match(/^[a-zA-Z]{1,6}/);
      const suf = m ? m[0] : '∅';
      // для LF/TAB интересны только когда сразу идут буквы (подозрение на команду)
      if ((c === 10 || c === 9) && !m) continue;
      const key = `${NAME[c]}+${suf}`;
      combos[key] = (combos[key] || 0) + 1;
      found = true;
    }
  }
  if (found) fieldsWithCtrl++;
}
for (const d of all) for (const lvl of ['a', 'b', 'c']) for (const t of (Array.isArray(d[lvl]) ? d[lvl] : [])) {
  if (!t || typeof t !== 'object') continue;
  scan(t.text); scan(t.question); scan(t.explanation);
  if (Array.isArray(t.options)) t.options.forEach(scan);
}
console.log('полей с контрол-символами:', fieldsWithCtrl);
console.log('\nкомбинации (контрол+суффикс) по убыванию:');
Object.entries(combos).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
