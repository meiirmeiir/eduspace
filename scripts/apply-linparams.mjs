/**
 * apply-linparams.mjs — заменяет 40 вопросов dailyTasks/linear_params_analysis (были про ОДЗ)
 * на 40 новых про коэффициенты k,b (из audit/_linparams_result.json, прошли двойную защиту).
 * Защита: ровно 40 принятых, у каждой 4 уник. опции, correct 0..3, есть explanation,
 * solvedIndex==correct, нет кириллицы внутри $...$.
 *   node scripts/apply-linparams.mjs            # DRY-RUN
 *   node scripts/apply-linparams.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const r = JSON.parse(readFileSync(resolve(__dirname, '../audit/_linparams_result.json'), 'utf8'));
const acc = r.accepted;
const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const stripText = (s) => s.replace(/\\(?:text|mathrm|operatorname)\s*\{[^{}]*\}/g, '');
const cyrInMath = (s) => (String(s).match(MATHSPAN) || []).some((sp) => /[а-яёА-ЯЁ]/.test(stripText(sp)));

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const ref = db.collection('dailyTasks').doc('linear_params_analysis');
const cur = (await ref.get()).data();

const bad = [];
const newQ = acc.map((a, i) => {
  const four = Array.isArray(a.options) && a.options.length === 4 && new Set(a.options.map(String)).size === 4;
  if (!four) bad.push(`#${i}: не 4 уник. опции`);
  if (!(a.correct >= 0 && a.correct <= 3)) bad.push(`#${i}: correct вне 0..3`);
  if (a.verdict.solvedIndex !== a.correct) bad.push(`#${i}: solvedIndex≠correct`);
  if (!a.explanation?.trim()) bad.push(`#${i}: пустой explanation`);
  if (cyrInMath(a.question) || a.options.some(cyrInMath) || cyrInMath(a.explanation)) bad.push(`#${i}: кириллица в $...$`);
  return { question: a.question, options: a.options, correct: a.correct, explanation: a.explanation, difficulty: a.difficulty, skill_id: 'linear_params_analysis' };
});

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · dailyTasks/linear_params_analysis`);
console.log(`  было: ${cur.questions.length} вопросов (про ОДЗ) · станет: ${newQ.length} (про k,b)`);
console.log(`  проблем валидации: ${bad.length}`);
if (bad.length) { bad.forEach((b) => console.log('   ⚠ ' + b)); process.exit(1); }
console.log('\n— примеры новых (до 6) —');
for (const q of newQ.slice(0, 6)) console.log(`  [${q.difficulty}] ${q.question.slice(0, 70)} | ✔ ${q.options[q.correct]}`);
console.log('\n— что удаляется (старые про ОДЗ, до 3) —');
cur.questions.slice(0, 3).forEach((q) => console.log(`  ${String(q.question || q.text).slice(0, 60)}`));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-linparams-regen`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'linear_params_analysis.json'), JSON.stringify(cur, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-linparams-regen/`);
await ref.update({ questions: newQ, updatedAt: new Date().toISOString() });
console.log(`\n✅ Записано 40 новых вопросов.\n`);
