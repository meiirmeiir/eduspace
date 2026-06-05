/**
 * extract-group3.mjs — извлекает «утёкшие» вопросы Группы 3 (частичные утечки) из live dailyTasks.
 * Группа 3 = все банки несоответствий, КРОМЕ linear_params_analysis (полностью чужой)
 * и sphere_and_ball (мис-класс по классу). n из _dt_mismatch.json — 1-based (вопрос = array[n-1]).
 * Выход: audit/_group3_cases.json  (idx, skill_id, skill_name, grade, qi, qtopic, mismatch, current{...}).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EXCLUDE = new Set(['linear_params_analysis', 'sphere_and_ball']);
const mism = JSON.parse(readFileSync('audit/_dt_mismatch.json', 'utf8')).filter((m) => !EXCLUDE.has(m.skill_id));

// сгруппировать по банку, читать каждый банк один раз
const byBank = {};
for (const m of mism) (byBank[m.skill_id] ||= []).push(m);

const cases = [];
let idx = 0;
const diffs = {};
for (const [id, rows] of Object.entries(byBank)) {
  const d = await db.collection('dailyTasks').doc(id).get();
  if (!d.exists) { console.log(`⚠ нет банка ${id}`); continue; }
  const data = d.data();
  const arr = data.questions || data.tasks || [];
  for (const m of rows) {
    const q = arr[m.n - 1];
    if (!q) { console.log(`⚠ ${id} n=${m.n}: нет вопроса`); continue; }
    diffs[q.difficulty || '(нет)'] = (diffs[q.difficulty || '(нет)'] || 0) + 1;
    cases.push({
      idx: idx++,
      skill_id: id,
      skill_name: m.skill_name || data.skillName || '',
      grade: m.grade,
      qi: m.n - 1,
      n: m.n,
      qtopic: m.qtopic,
      mismatch: m.mismatch,
      current: {
        text: q.text || q.question || '',
        options: q.options || [],
        correct: q.correct,
        explanation: q.explanation || '',
        difficulty: q.difficulty || null,
        type: q.type || 'mcq',
      },
    });
  }
}

writeFileSync('audit/_group3_cases.json', JSON.stringify(cases, null, 1));
console.log(`Группа 3: ${cases.length} вопросов · банков: ${Object.keys(byBank).length}`);
console.log('difficulty:', JSON.stringify(diffs));
const byB = {};
for (const c of cases) byB[c.skill_id] = (byB[c.skill_id] || 0) + 1;
console.log('по банкам:', JSON.stringify(byB, null, 0));
console.log(`размер JSON: ${(JSON.stringify(cases).length / 1024).toFixed(1)} KB`);
process.exit(0);
