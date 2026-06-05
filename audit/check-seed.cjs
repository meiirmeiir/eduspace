const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('audit/tasks_grade_5.json', 'utf8'));
// структура seed?
console.log('тип seed:', Array.isArray(seed) ? 'array len ' + seed.length : 'object keys: ' + Object.keys(seed).slice(0, 10).join(','));
// найти complex_eq_std_1
const BANKS = ['complex_equation_solving', 'mixed_improper_logic', 'sequence_generation'];
const anchorKey = (s) => (String(s || '').match(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g) || []).map((x) => x.replace(/\s+/g, '')).join('|');

// собрать все задачи из seed (рекурсивно ищем объекты с task_id/question_text)
const allTasks = [];
const walk = (o, bank) => {
  if (Array.isArray(o)) o.forEach((x) => walk(x, bank));
  else if (o && typeof o === 'object') {
    if (o.task_id || (o.question_text && o.options)) allTasks.push({ ...o, _bank: bank });
    for (const [k, v] of Object.entries(o)) walk(v, BANKS.includes(k) ? k : (o.skill_id && BANKS.includes(o.skill_id) ? o.skill_id : bank));
  }
};
// seed может быть {skill_id: {tasks:[...]}} или массив банков
walk(seed, null);
console.log('всего задач в seed:', allTasks.length);
const std1 = allTasks.find((t) => t.task_id === 'complex_eq_std_1' || t.id === 'complex_eq_std_1');
console.log('\ncomplex_eq_std_1 в seed:', std1 ? 'НАЙДЕН' : 'нет');
if (std1) {
  console.log('  question_text:', JSON.stringify(std1.question_text || std1.text).slice(0, 90));
  console.log('  options:', JSON.stringify(std1.options), '| correct_index:', std1.correct_index ?? std1.correct);
  console.log('  skills_tested:', JSON.stringify(std1.skills_tested || []).slice(0, 80));
}
// сопоставление по якорю для каждого банка vs taskBank? просто покажем якоря seed по банкам
const byBank = {};
for (const t of allTasks) { const b = t._bank || t.skill_id; if (BANKS.includes(b)) (byBank[b] ||= []).push(t); }
console.log('\nзадач seed по 3 банкам:');
for (const b of BANKS) console.log(`  ${b}: ${(byBank[b] || []).length} · task_id: ${(byBank[b] || []).map((t) => t.task_id || t.id).join(',')}`);
