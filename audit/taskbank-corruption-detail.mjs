import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const RUN = /\?{2,}/;
const snap = await db.collection('taskBank').get();
const corrupt = [];
snap.forEach((d) => {
  const blob = JSON.stringify(d.data());
  const runs = (blob.match(/\?{2,}/g) || []).length;
  if (runs) corrupt.push({ id: d.id, runs, data: d.data() });
});
console.log(`taskBank: ${snap.size} докум · с порчей: ${corrupt.length}\n`);
for (const c of corrupt) {
  console.log(`\n══ ${c.id} · ?-рун: ${c.runs} ══`);
  // структура: где задачи?
  const keys = Object.keys(c.data);
  console.log('  поля:', keys.join(','));
  // первые испорченные строки
  const samples = [];
  const walk = (o, path) => {
    if (typeof o === 'string') { if (RUN.test(o) && samples.length < 4) samples.push(`${path}: ${o.slice(0, 60)}`); }
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  walk(c.data, '');
  samples.forEach((s) => console.log('   ', s));
  // сколько вопросов вообще и сколько с ?
  const qs = c.data.questions || c.data.tasks || c.data.a || [];
}
process.exit(0);
