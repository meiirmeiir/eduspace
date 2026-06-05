const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const piloted = new Set(JSON.parse(fs.readFileSync('audit/_st_logic_banks.json', 'utf8')));
const ADV = /тригонометр|логарифм|показательн|производн|интеграл|комплексн|стереометр|асимптот|предел|первообразн|дифференц|экстремум|касательн|вектор|окружност|сфер|конус|пирамид|эллипс|гипербол|парабол|прогресс|последовательн|иррационал|степен|радикал|многочлен|рациональн|неравенств|синус|косинус|тангенс/i;
const gradeNum = (g) => { const m = String(g || '').match(/(\d+)/); return m ? +m[1] : 0; };

const selected = [];
for (const d of all) {
  if (piloted.has(d.id)) continue;
  const g = gradeNum(d.grade);
  const name = (d.skill_name || '') + ' ' + (d.id || '');
  const tasks = ['a', 'b', 'c'].reduce((s, l) => s + (Array.isArray(d[l]) ? d[l].length : 0), 0);
  const advanced = g >= 9 || (g >= 8 && ADV.test(name)) || ADV.test(name);
  if (advanced && tasks > 0) selected.push({ id: d.id, grade: d.grade, g, name: d.skill_name, tasks });
}
// приоритет: выше класс + больше задач; ограничим разумным числом
selected.sort((a, b) => (b.g - a.g) || (b.tasks - a.tasks));
const LIMIT = 80;
const pick = selected.slice(0, LIMIT);
fs.writeFileSync('audit/_st_adv_banks.json', JSON.stringify(pick.map((x) => x.id)));
console.log(`кандидатов(продвинутых, не пилот): ${selected.length} · берём: ${pick.length}`);
const byGrade = {};
for (const p of pick) byGrade[p.g] = (byGrade[p.g] || 0) + 1;
console.log('по классам:', JSON.stringify(byGrade));
console.log('всего задач:', pick.reduce((s, p) => s + p.tasks, 0));
