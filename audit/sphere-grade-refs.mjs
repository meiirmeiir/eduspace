import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('scripts/service-account.json', 'utf8'))) });
const db = getFirestore();

// Все коллекции, где может быть привязка skill→grade
const cols = ['sections', 'individualPlans', 'skills', 'skillHierarchies', 'crossGradeLinks', 'globalSkillMap', 'prereqMap', 'skillsDb', 'topics', 'dailyTasks', 'taskBank', 'skillTasks'];
for (const col of cols) {
  let snap;
  try { snap = await db.collection(col).get(); } catch { continue; }
  const hits = [];
  snap.forEach((d) => {
    const blob = JSON.stringify(d.data());
    if (/sphere_and_ball/.test(blob)) {
      const data = d.data();
      const g = data.grade ?? data.gradeLevel ?? '';
      // вытащить контекст вокруг sphere_and_ball
      const m = blob.match(/.{0,40}sphere_and_ball.{0,60}/);
      hits.push({ id: d.id, grade: g, ctx: m ? m[0] : '' });
    }
  });
  if (hits.length) {
    console.log(`\n[${col}] упоминаний sphere_and_ball: ${hits.length}`);
    hits.slice(0, 6).forEach((h) => console.log(`  ${h.id} · doc.grade=${h.grade}\n     …${h.ctx}…`));
  }
}
process.exit(0);
