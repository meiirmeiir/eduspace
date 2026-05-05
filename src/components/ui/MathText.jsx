import React from "react";

function SqrtSpan({ children }) {
  return (
    <span style={{display:"inline-flex",alignItems:"flex-end",gap:1,verticalAlign:"middle"}}>
      <span style={{fontSize:"1.15em",lineHeight:1,paddingBottom:1}}>√</span>
      <span style={{borderTop:"1.5px solid currentColor",paddingLeft:2,paddingRight:2,lineHeight:1.4,display:"inline-block"}}>{children}</span>
    </span>
  );
}

function FracSpan({ num, den }) {
  return (
    <span style={{display:"inline-flex",flexDirection:"column",alignItems:"center",verticalAlign:"middle",fontSize:"0.88em",lineHeight:1.25,margin:"0 3px"}}>
      <span style={{borderBottom:"1.5px solid currentColor",padding:"0 3px",textAlign:"center",whiteSpace:"nowrap"}}>{num}</span>
      <span style={{padding:"0 3px",textAlign:"center",whiteSpace:"nowrap"}}>{den}</span>
    </span>
  );
}

// Recursive parser: returns array of React nodes
function _mNodes(str, pfx) {
  if (!str) return [];
  const res = []; let i = 0, buf = '', ki = 0;
  const k = () => `${pfx}_${ki++}`;
  const flush = () => { if (buf) { res.push(buf); buf = ''; } };

  while (i < str.length) {
    // sqrt(...)
    if (/^sqrt\s*\(/.test(str.slice(i))) {
      flush();
      const p = str.indexOf('(', i + 4);
      let d = 1, j = p + 1;
      while (j < str.length && d > 0) { if (str[j]==='(') d++; else if (str[j]===')') d--; j++; }
      const ik = k();
      res.push(<SqrtSpan key={ik}>{_mNodes(str.slice(p+1, j-1), ik)}</SqrtSpan>);
      i = j; continue;
    }
    // √
    if (str[i] === '√') {
      flush(); i++;
      let inn = '';
      if (str[i]==='(') { i++; let d=1; while(i<str.length&&d>0){if(str[i]==='(')d++;else if(str[i]===')')d--;if(d>0)inn+=str[i];i++;} }
      else { while(i<str.length&&/[\w\d.]/.test(str[i]))inn+=str[i++]; }
      const ik = k();
      res.push(<SqrtSpan key={ik}>{inn || '·'}</SqrtSpan>);
      continue;
    }
    // ^ superscript
    if (str[i] === '^') {
      flush(); i++;
      let exp = '';
      if (str[i]==='{') { i++; while(i<str.length&&str[i]!=='}')exp+=str[i++]; i++; }
      else if (str[i]==='(') { i++; let d=1; while(i<str.length&&d>0){if(str[i]==='(')d++;else if(str[i]===')')d--;if(d>0)exp+=str[i];i++;} }
      else { if(str[i]==='-')exp+=str[i++]; while(i<str.length&&/[\w\d.]/.test(str[i]))exp+=str[i++]; }
      const ik = k();
      res.push(<sup key={ik} style={{fontSize:"0.65em",lineHeight:1,verticalAlign:"super"}}>{_mNodes(exp, ik)}</sup>);
      continue;
    }
    // _ subscript
    if (str[i] === '_') {
      flush(); i++;
      let sub = '';
      if (str[i]==='{') { i++; while(i<str.length&&str[i]!=='}')sub+=str[i++]; i++; }
      else { while(i<str.length&&/[\w\d]/.test(str[i]))sub+=str[i++]; }
      res.push(<sub key={k()} style={{fontSize:"0.65em",verticalAlign:"sub"}}>{sub}</sub>);
      continue;
    }
    // / fraction — only if both sides are ASCII math terms (not Cyrillic words)
    if (str[i] === '/') {
      const nm = buf.match(/(\([^)]*\)|[\w\d.]+)$/);
      if (nm) {
        const ns = nm[1], pre = buf.slice(0, buf.length - ns.length);
        let j = i + 1, ds = '';
        if (str[j]==='(') { j++; let d=1; while(j<str.length&&d>0){if(str[j]==='(')d++;else if(str[j]===')')d--;if(d>0)ds+=str[j];j++;} }
        else { while(j<str.length&&/[\w\d.]/.test(str[j]))ds+=str[j++]; }
        // only render as fraction if both sides are ASCII math (no Cyrillic)
        if (ds && /^[\x00-\x7F]+$/.test(ns) && /^[\x00-\x7F]+$/.test(ds)) {
          buf = ''; if (pre) res.push(pre);
          const ik = k();
          // Strip outer parens from numerator and denominator for cleaner fraction display
          const nsClean = (ns.startsWith('(') && ns.endsWith(')')) ? ns.slice(1,-1) : ns;
          const dsClean = (ds.startsWith('(') && ds.endsWith(')')) ? ds.slice(1,-1) : ds;
          res.push(<FracSpan key={ik} num={_mNodes(nsClean, ik+'n')} den={_mNodes(dsClean, ik+'d')}/>);
          i = j; continue;
        }
      }
    }
    buf += str[i++];
  }
  flush();
  return res;
}

export default function MathText({ text, style }) {
  if (text === null || text === undefined) return null;
  const s = String(text)
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/=>/g, '⇒')
    .replace(/!=/g, '≠')
    .replace(/<->/g, '↔')
    .replace(/(?<![=<>!])->(?![>])/g, '→')
    .replace(/\s\*\s/g, ' × ')
    .replace(/(?<=\d)\*(?=\d)/g, '×')
    .replace(/(\d)\*(?=[a-zA-Zа-яёА-ЯЁ])/g, '$1')  // 2*a → 2a
    .replace(/([a-zA-Zа-яёА-ЯЁ])\*(?=[a-zA-Zа-яёА-ЯЁ])/g, '$1·')  // a*b → a·b
    .replace(/(?<=\s):(?=\s)/g, '∶') // ratio colon
    // Math.* library calls → display symbols
    .replace(/\bMath\.PI\b/g, 'π')
    .replace(/\bMath\.E\b/g, 'e')
    .replace(/\bMath\.sqrt\s*\(/g, 'sqrt(')
    .replace(/\bMath\.cbrt\s*\(/g, 'cbrt(')
    .replace(/\bMath\.abs\s*\(/g, '|')
    .replace(/\bMath\.pow\s*\(([^,]+),\s*([^)]+)\)/g, '($1)^{$2}')
    .replace(/\bMath\.log2\b/g, 'log₂')
    .replace(/\bMath\.log10\b/g, 'log₁₀')
    .replace(/\bMath\.log\b/g, 'ln')
    .replace(/\bMath\.sin\b/g, 'sin')
    .replace(/\bMath\.cos\b/g, 'cos')
    .replace(/\bMath\.tan\b/g, 'tan')
    .replace(/\bMath\.ceil\b/g, 'ceil')
    .replace(/\bMath\.floor\b/g, 'floor')
    .replace(/\bMath\.round\b/g, 'round')
    .replace(/\bMath\.max\b/g, 'max')
    .replace(/\bMath\.min\b/g, 'min')
    // Standalone aliases
    .replace(/\bpi\b/g, 'π')
    .replace(/\bPI\b/g, 'π')
    .replace(/\balpha\b/g, 'α')
    .replace(/\bbeta\b/g, 'β')
    .replace(/\bgamma\b/g, 'γ')
    .replace(/\btheta\b/g, 'θ')
    .replace(/\bphi\b/g, 'φ')
    .replace(/\binfty\b/g, '∞')
    .replace(/\binfinity\b/g, '∞')
    // Implicit squaring/cubing: aaa → a^3, aa → a^2 (single Latin letter repeated)
    .replace(/\b([a-zA-Z])\1\1\b/g, '$1^3')
    .replace(/\b([a-zA-Z])\1\b/g, '$1^2')
    // Implicit multiplication for display: number directly before letter (2a → 2·a)
    .replace(/([0-9])([a-zA-Z])(?![a-zA-Z])/g, '$1·$2');
  return <span style={style}>{_mNodes(s, 'm')}</span>;
}
