/**
 * create-sphere-basics-bank.mjs — создаёт документ dailyTasks/sphere_basics (6 класс)
 * с задачами из audit/_spherebasics_result.json (прошли двойную защиту, без формул V/S).
 *   node scripts/create-sphere-basics-bank.mjs            # DRY-RUN
 *   node scripts/create-sphere-basics-bank.mjs --apply    # backup(если был) + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const acc = JSON.parse(readFileSync(resolve(__dirname, '../audit/_spherebasics_result.json'), 'utf8')).accepted;
const FORMULA = /\\frac\{4\}\{3\}|4\\pi r\^?2|\\pi r\^3|=\s*4\s*\\?pi|объ[её]м.*=|площад.*поверхн.*=/i;

const questions = acc.map((a) => ({ question: a.question, options: a.options, correct: a.correct, explanation: a.explanation, difficulty: a.difficulty, skill_id: 'sphere_basics' }));
// защита: 4 уник. опции, correct ок, solvedIndex==correct, нет формул V/S
const bad = [];
acc.forEach((a, i) => {
  if (a.options.length !== 4 || new Set(a.options.map(String)).size !== 4) bad.push(`#${i}: не 4 уник`);
  if (a.verdict.solvedIndex !== a.correct) bad.push(`#${i}: solvedIndex≠correct`);
  if (FORMULA.test(a.question + a.explanation + a.options.join(' '))) bad.push(`#${i}: формула V/S!`);
});

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const ref = db.collection('dailyTasks').doc('sphere_basics');
const exists = (await ref.get()).exists;
const doc = { skill_id: 'sphere_basics', skill_name: 'Шар и сфера: основные понятия', grade: '6 класс', section: 'Отношения и пропорции', questions, updatedAt: new Date().toISOString() };

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · dailyTasks/sphere_basics`);
console.log(`  документ существует: ${exists} · вопросов: ${questions.length} · проблем: ${bad.length}`);
if (bad.length) { bad.forEach((b) => console.log('   ⚠ ' + b)); process.exit(1); }
console.log('  метаданные:', JSON.stringify({ skill_id: doc.skill_id, skill_name: doc.skill_name, grade: doc.grade, section: doc.section }));
console.log('\n— примеры (до 6) —');
questions.slice(0, 6).forEach((q) => console.log(`  [${q.difficulty}] ${q.question.slice(0, 65)} | ✔ ${q.options[q.correct]}`));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
if (exists) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bk = resolve(__dirname, `../migration/backups/${ts}-spherebasics-bank`); mkdirSync(bk, { recursive: true });
  writeFileSync(join(bk, 'sphere_basics.json'), JSON.stringify((await ref.get()).data(), null, 2), 'utf8');
  console.log(`💾 Backup существующего → ${bk}`);
}
await ref.set(doc);
console.log(`\n✅ Создан dailyTasks/sphere_basics (${questions.length} вопросов).\n`);
