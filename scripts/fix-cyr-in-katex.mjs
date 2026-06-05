/**
 * fix-cyr-in-katex.mjs — выносит кириллицу из LaTeX-математики $...$ в банках dailyTasks.
 *
 *   node scripts/fix-cyr-in-katex.mjs            # DRY-RUN (ничего не пишет)
 *   node scripts/fix-cyr-in-katex.mjs --apply    # backup + запись
 *
 * Причина: математические шрифты KaTeX не содержат кириллических глифов → «см» внутри $...$
 * рендерится как ????? на платформах без системного fallback. (CSS-фикс A уже маскирует это;
 * B — типографически правильная чистка данных.)
 *
 * Стратегия (консервативно, по каждому $-спану с кириллицей):
 *   1) Чистая единица со степенью:   $см^2$  → см²   ;  $м^3$ → м³  (степень = 1 цифра 0-9)
 *      Многозначная/сложная степень:  $см^{12}$ → см$^{12}$  (единица в текст, степень в math)
 *   2) Чистая единица без степени:   $см$ → см   ;  $кВт*ч$ → кВт·ч
 *   3) Кир. сокращение + матхвост:   $НОК(12,15)$ → НОК$(12,15)$   (кир. префикс в текст)
 *   АВТО только если после выноса в $...$ НЕ осталось кириллицы. Иначе — в manual-бакет
 *   (кир. индексы $S_{кольца}$, \text{кир}, смешанные выражения) — их правит человек/Workflow.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const CYR = /[а-яёА-ЯЁ]/;
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;

// Преобразовать ОДИН $...$-спан (со знаками $). Возврат {out, ok} — ok=false → в manual.
function fixSpan(span) {
  const dbl = span.startsWith('$$');
  const inner = dbl ? span.slice(2, -2) : span.slice(1, -1);
  const body = inner.trim();

  // 2) чистая единица без степени:  кВт*ч / см / м³(уже юникод)  — кириллица + опц. *ч и т.п.
  //    допускаем буквы, ·, *, пробелы, ° — без цифр/латинских матсимволов
  if (/^[а-яёА-ЯЁ]+(\s*[*·]\s*[а-яёА-ЯЁ]+)*$/.test(body)) {
    return { out: body.replace(/\s*\*\s*/g, '·'), ok: true };
  }
  // 1) единица со степенью:  см^2 | м^{3} | см^12
  let m = body.match(/^([а-яёА-ЯЁ]+)\s*\^\s*\{?\s*(\d+)\s*\}?$/);
  if (m) {
    const [, unit, pow] = m;
    if (pow.length === 1) return { out: unit + SUP[pow], ok: true };           // см² (юникод)
    return { out: `${unit}${dbl ? '$$' : '$'}^{${pow}}${dbl ? '$$' : '$'}`, ok: true }; // см$^{12}$
  }
  // 3) кириллический префикс + матхвост, где хвост без кириллицы:  НОК(12,15) | НОД(8,10)=2
  m = body.match(/^([А-ЯЁа-яё]+)\s*([([].*)$/);
  if (m && !CYR.test(m[2])) {
    const [, word, tail] = m;
    return { out: `${word}${dbl ? '$$' : '$'}${tail}${dbl ? '$$' : '$'}`, ok: true };
  }
  return { out: span, ok: false }; // не умеем безопасно → manual
}

function fixField(text) {
  if (!text || !CYR.test(text)) return null;
  let changed = false; const manual = [];
  const out = String(text).replace(MATHSPAN, (span) => {
    if (!CYR.test(span)) return span;
    const r = fixSpan(span);
    if (r.ok && r.out !== span) { changed = true; return r.out; }
    if (!r.ok) manual.push(span.slice(0, 80));
    return span;
  });
  if (!changed && !manual.length) return null;
  return { out, changed, manual };
}

// ── читаем live dailyTasks ──────────────────────────────────────────────────
const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю dailyTasks…\n`);
const snap = await db.collection('dailyTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const FIELDS = ['text', 'question', 'q', 'prompt', 'explanation'];
const edits = [];          // {id, qi, field, before, after}
const manualRows = [];     // {id, qi, field, span}

for (const [id, data] of Object.entries(docs)) {
  const qs = data.questions || data.tasks;
  if (!Array.isArray(qs)) continue;
  qs.forEach((q, qi) => {
    // обычные текстовые поля
    for (const f of FIELDS) {
      const r = fixField(q[f]);
      if (!r) continue;
      if (r.changed) edits.push({ id, qi, field: f, before: q[f], after: r.out });
      r.manual.forEach((s) => manualRows.push({ id, qi, field: f, span: s }));
    }
    // опции
    if (Array.isArray(q.options)) q.options.forEach((opt, oi) => {
      const r = fixField(opt);
      if (!r) return;
      if (r.changed) edits.push({ id, qi, field: `options[${oi}]`, before: opt, after: r.out });
      r.manual.forEach((s) => manualRows.push({ id, qi, field: `options[${oi}]`, span: s }));
    });
  });
}

console.log(`📊 АВТО-правок: ${edits.length} · ручных спанов: ${manualRows.length}\n`);
const clip = (s) => String(s).replace(/\n/g, '⏎').slice(0, 90);
console.log('— примеры АВТО (до → после) —');
for (const e of edits.slice(0, 20)) console.log(`  [${e.id} q${e.qi} ${e.field}]\n    ${clip(e.before)}\n  → ${clip(e.after)}`);

// отчёт
const md = ['# B (dry-run): вынос кириллицы из KaTeX-математики', '',
  `АВТО-правок: **${edits.length}** · в ручной бакет: **${manualRows.length}** спанов`, '',
  '## Авто-правки (до → после)', '', '| Банк | q# | Поле | До | После |', '|---|--|---|---|---|'];
for (const e of edits) md.push(`| \`${e.id}\` | ${e.qi} | ${e.field} | \`${clip(e.before)}\` | \`${clip(e.after)}\` |`);
md.push('', '## Ручной бакет (кир. индексы / \\text / смешанное — нужен человек/Workflow)', '',
  '| Банк | q# | Поле | Спан |', '|---|--|---|---|');
for (const r of manualRows) md.push(`| \`${r.id}\` | ${r.qi} | ${r.field} | \`${clip(r.span)}\` |`);
writeFileSync(resolve(__dirname, '../audit/cyr-in-katex-fix-report.md'), md.join('\n'));
writeFileSync(resolve(__dirname, '../audit/_cyr_fix_edits.json'), JSON.stringify(edits, null, 1));
console.log(`\n  отчёт → audit/cyr-in-katex-fix-report.md · полные правки → audit/_cyr_fix_edits.json`);

// ── валидация целостности на ПОЛНЫХ строках (не обрезанных) ──────────────────
let oddDollar = 0, lostCyr = 0;
for (const e of edits) {
  const da = (e.after.match(/\$/g) || []).length;
  const db = (e.before.match(/\$/g) || []).length;
  if (da % 2 !== 0) { oddDollar++; if (oddDollar <= 5) console.log('  ⚠ нечётный $ в after:', clip(e.after)); }
  // потеря кириллицы недопустима (мы только переносим, не удаляем)
  const cb = (e.before.match(/[а-яёА-ЯЁ]/g) || []).length;
  const ca = (e.after.match(/[а-яёА-ЯЁ]/g) || []).length;
  if (ca !== cb) { lostCyr++; if (lostCyr <= 5) console.log('  ⚠ изменилось число кир. букв:', clip(e.before), '→', clip(e.after)); }
}
console.log(`\n  ✓ валидация: нечётный $ — ${oddDollar} · изменение числа кир.букв — ${lostCyr} (оба должны быть 0)`);

if (!APPLY) { console.log('\n🔵 DRY-RUN: ничего не записано. Запусти с --apply.\n'); process.exit(0); }

// ── APPLY: backup + запись ──────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(__dirname, `../migration/backups/${ts}-cyr-in-katex`);
mkdirSync(backupDir, { recursive: true });
writeFileSync(join(backupDir, 'dailyTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-cyr-in-katex/dailyTasks.json`);

// сгруппировать правки по документу и записать целиком обновлённый questions-массив
const byDoc = {};
for (const e of edits) (byDoc[e.id] ||= []).push(e);
let written = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  const qs = data.questions ? 'questions' : 'tasks';
  const arr = data[qs];
  for (const e of list) {
    const q = arr[e.qi];
    const om = e.field.match(/^options\[(\d+)\]$/);
    if (om) q.options[Number(om[1])] = e.after;
    else q[e.field] = e.after;
  }
  await db.collection('dailyTasks').doc(id).update({ [qs]: arr });
  written++;
}
console.log(`\n✅ Обновлено документов: ${written} (правок: ${edits.length}).\n`);
