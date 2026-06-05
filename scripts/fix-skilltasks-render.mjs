/**
 * fix-skilltasks-render.mjs — целевые render-фиксы для skillTasks (a/b/c).
 * Чинит ФАКТИЧЕСКИ найденные дефекты (Шаг 1):
 *   1) Контрол-символьная порча LaTeX-команд: FF→\f (\frac), CR→\r (\right/\rho/\rfloor),
 *      TAB→\t (\times/\to/\tan) [только перед буквой], LF→\n (\neq,\nu) [только спец-суффиксы],
 *      BS→\bar/\beta или удалить стрелый BS, VT→\v.
 *   2) Делимитеры \(...\) → $...$ и \[...\] → $$...$$ (а в полях с $ → \(→( , \)→) ).
 *   3) \/cmd → \cmd (стрелый \/ перед командой).
 * Перед записью КАЖДОГО поля пересчитывает число KaTeX parse-ошибок (тот же пайплайн, что
 * audit/skilltasks-render-scan): применяет правку ТОЛЬКО если ошибок не стало больше.
 *
 *   node scripts/fix-skilltasks-render.mjs            # DRY-RUN
 *   node scripts/fix-skilltasks-render.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import katex from 'katex';
import { jsExprToLatex } from '../src/lib/mathUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const LEVELS = ['a', 'b', 'c'];
const FIELDS = ['text', 'question', 'question_text', 'explanation'];

// ── трансформации (порядок важен) ───────────────────────────────────────────
function fixControlChars(s, tally) {
  let v = s;
  const rules = [
    [/\x0Crac/g, '\\frac'],            // FF
    [/\x0C/g, '\\f'],                  // generic FF
    [/\x0Dightarrow/g, '\\rightarrow'],
    [/\x0Dight/g, '\\right'], [/\x0Dho/g, '\\rho'], [/\x0Dfloor/g, '\\rfloor'],
    [/\x0D/g, '\\r'],                  // generic CR
    [/\x09imes(?![A-Za-z])/g, '\\times'], [/\x09heta(?![A-Za-z])/g, '\\theta'],
    [/\x09ext(?![A-Za-z])/g, '\\text'], [/\x09au(?![A-Za-z])/g, '\\tau'],
    [/\x09an(?![A-Za-z])/g, '\\tan'], [/\x09o(?![A-Za-z])/g, '\\to'],
    [/\x09(?=[A-Za-z])/g, '\\t'],      // прочий TAB перед буквой
    [/\x0Aeq(?![A-Za-z])/g, '\\neq'], [/\x0Au(?![A-Za-z])/g, '\\nu'], // LF только спец
    [/\x08ar(?![A-Za-z])/g, '\\bar'], [/\x08eta(?![A-Za-z])/g, '\\beta'],
    [/\x08/g, ''],                     // стрелый backspace — удалить
    [/\x0B/g, '\\v'],                  // VT
  ];
  for (const [re, to] of rules) {
    const m = v.match(re);
    if (m) { tally.ctrl = (tally.ctrl || 0) + m.length; v = v.replace(re, to); }
  }
  return v;
}
function fixDelimiters(s, tally) {
  let v = s;
  if (v.includes('$')) {
    // в полях с $ скобочные \( \) — это мис-эскейп скобок
    const m = v.match(/\\[()]/g);
    if (m) { tally.parenInDollar = (tally.parenInDollar || 0) + m.length; v = v.replace(/\\\(/g, '(').replace(/\\\)/g, ')'); }
  } else if (/\\[()[\]]/.test(v)) {
    const m = v.match(/\\[()[\]]/g);
    tally.delim = (tally.delim || 0) + (m ? m.length : 0);
    v = v.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$').replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  }
  return v;
}
function fixSlashCmd(s, tally) {
  if (/\\\/[A-Za-z]/.test(s)) { const m = s.match(/\\\/[A-Za-z]/g); tally.slashcmd = (tally.slashcmd || 0) + m.length; return s.replace(/\\\/(?=[A-Za-z])/g, '\\'); }
  return s;
}
function transform(s, tally) {
  if (typeof s !== 'string' || !s) return s;
  let v = s;
  v = fixControlChars(v, tally);
  v = fixDelimiters(v, tally);
  v = fixSlashCmd(v, tally);
  return v;
}

// ── валидация: число KaTeX parse-ошибок в поле (пайплайн LatexText) ──────────
const CJK = /[一-鿿㐀-䶿　-〿＀-￯]+/g;
function katexErrCount(text) {
  let raw = String(text).replace(/\/\/([a-zA-Z]+)/g, '\\$1').replace(CJK, '').trim();
  if (!raw) return 0;
  if (!raw.includes('$')) {
    if (/[а-яёА-ЯЁ]/.test(raw)) raw = raw.replace(/\\[a-zA-Z]+/g, (m) => `$${m}$`);
    else if (/\\[a-zA-Z]/.test(raw) || /\bMath\./.test(raw)) raw = `$${raw}$`;
    else return 0;
  }
  let s = raw, errs = 0;
  while (s.length > 0) {
    const b = s.indexOf('$$'), i = s.indexOf('$');
    let expr = null, block = false;
    if (b !== -1 && b === i) { const e = s.indexOf('$$', b + 2); if (e !== -1) { expr = jsExprToLatex(s.slice(b + 2, e)); block = true; s = s.slice(e + 2); } }
    if (expr === null && i !== -1) { const e = s.indexOf('$', i + 1); if (e !== -1) { expr = jsExprToLatex(s.slice(i + 1, e)); s = s.slice(e + 1); } }
    if (expr === null) break;
    try { katex.renderToString(expr, { throwOnError: true, displayMode: block, strict: false }); } catch { errs++; }
  }
  return errs;
}

// ── чтение live ─────────────────────────────────────────────────────────────
const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю skillTasks…\n`);
const snap = await db.collection('skillTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const tally = {};
let errBeforeTot = 0, errAfterTot = 0, fieldsChanged = 0, regressions = 0;
const regrExamples = [], changeExamples = [];
const docUpdates = {}; // id -> {level -> newArr}

for (const [id, data] of Object.entries(docs)) {
  for (const lvl of LEVELS) {
    const arr = data[lvl];
    if (!Array.isArray(arr)) continue;
    let lvlChanged = false;
    const newArr = arr.map((t, ti) => {
      if (!t || typeof t !== 'object') return t;
      const nt = { ...t };
      const applyField = (key, val) => {
        if (typeof val !== 'string' || !val) return val;
        const local = {};
        const nv = transform(val, local);
        if (nv === val) return val;
        const eB = katexErrCount(val), eA = katexErrCount(nv);
        if (eA > eB) { // регрессия — НЕ применять
          regressions++;
          if (regrExamples.length < 10) regrExamples.push({ loc: `${id}|${lvl}[${ti}]|${key}`, before: val.slice(0, 80), after: nv.slice(0, 80), eB, eA });
          return val;
        }
        fieldsChanged++; lvlChanged = true;
        errBeforeTot += eB; errAfterTot += eA;
        for (const k in local) tally[k] = (tally[k] || 0) + local[k];
        if (changeExamples.length < 16) changeExamples.push({ loc: `${id}|${lvl}[${ti}]|${key}`, before: val.slice(0, 90), after: nv.slice(0, 90), eB, eA });
        return nv;
      };
      for (const f of FIELDS) if (typeof nt[f] === 'string') nt[f] = applyField(f, nt[f]);
      if (Array.isArray(nt.options)) nt.options = nt.options.map((o, oi) => applyField(`opt${oi}`, o));
      return nt;
    });
    if (lvlChanged) { (docUpdates[id] ||= {})[lvl] = newArr; }
  }
}

console.log('📊 ИТОГ ДРАЙ-РАНА');
console.log(`  полей изменено: ${fieldsChanged} · документов: ${Object.keys(docUpdates).length}`);
console.log(`  KaTeX-ошибок в изменённых полях: ${errBeforeTot} → ${errAfterTot}  (−${errBeforeTot - errAfterTot})`);
console.log(`  по правилам: ${JSON.stringify(tally)}`);
console.log(`  регрессий (пропущено): ${regressions}`);
if (regrExamples.length) { console.log('\n  ⚠ примеры регрессий (НЕ применены):'); regrExamples.forEach((r) => console.log(`    [${r.loc}] ${r.eB}→${r.eA}\n      ${JSON.stringify(r.before)}\n      ${JSON.stringify(r.after)}`)); }
console.log('\n  — примеры правок (до → после) —');
for (const e of changeExamples) console.log(`\n  [${e.loc}] err ${e.eB}→${e.eA}\n    ${JSON.stringify(e.before)}\n  → ${JSON.stringify(e.after)}`);

// отчёт
const md = ['# Шаг 2 — целевые render-фиксы skillTasks (dry-run)', '',
  `Полей изменено: **${fieldsChanged}** · документов: **${Object.keys(docUpdates).length}** · KaTeX-ошибок: **${errBeforeTot}→${errAfterTot}** · регрессий: **${regressions}**`,
  '', `Правила: ${JSON.stringify(tally)}`, '', '## Примеры', '', '| Локация | err | До | После |', '|---|--|---|---|'];
for (const e of changeExamples) md.push(`| \`${e.loc}\` | ${e.eB}→${e.eA} | \`${e.before.replace(/[\x00-\x1F]/g, (m) => '⟨' + m.charCodeAt(0) + '⟩').replace(/\|/g, '\\|')}\` | \`${e.after.replace(/\|/g, '\\|')}\` |`);
writeFileSync(resolve(__dirname, '../audit/skilltasks-fix-report.md'), md.join('\n'));
console.log('\n  отчёт → audit/skilltasks-fix-report.md');

if (!APPLY) { console.log('\n🔵 DRY-RUN: ничего не записано. Запусти с --apply.\n'); process.exit(0); }

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(__dirname, `../migration/backups/${ts}-skilltasks-render`);
mkdirSync(backupDir, { recursive: true });
writeFileSync(join(backupDir, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-skilltasks-render/skillTasks.json`);

let written = 0;
for (const [id, levels] of Object.entries(docUpdates)) {
  await db.collection('skillTasks').doc(id).update(levels);
  written++;
}
console.log(`\n✅ Обновлено документов: ${written} (полей: ${fieldsChanged}).\n`);
