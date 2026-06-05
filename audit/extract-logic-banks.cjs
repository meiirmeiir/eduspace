// Выгружает выбранные банки skillTasks в per-bank файлы для логик-аудита (агент на банк).
const fs = require('fs');
const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
const byId = new Map(all.map((d) => [d.id, d]));
const PILOT = [
  'equation_root_verification', 'addition_method', 'physical_modeling', 'rational_modeling_tasks',
  'asymptote_analysis', 'axis_intersections', 'sphere_and_ball', 'linear_params_analysis',
  'func_composition', 'fsu_proofs', 'graphical_interpretation', 'exp_eq_methods',
  'trig_systems_complex', 'fractional_rational_construction', 'direct_prop_logic', 'calc_and_domain',
  'physics_applications_integral', 'poly_coefficients_theory', 'inv_trig_graphs', 'double_inequality_analysis',
];
fs.mkdirSync('audit/_st_logic', { recursive: true });
let total = 0;
const present = [];
for (const id of PILOT) {
  const d = byId.get(id);
  if (!d) { console.log('⚠ нет банка', id); continue; }
  const tasks = [];
  for (const lvl of ['a', 'b', 'c']) {
    if (!Array.isArray(d[lvl])) continue;
    d[lvl].forEach((t, ti) => {
      if (!t || typeof t !== 'object') return;
      tasks.push({ level: lvl, ti, id: t.id, text: t.text || t.question || '', options: t.options || [], correct: t.correct, explanation: t.explanation || '' });
    });
  }
  fs.writeFileSync(`audit/_st_logic/${id}.json`, JSON.stringify({ bank: id, grade: d.grade, skill_name: d.skill_name, tasks }, null, 1));
  present.push(id); total += tasks.length;
}
fs.writeFileSync('audit/_st_logic_banks.json', JSON.stringify(present));
console.log(`банков: ${present.length} · всего задач: ${total} · ср.${Math.round(total / present.length)}/банк`);
