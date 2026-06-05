/**
 * gen-eval.mjs — READ-ONLY помощник для аудита generated-вопросов.
 * Для каждого id N раз прогоняет НАСТОЯЩИЙ generateQuestion (mathUtils.js):
 * получает {vars, резолвнутый текст, answer (=options[correct]), options}.
 * Агент потом сам решает текст и сверяет с answer.
 * Также флагит механические дефекты: NaN/пустой ответ, схлопывание дистракторов (<4 опций).
 *
 *   node audit/gen-eval.mjs '["id1","id2",...]'   (или один id строкой)
 */
import { generateQuestion } from '../src/lib/mathUtils.js';
import { readFileSync } from 'fs';

const all = JSON.parse(readFileSync('audit/_questions_all.json', 'utf8'));
const byId = new Map(all.map((q) => [q.id, q]));

// argv: JSON-массив id, ОДИН id строкой, ИЛИ число = индекс чанка в audit/_gen_chunks.json
let ids;
const arg = process.argv[2];
if (/^\d+$/.test(arg)) {
  const chunks = JSON.parse(readFileSync('audit/_gen_chunks.json', 'utf8'));
  ids = chunks[Number(arg)] || [];
} else {
  try { ids = JSON.parse(arg); if (!Array.isArray(ids)) ids = [ids]; }
  catch { ids = [arg]; }
}

const N = 6;
const bad = (a) => a === undefined || a === null || a === '' || /NaN|Infinity|undefined/i.test(String(a));

const out = [];
for (const id of ids) {
  const q = byId.get(id);
  if (!q) { out.push({ id, error: 'not found' }); continue; }
  const runs = [];
  let badAnswer = false, shortOptions = false;
  for (let i = 0; i < N; i++) {
    let g;
    try { g = generateQuestion(q); } catch (e) { runs.push({ error: e.message }); badAnswer = true; continue; }
    const ans = g.options ? g.options[g.correct] : g.answer;
    if (bad(ans)) badAnswer = true;
    if (!g.options || g.options.length < 4) shortOptions = true;
    runs.push({ vars: g._vars, text: g.text, answer: ans, options: g.options });
  }
  out.push({
    id, topic: q.topic, template: q.text, answerFormula: q.answerFormula,
    wrongFormulas: q.wrongFormulas, answerDisplay: q.answerDisplay,
    flags: { badAnswer, shortOptions }, runs,
  });
}
console.log(JSON.stringify(out, null, 1));
