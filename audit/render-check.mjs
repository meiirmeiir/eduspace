// Faithful Node port of src/components/ui/LatexText.jsx render pipeline.
// react-katex (InlineMath/BlockMath) === katex.renderToString({throwOnError:false}),
// so we reproduce exactly what the user sees, without a browser.
import katex from 'katex';
import { jsExprToLatex } from '../src/lib/mathUtils.js';

// ── Literal-LaTeX detector (same rules as the browser harness) ─────────────
const LITERAL_CHECKS = [
  { re: /\\[a-zA-Z]{2,}/, type: 'literal-latex: \\cmd' },
  { re: /[\^_]\{/, type: 'literal-latex: ^{ или _{' },
  { re: /[A-Za-z0-9)\]}]\s*\^\s*[-+(]?\s*[A-Za-z0-9{]/, type: 'literal-latex: голая степень ^' },
  { re: /[A-Za-z0-9)\]}]_\s*[A-Za-z0-9{]/, type: 'literal-latex: голый индекс _' },
  { re: /\$/, type: 'literal-latex: одиночный $' },
];
export function detectLiteral(text) {
  for (const c of LITERAL_CHECKS) {
    const m = c.re.exec(text);
    if (m) {
      const i = Math.max(0, m.index - 12);
      return { type: c.type, frag: text.slice(i, m.index + m[0].length + 24).trim() };
    }
  }
  return null;
}

// ── Port of LatexText: returns ordered parts (text spans + math segments) ──
export function splitLatexText(text) {
  if (!text) return [];
  let raw = String(text);
  raw = raw.replace(/\/\/([a-zA-Z]+)/g, '\\$1');
  raw = raw.replace(/[一-鿿㐀-䶿　-〿＀-￯]+/g, '');
  raw = raw.trim();
  if (!raw) return [];
  if (!raw.includes('$')) {
    if (/[а-яёА-ЯЁ]/.test(raw)) {
      raw = raw.replace(/\\[a-zA-Z]+/g, (m) => `$${m}$`);
    } else if (/\\[a-zA-Z]/.test(raw) || /\bMath\./.test(raw)) {
      raw = `$${raw}$`;
    }
  }
  const parts = [];
  let s = raw;
  while (s.length > 0) {
    const b = s.indexOf('$$');
    const i = s.indexOf('$');
    if (b !== -1 && b === i) {
      const end = s.indexOf('$$', b + 2);
      if (end !== -1) {
        if (b > 0) parts.push({ kind: 'text', src: s.slice(0, b) });
        parts.push({ kind: 'block', src: s.slice(b + 2, end), expr: jsExprToLatex(s.slice(b + 2, end)) });
        s = s.slice(end + 2);
        continue;
      }
    }
    if (i !== -1) {
      const end = s.indexOf('$', i + 1);
      if (end !== -1) {
        if (i > 0) parts.push({ kind: 'text', src: s.slice(0, i) });
        parts.push({ kind: 'inline', src: s.slice(i + 1, end), expr: jsExprToLatex(s.slice(i + 1, end)) });
        s = s.slice(end + 1);
        continue;
      }
    }
    parts.push({ kind: 'text', src: s });
    break;
  }
  return parts;
}

// ── Analyze one field string: same issue list the harness produces ─────────
export function analyzeText(text) {
  const issues = [];
  const seen = new Set();
  const push = (type, frag) => {
    const k = type + '||' + frag;
    if (seen.has(k)) return;
    seen.add(k);
    issues.push({ type, frag });
  };
  for (const p of splitLatexText(text)) {
    if (p.kind === 'text') {
      const t = p.src;
      if (!t || !t.trim()) continue;
      const hit = detectLiteral(t);
      if (hit) push(hit.type, hit.frag);
    } else {
      let html;
      try {
        html = katex.renderToString(p.expr, { displayMode: p.kind === 'block', throwOnError: false });
      } catch (e) {
        push('render-threw', String(p.expr).slice(0, 120));
        continue;
      }
      if (/class="katex-error"/.test(html)) {
        // pull the source KaTeX echoes inside the error span
        push('katex-error', String(p.expr).slice(0, 120));
      }
    }
  }
  return issues;
}

// Final TeX that actually reaches KaTeX, for eyeballing semantic correctness.
export function finalTex(text) {
  return splitLatexText(text)
    .map((p) => (p.kind === 'text' ? p.src : `${p.kind === 'block' ? '$$' : '$'}${p.expr}${p.kind === 'block' ? '$$' : '$'}`))
    .join('');
}

const FIELDS = (q) => {
  const out = [];
  out.push(['question', q.text || q.question_text || q.question || '']);
  if (Array.isArray(q.options)) q.options.forEach((o, i) => out.push([`options[${i}]`, typeof o === 'string' ? o : String(o ?? '')]));
  if (q.explanation) out.push(['explanation', q.explanation]);
  return out;
};

export function analyzeCorpus(data) {
  const issues = [];
  for (const skill of Object.keys(data).sort()) {
    const qs = data[skill].questions || [];
    qs.forEach((q, qi) => {
      for (const [field, val] of FIELDS(q)) {
        for (const iss of analyzeText(val)) issues.push({ skill, num: qi + 1, field, fragment: iss.frag, type: iss.type });
      }
    });
  }
  return issues;
}

export { FIELDS };
