/**
 * fix-skilltasks-keys.mjs — чинит ошибки ключа skillTasks по находкам пилота
 * (audit/_st_logic_pilot.json). Для kind=key_error|expl_contradiction: ставит correct
 * на индекс варианта, совпадающего с решённым агентом ответом (solved) — ТОЛЬКО если
 * совпадение ОДНОЗНАЧНО (ровно один вариант) и отличается от текущего correct.
 * no_correct и неоднозначные — пропуск (→ Шаг 6).
 *   node scripts/fix-skilltasks-keys.mjs            # DRY-RUN
 *   node scripts/fix-skilltasks-keys.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const pilot = JSON.parse(readFileSync(resolve(__dirname, '../audit/_st_findings_all.json'), 'utf8'));

const norm = (s) => String(s == null ? '' : s).replace(/\$/g, '').replace(/\\(dfrac|frac|tfrac)/g, 'frac').replace(/[\s{}]/g, '').replace(/\\/g, '').toLowerCase();
function matchIdx(options, solved) {
  const ns = norm(solved);
  if (!ns) return [];
  const idxs = [];
  options.forEach((o, i) => { const no = norm(o); if (no && (no === ns || no === ns.replace(/[.,].*$/, ''))) idxs.push(i); });
  return idxs;
}

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю skillTasks…\n`);
const snap = await db.collection('skillTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const apply = [], skip = [];
for (const f of pilot.findings) {
  if (f.kind === 'no_correct') { skip.push({ f, why: 'no_correct → Шаг 6' }); continue; }
  const data = docs[f.bank];
  const t = data?.[f.level]?.[f.ti];
  if (!t) { skip.push({ f, why: 'нет задачи' }); continue; }
  if (t.correct !== f.currentCorrectIdx) { skip.push({ f, why: `correct сдвинулся (${t.correct}≠${f.currentCorrectIdx})` }); continue; }
  const idxs = matchIdx(t.options || [], f.solved);
  if (idxs.length !== 1) { skip.push({ f, why: `solved «${f.solved}» совпал с ${idxs.length} вариантами → Шаг 6` }); continue; }
  const newIdx = idxs[0];
  if (newIdx === t.correct) { skip.push({ f, why: 'solved уже = correct' }); continue; }
  apply.push({ bank: f.bank, level: f.level, ti: f.ti, id: t.id, oldIdx: t.correct, newIdx, oldVal: t.options[t.correct], newVal: t.options[newIdx], solved: f.solved });
}

console.log(`📊 ключ-фикс: применить ${apply.length} · пропуск ${skip.length}\n`);
console.log('— правки (correct: было → стало) —');
for (const a of apply) console.log(`  [${a.bank} ${a.level}[${a.ti}] ${a.id}] correct ${a.oldIdx}(${a.oldVal}) → ${a.newIdx}(${a.newVal})  [solved=${a.solved}]`);
console.log('\n— пропущено (→ Шаг 6 / manual) —');
for (const s of skip.slice(0, 50)) console.log(`  [${s.f.bank} ${s.f.level}[${s.f.ti}]] ${s.f.kind} | ${s.why}`);

writeFileSync(resolve(__dirname, '../audit/_st_keys_skip.json'), JSON.stringify(skip.map((s) => ({ ...s.f, why: s.why })), null, 1));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-skilltasks-keys`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-skilltasks-keys/skillTasks.json`);
const byDoc = {};
for (const a of apply) (byDoc[a.bank] ||= []).push(a);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const a of list) data[a.level][a.ti].correct = a.newIdx;
  const upd = {};
  for (const lvl of ['a', 'b', 'c']) if (list.some((x) => x.level === lvl)) upd[lvl] = data[lvl];
  await db.collection('skillTasks').doc(id).update(upd);
  w++;
}
console.log(`\n✅ Обновлено документов: ${w} (ключей: ${apply.length}).\n`);
