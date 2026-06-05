/**
 * apply-taskbank-regen.mjs — применяет LLM-регенерацию 3 остаточных задач taskBank.
 * Источник: audit/_tbregen_result.json (accepted) + audit/_tbregen_cases.json (intact correct_index).
 * Защита перед записью КАЖДОЙ:
 *   • в регенерированных полях НЕТ `?{2,}` (кириллица восстановлена);
 *   • options[correct_index] == intact.answer (ответ НЕ изменился);
 *   • числа в options сохранены (множество чисел совпадает с intact.options);
 *   • верный ответ остаётся на том же correct_index (не трогаем).
 *   node scripts/apply-taskbank-regen.mjs            # DRY-RUN
 *   node scripts/apply-taskbank-regen.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const accepted = JSON.parse(readFileSync(resolve(__dirname, '../audit/_tbregen_result.json'), 'utf8')).accepted;
const cases = JSON.parse(readFileSync(resolve(__dirname, '../audit/_tbregen_cases.json'), 'utf8'));
const caseByIdx = new Map(cases.map((c) => [c.idx, c]));
const nums = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).sort().join(',');
const hasQ = (s) => /\?{2,}/.test(String(s || ''));

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'}\n`);
const docs = {};
const ok = [], skip = [];
for (const a of accepted) {
  const c = caseByIdx.get(a.idx);
  if (!c) { skip.push({ a, why: 'нет кейса' }); continue; }
  const ci = c.intact.correct_index;
  const af = a.after;
  // 1) нет ?
  if ([af.question_text, af.explanation, ...(af.options || []), ...(af.skills_tested || [])].some(hasQ)) { skip.push({ a, why: 'остался ?' }); continue; }
  // 2) ответ не изменился: options[ci] числа == intact.answer числа
  if (!af.options || af.options.length !== 4) { skip.push({ a, why: 'не 4 опции' }); continue; }
  if (nums(af.options[ci]) !== nums(c.intact.answer)) { skip.push({ a, why: `ответ изменился: было ${c.intact.answer} стало ${af.options[ci]}` }); continue; }
  // 3) множество чисел опций сохранено
  if (nums(af.options.join(' ')) !== nums((c.intact.options || []).join(' '))) { skip.push({ a, why: 'числа опций изменились' }); continue; }
  // 4) validator solvedIndex == ci
  if (a.verdict.solvedIndex !== ci) { skip.push({ a, why: `solvedIndex(${a.verdict.solvedIndex})≠correct(${ci})` }); continue; }
  ok.push({ bank: a.bank, tid: a.tid, ti: c.ti, after: af });
}
console.log(`📊 к записи: ${ok.length} · пропуск: ${skip.length}\n`);
for (const e of ok) {
  console.log(`\n[${e.bank}/${e.tid}]`);
  console.log(`  question_text: ${e.after.question_text.slice(0, 80)}`);
  console.log(`  options: ${JSON.stringify(e.after.options)}`);
  console.log(`  explanation: ${e.after.explanation.slice(0, 70)}`);
}
skip.forEach((s) => console.log(`  ПРОПУСК [${s.a.tid}] ${s.why}`));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-taskbank-regen`);
mkdirSync(bk, { recursive: true });
// читаем актуальные доки и пишем
const byBank = {};
for (const e of ok) (byBank[e.bank] ||= []).push(e);
for (const bank of Object.keys(byBank)) docs[bank] = (await db.collection('taskBank').doc(bank).get()).data();
writeFileSync(join(bk, 'taskBank.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-taskbank-regen/`);
for (const [bank, list] of Object.entries(byBank)) {
  const tasks = docs[bank].tasks;
  for (const e of list) {
    const t = tasks[e.ti];
    t.question_text = e.after.question_text; t.explanation = e.after.explanation;
    t.options = e.after.options; t.skills_tested = e.after.skills_tested;
  }
  await db.collection('taskBank').doc(bank).update({ tasks });
}
console.log(`\n✅ Применено: ${ok.length} задач.\n`);
