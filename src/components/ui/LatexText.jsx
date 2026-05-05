import React from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { jsExprToLatex } from "../../lib/mathUtils.js";

export default function LatexText({ text, style }) {
  if (!text) return null;
  const parts = [];
  let raw = String(text);
  // Fix AI mistake: // used instead of \ for LaTeX commands (e.g. //Rightarrow → \Rightarrow)
  raw = raw.replace(/\/\/([a-zA-Z]+)/g, '\\$1');
  // Strip CJK characters (Chinese/Japanese/Korean — AI hallucination artifacts)
  raw = raw.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]+/g, '');
  raw = raw.trim();
  if (!raw) return null;
  // Auto-wrap bare LaTeX commands without $ delimiters
  if (!raw.includes('$')) {
    if (/[а-яёА-ЯЁ]/.test(raw)) {
      // Mixed Cyrillic + LaTeX: wrap each \command individually, not the whole string
      // (wrapping whole string breaks KaTeX because Cyrillic is invalid in math mode)
      raw = raw.replace(/\\[a-zA-Z]+/g, m => `$${m}$`);
    } else if (/\\[a-zA-Z]/.test(raw) || /\bMath\./.test(raw)) {
      // Pure math expression: wrap everything
      raw = `$${raw}$`;
    }
  }
  let s = raw, key = 0;
  while (s.length > 0) {
    const b = s.indexOf('$$');
    const i = s.indexOf('$');
    if (b !== -1 && b === i) {
      const end = s.indexOf('$$', b + 2);
      if (end !== -1) {
        if (b > 0) parts.push(<span key={key++}>{s.slice(0, b)}</span>);
        const expr = jsExprToLatex(s.slice(b + 2, end));
        try { parts.push(<BlockMath key={key++} math={expr}/>); } catch { parts.push(<span key={key++}>{`$$${expr}$$`}</span>); }
        s = s.slice(end + 2); continue;
      }
    }
    if (i !== -1) {
      const end = s.indexOf('$', i + 1);
      if (end !== -1) {
        if (i > 0) parts.push(<span key={key++}>{s.slice(0, i)}</span>);
        const expr = jsExprToLatex(s.slice(i + 1, end));
        try { parts.push(<InlineMath key={key++} math={expr}/>); } catch { parts.push(<span key={key++}>{`$${expr}$`}</span>); }
        s = s.slice(end + 1); continue;
      }
    }
    parts.push(<span key={key++}>{s}</span>); break;
  }
  return <span style={style}>{parts}</span>;
}
