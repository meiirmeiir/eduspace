import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('scripts/service-account.json', 'utf8'))) });
const db = getFirestore();

// 1) где sphere_and_ball упоминается (skill_id) — в каких skills-доках и с каким grade
console.log('=== где skill_id "sphere_and_ball" в skills ===');
const sk = await db.collection('skills').get();
sk.forEach((d) => {
  const data = d.data();
  if (JSON.stringify(data).includes('sphere_and_ball')) {
    const arr = data.skills || [];
    const item = Array.isArray(arr) ? arr.find((s) => (s.id || s.skill_id || s.skillId) === 'sphere_and_ball') : null;
    console.log(`  skills/${d.id} · grade=${data.grade} · topic=${data.topicName} · section=${data.sectionName}`);
    if (item) console.log(`     item: ${JSON.stringify(item).slice(0, 120)}`);
  }
});

// 2) grade-11 sphere-навыки: их skill_id и названия
console.log('\n=== grade-11 навыки про шар/сферу (skill_id + name) ===');
const SPHERE = /шар|сфер/i;
sk.forEach((d) => {
  const data = d.data();
  if (data.grade !== '11 класс') return;
  const arr = data.skills || [];
  for (const s of (Array.isArray(arr) ? arr : [])) {
    const nm = s.name || s.skill_name || s.title || '';
    if (SPHERE.test(nm)) console.log(`  ${s.id || s.skill_id || s.skillId} · ${String(nm).slice(0, 60)} · (topic=${data.topicName})`);
  }
});

// 3) есть ли skillTasks/dailyTasks/taskBank для найденных grade-11 sphere skill_id?
console.log('\n=== grade-6 навык шар/сфера (для сравнения) ===');
sk.forEach((d) => {
  const data = d.data();
  if (data.grade !== '6 класс') return;
  const arr = data.skills || [];
  for (const s of (Array.isArray(arr) ? arr : [])) {
    const nm = s.name || s.skill_name || '';
    if (SPHERE.test(nm)) console.log(`  ${s.id || s.skill_id || s.skillId} · ${String(nm).slice(0, 60)}`);
  }
});
process.exit(0);
