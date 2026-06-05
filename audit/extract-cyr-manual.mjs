/**
 * extract-cyr-manual.mjs — собирает «ручные» случаи (кириллица в KaTeX, не авто-фиксимая):
 * кир. индексы $S_{кольца}$, \text{кир}, смешанные выражения. С ПОЛНЫМ текстом поля.
 * READ-ONLY. Выход: audit/_cyr_manual_cases.json
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CYR = /[а-яёА-ЯЁ]/;
const SUP = { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 1, '9': 1 };
const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;

// повтор логики fixSpan: true = авто-фиксимо (НЕ ручное)
function autoFixable(span) {
  const dbl = span.startsWith('$$');
  const body = (dbl ? span.slice(2, -2) : span.slice(1, -1)).trim();
  if (/^[а-яёА-ЯЁ]+(\s*[*·]\s*[а-яёА-ЯЁ]+)*$/.test(body)) return true;
  if (/^([а-яёА-ЯЁ]+)\s*\^\s*\{?\s*(\d+)\s*\}?$/.test(body)) return true;
  const m = body.match(/^([А-ЯЁа-яё]+)\s*([([].*)$/);
  if (m && !CYR.test(m[2])) return true;
  return false;
}
function manualSpans(text) {
  if (!text || !CYR.test(text)) return [];
  const spans = String(text).match(MATHSPAN) || [];
  return spans.filter((s) => CYR.test(s) && !autoFixable(s));
}

const sa = JSON.parse(readFileSync(resolve(__dirname, '../scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('dailyTasks').get();
const FIELDS = ['text', 'question', 'q', 'prompt', 'explanation'];
const cases = [];
snap.forEach((d) => {
  const data = d.data();
  const qs = data.questions || data.tasks;
  if (!Array.isArray(qs)) return;
  qs.forEach((q, qi) => {
    const probe = (field, val) => {
      const ms = manualSpans(val);
      if (ms.length) cases.push({ id: d.id, grade: data.grade, qi, field, fullText: String(val), spans: ms });
    };
    for (const f of FIELDS) if (q[f]) probe(f, q[f]);
    if (Array.isArray(q.options)) q.options.forEach((opt, oi) => { if (opt) probe(`options[${oi}]`, opt); });
  });
});

writeFileSync(resolve(__dirname, '_cyr_manual_cases.json'), JSON.stringify(cases, null, 1));
const bytes = JSON.stringify(cases).length;
console.log(`ручных случаев: ${cases.length} · банков: ${new Set(cases.map((c) => c.id)).size} · размер JSON: ${(bytes / 1024).toFixed(1)} KB`);
console.log('поля:', JSON.stringify(cases.reduce((a, c) => { const k = c.field.replace(/\d+/, '#'); a[k] = (a[k] || 0) + 1; return a; }, {})));
console.log('\nпримеры spans:');
for (const c of cases.slice(0, 8)) console.log(`  [${c.id} q${c.qi} ${c.field}] ${c.spans.join('  ')}`);
