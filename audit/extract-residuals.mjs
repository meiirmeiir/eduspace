/**
 * extract-residuals.mjs — собирает live-данные для трёх групп остаточных правок.
 * Группа A: skillTasks manual (5 rewrite из _baserw_manual + 1 render fsu_proofs).
 * Группа B: dailyTasks 73 строки manual-rewrite-needed.md (нумерация 1-based → live idx = №-1).
 * Группа C: questions 11 non-gen (logic-audit) + 4 gen (4JtCs/QMZ7/cvCKIu/qqac).
 * Пишет audit/_resid_A.json, _resid_B.json, _resid_C.json (+ чанки в _resid_*_chunks).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(__dirname, p);
initializeApp({ credential: cert(JSON.parse(readFileSync(R('../scripts/service-account.json'), 'utf8'))) });
const db = getFirestore();

function chunkify(name, cases, size = 5) {
  const dir = R(`_resid_${name}_chunks`); mkdirSync(dir, { recursive: true });
  let n = 0;
  for (let i = 0; i < cases.length; i += size) { writeFileSync(join(dir, `chunk_${n}.json`), JSON.stringify(cases.slice(i, i + size), null, 1)); n++; }
  writeFileSync(R(`_resid_${name}.json`), JSON.stringify(cases, null, 1));
  return n;
}

// ---------- Группа A: skillTasks ----------
const stSnap = await db.collection('skillTasks').get();
const stDocs = {}; stSnap.forEach((d) => { stDocs[d.id] = d.data(); });
const baseManual = JSON.parse(readFileSync(R('_baserw_manual.json'), 'utf8'));
const renderManual = JSON.parse(readFileSync(R('_render_manual.json'), 'utf8'));
const A = [];
for (const m of baseManual) {
  const t = stDocs[m.bank]?.[m.level]?.[m.ti];
  if (!t) continue;
  A.push({ idx: A.length, group: 'A', kind: 'rewrite', coll: 'skillTasks', bank: m.bank, level: m.level, ti: m.ti,
    live: { text: t.text, options: t.options, correct: t.correct, explanation: t.explanation },
    priorAfter: m.after, priorVerdict: m.verdict, note: m.note });
}
for (const m of renderManual) {
  const t = stDocs[m.bank]?.[m.level]?.[m.ti];
  if (!t) continue;
  const om = (m.field || '').match(/^opt(\d+)$/);
  const liveVal = om ? t.options?.[Number(om[1])] : t[m.field];
  A.push({ idx: A.length, group: 'A', kind: 'render', coll: 'skillTasks', bank: m.bank, level: m.level, ti: m.ti, field: m.field,
    live: { text: t.text, options: t.options, correct: t.correct, explanation: t.explanation }, liveVal: String(liveVal),
    before: m.before, priorAfter: m.after, note: 'render: привести LaTeX к 0 KaTeX-ошибок' });
}
const aN = chunkify('A', A, 3);

// ---------- Группа B: dailyTasks ----------
const md = readFileSync(R('manual-rewrite-needed.md'), 'utf8').split('\n');
const rows = [];
for (const line of md) {
  const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|/);
  if (!m) continue;
  const cells = line.split('|').map((c) => c.trim());
  rows.push({ skill: m[1], num: Number(m[2]), curCorrect: cells[3], solution: cells[4] || '', note: cells[5] || '', reason: cells[6] || '' });
}
const dtIds = [...new Set(rows.map((r) => r.skill))];
const dtDocs = {};
await Promise.all(dtIds.map(async (id) => { const s = await db.collection('dailyTasks').doc(id).get(); if (s.exists) dtDocs[id] = s.data(); }));
const cat = (reason) => {
  const r = reason.toLowerCase();
  if (/непровер|рисун|чертёж|чертеж|диаграмм/.test(r)) return 'drawing';
  if (/дубл/.test(r)) return 'dedup';
  if (/конфликт/.test(r)) return 'keyfix';
  return 'rewrite';
};
const B = [];
for (const r of rows) {
  const qs = dtDocs[r.skill]?.questions;
  const live = qs?.[r.num - 1]; // 1-based → 0-based
  if (!live) { B.push({ idx: B.length, group: 'B', coll: 'dailyTasks', skill: r.skill, num: r.num, missing: true, note: r.note, reason: r.reason }); continue; }
  B.push({ idx: B.length, group: 'B', coll: 'dailyTasks', skill: r.skill, num: r.num, liveIdx: r.num - 1, category: cat(r.reason),
    live: { question: live.question, options: live.options, correct: live.correct, explanation: live.explanation, difficulty: live.difficulty },
    auditNote: r.note.slice(0, 200), reason: r.reason, auditSolution: r.solution.slice(0, 120) });
}
const bN = chunkify('B', B, 5);

// ---------- Группа C: questions ----------
const qLive = JSON.parse(readFileSync(R('_questions_live.json'), 'utf8'));
const qArr = Array.isArray(qLive) ? qLive : Object.values(qLive);
const qById = new Map(qArr.map((q) => [q.id, q]));
const nonGen = ['2tbFDirEN2rZbDRLLRrx', 'LxqpdYusguZi4lVjk2Ru', 'QgFiVHW6NuWS4NM6xQIL', 'VlzEhdxequb66E8cZUeQ', 'fwTcJlaLypT2kY7oHTW5', 'hNmmfWOySNW9Fabq9MYv', 'gX4SvL26uxxyo6xTkDD4', 'PT5hykDLvxsJsntmxJT6', 'zcFerL23GiCnIMBT8dKW'];
const gen = ['4JtCsVoPFyoP1kKCcuT0', 'QMZ7Graqw3JpXHAgUnhY', 'cvCKIu8C7RQlsgaYOPCa', 'qqacMdM7wwZZoRlCVsH8'];
const C = [];
for (const id of [...nonGen, ...gen]) {
  const q = qById.get(id);
  if (!q) { C.push({ idx: C.length, group: 'C', id, missing: true }); continue; }
  const base = { idx: C.length, group: 'C', coll: 'questions', id, qtype: q.type, topic: q.topic, text: q.text };
  if (q.type === 'compound') base.subQuestions = q.subQuestions;
  else if (q.type === 'generated') { base.variables = q.variables; base.derivedVars = q.derivedVars; base.answerFormula = q.answerFormula; base.wrongFormulas = q.wrongFormulas; }
  else { base.options = q.options; base.correct = q.correct; }
  C.push(base);
}
const cN = chunkify('C', C, 4);

console.log(`Группа A (skillTasks): ${A.length} кейсов · ${aN} чанков`);
console.log(`  rewrite: ${A.filter((x) => x.kind === 'rewrite').length} · render: ${A.filter((x) => x.kind === 'render').length}`);
console.log(`Группа B (dailyTasks): ${B.length} кейсов · ${bN} чанков (1-based→0-based)`);
const byCat = {}; for (const b of B) byCat[b.category || 'missing'] = (byCat[b.category || 'missing'] || 0) + 1;
console.log('  по категориям:', JSON.stringify(byCat));
console.log(`Группа C (questions): ${C.length} кейсов · ${cN} чанков`);
console.log(`  non-gen: ${C.filter((x) => x.qtype && x.qtype !== 'generated').length} · gen: ${C.filter((x) => x.qtype === 'generated').length} · missing: ${C.filter((x) => x.missing).length}`);
process.exit(0);
