/**
 * apply-resid-skilltasks.mjs — применяет починки Группы A (skillTasks) с защитой.
 * Вход: audit/_resid_A_result.json (items:[{idx,kind,decision,after,note,verdict}]) + audit/_resid_A.json (карта idx→bank,level,ti,live,...).
 *  · kind='rewrite': guard live==before && 4 уникальных && verdict.mathOk && verdict.formatOk && verdict.solvedIndex===after.correct → пишем text/options/correct/explanation.
 *  · kind='render':  guard live-поле==before, ДЕТЕРМИНИРОВАННАЯ KaTeX-проверка after-поля (0 ошибок, нет literal вне $) → пишем поле.
 * decision='manual' / провал гарда → ручная корзина audit/_resid_A_manual.json.
 *   node scripts/apply-resid-skilltasks.mjs           # DRY-RUN
 *   node scripts/apply-resid-skilltasks.mjs --apply   # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import katex from 'katex';
import { jsExprToLatex } from '../src/lib/mathUtils.js';
console.warn = () => {};
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(__dirname, p);
const APPLY = process.argv.includes('--apply');
const items = JSON.parse(readFileSync(R('../audit/_resid_A_result.json'), 'utf8')).items;
const cases = JSON.parse(readFileSync(R('../audit/_resid_A.json'), 'utf8'));
const caseByIdx = new Map(cases.map((c) => [c.idx, c]));
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '');

const CJK = /[一-鿿㐀-䶿　-〿＀-￯]+/g;
const LIT = /\\[a-zA-Z]{2,}|\^\{|_\{|\\frac|\\sqrt|\\cdot/;
function extract(text) {
  let raw = String(text).replace(/\/\/([a-zA-Z]+)/g, '\\$1').replace(CJK, '').trim();
  if (!raw) return { segs: [], plain: '' };
  if (!raw.includes('$')) { if (/[а-яёА-ЯЁ]/.test(raw)) raw = raw.replace(/\\[a-zA-Z]+/g, (m) => `$${m}$`); else if (/\\[a-zA-Z]/.test(raw) || /\bMath\./.test(raw)) raw = `$${raw}$`; else return { segs: [], plain: raw }; }
  const segs = []; let s = raw, plain = '';
  while (s.length) { const b = s.indexOf('$$'), i = s.indexOf('$'); let done = false;
    if (b !== -1 && b === i) { const e = s.indexOf('$$', b + 2); if (e !== -1) { plain += s.slice(0, b); segs.push({ expr: jsExprToLatex(s.slice(b + 2, e)), block: true }); s = s.slice(e + 2); done = true; } }
    if (!done && i !== -1) { const e = s.indexOf('$', i + 1); if (e !== -1) { plain += s.slice(0, i); segs.push({ expr: jsExprToLatex(s.slice(i + 1, e)), block: false }); s = s.slice(e + 1); done = true; } }
    if (!done) { plain += s; break; }
  }
  return { segs, plain };
}
function renderEval(text) { const { segs, plain } = extract(text); let errs = 0; for (const sg of segs) { try { katex.renderToString(sg.expr, { throwOnError: true, displayMode: sg.block, strict: false }); } catch { errs++; } } return { errs, literal: LIT.test(plain) }; }

initializeApp({ credential: cert(JSON.parse(readFileSync(R('service-account.json'), 'utf8'))) });
const db = getFirestore();
const snap = await db.collection('skillTasks').get();
const docs = {}; snap.forEach((d) => { docs[d.id] = d.data(); });

const apply = [], manual = [];
for (const it of items) {
  const c = caseByIdx.get(it.idx);
  if (!c) { manual.push({ idx: it.idx, why: 'нет кейса' }); continue; }
  const t = docs[c.bank]?.[c.level]?.[c.ti];
  if (!t) { manual.push({ idx: it.idx, bank: c.bank, why: 'нет задачи' }); continue; }
  if (it.decision === 'manual') { manual.push({ idx: it.idx, bank: c.bank, level: c.level, ti: c.ti, why: 'agent: manual', note: it.note }); continue; }
  if (it.kind === 'render') {
    const field = c.field || 'explanation';
    const om = field.match(/^opt(\d+)$/);
    const liveVal = om ? t.options?.[Number(om[1])] : t[field];
    // Гард на KaTeX (а не на устаревший before): чиним только если live ещё ломается, а after — чист.
    const liveEv = renderEval(liveVal);
    if (liveEv.errs === 0 && !liveEv.literal) { manual.push({ idx: it.idx, bank: c.bank, why: 'render: live уже чисто (закрыт без изменений)' }); continue; }
    const newVal = om ? it.after.options[Number(om[1])] : it.after[field];
    const ev = renderEval(newVal);
    if (ev.errs > 0 || ev.literal) { manual.push({ idx: it.idx, bank: c.bank, why: `render: after KaTeX errs=${ev.errs} literal=${ev.literal}` }); continue; }
    apply.push({ kind: 'render', bank: c.bank, level: c.level, ti: c.ti, field, newVal, note: it.note });
  } else {
    const a = it.after; const v = it.verdict;
    const four = a.options.length === 4 && new Set(a.options.map(String)).size === 4;
    if (norm(t.text) !== norm(c.live.text)) { manual.push({ idx: it.idx, bank: c.bank, why: 'rewrite: live≠before (text)' }); continue; }
    if (!v || !v.mathOk || !v.formatOk || v.solvedIndex !== a.correct || !four) { manual.push({ idx: it.idx, bank: c.bank, level: c.level, ti: c.ti, why: `вердикт не прошёл (solved=${v?.solvedIndex} corr=${a.correct} math=${v?.mathOk} fmt=${v?.formatOk} 4uniq=${four})`, note: it.note }); continue; }
    apply.push({ kind: 'rewrite', bank: c.bank, level: c.level, ti: c.ti, after: a, note: it.note, oldCorrect: t.correct });
  }
}
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · Группа A (skillTasks)`);
console.log(`  к записи: ${apply.length} · в ручную: ${manual.length}\n`);
for (const a of apply) console.log(a.kind === 'render'
  ? `  [${a.bank} ${a.level}[${a.ti}] ${a.field}] RENDER (KaTeX 0) | ${String(a.note).slice(0, 60)}`
  : `  [${a.bank} ${a.level}[${a.ti}]] REWRITE correct ${a.oldCorrect}→${a.after.correct} | ${String(a.note).slice(0, 55)}`);
if (manual.length) { console.log('\n— ручная корзина —'); for (const m of manual) console.log(`  [${m.bank} ${m.level ?? ''}${m.ti != null ? '[' + m.ti + ']' : ''}] ${m.why}${m.note ? ' :: ' + String(m.note).slice(0, 70) : ''}`); }
writeFileSync(R('../audit/_resid_A_manual.json'), JSON.stringify(manual, null, 1));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = R(`../migration/backups/${ts}-resid-skilltasks`); mkdirSync(bk, { recursive: true });
const touched = [...new Set(apply.map((a) => a.bank))];
const bkData = {}; for (const id of touched) bkData[id] = docs[id];
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(bkData, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-resid-skilltasks/ (${touched.length} док.)`);
const byDoc = {}; for (const a of apply) (byDoc[a.bank] ||= []).push(a);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const a of list) {
    const t = data[a.level][a.ti];
    if (a.kind === 'render') { const om = a.field.match(/^opt(\d+)$/); if (om) t.options[Number(om[1])] = a.newVal; else t[a.field] = a.newVal; }
    else { t.text = a.after.text; t.options = a.after.options; t.correct = a.after.correct; t.explanation = a.after.explanation; }
  }
  const upd = {}; for (const lvl of ['a', 'b', 'c']) if (list.some((x) => x.level === lvl)) upd[lvl] = data[lvl];
  await db.collection('skillTasks').doc(id).update(upd); w++;
}
console.log(`\n✅ Обновлено skillTasks-документов: ${w} (правок: ${apply.length}).\n`);
process.exit(0);
