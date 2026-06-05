import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const SKILLS = ['linear_params_analysis', 'sphere_and_ball', 'asymptote_analysis'];
const COLS = ['dailyTasks', 'skillTasks', 'taskBank'];
for (const skill of SKILLS) {
  console.log(`\n${'='.repeat(60)}\n${skill}\n${'='.repeat(60)}`);
  for (const col of COLS) {
    const d = await db.collection(col).doc(skill).get();
    if (!d.exists) { console.log(`  ${col}: НЕТ`); continue; }
    const data = d.data();
    const counts = {};
    let arr0 = null, arrName = '';
    for (const k of ['questions', 'tasks', 'a', 'b', 'c']) if (Array.isArray(data[k])) { counts[k] = data[k].length; if (!arr0) { arr0 = data[k][0]; arrName = k; } }
    console.log(`  ${col}: поля=${Object.keys(data).join(',')} · массивы=${JSON.stringify(counts)} · grade=${data.grade ?? data.gradeLevel ?? '—'} · skill_name=${data.skill_name ?? data.skillName ?? '—'}`);
    if (arr0) console.log(`     ${arrName}[0]: ${JSON.stringify({ text: (arr0.text || arr0.question || arr0.question_text || '').slice(0, 60), options: arr0.options, correct: arr0.correct ?? arr0.correct_index }).slice(0, 130)}`);
  }
}

// asymptote_analysis qi4 во всех коллекциях
console.log(`\n${'='.repeat(60)}\nasymptote_analysis — задача index 4 (a/b/c и questions)\n${'='.repeat(60)}`);
for (const col of COLS) {
  const d = await db.collection(col).doc('asymptote_analysis').get();
  if (!d.exists) continue;
  const data = d.data();
  for (const lvl of ['questions', 'tasks', 'a', 'b', 'c']) {
    if (!Array.isArray(data[lvl])) continue;
    const t = data[lvl][4];
    if (t) console.log(`  ${col}.${lvl}[4]: ${JSON.stringify({ text: (t.text || t.question || t.question_text || '').slice(0, 90), options: t.options, correct: t.correct ?? t.correct_index })}`);
  }
}
process.exit(0);
