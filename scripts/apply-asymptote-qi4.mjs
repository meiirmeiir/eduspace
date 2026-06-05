/**
 * apply-asymptote-qi4.mjs — точечная регенерация dailyTasks/asymptote_analysis.questions[4].
 * Было: «$x\arctan(x)$» (утёкшая, 11 кл). Стало: дробно-рациональная с РЕАЛЬНОЙ наклонной
 * асимптотой (числитель НЕ делится на знаменатель нацело): $f(x)=(x^2+3x+5)/(x+1)$ → y=x+2.
 *   node scripts/apply-asymptote-qi4.mjs            # DRY-RUN
 *   node scripts/apply-asymptote-qi4.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const QI = 4;

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const ref = db.collection('dailyTasks').doc('asymptote_analysis');
const cur = (await ref.get()).data();
const old = cur.questions[QI];

const next = {
  ...old,
  question: 'Найдите наклонную асимптоту графика функции $f(x) = \\dfrac{x^2 + 3x + 5}{x + 1}$ при $x \\to \\infty$.',
  options: ['$y = x + 2$', '$y = x + 3$', '$y = x - 2$', 'Наклонной асимптоты нет'],
  correct: 0,
  explanation: 'Степень числителя (2) на единицу больше степени знаменателя (1) — значит существует наклонная асимптота $y = kx + b$, равная частному от деления многочленов. Делим: $x^2 + 3x + 5 = (x+1)(x+2) + 3$, остаток равен $3 \\neq 0$ (числитель не делится на знаменатель нацело). Частное равно $x + 2$, поэтому наклонная асимптота: $y = x + 2$.',
};
delete next.text;

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · asymptote_analysis.questions[${QI}]`);
console.log('  было:  ', JSON.stringify(old.question || old.text).slice(0, 90), '| correct', old.correct);
console.log('  стало: ', next.question);
console.log('   options:', JSON.stringify(next.options), '| correct', next.correct, '=', next.options[next.correct]);
console.log('   поля сохранены:', Object.keys(next).join(','));
// само-проверка: остаток деления x^2+3x+5 на x+1
const f = (x) => (x * x + 3 * x + 5) / (x + 1), asy = (x) => x + 2;
const diff = Math.abs(f(1000) - asy(1000));
console.log(`   само-проверка: |f(1000)-(x+2)| = ${diff.toFixed(4)} → ${diff < 0.01 ? 'асимптота верна (y=x+2)' : 'ОШИБКА'}`);

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-asymptote-qi4`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'asymptote_analysis.json'), JSON.stringify(cur, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-asymptote-qi4/`);
cur.questions[QI] = next;
await ref.update({ questions: cur.questions, updatedAt: new Date().toISOString() });
console.log('\n✅ Задача qi4 заменена.\n');
