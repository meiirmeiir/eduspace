/**
 * apply-skilltasks-step6.mjs — применяет принятые Шагом 6 переписанные задачи skillTasks.
 * Источник: audit/_st6_result.json (accepted). Защита перед каждой записью:
 *   • live-задача (bank[level][ti]) совпадает с before (text+options);
 *   • after валиден: 4 уникальные опции, correct 0..3, solvedIndex==correct (из вердикта), есть explanation.
 *   node scripts/apply-skilltasks-step6.mjs            # DRY-RUN
 *   node scripts/apply-skilltasks-step6.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const srcIdx = process.argv.indexOf('--src');
const SRC = srcIdx !== -1 ? process.argv[srcIdx + 1] : '../audit/_st6_result.json';
const accepted = JSON.parse(readFileSync(resolve(__dirname, SRC.startsWith('..') ? SRC : '../' + SRC), 'utf8')).accepted;
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '');

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю skillTasks…\n`);
const snap = await db.collection('skillTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const ok = [], skip = [];
for (const e of accepted) {
  const t = docs[e.bank]?.[e.level]?.[e.ti];
  if (!t) { skip.push({ e, why: 'нет задачи' }); continue; }
  const a = e.after;
  if (!Array.isArray(a.options) || a.options.length !== 4 || new Set(a.options.map(String)).size !== 4) { skip.push({ e, why: 'не 4 уник. опции' }); continue; }
  if (!(a.correct >= 0 && a.correct <= 3)) { skip.push({ e, why: 'correct вне 0..3' }); continue; }
  if (e.verdict.solvedIndex !== a.correct) { skip.push({ e, why: 'solvedIndex≠correct' }); continue; }
  if (!a.explanation || !a.explanation.trim()) { skip.push({ e, why: 'пустой explanation' }); continue; }
  const curText = t.text || t.question || '';
  if (norm(curText) !== norm(e.before.text)) { skip.push({ e, why: 'live.text ≠ before' }); continue; }
  if (JSON.stringify(t.options || []) !== JSON.stringify(e.before.options)) { skip.push({ e, why: 'live.options ≠ before' }); continue; }
  ok.push(e);
}

console.log(`📊 к записи: ${ok.length} · пропуск: ${skip.length}\n`);
for (const e of ok.slice(0, 8)) {
  console.log(`\n  [${e.bank} ${e.level}[${e.ti}]] ${e.note.slice(0, 70)}`);
  console.log(`    было:  ${e.before.options.join(' | ')}  (correct ${e.before.correct})`);
  console.log(`    стало: ${e.after.options.join(' | ')}  (correct ${e.after.correct} = ${e.after.options[e.after.correct]})`);
}
if (skip.length) { console.log('\n— пропущено —'); skip.slice(0, 30).forEach((s) => console.log(`  [${s.e.bank} ${s.e.level}[${s.e.ti}]] ${s.why}`)); }

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-skilltasks-step6`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-skilltasks-step6/skillTasks.json`);
const byDoc = {};
for (const e of ok) (byDoc[e.bank] ||= []).push(e);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const e of list) {
    const t = data[e.level][e.ti];
    if (t.text !== undefined) t.text = e.after.text; else t.question = e.after.text;
    t.options = e.after.options; t.correct = e.after.correct; t.explanation = e.after.explanation;
  }
  const upd = {};
  for (const lvl of ['a', 'b', 'c']) if (list.some((x) => x.level === lvl)) upd[lvl] = data[lvl];
  await db.collection('skillTasks').doc(id).update(upd);
  w++;
}
console.log(`\n✅ Обновлено документов: ${w} (задач: ${ok.length}).\n`);
