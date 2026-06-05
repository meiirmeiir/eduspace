const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const vis = (s) => s.replace(/[\x00-\x1F]/g, (m) => `<${m.charCodeAt(0)}>`);
const PAREN = /\\\(/;
let bs = [], parenNoDollar = 0, both = 0;
for (const d of all) for (const lvl of ['a', 'b', 'c']) for (const t of (Array.isArray(d[lvl]) ? d[lvl] : [])) {
  if (!t || typeof t !== 'object') continue;
  const fields = [t.text, t.question, t.explanation, ...(Array.isArray(t.options) ? t.options : [])];
  for (const v of fields) {
    if (typeof v !== 'string') continue;
    let m; const re = /\x08(.{0,4})/g;
    while ((m = re.exec(v))) { if (!/^[a-zA-Z]/.test(m[1]) && bs.length < 8) bs.push(vis(v.slice(Math.max(0, m.index - 8), m.index + 6))); }
    const hasD = v.includes('$'), hasP = PAREN.test(v);
    if (hasP && hasD) both++;
    else if (hasP) parenNoDollar++;
  }
}
console.log('BS+нелитера примеры:', JSON.stringify(bs));
console.log('полей с \\( и БЕЗ $:', parenNoDollar);
console.log('полей с \\( И с $ (смешанные):', both);
