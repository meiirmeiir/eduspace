import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('scripts/service-account.json', 'utf8'))) });
const db = getFirestore();
const J = (o, n = 200) => JSON.stringify(o).slice(0, n);

// 1) crossGradeLinks — все цепочки (doc id = пары классов), какая 11-классовая
console.log('=== crossGradeLinks: все документы ===');
const cgl = await db.collection('crossGradeLinks').get();
cgl.forEach((d) => {
  const data = d.data();
  const mods = data.grade_modules ? Object.keys(data.grade_modules) : (data.chain || []);
  console.log(`  ${d.id} · поля=${Object.keys(data).join(',')} · модулей/звеньев=${Array.isArray(mods) ? mods.length : JSON.stringify(mods).slice(0, 60)}`);
});

// 2) skillHierarchies — секции; найти 11-класс стереометрию/геометрию + структуру 6-кл sphere-дока
console.log('\n=== skillHierarchies: секции (sectionId/section + grade) ===');
const sh = await db.collection('skillHierarchies').get();
sh.forEach((d) => {
  const data = d.data();
  const sec = data.section || data.sectionName || '';
  const grade = data.grade || (String(sec).match(/1[01]|[5-9]\s*класс/) || [''])[0];
  const isGeom = /геометр|стереометр|фигур|шар|сфер|простран|объ[её]м|тел/i.test(JSON.stringify(data));
  const has11 = /11\s*класс/.test(JSON.stringify(data));
  if (isGeom || d.id === 'kQhj2mANpntB3G9xfsbI') {
    console.log(`  ${d.id} · section=${J(sec, 60)} · grade=${grade} · 11кл=${has11} · clusters?=${Array.isArray(data.clusters) ? data.clusters.length : '—'}`);
  }
});

// структура дока, где sphere сейчас (6 кл)
console.log('\n=== skillHierarchies/kQhj2mANpntB3G9xfsbI (где sphere) — структура ===');
const cur6 = (await db.collection('skillHierarchies').doc('kQhj2mANpntB3G9xfsbI').get()).data();
console.log('  поля:', Object.keys(cur6).join(','));
console.log('  section:', J(cur6.section, 80), '| sectionId:', cur6.sectionId);
const cl = cur6.clusters || [];
console.log('  clusters:', Array.isArray(cl) ? cl.length : typeof cl);
if (Array.isArray(cl)) cl.forEach((c, i) => { const ids = (c.skills || c.skill_ids || []).map((s) => s.skill_id || s.id || s); if (JSON.stringify(c).includes('sphere_and_ball')) console.log(`    cluster[${i}] содержит sphere · ${J(c, 120)}`); });

// 3) 11-класс гео-секция: из dailyTasks (банк 11 кл с геометрией) — какое section
console.log('\n=== dailyTasks 11 класс с геометрией (section-имена) ===');
const dt = await db.collection('dailyTasks').get();
const sec11 = new Set();
dt.forEach((d) => { const data = d.data(); if (data.grade === '11 класс' && /геометр|стереометр|фигур|объ[её]м|шар|сфер|тел|простран/i.test(data.section || '')) sec11.add(data.section); });
[...sec11].slice(0, 12).forEach((s) => console.log('  ', s));
// все section 11 класса
const allSec11 = new Set(); dt.forEach((d) => { if (d.data().grade === '11 класс') allSec11.add(d.data().section); });
console.log('  ВСЕ section 11 класса:', [...allSec11].join(' | '));

// 4) globalSkillMap/master — запись sphere + поля
console.log('\n=== globalSkillMap/master: запись sphere_and_ball ===');
const gsm = (await db.collection('globalSkillMap').doc('master').get()).data();
console.log('  sphere entry:', J(gsm.skills?.sphere_and_ball, 220));

// 5) dailyTasks/taskBank sphere текущее
const dts = (await db.collection('dailyTasks').doc('sphere_and_ball').get()).data();
console.log('\n=== dailyTasks/sphere_and_ball: grade/section ===');
console.log('  grade:', dts.grade, '| section:', dts.section, '| поля:', Object.keys(dts).join(','));
process.exit(0);
