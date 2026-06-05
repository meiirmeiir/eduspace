import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Порча: кириллица заменена на ? → признаки: руны ?{2,}, либо «слова» из ? ( \?+ ), либо
// одиночный ? вместо буквы внутри слова (буква?буква). Считаем поле corrupt при любом.
// Точный детектор: порча кириллица→? даёт РУНЫ ?{2,} (каждое слово = ряд ?).
// Легитимные ? (конец вопроса) — одиночные, рунами не считаются.
const RUN = /\?{2,}/;
const isCorrupt = (s) => typeof s === 'string' && RUN.test(s);
const qCount = (s) => (String(s).match(/\?/g) || []).length;

const snap = await db.collection('taskBank').get();
const rows = [];     // {doc, taskIdx, taskId, field, qmarks, sample}
const docsCorrupt = new Set();
let totalTasks = 0;

snap.forEach((d) => {
  const data = d.data();
  const tasks = data.tasks || data.questions || [];
  tasks.forEach((t, ti) => {
    totalTasks++;
    if (!t || typeof t !== 'object') return;
    const fields = { question_text: t.question_text || t.text || t.question, explanation: t.explanation };
    (t.options || []).forEach((o, oi) => { fields['options[' + oi + ']'] = o; });
    (t.skills_tested || []).forEach((s, si) => { fields['skills_tested[' + si + ']'] = s; });
    for (const [fname, fval] of Object.entries(fields)) {
      if (isCorrupt(fval)) {
        docsCorrupt.add(d.id);
        rows.push({ doc: d.id, taskIdx: ti, taskId: t.task_id || t.id || '', field: fname, qmarks: qCount(fval), sample: String(fval).slice(0, 70) });
      }
    }
  });
});

console.log(`taskBank: ${snap.size} документов · ${totalTasks} задач`);
console.log(`документов с порчей: ${docsCorrupt.size}`);
console.log(`испорченных полей: ${rows.length}`);
const byDoc = {};
for (const r of rows) byDoc[r.doc] = (byDoc[r.doc] || 0) + 1;
console.log('\nпо документам:');
Object.entries(byDoc).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`  ${String(n).padStart(3)}  ${d}`));

// отчёт
const md = ['# taskBank — порча кириллицы (литеральные `?` / U+003F)', '',
  `Скан всех **${snap.size}** документов коллекции \`taskBank\` (${totalTasks} задач). Кириллица заменена на литеральные \`?\` (U+003F) — порча кодировки при импорте; математика \`$...$\`, числа и латиница целы.`, '',
  `- **Документов с порчей: ${docsCorrupt.size}**`,
  `- **Испорченных полей: ${rows.length}**`, '',
  '## Документы с порчей', '', '| taskBank doc | испорч. полей |', '|---|--:|'];
Object.entries(byDoc).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => md.push(`| \`${d}\` | ${n} |`));
md.push('', '## Все испорченные поля', '', '| Документ | task# | task_id | Поле | `?` | Фрагмент |', '|---|--:|---|---|--:|---|');
for (const r of rows) md.push(`| \`${r.doc}\` | ${r.taskIdx} | ${r.taskId} | ${r.field} | ${r.qmarks} | \`${r.sample.replace(/\|/g, '\\|')}\` |`);
writeFileSync('audit/taskbank-corruption.md', md.join('\n'));
writeFileSync('audit/_taskbank_corruption.json', JSON.stringify({ docsCorrupt: [...docsCorrupt], rows }, null, 1));
console.log('\nотчёт → audit/taskbank-corruption.md');
process.exit(0);
