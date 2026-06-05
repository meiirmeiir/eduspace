import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const TARGETS = [
  ['mixed_improper_logic', 'mixed_improper_context_2', ['explanation']],
  ['sequence_generation', 'sequence_gen_comp_3', ['explanation']],
  ['sequence_generation', 'sequence_gen_cont_2', ['question_text', 'explanation', 'skills_tested']],
];
const hasQ = (s) => /\?{2,}/.test(String(s || ''));
const cases = [];
const docCache = {};
for (const [bank, tid, fixFields] of TARGETS) {
  if (!docCache[bank]) docCache[bank] = (await db.collection('taskBank').doc(bank).get()).data();
  const tasks = docCache[bank].tasks;
  const ti = tasks.findIndex((t) => (t.task_id || t.id) === tid);
  const t = tasks[ti];
  cases.push({
    idx: cases.length, bank, ti, tid, fixFields,
    intact: {
      question_text: hasQ(t.question_text) ? null : t.question_text,  // null = тоже чинить
      options: t.options,
      correct_index: t.correct_index ?? t.correct,
      answer: t.options[t.correct_index ?? t.correct],
      skills_tested_clean: (t.skills_tested || []).filter((s) => !hasQ(s)),
    },
    corrupt: {
      question_text: hasQ(t.question_text) ? t.question_text : undefined,
      explanation: t.explanation,
      skills_tested: t.skills_tested,
    },
  });
}
mkdirSync('audit/_tbregen', { recursive: true });
cases.forEach((c) => writeFileSync(`audit/_tbregen/case_${c.idx}.json`, JSON.stringify(c, null, 1)));
writeFileSync('audit/_tbregen_cases.json', JSON.stringify(cases, null, 1));
for (const c of cases) {
  console.log(`\n[case ${c.idx}] ${c.bank}/${c.tid} · чинить: ${c.fixFields.join(',')}`);
  console.log('  question_text(цел?):', c.intact.question_text ? JSON.stringify(c.intact.question_text.slice(0, 70)) : '⚠ ИСПОРЧЕН → ' + JSON.stringify(String(c.corrupt.question_text).slice(0, 50)));
  console.log('  options:', JSON.stringify(c.intact.options), '| ответ:', JSON.stringify(c.intact.answer), '(index', c.intact.correct_index + ')');
  console.log('  explanation(исп.):', JSON.stringify(String(c.corrupt.explanation).slice(0, 55)));
}
process.exit(0);
