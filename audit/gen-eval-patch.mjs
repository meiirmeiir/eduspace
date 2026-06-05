/**
 * gen-eval-patch.mjs — READ-ONLY: применяет патч полей к generated-вопросу и прогоняет
 * НАСТОЯЩИЙ generateQuestion N раз. Для валидации предложенного фикса.
 *   node audit/gen-eval-patch.mjs <id> '<patchJsonString>'
 * patch может содержать: variables, derivedVars, answerFormula, wrongFormulas, text, answerDisplay.
 */
import { generateQuestion } from '../src/lib/mathUtils.js';
import { readFileSync } from 'fs';

const all = JSON.parse(readFileSync('audit/_questions_all.json', 'utf8'));
const byId = new Map(all.map((q) => [q.id, q]));

const id = process.argv[2];
let patch = {};
try { patch = JSON.parse(process.argv[3] || '{}'); } catch (e) { console.log(JSON.stringify({ error: 'bad patch JSON: ' + e.message })); process.exit(0); }

const base = byId.get(id);
if (!base) { console.log(JSON.stringify({ error: 'id not found' })); process.exit(0); }

const q = { ...base, ...patch };
const N = 8;
const bad = (a) => a === undefined || a === null || a === '' || /NaN|Infinity|undefined/i.test(String(a)) || /[{}]/.test(String(a)) || /Math\.|[a-zA-Z]\(/.test(String(a));
const runs = [];
let anyBad = false, anyShort = false;
for (let i = 0; i < N; i++) {
  let g;
  try { g = generateQuestion(q); } catch (e) { runs.push({ error: e.message }); anyBad = true; continue; }
  const ans = g.options ? g.options[g.correct] : g.answer;
  const rawOptStr = (g.options || []).some((o) => /[{}]|Math\.|undefined|NaN/i.test(String(o)));
  if (bad(ans) || rawOptStr) anyBad = true;
  if (!g.options || g.options.length < 4) anyShort = true;
  runs.push({ vars: g._vars, text: g.text, answer: ans, options: g.options });
}
console.log(JSON.stringify({ id, patchApplied: Object.keys(patch), flags: { anyBad, anyShort }, template: q.text, answerFormula: q.answerFormula, wrongFormulas: q.wrongFormulas, variables: q.variables, derivedVars: q.derivedVars, runs }, null, 1));
