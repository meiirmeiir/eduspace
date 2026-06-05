// Извлекает explanation с маркерами саморедактирования (полный текст) для Шага 5.
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('audit/_st_expl_markers.json', 'utf8'));
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));
const cases = [];
for (const r of rows) {
  const t = byId.get(r.bank)?.[r.level]?.[r.ti];
  if (!t || typeof t.explanation !== 'string') continue;
  cases.push({
    idx: cases.length, bank: r.bank, level: r.level, ti: r.ti, id: t.id,
    answer: (t.options || [])[t.correct] ?? '',
    text: (t.text || t.question || '').slice(0, 200),
    explanation: t.explanation,
  });
}
fs.mkdirSync('audit/_st5_chunks', { recursive: true });
const SIZE = 6; let n = 0;
for (let i = 0; i < cases.length; i += SIZE) { fs.writeFileSync(`audit/_st5_chunks/chunk_${n}.json`, JSON.stringify(cases.slice(i, i + SIZE), null, 1)); n++; }
fs.writeFileSync('audit/_st5_cases.json', JSON.stringify(cases, null, 1));
console.log(`Шаг 5 explanation: ${cases.length} · чанков: ${n} · KB: ${(JSON.stringify(cases).length / 1024).toFixed(0)}`);
