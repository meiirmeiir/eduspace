import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const snap = await db.collection('questions').get();
const all = [];
snap.forEach((d) => all.push({ id: d.id, ...d.data() }));

const RUN = /\?{2,}/;            // руны ?? и длиннее (как ?????)
const fields = ['text', 'question', 'explanation'];
const opts = (q) => Array.isArray(q.options) ? q.options : [];
let runDocs = [], singleQ = 0;
for (const q of all) {
  const blobs = [...fields.map((f) => q[f]), ...opts(q)].filter((v) => typeof v === 'string');
  let hasRun = false, hasSingle = false;
  for (const v of blobs) { if (RUN.test(v)) hasRun = true; else if (/[а-яё]\?|\?[а-яё]/i.test(v)) hasSingle = true; }
  if (hasRun) runDocs.push(q);
  else if (hasSingle) singleQ++;
}
console.log(`вопросов с РУНОЙ ?? (как ?????): ${runDocs.length}`);
console.log(`вопросов с одиночным ? рядом с кириллицей (норм. конец вопроса): ${singleQ}`);
console.log('\n=== примеры РУН ?? (text/поле + hex вокруг) ===');
for (const q of runDocs.slice(0, 20)) {
  const all3 = [['text', q.text], ['question', q.question], ['explanation', q.explanation], ...opts(q).map((o, i) => ['opt' + i, o])];
  const bad = all3.find(([, v]) => typeof v === 'string' && RUN.test(v));
  const v = String(bad[1]);
  const m = v.match(/.{0,12}\?{2,}.{0,12}/);
  console.log(`\n[${q.id}] topic=${JSON.stringify(q.topic)} поле=${bad[0]} type=${q.type}`);
  console.log(`  фрагмент: ${JSON.stringify(m ? m[0] : v.slice(0, 40))}`);
  console.log(`  hex: ${Buffer.from(m ? m[0] : v.slice(0, 24), 'utf8').toString('hex').replace(/(..)/g, '$1 ').trim()}`);
}
process.exit(0);
