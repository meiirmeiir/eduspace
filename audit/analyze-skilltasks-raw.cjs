// Показывает СЫРОЙ текст полей для каждого класса render-ошибок (для дизайна фиксов).
const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const r = JSON.parse(fs.readFileSync('audit/_skilltasks_render.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));

function rawOf(loc) {
  // loc = bank|a[ti]|field|sN
  const [bank, lvlIdx, field] = loc.split('|');
  const m = lvlIdx.match(/^([abc])\[(\d+)\]$/);
  if (!m) return null;
  const t = byId.get(bank)?.[m[1]]?.[Number(m[2])];
  if (!t) return null;
  if (/^opt(\d+)$/.test(field)) return t.options?.[Number(field.slice(3))];
  return t[field];
}

const classes = {
  'paren_delim \\(': (e) => /Can't use function '\\\('/.test(e.err),
  'overline_noarg': (e) => /macro argument/.test(e.err) && /overline/.test(e.latex),
  'macro_noarg_other': (e) => /macro argument/.test(e.err) && !/overline/.test(e.latex),
  'unexpected_space': (e) => /Unexpected character: ' '/.test(e.err),
  'sqrt_nogroup': (e) => /argument to '\\sqrt'/.test(e.err),
  'left_right': (e) => /\\left|\\right/.test(e.err),
  'undef_cmd': (e) => /Undefined control sequence/.test(e.err),
};
for (const [name, pred] of Object.entries(classes)) {
  const hits = r.katexErrors.filter(pred);
  console.log(`\n══ ${name} (${hits.length}) ══`);
  const seen = new Set();
  for (const e of hits) {
    const raw = rawOf(e.loc);
    if (raw == null) continue;
    const key = raw.slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  [${e.loc}]`);
    console.log(`    RAW: ${JSON.stringify(String(raw).slice(0, 130))}`);
    if (seen.size >= 5) break;
  }
}
