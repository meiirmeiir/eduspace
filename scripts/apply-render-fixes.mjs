/**
 * apply-render-fixes.mjs — применяет render-фиксы (Задача 1) к skillTasks с ДЕТЕРМИНИРОВАННОЙ
 * KaTeX-валидацией: каждый `after` прогоняется через тот же пайплайн (LatexText + KaTeX
 * throwOnError); применяем ТОЛЬКО если (1) 0 KaTeX-ошибок, (2) не осталось literal-LaTeX вне $,
 * (3) live-значение поля == before. Не прошедшие → ручная корзина audit/_render_manual.json.
 *   node scripts/apply-render-fixes.mjs            # DRY-RUN
 *   node scripts/apply-render-fixes.mjs --apply    # backup + запись
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
const APPLY = process.argv.includes('--apply');
const items = JSON.parse(readFileSync(resolve(__dirname, '../audit/_render_result.json'), 'utf8')).items;
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
function renderEval(text) {
  const { segs, plain } = extract(text);
  let errs = 0;
  for (const sg of segs) { try { katex.renderToString(sg.expr, { throwOnError: true, displayMode: sg.block, strict: false }); } catch { errs++; } }
  return { errs, literal: LIT.test(plain) };
}
const getF = (t, field) => { const m = field.match(/^opt(\d+)$/); return m ? t.options?.[Number(m[1])] : t[field]; };
const setF = (t, field, v) => { const m = field.match(/^opt(\d+)$/); if (m) t.options[Number(m[1])] = v; else t[field] = v; };
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '');

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const snap = await db.collection('skillTasks').get();
const docs = {}; snap.forEach((d) => { docs[d.id] = d.data(); });

const ok = [], manual = [];
for (const it of items) {
  const t = docs[it.bank]?.[it.level]?.[it.ti];
  if (!t) { manual.push({ ...it, why: 'нет задачи' }); continue; }
  if (/^manual/i.test(it.note || '')) { manual.push({ ...it, why: 'агент: manual' }); continue; }
  if (norm(getF(t, it.field)) !== norm(it.before)) { manual.push({ ...it, why: 'live≠before' }); continue; }
  const ev = renderEval(it.after);
  if (ev.errs > 0 || ev.literal) { manual.push({ ...it, why: `KaTeX errs=${ev.errs} literal=${ev.literal}` }); continue; }
  ok.push(it);
}
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · render-фиксы`);
console.log(`  к записи (KaTeX 0 ошибок): ${ok.length} · в ручную: ${manual.length}\n`);
for (const e of ok.slice(0, 10)) console.log(`  [${e.bank} ${e.level}[${e.ti}] ${e.field}] ${e.kind}\n    ${e.before.slice(0, 60)}\n  → ${e.after.slice(0, 60)}`);
if (manual.length) { console.log('\n— ручная корзина —'); manual.forEach((m) => console.log(`  [${m.bank} ${m.level}[${m.ti}] ${m.field}] ${m.why}`)); }
writeFileSync(resolve(__dirname, '../audit/_render_manual.json'), JSON.stringify(manual, null, 1));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-render-fixes`); mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-render-fixes/`);
const byDoc = {}; for (const e of ok) (byDoc[e.bank] ||= []).push(e);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const e of list) setF(data[e.level][e.ti], e.field, e.after);
  const upd = {}; for (const lvl of ['a', 'b', 'c']) if (list.some((x) => x.level === lvl)) upd[lvl] = data[lvl];
  await db.collection('skillTasks').doc(id).update(upd); w++;
}
console.log(`\n✅ Обновлено документов: ${w} (полей: ${ok.length}).\n`);
