/**
 * apply-group3.mjs — применяет принятые правки Группы 3 (замена утёкших вопросов на
 * вопросы правильной темы/класса) из audit/_group3_wf_result.json к live dailyTasks.
 *
 *   node scripts/apply-group3.mjs            # DRY-RUN
 *   node scripts/apply-group3.mjs --apply    # backup + запись
 *
 * Защита перед КАЖДОЙ заменой:
 *   • вопрос в Firestore (bank[skill_id].questions[qi]) СЕЙЧАС совпадает с before (text+options);
 *   • after валиден: ровно 4 уникальные опции, correct 0..3, непустой explanation, solvedIndex==correct.
 * Заменяются только поля text, options, correct, explanation (difficulty/прочее сохраняются).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const accepted = JSON.parse(readFileSync(resolve(__dirname, '../audit/_group3_wf_result.json'), 'utf8')).accepted;
const norm = (s) => String(s || '').replace(/\s+/g, '');

function validAfter(a, v) {
  if (!Array.isArray(a.options) || a.options.length !== 4) return 'не 4 опции';
  if (new Set(a.options.map(String)).size !== 4) return 'опции не уникальны';
  if (!(a.correct >= 0 && a.correct <= 3)) return 'correct вне 0..3';
  if (v.solvedIndex !== a.correct) return 'solvedIndex≠correct';
  if (!a.explanation || !a.explanation.trim()) return 'пустой explanation';
  return null;
}

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю dailyTasks…\n`);
const snap = await db.collection('dailyTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const ok = [], skip = [];
for (const e of accepted) {
  const data = docs[e.skill_id];
  if (!data) { skip.push({ e, why: 'нет банка' }); continue; }
  const arrKey = data.questions ? 'questions' : 'tasks';
  const q = (data[arrKey] || [])[e.qi];
  if (!q) { skip.push({ e, why: 'нет вопроса' }); continue; }
  const curText = q.text || q.question || '';
  if (norm(curText) !== norm(e.before.text)) { skip.push({ e, why: 'live.text ≠ before (изменилось)' }); continue; }
  if (JSON.stringify(q.options || []) !== JSON.stringify(e.before.options)) { skip.push({ e, why: 'live.options ≠ before' }); continue; }
  const bad = validAfter(e.after, e.verdict);
  if (bad) { skip.push({ e, why: bad }); continue; }
  ok.push(e);
}

console.log(`📊 к записи: ${ok.length} · пропуск: ${skip.length}\n`);
console.log('— примеры (банк qi: было → стало) —');
for (const e of ok.slice(0, 8)) {
  console.log(`\n  [${e.skill_id} qi${e.qi}] ${e.grade}`);
  console.log(`    было:  ${e.before.text.replace(/\n/g, ' ').slice(0, 80)}`);
  console.log(`    стало: ${e.after.text.replace(/\n/g, ' ').slice(0, 80)} | ✔ ${e.after.options[e.after.correct]}`);
}
if (skip.length) { console.log('\n— пропущено —'); skip.forEach((s) => console.log(`  [${s.e.skill_id} qi${s.e.qi}] ${s.why}`)); }

if (!APPLY) { console.log('\n🔵 DRY-RUN: ничего не записано. Запусти с --apply.\n'); process.exit(0); }

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(__dirname, `../migration/backups/${ts}-group3-rewrite`);
mkdirSync(backupDir, { recursive: true });
writeFileSync(join(backupDir, 'dailyTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-group3-rewrite/dailyTasks.json`);

const byDoc = {};
for (const e of ok) (byDoc[e.skill_id] ||= []).push(e);
let written = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  const arrKey = data.questions ? 'questions' : 'tasks';
  const arr = data[arrKey];
  for (const e of list) {
    const q = arr[e.qi];
    const useQuestion = q.question !== undefined && q.text === undefined;
    if (useQuestion) q.question = e.after.text; else q.text = e.after.text;
    q.options = e.after.options;
    q.correct = e.after.correct;
    q.explanation = e.after.explanation;
    if (e.after.difficulty) q.difficulty = e.after.difficulty;
  }
  await db.collection('dailyTasks').doc(id).update({ [arrKey]: arr });
  written++;
}
console.log(`\n✅ Обновлено банков: ${written} (вопросов заменено: ${ok.length}, пропущено: ${skip.length}).\n`);
