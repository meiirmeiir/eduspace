/**
 * apply-resid-questions.mjs — применяет починки Группы C (questions) с защитой.
 * Вход: audit/_resid_C_result.json (items:[{idx,id,qtype,decision,compoundFixes?,mcqFix?,genFix?,verdict}]).
 * Применяем ТОЛЬКО decision='fix' && verdict.ok===true. Типы:
 *  · compound → subQuestions[subIndex].correct (+options если newOptions непусты)
 *  · mcq → correct (+options если newOptions непусты)
 *  · generated → answerFormula + wrongFormulas
 * already_ok / manual / verdict !ok → пропуск (репорт).
 *   node scripts/apply-resid-questions.mjs           # DRY-RUN
 *   node scripts/apply-resid-questions.mjs --apply   # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(__dirname, p);
const APPLY = process.argv.includes('--apply');
const result = JSON.parse(readFileSync(R('../audit/_resid_C_result.json'), 'utf8'));
const items = result.items || result;

initializeApp({ credential: cert(JSON.parse(readFileSync(R('service-account.json'), 'utf8'))) });
const db = getFirestore();

const apply = [], skip = [];
const byDec = {};
for (const it of items) {
  byDec[it.decision] = (byDec[it.decision] || 0) + 1;
  if (it.decision !== 'fix') { skip.push({ id: it.id, why: it.decision }); continue; }
  if (!it.verdict || it.verdict.ok !== true) { skip.push({ id: it.id, why: `вердикт !ok: ${it.verdict?.reason || '—'}` }); continue; }
  const snap = await db.collection('questions').doc(it.id).get();
  if (!snap.exists) { skip.push({ id: it.id, why: 'нет документа' }); continue; }
  const q = snap.data();
  const upd = {}; const diffs = [];
  if (it.qtype === 'compound') {
    if (!Array.isArray(it.compoundFixes) || !it.compoundFixes.length) { skip.push({ id: it.id, why: 'нет compoundFixes' }); continue; }
    const subs = JSON.parse(JSON.stringify(q.subQuestions));
    let bad = false;
    for (const fx of it.compoundFixes) {
      const s = subs[fx.subIndex]; if (!s) { bad = true; break; }
      const opts = (fx.newOptions && fx.newOptions.length) ? fx.newOptions : s.options;
      if (!(opts.length === 4 && new Set(opts.map(String)).size === 4)) { bad = true; break; }
      if (fx.newCorrect < 0 || fx.newCorrect > 3) { bad = true; break; }
      s.options = opts; const old = s.correct; s.correct = fx.newCorrect;
      diffs.push(`sub${fx.subIndex}: correct ${old}→${fx.newCorrect}${(fx.newOptions && fx.newOptions.length) ? ' +опции' : ''}`);
    }
    if (bad) { skip.push({ id: it.id, why: 'compoundFix: плохие опции/индекс' }); continue; }
    upd.subQuestions = subs;
  } else if (it.qtype === 'mcq') {
    const f = it.mcqFix; if (!f) { skip.push({ id: it.id, why: 'нет mcqFix' }); continue; }
    const opts = (f.newOptions && f.newOptions.length) ? f.newOptions : q.options;
    if (!(opts.length === 4 && new Set(opts.map(String)).size === 4)) { skip.push({ id: it.id, why: 'mcq: опции не 4-уник' }); continue; }
    if (f.newCorrect < 0 || f.newCorrect > 3) { skip.push({ id: it.id, why: 'mcq: индекс вне диапазона' }); continue; }
    upd.options = opts; upd.correct = f.newCorrect; diffs.push(`correct ${q.correct}→${f.newCorrect}${(f.newOptions && f.newOptions.length) ? ' +опции' : ''}`);
  } else if (it.qtype === 'generated') {
    const f = it.genFix; if (!f || !f.answerFormula) { skip.push({ id: it.id, why: 'нет genFix' }); continue; }
    const wf = (f.wrongFormulas || []).filter((w) => w && w !== f.answerFormula);
    if (new Set(wf).size < 2) { skip.push({ id: it.id, why: 'мало уникальных wrongFormulas' }); continue; }
    upd.answerFormula = f.answerFormula; upd.wrongFormulas = wf; diffs.push(`answerFormula '${q.answerFormula}'→'${f.answerFormula}'`);
  } else { skip.push({ id: it.id, why: `неизв. тип ${it.qtype}` }); continue; }
  apply.push({ id: it.id, qtype: it.qtype, upd, diffs, note: it.note, prev: q });
}
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · Группа C (questions)`);
console.log(`  решения: ${JSON.stringify(byDec)}`);
console.log(`  к записи: ${apply.length} · пропуск: ${skip.length}\n`);
for (const a of apply) console.log(`  [${a.id.slice(0, 8)} ${a.qtype}] ${a.diffs.join('; ')} | ${String(a.note).slice(0, 60)}`);
if (skip.length) { console.log('\n— пропуск —'); for (const s of skip) console.log(`  [${String(s.id).slice(0, 8)}] ${s.why}`); }
writeFileSync(R('../audit/_resid_C_applied.json'), JSON.stringify({ apply: apply.map((a) => ({ id: a.id, qtype: a.qtype, diffs: a.diffs, note: a.note })), skip }, null, 1));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = R(`../migration/backups/${ts}-resid-questions`); mkdirSync(bk, { recursive: true });
const bkData = {}; for (const a of apply) bkData[a.id] = a.prev;
writeFileSync(join(bk, 'questions.json'), JSON.stringify(bkData, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-resid-questions/ (${apply.length} док.)`);
let w = 0;
for (const a of apply) { await db.collection('questions').doc(a.id).update(a.upd); w++; }
console.log(`\n✅ Обновлено questions-документов: ${w}.\n`);
process.exit(0);
