/**
 * scan-cyr-in-katex.cjs — находит вопросы, где кириллица попадает ВНУТРЬ KaTeX-зоны
 * (между $...$ / $$...$$ или внутри \text{}/\mathrm{} и т.п.). Именно там KaTeX-шрифты
 * (KaTeX_Main/Math, без кириллических глифов) рендерят кириллицу как ?????.
 * READ-ONLY. Источник: backup dailyTasks.json (или путь в argv[2]).
 */
const fs = require('fs');
const path = process.argv[2] || 'migration/backups/2026-06-04T17-08-20-expl-cleanup/dailyTasks.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const CYR = /[а-яёА-ЯЁ]/;
const banks = Array.isArray(data) ? data : Object.entries(data).map(([id, v]) => ({ id, ...v }));

const TEXTCMD = /\\(?:text|mathrm|operatorname|mbox|textbf|textit)\s*\{[^}]*\}/g;
const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;

function cyrInKatex(text) {
  if (!text || !CYR.test(text)) return [];
  let raw = String(text).replace(/\/\/([a-zA-Z]+)/g, '\\$1').trim();
  const hits = [];
  if (raw.includes('$')) {
    const spans = raw.match(MATHSPAN) || [];
    for (const m of spans) if (CYR.test(m)) hits.push({ kind: 'math$', frag: m.slice(0, 80) });
  }
  const txt = raw.match(TEXTCMD) || [];
  for (const m of txt) if (CYR.test(m)) hits.push({ kind: 'textcmd', frag: m.slice(0, 80) });
  return hits;
}

let affBanks = 0, affQ = 0;
const rows = [];
for (const bank of banks) {
  const qs = bank.questions || bank.tasks || [];
  let bankHit = false;
  const list = Array.isArray(qs) ? qs : [];
  list.forEach((q, qi) => {
    const fields = { text: q.text || q.question || q.q || q.prompt, explanation: q.explanation };
    (q.options || []).forEach((o, oi) => { fields['opt' + oi] = o; });
    for (const [fname, fval] of Object.entries(fields)) {
      const h = cyrInKatex(fval);
      if (h.length) {
        affQ++; bankHit = true;
        rows.push({ bank: bank.id || bank.skillId, grade: bank.grade, qi, field: fname, kind: h[0].kind, frag: h[0].frag, full: String(fval).slice(0, 140) });
        break;
      }
    }
  });
  if (bankHit) affBanks++;
}

console.log(`банков с кириллицей-в-KaTeX: ${affBanks}/${banks.length}`);
console.log(`вопросов/полей: ${affQ}\n`);
const byBank = {};
for (const r of rows) byBank[r.bank] = (byBank[r.bank] || 0) + 1;
console.log('--- топ банков ---');
Object.entries(byBank).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([b, n]) => console.log(`  ${n}\t${b}`));
console.log('\n--- примеры (field | kind | фрагмент) ---');
for (const r of rows.slice(0, 30)) console.log(`  [${r.bank} q${r.qi} ${r.field}] ${r.kind}: ${r.frag}`);
fs.writeFileSync('audit/_cyr_in_katex.json', JSON.stringify(rows, null, 1));
console.log(`\nполный список → audit/_cyr_in_katex.json (${rows.length})`);
