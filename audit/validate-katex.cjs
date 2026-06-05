#!/usr/bin/env node
/**
 * KaTeX validator for audit/tasks_grade_*.json.
 *
 * For every task we extract math segments from text / options /
 * explanation and (for compound) recurse into subQuestions. Math
 * is anything wrapped in $...$ or $$...$$.  Each segment is
 * rendered with `throwOnError: true` and `strict: false`; any
 * thrown error counts as a failure.
 *
 * The full report is written to audit/katex-errors.json and a
 * compact per-file summary is printed.
 */

const fs = require('fs');
const path = require('path');
const katex = require('katex');

const AUDIT_DIR = __dirname;

// Match $$…$$ (display) and $…$ (inline). The display alt has to come first
// because $$ also matches $. Newlines are allowed inside.
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^\n$][\s\S]*?)\$/g;

function extractMath(text) {
  if (typeof text !== 'string' || !text.includes('$')) return [];
  const out = [];
  let m;
  MATH_RE.lastIndex = 0;
  while ((m = MATH_RE.exec(text)) !== null) {
    const display = !!m[1];
    const tex = (m[1] ?? m[2] ?? '').trim();
    if (tex) out.push({ tex, display, raw: m[0] });
  }
  return out;
}

function validate(snippet, display) {
  try {
    katex.renderToString(snippet, {
      throwOnError: true,
      strict: false,
      displayMode: display,
    });
    return null;
  } catch (e) {
    // KaTeX throws ParseError with .message
    return e.message || String(e);
  }
}

function checkText(text, location, errors) {
  for (const seg of extractMath(text)) {
    const err = validate(seg.tex, seg.display);
    if (err) {
      errors.push({
        location,
        snippet: seg.raw.length > 120 ? seg.raw.slice(0, 117) + '…' : seg.raw,
        error: err.split('\n')[0],
      });
    }
  }
}

function checkTask(task, fileErrors) {
  const taskRef = task.task_id || task.id || '(?)';
  if (typeof task.text === 'string') checkText(task.text, `${taskRef}/text`, fileErrors);
  if (typeof task.explanation === 'string') checkText(task.explanation, `${taskRef}/explanation`, fileErrors);
  if (Array.isArray(task.options)) {
    task.options.forEach((o, i) => {
      if (typeof o === 'string') checkText(o, `${taskRef}/options[${i}]`, fileErrors);
    });
  }
  if (Array.isArray(task.subQuestions)) {
    task.subQuestions.forEach((sq, si) => {
      const subRef = `${taskRef}/sub[${si}]`;
      if (typeof sq.text === 'string') checkText(sq.text, `${subRef}/text`, fileErrors);
      if (typeof sq.explanation === 'string') checkText(sq.explanation, `${subRef}/explanation`, fileErrors);
      if (Array.isArray(sq.options)) sq.options.forEach((o, i) => {
        if (typeof o === 'string') checkText(o, `${subRef}/options[${i}]`, fileErrors);
      });
    });
  }
}

const allErrors = {};
const summary = [];
const files = fs.readdirSync(AUDIT_DIR).filter(f => /^tasks_grade_\d+\.json$/.test(f)).sort();

for (const f of files) {
  const tasks = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, f), 'utf8'));
  let mathSegments = 0;
  const fileErrors = [];
  for (const t of tasks) {
    // count segments before validate-loop
    const beforeLen = fileErrors.length;
    [t.text, t.explanation, ...(t.options || []),
      ...((t.subQuestions || []).flatMap(sq => [sq.text, sq.explanation, ...(sq.options || [])]))
    ].forEach(x => { if (typeof x === 'string') mathSegments += extractMath(x).length; });
    checkTask(t, fileErrors);
  }
  allErrors[f] = fileErrors;
  // Group errors by message
  const byMessage = {};
  for (const e of fileErrors) {
    const key = e.error.slice(0, 80);
    byMessage[key] = (byMessage[key] || 0) + 1;
  }
  summary.push({ file: f, tasks: tasks.length, mathSegments, errors: fileErrors.length, topErrors: Object.entries(byMessage).sort((a,b)=>b[1]-a[1]).slice(0,3) });
}

// Write full report
const reportPath = path.join(AUDIT_DIR, 'katex-errors.json');
fs.writeFileSync(reportPath, JSON.stringify(allErrors, null, 2));

// Print summary
console.log('\n=== KaTeX validation summary ===\n');
let totalTasks = 0, totalSegs = 0, totalErr = 0;
for (const s of summary) {
  totalTasks += s.tasks;
  totalSegs += s.mathSegments;
  totalErr += s.errors;
  const pct = s.mathSegments ? ((s.errors / s.mathSegments) * 100).toFixed(1) : '0.0';
  console.log(`${s.file.padEnd(28)} tasks=${String(s.tasks).padStart(3)}  math=${String(s.mathSegments).padStart(5)}  errors=${String(s.errors).padStart(4)} (${pct}%)`);
  if (s.topErrors.length) {
    s.topErrors.forEach(([msg, cnt]) => console.log(`    × ${cnt}: ${msg}`));
  }
}
const totalPct = totalSegs ? ((totalErr / totalSegs) * 100).toFixed(1) : '0.0';
console.log('\n' + '-'.repeat(75));
console.log(`TOTAL${' '.repeat(23)}tasks=${totalTasks}  math=${totalSegs}  errors=${totalErr} (${totalPct}%)`);
console.log(`\nFull error list → ${path.relative(process.cwd(), reportPath)}`);
