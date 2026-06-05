import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const snap = await db.collection('questions').get();
const all = [];
snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
writeFileSync('audit/_questions_live.json', JSON.stringify(all, null, 1));
console.log('живых questions:', all.length);

const re = /complex_equation|complex.?equation|сложн.*уравнен/i;
const hits = all.filter((q) => re.test(JSON.stringify([q.topic, q.skillNames, q.skillId, q.sectionId, q.sectionName])));
console.log('по complex_equation:', hits.length);
// показать какие вообще topic/skill встречаются с "equation"
const eqTopics = new Set();
all.forEach((q) => { const t = (q.topic || '') + '|' + JSON.stringify(q.skillNames || ''); if (/equation|уравн/i.test(t)) eqTopics.add((q.topic || '') + ' :: ' + JSON.stringify(q.skillNames || [])); });
console.log('\ntopic/skill с "equation/уравн" (до 25):');
[...eqTopics].slice(0, 25).forEach((t) => console.log('  ' + t.slice(0, 100)));
for (const h of hits.slice(0, 12)) console.log(`\n[${h.id}] type=${h.type} latex=${h.latex} topic=${h.topic}\n  text: ${JSON.stringify(h.text || h.question).slice(0, 160)}`);
process.exit(0);
