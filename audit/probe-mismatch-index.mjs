import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const mism = JSON.parse(readFileSync('audit/_dt_mismatch.json', 'utf8'));
const sample = [
  ['asymptote_analysis', 5, 'arctan'],
  ['axis_intersections', 6, 'x^2-9'],
  ['graph_reading_skills', 3, 'x²-4x+4'],
  ['equation_root_verification', 21, '2^x'],
  ['joint_work_solving', 17, 'Улитка'],
];
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
for (const [id, n, marker] of sample) {
  const d = await db.collection('dailyTasks').doc(id).get();
  if (!d.exists) { console.log(`${id}: НЕТ банка`); continue; }
  const data = d.data();
  const arr = data.questions || data.tasks || [];
  const get = (i) => (arr[i] ? (arr[i].text || arr[i].question || '') : '(нет)');
  const at_n = get(n), at_n1 = get(n - 1);
  const hit_n = norm(at_n).includes(norm(marker));
  const hit_n1 = norm(at_n1).includes(norm(marker));
  console.log(`\n[${id} n=${n}] маркер="${marker}" | всего вопросов=${arr.length}`);
  console.log(`  array[${n}]   ${hit_n ? '✅' : '  '} ${at_n.slice(0, 70)}`);
  console.log(`  array[${n - 1}] ${hit_n1 ? '✅' : '  '} ${at_n1.slice(0, 70)}`);
}
process.exit(0);
