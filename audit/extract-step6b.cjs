// Извлекает 106 конфликтов answer (из Шага 5) для повторного rewrite-прохода.
const fs = require('fs');
const contra = JSON.parse(fs.readFileSync('audit/_st5_contradictions.json', 'utf8'));
const st5 = JSON.parse(fs.readFileSync('audit/_st5_result.json', 'utf8')).items;
const cleanedBy = new Map(st5.map((i) => [`${i.bank}|${i.level}|${i.ti}`, i.after]));
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));

const cases = [];
for (const c of contra) {
  const t = byId.get(c.bank)?.[c.level]?.[c.ti];
  if (!t) continue;
  const key = `${c.bank}|${c.level}|${c.ti}`;
  cases.push({
    idx: cases.length, bank: c.bank, level: c.level, ti: c.ti, id: t.id,
    cleanedDerivation: cleanedBy.get(key) || '',   // истинная математика (разбор без хвостов)
    agentNote: c.note,
    current: { text: t.text || t.question || '', options: t.options || [], correct: t.correct, explanation: t.explanation || '' },
  });
}
fs.mkdirSync('audit/_st6b_chunks', { recursive: true });
const SIZE = 5; let n = 0;
for (let i = 0; i < cases.length; i += SIZE) { fs.writeFileSync(`audit/_st6b_chunks/chunk_${n}.json`, JSON.stringify(cases.slice(i, i + SIZE), null, 1)); n++; }
fs.writeFileSync('audit/_st6b_cases.json', JSON.stringify(cases, null, 1));
console.log(`конфликтов: ${cases.length} · чанков: ${n} · KB: ${(JSON.stringify(cases).length / 1024).toFixed(0)}`);
