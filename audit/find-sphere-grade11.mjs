import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('scripts/service-account.json', 'utf8'))) });
const db = getFirestore();
const SPHERE = /шар|сфер|sphere|ball|стереометр|объём.*шар|поверхност.*сфер/i;

for (const col of ['skillHierarchies', 'crossGradeLinks', 'globalSkillMap', 'skills', 'prereqMap', 'skillsDb']) {
  let snap;
  try { snap = await db.collection(col).get(); } catch (e) { console.log(`[${col}] ошибка: ${e.message}`); continue; }
  if (snap.empty) { console.log(`[${col}] пусто/нет`); continue; }
  const hits = [];
  snap.forEach((d) => {
    const blob = JSON.stringify(d.data());
    if (SPHERE.test(blob)) {
      const data = d.data();
      const g = data.grade ?? data.gradeLevel ?? data.class ?? '';
      hits.push({ id: d.id, grade: g, keys: Object.keys(data).slice(0, 8).join(',') });
    }
  });
  console.log(`\n[${col}] докум: ${snap.size} · со «шар/сфера»: ${hits.length}`);
  hits.slice(0, 12).forEach((h) => console.log(`   ${h.id} · grade=${h.grade} · ${h.keys}`));
}
// в skills — ищем sphere-навыки с указанием класса
console.log('\n=== skills с шар/сфера (детально) ===');
const sk = await db.collection('skills').get();
sk.forEach((d) => {
  const data = d.data();
  const name = data.name || data.skill_name || data.title || '';
  if (SPHERE.test(name) || SPHERE.test(d.id)) {
    console.log(`  ${d.id} · grade=${data.grade ?? data.gradeLevel ?? '—'} · name=${String(name).slice(0, 50)}`);
  }
});
process.exit(0);
