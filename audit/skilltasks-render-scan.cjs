/**
 * skilltasks-render-scan.cjs — READ-ONLY render sweep для skillTasks (a/b/c).
 * Повторяет пайплайн LatexText.jsx + KaTeX throwOnError (как validate-all-katex.mjs),
 * но проходит массивы a[]/b[]/c[] каждого из 307 банков.
 * Находит: (1) KaTeX parse-ошибки (.katex-error), (2) literal LaTeX вне $...$.
 * Источник: audit/_skilltasks_all.json (свежий дамп). KaTeX и jsExprToLatex — реальные.
 */
const fs = require('fs');
const katex = require('katex');

// jsExprToLatex реализован в ESM (mathUtils.js). Чтобы не тянуть ESM в CJS,
// читаем его через динамический импорт.
async function main() {
  const { jsExprToLatex } = await import('../src/lib/mathUtils.js');
  const all = JSON.parse(fs.readFileSync('audit/_skilltasks_all.json', 'utf8'));
  const LEVELS = ['a', 'b', 'c'];
  const FIELDS = ['text', 'question', 'question_text', 'explanation'];
  const CJK = /[一-鿿㐀-䶿　-〿＀-￯]+/g;

  function extractSegments(text) {
    let raw = String(text);
    raw = raw.replace(/\/\/([a-zA-Z]+)/g, '\\$1');
    raw = raw.replace(CJK, '');
    raw = raw.trim();
    if (!raw) return { segs: [], plain: '' };
    let wrapped = raw;
    if (!raw.includes('$')) {
      if (/[а-яёА-ЯЁ]/.test(raw)) wrapped = raw.replace(/\\[a-zA-Z]+/g, (m) => `$${m}$`);
      else if (/\\[a-zA-Z]/.test(raw) || /\bMath\./.test(raw)) wrapped = `$${raw}$`;
      else return { segs: [], plain: raw };
    }
    const segs = [];
    let s = wrapped, plain = '';
    while (s.length > 0) {
      const b = s.indexOf('$$');
      const i = s.indexOf('$');
      if (b !== -1 && b === i) {
        const end = s.indexOf('$$', b + 2);
        if (end !== -1) { plain += s.slice(0, b); segs.push({ mode: 'block', expr: jsExprToLatex(s.slice(b + 2, end)) }); s = s.slice(end + 2); continue; }
      }
      if (i !== -1) {
        const end = s.indexOf('$', i + 1);
        if (end !== -1) { plain += s.slice(0, i); segs.push({ mode: 'inline', expr: jsExprToLatex(s.slice(i + 1, end)) }); s = s.slice(end + 1); continue; }
      }
      plain += s; break;
    }
    return { segs, plain };
  }

  const errOf = (latex, block) => {
    try { katex.renderToString(latex, { throwOnError: true, displayMode: block, strict: false }); return null; }
    catch (e) { return String(e.message || e).replace(/\s+/g, ' ').slice(0, 110); }
  };
  // literal LaTeX, оставшийся в plain-тексте (вне $...$) → рендерится буквально
  const LIT = /\\[a-zA-Z]{2,}|\^\{|_\{|\\frac|\\dfrac|\\sqrt|\\cdot|\\times|\\Rightarrow|\\le\b|\\ge\b|\\pi\b/;

  let taskCount = 0, segCount = 0;
  const katexErrors = [];   // {loc, latex, err}
  const literalLatex = [];  // {loc, frag}

  for (const doc of all) {
    for (const lvl of LEVELS) {
      const arr = doc[lvl];
      if (!Array.isArray(arr)) continue;
      arr.forEach((t, ti) => {
        if (!t || typeof t !== 'object') return;
        taskCount++;
        const checkField = (label, val) => {
          if (typeof val !== 'string' || !val) return;
          const { segs, plain } = extractSegments(val);
          segs.forEach((seg, si) => {
            segCount++;
            const err = errOf(seg.expr, seg.mode === 'block');
            if (err) katexErrors.push({ loc: `${doc.id}|${lvl}[${ti}]|${label}|s${si}`, latex: seg.expr.slice(0, 140), err });
          });
          if (LIT.test(plain)) {
            const frag = (plain.match(/.{0,15}(\\[a-zA-Z]{2,}|\^\{|_\{)[^$]{0,20}/) || [plain])[0];
            literalLatex.push({ loc: `${doc.id}|${lvl}[${ti}]|${label}`, frag: frag.trim().slice(0, 80) });
          }
        };
        for (const f of FIELDS) checkField(f, t[f]);
        if (Array.isArray(t.options)) t.options.forEach((o, oi) => checkField(`opt${oi}`, o));
      });
    }
  }

  fs.writeFileSync('audit/_skilltasks_render.json', JSON.stringify({ katexErrors, literalLatex }, null, 1));
  console.log(`банков: ${all.length} | задач: ${taskCount} | мат.сегментов: ${segCount}`);
  console.log(`KaTeX parse-ошибок: ${katexErrors.length}`);
  console.log(`literal LaTeX вне $: ${literalLatex.length}`);
  // топ банков по проблемам
  const byBank = {};
  for (const e of [...katexErrors, ...literalLatex]) { const b = e.loc.split('|')[0]; byBank[b] = (byBank[b] || 0) + 1; }
  console.log('\nтоп банков:');
  Object.entries(byBank).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([b, n]) => console.log(`  ${n}\t${b}`));
  console.log('\nпримеры KaTeX-ошибок:');
  katexErrors.slice(0, 12).forEach((e) => console.log(`  [${e.loc}] ${e.err} | ${e.latex}`));
  console.log('\nпримеры literal LaTeX:');
  literalLatex.slice(0, 12).forEach((e) => console.log(`  [${e.loc}] ${e.frag}`));
}
main().then(() => process.exit(0));
