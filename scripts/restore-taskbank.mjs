/**
 * restore-taskbank.mjs — восстанавливает кириллицу в 3 испорченных банках taskBank
 * (complex_equation_solving, sequence_generation, mixed_improper_logic) из seed-файла
 * audit/tasks_grade_5.json (чистая версия).
 *
 * Сопоставление: по task_id + ВЕРИФИКАЦИЯ математического якоря ($...$) — math в taskBank
 * цел и должен совпадать с seed. Восстанавливаем ТОЛЬКО испорченные текстовые поля
 * (question_text, explanation, skills_tested) из seed; options/correct_index/type — сверяем.
 * Защита: применяем задачу ТОЛЬКО если (1) seed найден по task_id, (2) якорь совпал дословно,
 * (3) options совпали, (4) seed-поля без `?`-порчи.
 *
 *   node scripts/restore-taskbank.mjs            # DRY-RUN
 *   node scripts/restore-taskbank.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
// --tier2: восстановить ТОЛЬКО question_text + skills_tested (кириллица, без ответа) для
// задач, где якорь+опции совпали, но correct разошёлся; explanation НЕ трогаем (на регенерацию).
const TIER2 = process.argv.includes('--tier2');
const BANKS = ['complex_equation_solving', 'sequence_generation', 'mixed_improper_logic'];

const seed = JSON.parse(readFileSync(resolve(__dirname, '../audit/tasks_grade_5.json'), 'utf8'));
const seedById = new Map();
for (const t of seed) { const id = t.task_id || t.id; if (id) seedById.set(id, t); }

const anchor = (s) => (String(s || '').match(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g) || []).map((x) => x.replace(/\s+/g, '')).join('|');
const hasQ = (s) => /\?{2,}/.test(String(s || ''));
const TEXT_FIELDS = ['question_text', 'explanation'];

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю taskBank…\n`);
const docs = {};
for (const b of BANKS) { const d = await db.collection('taskBank').doc(b).get(); if (d.exists) docs[b] = d.data(); }

const apply = [], skip = [];
for (const [bank, data] of Object.entries(docs)) {
  const tasks = data.tasks || [];
  tasks.forEach((t, ti) => {
    const id = t.task_id || t.id;
    const s = seedById.get(id);
    const tag = `${bank}[${ti}] ${id}`;
    if (!s) { skip.push({ tag, why: 'нет в seed по task_id' }); return; }
    const sText = s.text ?? s.question_text;   // seed использует поле `text`
    // верификация якоря (математика $...$ должна совпасть дословно)
    if (anchor(t.question_text) !== anchor(sText)) { skip.push({ tag, why: `якорь не совпал: tb=${anchor(t.question_text)} seed=${anchor(sText)}` }); return; }
    // верификация options
    if (JSON.stringify(t.options) !== JSON.stringify(s.options)) { skip.push({ tag, why: 'options не совпали' }); return; }
    // seed-поля чисты
    if (hasQ(sText) || (s.skills_tested || []).some(hasQ)) { skip.push({ tag, why: 'seed question/skills тоже с ?' }); return; }
    // верификация верного ответа (taskBank.correct_index == seed.correct)
    const tCorr = t.correct_index ?? t.correct, sCorr = s.correct ?? s.correct_index;
    if (tCorr !== sCorr) {
      // ответ расходится → в TIER2 восстанавливаем только question_text + skills_tested (без explanation)
      if (TIER2) { apply.push({ bank, ti, id, partial: true, before: { qt: t.question_text }, after: { qt: sText, skills: s.skills_tested } }); }
      else skip.push({ tag, why: `correct разошёлся (tb=${tCorr} seed=${sCorr}) → нужен --tier2 (question+skills) или регенерация explanation` });
      return;
    }
    if (hasQ(s.explanation)) { skip.push({ tag, why: 'seed.explanation тоже с ?' }); return; }
    apply.push({ bank, ti, id, before: { qt: t.question_text, expl: t.explanation, skills: t.skills_tested }, after: { qt: sText, expl: s.explanation, skills: s.skills_tested } });
  });
}

console.log(`📊 к восстановлению: ${apply.length} задач · пропуск: ${skip.length}\n`);
for (const a of apply) {
  console.log(`\n[${a.bank} task${a.ti} ${a.id}]`);
  console.log(`  было:  ${String(a.before.qt).slice(0, 70)}`);
  console.log(`  стало: ${String(a.after.qt).slice(0, 70)}`);
  console.log(`  expl:  ${String(a.after.expl).slice(0, 60)}`);
}
if (skip.length) { console.log('\n— пропущено —'); skip.forEach((s) => console.log(`  [${s.tag}] ${s.why}`)); }

if (!APPLY) { console.log('\n🔵 DRY-RUN: ничего не записано.\n'); process.exit(0); }

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-taskbank-restore`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'taskBank.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-taskbank-restore/taskBank.json`);
let w = 0;
for (const bank of BANKS) {
  const list = apply.filter((a) => a.bank === bank);
  if (!list.length) continue;
  const data = docs[bank];
  for (const a of list) { data.tasks[a.ti].question_text = a.after.qt; if (a.after.expl !== undefined) data.tasks[a.ti].explanation = a.after.expl; if (a.after.skills) data.tasks[a.ti].skills_tested = a.after.skills; }
  await db.collection('taskBank').doc(bank).update({ tasks: data.tasks });
  w++;
}
console.log(`\n✅ Обновлено документов: ${w} (задач восстановлено: ${apply.length}).\n`);
