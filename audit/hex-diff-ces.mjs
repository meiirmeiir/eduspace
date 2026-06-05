import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const d = await db.collection('dailyTasks').doc('complex_equation_solving').get();
const qs = (d.data().questions || d.data().tasks || []);
const hex = (s, n = 40) => Buffer.from(String(s), 'utf8').slice(0, n).toString('hex').replace(/(..)/g, '$1 ').trim();
const allBytes = (s) => { const b = Buffer.from(String(s), 'utf8'); const set = new Set(); for (const x of b) set.add(x); return [...set].sort((a, b2) => a - b2); };
// аномальные байты: всё, что НЕ валидный UTF-8 печатной кириллицы/латиницы/математики
function nonStd(s) {
  const out = [];
  for (const ch of String(s)) { const c = ch.codePointAt(0); if (c < 0x20 && c !== 0x0a && c !== 0x09) out.push('U+' + c.toString(16).padStart(4, '0')); if (c === 0xFFFD) out.push('FFFD'); if (c === 0x3F) out.push('?'); }
  return out;
}
console.log('банк complex_equation_solving · вопросов:', qs.length);
console.log('\n=== «сломанные» 8,9,10 vs «рабочие» 1–7 (1-based) ===');
for (const n of [1, 2, 3, 7, 8, 9, 10]) {
  const q = qs[n - 1]; if (!q) continue;
  const t = String(q.text || q.question || '');
  const tag = [8, 9, 10].includes(n) ? '⚠СЛОМАН?' : 'рабочий';
  console.log(`\n[q${n} ${tag}] len=${t.length}`);
  console.log(`  text: ${JSON.stringify(t.slice(0, 55))}`);
  console.log(`  hex40: ${hex(t)}`);
  console.log(`  спец-символы (ctrl/FFFD/?): ${nonStd(t).join(' ') || 'НЕТ'}`);
}
// различаются ли стартовые байты у 8/9/10 от 1?
console.log('\n=== вывод ===');
const start = (n) => Buffer.from(String(qs[n - 1].text || qs[n - 1].question || ''), 'utf8').slice(0, 12).toString('hex');
console.log('старт q1 :', start(1));
console.log('старт q8 :', start(8));
console.log('старт q9 :', start(9));
console.log('старт q10:', start(10));
process.exit(0);
