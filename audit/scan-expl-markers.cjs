// READ-ONLY: ищет в explanation маркеры саморедактирования/мусорные хвосты (для Шага 5).
const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const MARKERS = [
  /\bНет:/i, /\bОй\b/i, /Исправ(им|лено|ляем)/i, /Пересч[её]т/i, /Ошибка в вариант/i,
  /ближайш/i, /выбер[еи]м/i, /Уточнение:/i, /на самом деле/i, /стоп\b/i, /подожд/i,
  /я ошиб/i, /неверно посчит/i, /перепрове/i, /\(пересчёт/i, /как наиболее близк/i,
  /если бы/i, /должно быть/i, /вариант [А-ГA-D]\b.*вариант [А-ГA-D]\b/i,
];
const rows = [];
const byBank = {};
let withMarker = 0;
for (const d of all) for (const lvl of ['a', 'b', 'c']) {
  if (!Array.isArray(d[lvl])) continue;
  d[lvl].forEach((t, ti) => {
    if (!t || typeof t.explanation !== 'string') return;
    const e = t.explanation;
    const hit = MARKERS.find((m) => m.test(e));
    if (hit) {
      withMarker++; byBank[d.id] = (byBank[d.id] || 0) + 1;
      rows.push({ bank: d.id, level: lvl, ti, marker: String(hit), frag: e.slice(0, 120) });
    }
  });
}
fs.writeFileSync('audit/_st_expl_markers.json', JSON.stringify(rows, null, 1));
console.log(`explanation с маркерами: ${withMarker} · банков: ${Object.keys(byBank).length}`);
console.log('\nтоп банков:');
Object.entries(byBank).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([b, n]) => console.log(`  ${String(n).padStart(3)}  ${b}`));
console.log('\nпримеры:');
rows.slice(0, 15).forEach((r) => console.log(`  [${r.bank} ${r.level}[${r.ti}]] ${r.frag.replace(/\n/g, ' ')}`));
