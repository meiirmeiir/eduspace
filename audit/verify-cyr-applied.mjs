import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const TEXTCMD = /\\(?:text|mathrm|operatorname|mbox)\s*\{[^{}]*\}/g;
const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const checks = [['circle_and_pi', 1], ['formula_calculation_application', 16], ['gcd_lcm_calculation', 3], ['last_digit', 2], ['statistical_probability_definition', 0], ['diagram_construction_complex', 29]];
let bareLeft = 0;
for (const [id, qi] of checks) {
  const d = await db.collection('dailyTasks').doc(id).get();
  const data = d.data();
  const arr = data.questions || data.tasks;
  const t = arr[qi].explanation || arr[qi].question || '';
  const spans = t.match(MATHSPAN) || [];
  const bare = spans.map((s) => s.replace(TEXTCMD, '')).filter((s) => /[а-яёА-ЯЁ]/.test(s));
  if (bare.length) bareLeft++;
  console.log(`[${id} q${qi}] голой кир. в math: ${bare.length} | ${t.slice(0, 95)}`);
}
console.log('\nитог: среди проверенных банков с остаточной голой кириллицей в math:', bareLeft);
process.exit(0);
