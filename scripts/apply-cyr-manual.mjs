/**
 * apply-cyr-manual.mjs — применяет 65 типографских правок (кириллица в KaTeX → \text{})
 * из audit/_cyr_manual_wf_result.json (поле accepted) к live dailyTasks.
 *
 *   node scripts/apply-cyr-manual.mjs            # DRY-RUN
 *   node scripts/apply-cyr-manual.mjs --apply    # backup + запись
 *
 * Защита перед записью КАЖДОЙ правки:
 *   • поле в Firestore сейчас ДОСЛОВНО равно e.before (иначе skip — данные изменились);
 *   • в e.after внутри $...$ НЕТ голой кириллицы (вне \text/\mathrm/\operatorname);
 *   • мультимножество чисел и число кир.букв и парность $ сохранены.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const accepted = JSON.parse(readFileSync(resolve(__dirname, '../audit/_cyr_manual_wf_result.json'), 'utf8')).accepted;

const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const CYR = /[а-яёА-ЯЁ]/;
const stripText = (s) => s.replace(/\\(?:text|mathrm|operatorname|mbox)\s*\{[^{}]*\}/g, '');
const cyrN = (s) => (s.match(/[а-яёА-ЯЁ]/g) || []).length;
const dol = (s) => (s.match(/\$/g) || []).length;
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).sort().join(',');

function safe(before, after) {
  for (const sp of after.match(MATHSPAN) || []) if (CYR.test(stripText(sp))) return 'голая кириллица в math';
  if (cyrN(before) !== cyrN(after)) return 'изменилось число кир.букв';
  if (dol(after) % 2 !== 0 || dol(before) !== dol(after)) return 'нарушена парность/число $';
  if (nums(before) !== nums(after)) return 'изменились числа';
  return null;
}
const getField = (q, field) => { const m = field.match(/^options\[(\d+)\]$/); return m ? q.options?.[Number(m[1])] : q[field]; };
const setField = (q, field, val) => { const m = field.match(/^options\[(\d+)\]$/); if (m) q.options[Number(m[1])] = val; else q[field] = val; };

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю dailyTasks…\n`);
const snap = await db.collection('dailyTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const toWrite = {}; // id -> {field key, arr}
const ok = [], skip = [];
for (const e of accepted) {
  const data = docs[e.id];
  if (!data) { skip.push({ e, why: 'нет банка' }); continue; }
  const arrKey = data.questions ? 'questions' : 'tasks';
  const q = (data[arrKey] || [])[e.qi];
  if (!q) { skip.push({ e, why: 'нет вопроса' }); continue; }
  const cur = getField(q, e.field);
  if (cur !== e.before) { skip.push({ e, why: 'live ≠ before (данные изменились)' }); continue; }
  const bad = safe(e.before, e.after);
  if (bad) { skip.push({ e, why: bad }); continue; }
  ok.push(e);
}

console.log(`📊 к записи: ${ok.length} · пропуск: ${skip.length}\n`);
console.log('— примеры (до → после) —');
for (const e of ok.slice(0, 12)) console.log(`  [${e.id} q${e.qi} ${e.field}]\n    ${e.before.slice(0, 90)}\n  → ${e.after.slice(0, 90)}`);
if (skip.length) { console.log('\n— пропущено —'); for (const s of skip) console.log(`  [${s.e.id} q${s.e.qi}] ${s.why}`); }

if (!APPLY) { console.log('\n🔵 DRY-RUN: ничего не записано. Запусти с --apply.\n'); process.exit(0); }

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(__dirname, `../migration/backups/${ts}-cyr-manual`);
mkdirSync(backupDir, { recursive: true });
writeFileSync(join(backupDir, 'dailyTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-cyr-manual/dailyTasks.json`);

const byDoc = {};
for (const e of ok) (byDoc[e.id] ||= []).push(e);
let written = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  const arrKey = data.questions ? 'questions' : 'tasks';
  const arr = data[arrKey];
  for (const e of list) setField(arr[e.qi], e.field, e.after);
  await db.collection('dailyTasks').doc(id).update({ [arrKey]: arr });
  written++;
}
console.log(`\n✅ Обновлено документов: ${written} (правок: ${ok.length}, пропущено: ${skip.length}).\n`);
