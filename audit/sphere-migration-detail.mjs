import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('scripts/service-account.json', 'utf8'))) });
const db = getFirestore();
const J = (o, n = 160) => JSON.stringify(o).slice(0, n);

// A) kQhj2 (где sphere, 6кл «Отношения и пропорции») — кластеры, как убрать sphere
const k6 = (await db.collection('skillHierarchies').doc('kQhj2mANpntB3G9xfsbI').get()).data();
console.log('=== ИСТОЧНИК skillHierarchies/kQhj2 (section:', J(k6.section, 40), ') ===');
(k6.clusters || []).forEach((c, i) => {
  const skills = (c.skills || []).map((s) => s.skill_id || s.id || s);
  const has = JSON.stringify(c).includes('sphere_and_ball');
  console.log(`  cluster[${i}]${has ? ' ★SPHERE' : ''}: ${J({ name: c.name || c.cluster_name, skills }, 140)}`);
});

// B) ЦЕЛЬ dqZBuSkMll3 «Фигуры в пространстве» — структура + есть ли уже сфера
const tgt = (await db.collection('skillHierarchies').doc('dqZBuSkMll3I1nyR1MKY').get()).data();
console.log('\n=== ЦЕЛЬ skillHierarchies/dqZBuSkMll3 (section:', J(tgt.section, 40), ', sectionId:', tgt.sectionId, ') ===');
console.log('  поля:', Object.keys(tgt).join(','));
(tgt.clusters || []).forEach((c, i) => {
  const skills = (c.skills || []).map((s) => s.skill_id || s.id || s);
  console.log(`  cluster[${i}]: ${J({ name: c.name || c.cluster_name, skills }, 160)}`);
});

// C) dailyTasks 11-класс гео-секции (что ставить в section)
const dt = await db.collection('dailyTasks').get();
const sec11 = new Set();
dt.forEach((d) => { if (d.data().grade === '11 класс') sec11.add(d.data().section); });
console.log('\n=== dailyTasks ВСЕ section 11 класса ===\n  ', [...sec11].join('\n   '));

// D) crossGradeLinks: где 11-класс гео-модуль (в полной цепочке)
const full = (await db.collection('crossGradeLinks').doc('5_класс__6_класс__7_класс__8_класс__9_класс__10_класс__11_класс').get()).data();
console.log('\n=== crossGradeLinks полная цепочка: grade_modules ключи ===');
console.log('  grade_modules:', Object.keys(full.grade_modules || {}).join(','));
// найти модуль с фигурами в пространстве / сферой
for (const [k, v] of Object.entries(full.grade_modules || {})) {
  if (/фигур.*простран|стереометр|шар|сфер|пространств/i.test(JSON.stringify(v))) console.log(`   модуль ${k}: ${J(v, 180)}`);
}
const cgl6 = (await db.collection('crossGradeLinks').doc('5_класс__6_класс').get()).data();
console.log('\n=== crossGradeLinks 5_6: где sphere ===');
for (const [k, v] of Object.entries(cgl6.grade_modules || {})) if (JSON.stringify(v).includes('sphere_and_ball')) console.log(`   модуль ${k}: ${J(v, 200)}`);

// E) globalSkillMap sphere + образец 11-кл гео-навыка
const gsm = (await db.collection('globalSkillMap').doc('master').get()).data();
console.log('\n=== globalSkillMap/master sphere_and_ball ===\n  ', J(gsm.skills?.sphere_and_ball, 260));
process.exit(0);
