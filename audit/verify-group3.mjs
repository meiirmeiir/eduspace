import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const acc = JSON.parse(readFileSync('audit/_group3_wf_result.json', 'utf8')).accepted;
const norm = (s) => String(s || '').replace(/\s+/g, '');
const sample = ['axis_intersections', 'joint_work_solving', 'power_calc', 'trig_function_analysis', 'sqrt_graphing', 'system_foundations'];
let okN = 0, total = 0;
for (const id of sample) {
  const d = await db.collection('dailyTasks').doc(id).get();
  const data = d.data();
  const arr = data.questions || data.tasks;
  for (const e of acc.filter((x) => x.skill_id === id)) {
    total++;
    const q = arr[e.qi];
    const landed = norm(q.text || q.question) === norm(e.after.text) && q.correct === e.after.correct;
    if (landed) okN++; else console.log(`✗ ${id} qi${e.qi} НЕ совпало`);
  }
  const f = acc.find((x) => x.skill_id === id);
  console.log(`[${id}] заменённых проверено; пример qi${f.qi}: ${(arr[f.qi].text || arr[f.qi].question).slice(0, 75)}`);
}
console.log(`\nитог: совпало ${okN}/${total} проверенных`);
process.exit(0);
