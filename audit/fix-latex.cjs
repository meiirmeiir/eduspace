#!/usr/bin/env node
/**
 * Reads tasks-export-raw.json (Playwright output, JSON-encoded JSON),
 * splits per-grade into audit/tasks_grade_N.json, then runs the LaTeX
 * autofix on text / options / explanation across all tasks.
 *
 * Replacements (only when the LaTeX command is missing its leading backslash):
 *   Rightarrow → \Rightarrow
 *   Leftarrow  → \Leftarrow
 *   rightarrow → \rightarrow
 *   leq        → \leq
 *   geq        → \geq
 *   neq        → \neq
 *   infty      → \infty
 *
 * To avoid corrupting unrelated words ("sleq", "neglect", etc.) we
 * require:
 *   - a preceding boundary that is NOT a letter or a backslash;
 *   - a trailing boundary that is NOT a letter.
 * This catches LaTeX usage like "x leq 5" while leaving prose alone.
 */

const fs = require('fs');
const path = require('path');

const AUDIT_DIR = __dirname;
const RAW_FILE = path.join(AUDIT_DIR, '..', 'tasks-export-raw.json');

// 1. Decode (Playwright wraps the eval return in JSON-encoded string)
const raw = fs.readFileSync(RAW_FILE, 'utf8');
const decoded = JSON.parse(raw); // outer string
const payload = JSON.parse(decoded); // inner JSON
console.log('Diagnostics:', payload.diagnostics);
console.log('Per-grade counts:', payload.perGrade);

// 2. LaTeX replacement patterns.
// (?<![A-Za-z\\]) — left guard: not a letter, not a backslash
// (?![A-Za-z])   — right guard: not a letter
const PATTERNS = [
  { name: 'Rightarrow', re: /(?<![A-Za-z\\])Rightarrow(?![A-Za-z])/g, to: '\\Rightarrow' },
  { name: 'Leftarrow',  re: /(?<![A-Za-z\\])Leftarrow(?![A-Za-z])/g,  to: '\\Leftarrow' },
  { name: 'rightarrow', re: /(?<![A-Za-z\\])rightarrow(?![A-Za-z])/g, to: '\\rightarrow' },
  { name: 'leq',        re: /(?<![A-Za-z\\])leq(?![A-Za-z])/g,        to: '\\leq' },
  { name: 'geq',        re: /(?<![A-Za-z\\])geq(?![A-Za-z])/g,        to: '\\geq' },
  { name: 'neq',        re: /(?<![A-Za-z\\])neq(?![A-Za-z])/g,        to: '\\neq' },
  { name: 'infty',      re: /(?<![A-Za-z\\])infty(?![A-Za-z])/g,      to: '\\infty' },
];

function fixString(s, counters) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const p of PATTERNS) {
    out = out.replace(p.re, () => {
      counters[p.name] = (counters[p.name] || 0) + 1;
      return p.to;
    });
  }
  return out;
}

function fixTask(t, counters) {
  if (typeof t.text === 'string') t.text = fixString(t.text, counters);
  if (typeof t.explanation === 'string') t.explanation = fixString(t.explanation, counters);
  if (Array.isArray(t.options)) t.options = t.options.map(o => typeof o === 'string' ? fixString(o, counters) : o);
  // Compound — recurse into subQuestions
  if (Array.isArray(t.subQuestions)) {
    for (const sq of t.subQuestions) {
      if (typeof sq.text === 'string') sq.text = fixString(sq.text, counters);
      if (typeof sq.explanation === 'string') sq.explanation = fixString(sq.explanation, counters);
      if (Array.isArray(sq.options)) sq.options = sq.options.map(o => typeof o === 'string' ? fixString(o, counters) : o);
    }
  }
  return t;
}

// 3. Iterate per-grade, write files, log stats
const grandTotal = {};
const fileStats = [];
for (const grade of Object.keys(payload.data).sort()) {
  const tasks = payload.data[grade];
  const counters = {};
  const fixed = tasks.map(t => fixTask({ ...t }, counters));
  const filename = path.join(AUDIT_DIR, `tasks_grade_${grade}.json`);
  fs.writeFileSync(filename, JSON.stringify(fixed, null, 2));
  const totalReplacements = Object.values(counters).reduce((s, n) => s + n, 0);
  for (const [k, v] of Object.entries(counters)) grandTotal[k] = (grandTotal[k] || 0) + v;
  fileStats.push({ file: path.basename(filename), tasks: fixed.length, replacements: totalReplacements, perPattern: counters });
}

console.log('\n=== Per-file stats ===');
for (const s of fileStats) {
  console.log(`${s.file}: ${s.tasks} задач, ${s.replacements} замен — ${JSON.stringify(s.perPattern)}`);
}
console.log('\n=== Grand total ===');
console.log(grandTotal);

// 4. Cleanup
fs.unlinkSync(RAW_FILE);
console.log(`\nDeleted temp file ${path.basename(RAW_FILE)}`);
