// ЗАДАЧА 1: извлекает render-проблемные поля (KaTeX-ошибки + literal-LaTeX) с контекстом задачи.
const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));
const r = JSON.parse(fs.readFileSync('audit/_skilltasks_render.json', 'utf8'));

function fieldVal(bank, lvlIdx, field) {
  const m = lvlIdx.match(/^([abc])\[(\d+)\]$/);
  if (!m) return null;
  const t = byId.get(bank)?.[m[1]]?.[Number(m[2])];
  if (!t) return null;
  const om = field.match(/^opt(\d+)$/);
  const val = om ? t.options?.[Number(om[1])] : t[field];
  return { t, lvl: m[1], ti: Number(m[2]), val };
}

const cases = []; const seen = new Set();
const add = (loc, kind, err) => {
  const [bank, lvlIdx, field] = loc.split('|');
  const key = `${bank}|${lvlIdx}|${field}`;
  if (seen.has(key)) return; seen.add(key);
  const fv = fieldVal(bank, lvlIdx, field);
  if (!fv) return;
  cases.push({ idx: cases.length, bank, level: fv.lvl, ti: fv.ti, field, kind, err: err || '',
    value: String(fv.val), task: { text: fv.t.text, options: fv.t.options, correct: fv.t.correct } });
};
for (const e of r.katexErrors) add(e.loc, 'katex_error', e.err);
for (const e of r.literalLatex) add(e.loc, 'literal_latex', '');

fs.mkdirSync('audit/_render_chunks', { recursive: true });
const SIZE = 5; let n = 0;
for (let i = 0; i < cases.length; i += SIZE) { fs.writeFileSync(`audit/_render_chunks/chunk_${n}.json`, JSON.stringify(cases.slice(i, i + SIZE), null, 1)); n++; }
fs.writeFileSync('audit/_render_cases.json', JSON.stringify(cases, null, 1));
console.log(`render-кейсов: ${cases.length} (katex_error+literal) · чанков: ${n}`);
const byKind = {}; for (const c of cases) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
console.log('по виду:', JSON.stringify(byKind));
cases.slice(0, 6).forEach((c) => console.log(`  [${c.bank} ${c.level}[${c.ti}] ${c.field}] ${c.kind}: ${c.value.slice(0, 60)}`));
