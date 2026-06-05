/**
 * apply-resid-dailytasks.mjs — применяет починки Группы B (dailyTasks) с двойной защитой.
 * Вход: audit/_resid_B_result.json (items:[{idx,decision,after,verdict}]) + audit/_resid_B.json (карта idx→skill,num,liveIdx,live).
 * Применяем ТОЛЬКО decision='fix' && verdict.mathOk && verdict.formatOk && verdict.solvedIndex===after.correct
 *   && 4 уникальных опции && live-вопрос совпадает с тем, что видел переписчик (по тексту вопроса).
 * already_ok / manual / rejected → не трогаем (репорт).
 *   node scripts/apply-resid-dailytasks.mjs           # DRY-RUN
 *   node scripts/apply-resid-dailytasks.mjs --apply   # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(__dirname, p);
const APPLY = process.argv.includes('--apply');
const result = JSON.parse(readFileSync(R('../audit/_resid_B_result.json'), 'utf8'));
const items = result.items || result;
const cases = JSON.parse(readFileSync(R('../audit/_resid_B.json'), 'utf8'));
const caseByIdx = new Map(cases.map((c) => [c.idx, c]));
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();

initializeApp({ credential: cert(JSON.parse(readFileSync(R('service-account.json'), 'utf8'))) });
const db = getFirestore();
const ids = [...new Set(cases.map((c) => c.skill).filter(Boolean))];
const docs = {};
await Promise.all(ids.map(async (id) => { const s = await db.collection('dailyTasks').doc(id).get(); if (s.exists) docs[id] = s.data(); }));

const apply = [], skip = [];
const byDec = {};
for (const it of items) {
  byDec[it.decision] = (byDec[it.decision] || 0) + 1;
  const c = caseByIdx.get(it.idx);
  if (!c) { skip.push({ it, why: 'нет кейса' }); continue; }
  if (it.decision !== 'fix') { skip.push({ it, why: it.decision }); continue; }
  const v = it.verdict;
  const a = it.after;
  const four = a.options.length === 4 && new Set(a.options.map(String)).size === 4;
  if (!v || !v.mathOk || !v.formatOk || v.solvedIndex !== a.correct || !four) { skip.push({ it, why: `вердикт не прошёл (solved=${v?.solvedIndex} corr=${a.correct} math=${v?.mathOk} fmt=${v?.formatOk} 4uniq=${four})` }); continue; }
  const q = docs[c.skill]?.questions?.[c.liveIdx];
  if (!q) { skip.push({ it, why: 'нет live-задачи' }); continue; }
  if (norm(q.question) !== norm(c.live.question)) { skip.push({ it, why: 'live≠видел переписчик (вопрос изменился)' }); continue; }
  apply.push({ idx: it.idx, skill: c.skill, num: c.num, liveIdx: c.liveIdx, after: a, note: it.note,
    diff: { oldCorrect: q.correct, newCorrect: a.correct, optsChanged: JSON.stringify(q.options) !== JSON.stringify(a.options) } });
}
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · Группа B (dailyTasks)`);
console.log(`  решения: ${JSON.stringify(byDec)}`);
console.log(`  к записи: ${apply.length} · пропуск: ${skip.length}\n`);
for (const a of apply) console.log(`  [${a.skill} #${a.num}] correct ${a.diff.oldCorrect}→${a.diff.newCorrect}${a.diff.optsChanged ? ' +опции' : ''} | ${String(a.note).slice(0, 70)}`);
const skipManual = skip.filter((s) => s.it && (s.it.decision === 'manual'));
if (skipManual.length) { console.log(`\n— manual (нерешаемо/рисунок): ${skipManual.length} —`); for (const s of skipManual) { const c = caseByIdx.get(s.it.idx); console.log(`  [${c?.skill} #${c?.num}] ${String(s.it.note).slice(0, 80)}`); } }
const skipReject = skip.filter((s) => s.it && s.it.decision === 'fix');
if (skipReject.length) { console.log(`\n— fix отклонён валидатором: ${skipReject.length} —`); for (const s of skipReject) { const c = caseByIdx.get(s.it.idx); console.log(`  [${c?.skill} #${c?.num}] ${s.why}`); } }
writeFileSync(R('../audit/_resid_B_applied.json'), JSON.stringify({ apply, skip: skip.map((s) => ({ idx: s.it?.idx, decision: s.it?.decision, why: s.why, note: s.it?.note })) }, null, 1));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = R(`../migration/backups/${ts}-resid-dailytasks`); mkdirSync(bk, { recursive: true });
const touched = [...new Set(apply.map((a) => a.skill))];
const bkData = {}; for (const id of touched) bkData[id] = docs[id];
writeFileSync(join(bk, 'dailyTasks.json'), JSON.stringify(bkData, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-resid-dailytasks/ (${touched.length} док.)`);
const byDoc = {}; for (const a of apply) (byDoc[a.skill] ||= []).push(a);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const a of list) { const q = data.questions[a.liveIdx]; q.question = a.after.question; q.options = a.after.options; q.correct = a.after.correct; q.explanation = a.after.explanation; }
  await db.collection('dailyTasks').doc(id).update({ questions: data.questions });
  w++;
}
console.log(`\n✅ Обновлено dailyTasks-документов: ${w} (задач: ${apply.length}).\n`);
process.exit(0);
