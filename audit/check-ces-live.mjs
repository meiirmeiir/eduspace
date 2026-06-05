import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const d = await db.collection('dailyTasks').doc('complex_equation_solving').get();
const data = d.data();
const qs = data.questions || data.tasks || [];
console.log('класс:', data.grade, '| вопросов:', qs.length);
const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g, CYR = /[а-яёА-ЯЁ]/;
let cyrInMath = 0, qmark = 0, fffd = 0;
qs.forEach((q, i) => {
  const fields = [q.text || q.question, q.explanation, ...(q.options || [])];
  for (const f of fields) {
    if (!f) continue;
    const s = String(f);
    for (const sp of s.match(MATHSPAN) || []) if (CYR.test(sp)) { cyrInMath++; console.log(`  q${i + 1}: кир. в $...$ →`, sp.slice(0, 70)); }
    if (/\?/.test(s)) { qmark++; console.log(`  q${i + 1}: символ '?' в поле →`, s.slice(0, 80)); }
    if (/�/.test(s)) { fffd++; console.log(`  q${i + 1}: U+FFFD →`, s.slice(0, 80)); }
  }
});
for (const n of [8, 9, 10]) {
  const q = qs[n - 1];
  console.log(`\nLIVE q${n}: ${JSON.stringify(q.text || q.question)}`);
  console.log(`   options: ${JSON.stringify(q.options)} | correct=${q.correct} | latex=${q.latex} | type=${q.type}`);
}
console.log(`\nитог по банку: кир-в-math=${cyrInMath}, символов '?'=${qmark}, U+FFFD=${fffd}`);
process.exit(0);
