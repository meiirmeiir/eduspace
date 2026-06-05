import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const BANKS = ['complex_equation_solving', 'mixed_improper_logic', 'sequence_generation'];
// нормализация математики $...$ как якоря
const anchors = (s) => {
  const m = String(s || '').match(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g) || [];
  return m.map((x) => x.replace(/\s+/g, '').replace(/\\(dfrac|tfrac)/g, '\\frac').replace(/\\cdot|\\times/g, '*').replace(/[{}]/g, '')).filter(Boolean);
};
const anchorKey = (s) => anchors(s).join('|');

for (const bank of BANKS) {
  console.log(`\n${'='.repeat(60)}\n${bank}\n${'='.repeat(60)}`);
  const tb = await db.collection('taskBank').doc(bank).get();
  if (!tb.exists) { console.log('  taskBank: НЕТ'); continue; }
  const tbd = tb.data();
  const tasks = tbd.tasks || [];
  console.log(`  taskBank.tasks: ${tasks.length} · поля задачи: ${Object.keys(tasks[0] || {}).join(',')}`);
  console.log(`  пример task[0]:`, JSON.stringify({ question_text: tasks[0]?.question_text?.slice(0, 70), options: tasks[0]?.options, answer: tasks[0]?.answer ?? tasks[0]?.correct, id: tasks[0]?.id }));

  // источники: dailyTasks + skillTasks
  for (const col of ['dailyTasks', 'skillTasks']) {
    const d = await db.collection(col).doc(bank).get();
    if (!d.exists) { console.log(`  ${col}: НЕТ документа`); continue; }
    const data = d.data();
    const arrName = col === 'dailyTasks' ? 'questions' : null;
    let qs = [];
    if (col === 'dailyTasks') qs = data.questions || data.tasks || [];
    else qs = [...(data.a || []), ...(data.b || []), ...(data.c || [])];
    console.log(`  ${col}: ${qs.length} вопросов · поля: ${Object.keys(qs[0] || {}).join(',')}`);
    // сопоставление по якорю
    const srcByAnchor = new Map();
    for (const q of qs) { const k = anchorKey(q.text || q.question); if (k) srcByAnchor.set(k, q); }
    let matched = 0;
    for (const t of tasks) { const k = anchorKey(t.question_text); if (k && srcByAnchor.has(k)) matched++; }
    console.log(`     совпадений по математике-якорю: ${matched}/${tasks.length}`);
  }
}
process.exit(0);
