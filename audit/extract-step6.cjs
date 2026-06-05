// Извлекает ещё-сломанные задачи (после ключ-фикса) для Шага 6 (rewrite).
const fs = require('fs');
const findings = JSON.parse(fs.readFileSync('audit/_st_findings_all.json', 'utf8')).findings;
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));
const norm = (s) => String(s == null ? '' : s).replace(/\$/g, '').replace(/\\(dfrac|frac|tfrac)/g, 'frac').replace(/[\s{}]/g, '').replace(/\\/g, '').toLowerCase();

const cases = [];
let alreadyFixed = 0;
for (const f of findings) {
  const t = byId.get(f.bank)?.[f.level]?.[f.ti];
  if (!t) continue;
  // если текущий correct уже совпадает с решённым — задача починена ключ-фиксом, пропуск
  if (norm(t.options?.[t.correct]) && norm(t.options[t.correct]) === norm(f.solved)) { alreadyFixed++; continue; }
  cases.push({
    idx: cases.length, bank: f.bank, level: f.level, ti: f.ti, id: t.id,
    kind: f.kind, agentSolved: f.solved, agentNote: f.note,
    current: { text: t.text || t.question || '', options: t.options || [], correct: t.correct, explanation: t.explanation || '' },
  });
}
fs.mkdirSync('audit/_st6_chunks', { recursive: true });
const SIZE = 5; let n = 0;
for (let i = 0; i < cases.length; i += SIZE) { fs.writeFileSync(`audit/_st6_chunks/chunk_${n}.json`, JSON.stringify(cases.slice(i, i + SIZE), null, 1)); n++; }
fs.writeFileSync('audit/_st6_cases.json', JSON.stringify(cases, null, 1));
console.log(`Шаг 6 задач: ${cases.length} · уже починено ключ-фиксом: ${alreadyFixed} · чанков: ${n}`);
const byKind = {}; for (const c of cases) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
console.log('по виду:', JSON.stringify(byKind));
console.log('размер cases JSON:', (JSON.stringify(cases).length / 1024).toFixed(1), 'KB');
