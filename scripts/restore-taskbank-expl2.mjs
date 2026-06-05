/**
 * restore-taskbank-expl2.mjs — восстанавливает explanation для 2 задач, где seed-разбор
 * ВЕРИФИЦИРОВАННО выводит ответ taskBank (seed.correct-поле было ошибочным, но разбор верен):
 *   complex_equation_solving / complex_eq_ctx_2  (разбор → x=18 = options[1] = taskBank.correct)
 *   sequence_generation / sequence_gen_std_1     (разбор → 64 = options[0] = taskBank.correct)
 * Защита: применяем только если seed.explanation чист (без ?) и якорь вопроса совпал.
 *   node scripts/restore-taskbank-expl2.mjs --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const seed = JSON.parse(readFileSync(resolve(__dirname, '../audit/tasks_grade_5.json'), 'utf8'));
const byId = new Map(seed.map((t) => [t.task_id || t.id, t]));
const TARGETS = [['complex_equation_solving', 'complex_eq_ctx_2'], ['sequence_generation', 'sequence_gen_std_1']];

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'}\n`);
const docs = {};
const apply = [];
for (const [bank, tid] of TARGETS) {
  if (!docs[bank]) docs[bank] = (await db.collection('taskBank').doc(bank).get()).data();
  const tasks = docs[bank].tasks;
  const ti = tasks.findIndex((t) => (t.task_id || t.id) === tid);
  const s = byId.get(tid);
  if (ti < 0 || !s) { console.log(`  ⚠ ${bank}/${tid}: не найдено`); continue; }
  if (/\?{2,}/.test(s.explanation || '')) { console.log(`  ⚠ ${tid}: seed.explanation с ?`); continue; }
  apply.push({ bank, ti, tid, before: tasks[ti].explanation, after: s.explanation });
  console.log(`[${bank}/${tid}]\n  было:  ${String(tasks[ti].explanation).slice(0, 60)}\n  стало: ${String(s.explanation).slice(0, 80)}`);
}
if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-taskbank-expl2`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'taskBank.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-taskbank-expl2/`);
for (const bank of Object.keys(docs)) {
  const list = apply.filter((a) => a.bank === bank);
  if (!list.length) continue;
  for (const a of list) docs[bank].tasks[a.ti].explanation = a.after;
  await db.collection('taskBank').doc(bank).update({ tasks: docs[bank].tasks });
}
console.log(`\n✅ Восстановлено explanation: ${apply.length}\n`);
