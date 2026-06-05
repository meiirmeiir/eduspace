import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const snap = await db.collection('skillTasks').get();
const all = [];
snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
writeFileSync('audit/_skilltasks_all.json', JSON.stringify(all, null, 1));

console.log('документов skillTasks:', all.length);
// какие поля-массивы задач встречаются
const fieldStats = {};
let totalTasks = 0;
const arrFields = new Set();
for (const doc of all) {
  for (const [k, v] of Object.entries(doc)) {
    if (Array.isArray(v)) {
      const looksLikeTasks = v.length && typeof v[0] === 'object' && (v[0].text || v[0].question || v[0].options);
      if (looksLikeTasks) { arrFields.add(k); fieldStats[k] = (fieldStats[k] || 0) + v.length; totalTasks += v.length; }
    }
  }
}
console.log('поля-массивы задач:', JSON.stringify(fieldStats));
console.log('всего задач:', totalTasks);
// пример структуры одной задачи
const ex = all.find((d) => Array.isArray(d.a) && d.a.length);
if (ex) {
  console.log('\nпример документа id=', ex.id, '| ключи:', Object.keys(ex).join(','));
  console.log('a[0] ключи:', Object.keys(ex.a[0]).join(','));
  console.log('a[0]:', JSON.stringify(ex.a[0]).slice(0, 300));
}
// есть ли документы без a/b/c
const noABC = all.filter((d) => !['a', 'b', 'c'].some((k) => Array.isArray(d[k]) && d[k].length));
console.log('\nдокументов без a/b/c с задачами:', noABC.length, noABC.slice(0, 5).map((d) => d.id).join(','));
process.exit(0);
