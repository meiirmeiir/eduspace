/**
 * fix-base-keys.mjs — ключ-фикс по находкам base-аудита (audit/_st_base_audit.json).
 * Для kind=key_error|expl_contradiction: ставит correct на индекс варианта == решённому (solved),
 * ТОЛЬКО если совпадение ОДНОЗНАЧНО (ровно один вариант) и live.correct == currentCorrectIdx.
 * no_correct и неоднозначные → пропуск (audit/_base_rewrite.json для rewrite-прохода).
 *   node scripts/fix-base-keys.mjs            # DRY-RUN
 *   node scripts/fix-base-keys.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const problems = JSON.parse(readFileSync(resolve(__dirname, '../audit/_st_base_audit.json'), 'utf8')).problems;
const cases = JSON.parse(readFileSync(resolve(__dirname, '../audit/_base_cases.json'), 'utf8'));
const caseByIdx = new Map(cases.map((c) => [c.idx, c]));
const norm = (s) => String(s == null ? '' : s).replace(/\$/g, '').replace(/\\dfrac|\\tfrac/g, '\\frac').replace(/[\s{}]/g, '').replace(/\\/g, '').toLowerCase();
function matchIdx(options, solved) {
  const ns = norm(solved); if (!ns) return [];
  const idxs = []; options.forEach((o, i) => { const no = norm(o); if (no && (no === ns || no === ns.replace(/[.,;].*$/, ''))) idxs.push(i); });
  return idxs;
}
const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const snap = await db.collection('skillTasks').get();
const docs = {}; snap.forEach((d) => { docs[d.id] = d.data(); });

const apply = [], rewrite = [], skip = [];
for (const p of problems) {
  if (p.kind === 'no_correct') { rewrite.push(p); continue; }
  const t = docs[p.bank]?.[p.level]?.[p.ti];
  if (!t) { skip.push({ p, why: 'нет задачи' }); continue; }
  if (t.correct !== p.currentCorrectIdx) { skip.push({ p, why: `correct сдвинулся (${t.correct})` }); continue; }
  const idxs = matchIdx(t.options || [], p.solved);
  if (idxs.length !== 1) { rewrite.push(p); continue; }
  if (idxs[0] === t.correct) { skip.push({ p, why: 'solved уже = correct' }); continue; }
  apply.push({ bank: p.bank, level: p.level, ti: p.ti, oldIdx: t.correct, newIdx: idxs[0], oldVal: t.options[t.correct], newVal: t.options[idxs[0]], solved: p.solved });
}
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · base ключ-фикс`);
console.log(`  применить: ${apply.length} · на rewrite: ${rewrite.length} · пропуск: ${skip.length}\n`);
for (const a of apply) console.log(`  [${a.bank} ${a.level}[${a.ti}]] correct ${a.oldIdx}(${a.oldVal})→${a.newIdx}(${a.newVal}) [solved=${a.solved}]`);
writeFileSync(resolve(__dirname, '../audit/_base_rewrite.json'), JSON.stringify(rewrite, null, 1));
console.log(`\n  на rewrite-проход → audit/_base_rewrite.json (${rewrite.length})`);

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-base-keys`); mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-base-keys/`);
const byDoc = {}; for (const a of apply) (byDoc[a.bank] ||= []).push(a);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const a of list) data[a.level][a.ti].correct = a.newIdx;
  const upd = {}; for (const lvl of ['a', 'b', 'c']) if (list.some((x) => x.level === lvl)) upd[lvl] = data[lvl];
  await db.collection('skillTasks').doc(id).update(upd); w++;
}
console.log(`\n✅ Обновлено документов: ${w} (ключей: ${apply.length}).\n`);
