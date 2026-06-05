/**
 * fix-skilltasks-wrap.mjs — оборачивает «bare LaTeX без $» в $...$ для skillTasks (a/b/c).
 * Остаток после fix-skilltasks-render (≈28 literal-LaTeX). Логика partial-wrap +
 * двойная валидация: правка применяется ТОЛЬКО если после неё (1) 0 KaTeX-ошибок,
 * (2) не осталось литерального LaTeX в plain-тексте, (3) значимый контент сохранён.
 *   node scripts/fix-skilltasks-wrap.mjs            # DRY-RUN
 *   node scripts/fix-skilltasks-wrap.mjs --apply    # backup + запись
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
const LEVELS = ['a', 'b', 'c'];
const FIELDS = ['text', 'question', 'question_text', 'explanation'];
const CJK = /[一-鿿㐀-䶿　-〿＀-￯]+/g;
const LIT = /\\[a-zA-Z]{2,}|\^\{|_\{|\\frac|\\sqrt|\\cdot|\\Rightarrow/;

const hasCyr = (s) => /[а-яёА-ЯЁ]/.test(s);
const stripDelims = (s) => s.replace(/\$/g, '');
const braceMultichar = (s) => s.replace(/\^(-?[0-9A-Za-z.]{2,})(?![}\w])/g, '^{$1}').replace(/_(-?[0-9A-Za-z.]{2,})(?![}\w])/g, '_{$1}');
const onlyAlnum = (s) => (s.match(/[0-9A-Za-zА-Яа-яёЁ]/g) || []).join('');
function contentPreserved(before, after) {
  const a = onlyAlnum(before), b = onlyAlnum(after); let i = 0;
  for (const ch of b) if (i < a.length && a[i] === ch) i++;
  return i === a.length;
}
function wrapLeaksInText(t) {
  const brace = (e) => (/^\{/.test(e) ? e : e.replace(/^(-?)(.+)$/, (m, sg, v) => (v.length > 1 ? `${sg}{${v}}` : `${sg}${v}`)));
  const sup = /([A-Za-z0-9.]+|\([^()]*\))\^(\{[^}]*\}|-?\([^()]*\)|-?[0-9A-Za-z.]+)/g;
  const sub = /([A-Za-z0-9.]+|\([^()]*\))_(\{[^}]*\}|-?[0-9A-Za-z.]+)/g;
  t = t.replace(sup, (m, b, e) => `$${b}^${brace(e)}$`);
  t = t.replace(sub, (m, b, e) => `$${b}_${brace(e)}$`);
  t = t.replace(/\\[a-zA-Z]+/g, (m) => `$${m}$`);
  return t;
}
// split на $…$ / $$…$$ сегменты и текст
function splitSpans(raw) {
  const parts = []; let s = raw;
  while (s.length) {
    const b = s.indexOf('$$'), i = s.indexOf('$');
    if (b !== -1 && b === i) { const e = s.indexOf('$$', b + 2); if (e !== -1) { if (b) parts.push({ t: 'text', v: s.slice(0, b) }); parts.push({ t: 'math', v: s.slice(b, e + 2) }); s = s.slice(e + 2); continue; } }
    if (i !== -1) { const e = s.indexOf('$', i + 1); if (e !== -1) { if (i) parts.push({ t: 'text', v: s.slice(0, i) }); parts.push({ t: 'math', v: s.slice(i, e + 1) }); s = s.slice(e + 1); continue; } }
    parts.push({ t: 'text', v: s }); break;
  }
  return parts;
}
// КОНСЕРВАТИВНО: оборачиваем целиком ТОЛЬКО компактное чистое выражение
// (без $, без кириллицы, без прозы — короткий одиночный токен/опция).
// Сложные/смешанные/с-$ случаи НЕ трогаем (уходят в ручной список).
const PURE_EXPR = /^[-]?[\\A-Za-z0-9^_{}()+\-*/.,=|\s]+$/;
const PROSE = /\b(mod|для|любого|где|если|при|тогда|число|равно)\b/i;
function transform(orig) {
  if (typeof orig !== 'string' || !orig) return orig;
  const body = orig.replace(CJK, '');
  if (!LIT.test(body)) return orig;
  if (orig.includes('$')) return orig;       // смешанное с $ — не трогаем
  if (hasCyr(orig)) return orig;             // проза — не трогаем
  const t = orig.trim();
  if (!PURE_EXPR.test(t) || PROSE.test(t) || t.length > 40) return orig; // только компактное чистое
  return '$' + braceMultichar(stripDelims(t)) + '$';
}

// число KaTeX-ошибок + остаточный литерал в plain
function evalField(text) {
  let raw = String(text).replace(/\/\/([a-zA-Z]+)/g, '\\$1').replace(CJK, '').trim();
  if (!raw) return { errs: 0, literal: false };
  if (!raw.includes('$')) {
    if (/[а-яёА-ЯЁ]/.test(raw)) raw = raw.replace(/\\[a-zA-Z]+/g, (m) => `$${m}$`);
    else if (/\\[a-zA-Z]/.test(raw) || /\bMath\./.test(raw)) raw = `$${raw}$`;
    else return { errs: 0, literal: LIT.test(raw) };
  }
  let s = raw, errs = 0, plain = '';
  while (s.length) {
    const b = s.indexOf('$$'), i = s.indexOf('$');
    let expr = null, block = false;
    if (b !== -1 && b === i) { const e = s.indexOf('$$', b + 2); if (e !== -1) { plain += s.slice(0, b); expr = jsExprToLatex(s.slice(b + 2, e)); block = true; s = s.slice(e + 2); } }
    if (expr === null && i !== -1) { const e = s.indexOf('$', i + 1); if (e !== -1) { plain += s.slice(0, i); expr = jsExprToLatex(s.slice(i + 1, e)); s = s.slice(e + 1); } }
    if (expr === null) { plain += s; break; }
    try { katex.renderToString(expr, { throwOnError: true, displayMode: block, strict: false }); } catch { errs++; }
  }
  return { errs, literal: LIT.test(plain) };
}

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю skillTasks…\n`);
const snap = await db.collection('skillTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

let changed = 0, skipped = 0;
const examples = [], manual = [];
const docUpdates = {};
for (const [id, data] of Object.entries(docs)) {
  for (const lvl of LEVELS) {
    const arr = data[lvl];
    if (!Array.isArray(arr)) continue;
    let lc = false;
    const nA = arr.map((t, ti) => {
      if (!t || typeof t !== 'object') return t;
      const nt = { ...t };
      const ap = (key, val) => {
        if (typeof val !== 'string' || !val) return val;
        const before = evalField(val);
        if (before.errs === 0 && !before.literal) return val; // уже ок
        const nv = transform(val);
        if (nv === val) { manual.push({ loc: `${id}|${lvl}[${ti}]|${key}`, why: 'не оборачивается', frag: val.slice(0, 70) }); return val; }
        const after = evalField(nv);
        if (after.errs === 0 && !after.literal && contentPreserved(val, nv)) {
          changed++; lc = true;
          if (examples.length < 16) examples.push({ loc: `${id}|${lvl}[${ti}]|${key}`, before: val.slice(0, 80), after: nv.slice(0, 80) });
          return nv;
        }
        skipped++;
        manual.push({ loc: `${id}|${lvl}[${ti}]|${key}`, why: `после wrap: errs=${after.errs} literal=${after.literal} preserved=${contentPreserved(val, nv)}`, frag: val.slice(0, 70) });
        return val;
      };
      for (const f of FIELDS) if (typeof nt[f] === 'string') nt[f] = ap(f, nt[f]);
      if (Array.isArray(nt.options)) nt.options = nt.options.map((o, oi) => ap(`opt${oi}`, o));
      return nt;
    });
    if (lc) (docUpdates[id] ||= {})[lvl] = nA;
  }
}

console.log(`📊 обёрнуто (валидно): ${changed} · в ручной список: ${manual.length}`);
console.log('\n— примеры обёрнутых —');
for (const e of examples) console.log(`  [${e.loc}]\n    ${JSON.stringify(e.before)}\n  → ${JSON.stringify(e.after)}`);
console.log('\n— в ручной список —');
for (const m of manual.slice(0, 40)) console.log(`  [${m.loc}] ${m.why} | ${m.frag.replace(/[\x00-\x1F]/g, (c) => '⟨' + c.charCodeAt(0) + '⟩')}`);
writeFileSync(resolve(__dirname, '../audit/_skilltasks_wrap_manual.json'), JSON.stringify(manual, null, 1));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-skilltasks-wrap`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-skilltasks-wrap/skillTasks.json`);
let w = 0;
for (const [id, levels] of Object.entries(docUpdates)) { await db.collection('skillTasks').doc(id).update(levels); w++; }
console.log(`\n✅ Обновлено документов: ${w} (полей: ${changed}).\n`);
