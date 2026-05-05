// ── MATH / FORMULA UTILITIES ─────────────────────────────────────────────────

export function jsExprToLatex(expr) {
  if (!expr) return expr;
  let s = expr;

  // Вспомогательная функция: извлечь содержимое в сбалансированных скобках
  // openIdx — индекс символа '(' в строке str. Возвращает {arg, endIdx} или null.
  function extractArg(str, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') { depth--; if (depth === 0) return { arg: str.slice(openIdx + 1, i), endIdx: i }; }
    }
    return null;
  }

  // Math.pow(base, exp) → {base}^{exp}
  let iter = 0;
  while (iter++ < 20) {
    const idx = s.indexOf('Math.pow(');
    if (idx === -1) break;
    const openIdx = idx + 8;
    let depth = 0, commaAt = -1, endIdx = -1;
    for (let ci = openIdx; ci < s.length; ci++) {
      const ch = s[ci];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { endIdx = ci; break; } }
      else if (ch === ',' && depth === 1 && commaAt === -1) commaAt = ci;
    }
    if (endIdx === -1 || commaAt === -1) break;
    const base = s.slice(openIdx + 1, commaAt).trim();
    const exp  = s.slice(commaAt + 1, endIdx).trim();
    const bLatex = (base.length > 1 || /[\+\-\/\s\(\)]/.test(base)) ? `{${base}}` : base;
    const eLatex = (exp.length > 1  || /[\+\-\/\*\s]/.test(exp))    ? `{${exp}}`  : exp;
    s = s.slice(0, idx) + `${bLatex}^${eLatex}` + s.slice(endIdx + 1);
  }

  // Math.sqrt(x) → \sqrt{x}
  iter = 0;
  while (iter++ < 20) {
    const idx = s.indexOf('Math.sqrt(');
    if (idx === -1) break;
    const res = extractArg(s, idx + 9);
    if (!res) break;
    s = s.slice(0, idx) + `\\sqrt{${res.arg}}` + s.slice(res.endIdx + 1);
  }

  // Math.abs(x) → \left|x\right|
  iter = 0;
  while (iter++ < 20) {
    const idx = s.indexOf('Math.abs(');
    if (idx === -1) break;
    const res = extractArg(s, idx + 8);
    if (!res) break;
    s = s.slice(0, idx) + `\\left|${res.arg}\\right|` + s.slice(res.endIdx + 1);
  }

  // Math.floor(x) → \lfloor x \rfloor
  iter = 0;
  while (iter++ < 20) {
    const idx = s.indexOf('Math.floor(');
    if (idx === -1) break;
    const res = extractArg(s, idx + 10);
    if (!res) break;
    s = s.slice(0, idx) + `\\lfloor ${res.arg} \\rfloor` + s.slice(res.endIdx + 1);
  }

  // Math.ceil(x) → \lceil x \rceil
  iter = 0;
  while (iter++ < 20) {
    const idx = s.indexOf('Math.ceil(');
    if (idx === -1) break;
    const res = extractArg(s, idx + 9);
    if (!res) break;
    s = s.slice(0, idx) + `\\lceil ${res.arg} \\rceil` + s.slice(res.endIdx + 1);
  }

  // Функции с одним аргументом: Math.X(arg) → \X(arg)
  const singleArgMap = [
    ['Math.sin(',   '\\sin'],
    ['Math.cos(',   '\\cos'],
    ['Math.tan(',   '\\tan'],
    ['Math.asin(',  '\\arcsin'],
    ['Math.acos(',  '\\arccos'],
    ['Math.atan(',  '\\arctan'],
    ['Math.atan2(', '\\operatorname{atan2}'],
    ['Math.sinh(',  '\\sinh'],
    ['Math.cosh(',  '\\cosh'],
    ['Math.tanh(',  '\\tanh'],
    ['Math.log10(', '\\log_{10}'],
    ['Math.log2(',  '\\log_2'],
    ['Math.log(',   '\\ln'],
    ['Math.exp(',   '\\exp'],
    ['Math.max(',   '\\max'],
    ['Math.min(',   '\\min'],
    ['Math.round(', '\\operatorname{round}'],
  ];
  for (const [jsFunc, latexCmd] of singleArgMap) {
    iter = 0;
    while (iter++ < 20) {
      const idx = s.indexOf(jsFunc);
      if (idx === -1) break;
      const res = extractArg(s, idx + jsFunc.length - 1);
      if (!res) break;
      s = s.slice(0, idx) + `${latexCmd}(${res.arg})` + s.slice(res.endIdx + 1);
    }
  }

  // Константы
  s = s.replace(/\bMath\.PI\b/g, '\\pi');
  s = s.replace(/\bMath\.E\b/g,  'e');

  // sum( → \sum(
  s = s.replace(/\bsum\s*\(/g, '\\sum(');

  // a / b → \frac{a}{b}
  s = s.replace(/(\([^()]+\)|[\w\.\^\{\}]+)\s*\/\s*(\([^()]+\)|[\w\.\^\{\}]+)/g,
    (_, num, den) => `\\frac{${num}}{${den}}`);

  // * → \cdot
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');

  return s;
}

// ── TOPIC PROGRESS ────────────────────────────────────────────────────────────
export const nextZone = (cur, score) => {
  if (!cur) return score >= 80 ? "green" : score >= 60 ? "yellow" : "red";
  if (cur === "red")    return score >= 60 ? "yellow" : "red";
  if (cur === "yellow") return score >= 80 ? "green"  : score < 50 ? "red" : "yellow";
  /* green */           return score < 60  ? "yellow" : "green";
};

export async function updateTopicProgress(_userPhone, _answers) {
  // Zones are now set exclusively by teacher expert reports.
  // This function is intentionally disabled — raw diagnostic scores are
  // stored in diagnosticResults collection and zones are written when
  // the teacher saves an expert report with a zonedPlan.
}

// ── IMAGE COMPRESSION ─────────────────────────────────────────────────────────
export function compressImage(file, maxW=800, quality=0.7){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.width);
        const canvas=document.createElement("canvas");
        canvas.width=img.width*scale; canvas.height=img.height*scale;
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",quality));
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

// ── FORMULA PREPROCESSOR ─────────────────────────────────────────────────────
// Adds explicit * for implicit multiplication so JS eval works correctly:
// aa → a*a, ab → a*b, 2a → 2*a, a(b+c) → a*(b+c)
export function preprocessFormula(formula, varNames) {
  if (!formula) return formula;
  let f = formula;
  // ── Normalize Math.* → plain JS ──────────────────────────────────────────
  // These are all valid JS already, but we ensure consistent casing/aliases
  f = f.replace(/\bPI\b/g, 'Math.PI');
  f = f.replace(/\bpi\b/g, 'Math.PI');
  f = f.replace(/\bsqrt\s*\(/g, 'Math.sqrt(');
  f = f.replace(/\babs\s*\(/g, 'Math.abs(');
  f = f.replace(/\bsin\s*\(/g, 'Math.sin(');
  f = f.replace(/\bcos\s*\(/g, 'Math.cos(');
  f = f.replace(/\btan\s*\(/g, 'Math.tan(');
  f = f.replace(/\blog\s*\(/g, 'Math.log(');
  f = f.replace(/\bln\s*\(/g, 'Math.log(');
  f = f.replace(/\bceil\s*\(/g, 'Math.ceil(');
  f = f.replace(/\bfloor\s*\(/g, 'Math.floor(');
  f = f.replace(/\bround\s*\(/g, 'Math.round(');
  f = f.replace(/\bpow\s*\(/g, 'Math.pow(');
  f = f.replace(/\bmax\s*\(/g, 'Math.max(');
  f = f.replace(/\bmin\s*\(/g, 'Math.min(');
  // ── ^ → ** (caret to JS exponentiation) ─────────────────────────────────
  f = f.replace(/\^\{([^}]+)\}/g, '**($1)'); // x^{n+1} → x**(n+1)
  f = f.replace(/\^/g, '**');                // x^2 → x**2
  // ── Cyrillic/named function aliases — processed BEFORE early return so they
  //    work even when varNames is empty (e.g. static chart values) ──────────
  let _prev;
  do {
    _prev = f;
    f = f.replace(/\bgcd\s*\(([^()]+)\)/g, (_,a)=>`(function(_a,_b){var _x=Math.abs(_a),_y=Math.abs(_b);while(_y){var _t=_y;_y=_x%_y;_x=_t;}return _x;})(${a})`);
    f = f.replace(/\blcm\s*\(([^()]+)\)/g, (_,a)=>`(function(_a,_b){var _x=Math.abs(_a),_y=Math.abs(_b),_g=_x,_u=_x,_v=_y;while(_v){var _t=_v;_v=_u%_v;_u=_t;}_g=_u;return _g===0?0:Math.abs(_a*_b)/_g;})(${a})`);
    f = f.replace(/НОД\s*\(([^()]+)\)/g, (_,a)=>`(function(_a,_b){var _x=Math.abs(_a),_y=Math.abs(_b);while(_y){var _t=_y;_y=_x%_y;_x=_t;}return _x;})(${a})`);
    f = f.replace(/НОК\s*\(([^()]+)\)/g, (_,a)=>`(function(_a,_b){var _x=Math.abs(_a),_y=Math.abs(_b),_g=_x,_u=_x,_v=_y;while(_v){var _t=_v;_v=_u%_v;_u=_t;}_g=_u;return _g===0?0:Math.abs(_a*_b)/_g;})(${a})`);
    f = f.replace(/ПОТОЛОК\s*\(([^()]+)\)/g, (_,a)=>`Math.ceil(${a})`);
    f = f.replace(/ДЕЛИТЕЛЬ\s*\(([^()]+)\)/g, (_,a)=>`(function(_n){var _d=[],_i;_n=Math.abs(Math.round(_n));for(_i=1;_i<=_n;_i++){if(_n%_i===0)_d.push(_i);}return _d.join(', ');})(${a})`);
    f = f.replace(/ПРОСТЫЕДЕЛИТЕЛИ\s*\(([^()]+)\)/g, (_,a)=>`(function(_n){var _d=[],_i,_m=Math.abs(Math.round(_n));for(_i=2;_i*_i<=_m;_i++){if(_m%_i===0){_d.push(_i);while(_m%_i===0)_m=Math.floor(_m/_i);}}if(_m>1)_d.push(_m);return _d.join(', ');})(${a})`);
  } while (f !== _prev);
  if (!varNames.length) return f;
  const sorted = [...varNames].sort((a, b) => b.length - a.length);
  const vp = sorted.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!vp) return f;
  // digit followed by variable: 2a → 2*a
  f = f.replace(new RegExp(`([0-9])(${vp})(?![\\w])`, 'g'), '$1*$2');
  // variable followed by opening paren: a(... → a*(...
  f = f.replace(new RegExp(`(${vp})\\(`, 'g'), '$1*(');
  // digit followed by paren: 2(... → 2*(...
  f = f.replace(/([0-9])\(/g, '$1*(');
  // variable × variable (chain: run repeatedly until stable)
  let prev;
  do {
    prev = f;
    f = f.replace(new RegExp(`(${vp})(?![*^/(\\[\\w])(${vp})`, 'g'), '$1*$2');
  } while (f !== prev);
  return f;
}

// ── PRIORITY INDEX & EFFICIENCY HELPERS ──────────────────────────────────────
export function parseGradeNumber(str) {
  if (!str) return 0;
  if (/ЕНТ|ENT/i.test(str)) return 11;
  if (/Calculus/i.test(str)) return 12;
  const m = String(str).match(/\d+/);
  return m ? parseInt(m[0]) : 0;
}
export function computeSkillC(sk) {
  const A = Number(sk?.A) || 3, W = Number(sk?.W_mem) || 3;
  const T = Number(sk?.T_depth) || 3, I = Number(sk?.I_score) || 3;
  return Math.min(5, Math.max(1, Math.round(0.35*A + 0.35*W + 0.15*T + 0.15*I)));
}
export function getM_c(C) { return ({1:0.00,2:0.15,3:0.25,4:0.40,5:0.50})[C]??0.25; }
export function computeKAdj(skillName, skMeta, lessonLogs) {
  const T_base = Number(skMeta?.T_base) || 60;
  const M_c = getM_c(computeSkillC(skMeta));
  const logs = (lessonLogs||[]).filter(l=>l.skillName===skillName).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if (!logs.length) return 1.0;
  let cumPct=0, T_a=0;
  for (const log of logs) { cumPct+=Number(log.percentCovered)||0; T_a+=Number(log.timeSpent)||0; if(cumPct>=100)break; }
  if (cumPct < 100) return 1.0;
  const K_raw = T_a / T_base;
  return Math.round((K_raw + (1-K_raw)*M_c)*100)/100;
}
export function computeS_diag(skMeta, zone, diagResults) {
  const sid = skMeta?.sectionId;
  if (sid && diagResults?.length) {
    const relevant = diagResults.filter(r=>r.sectionId===sid);
    if (relevant.length) {
      const latest = [...relevant].sort((a,b)=>(b.completedAt||"").localeCompare(a.completedAt||""))[0];
      return Math.round((latest.score||0))/100;
    }
  }
  return zone==="red"?0.2:zone==="yellow"?0.5:0.85;
}
export function computeM_g_final(G_u, G_s, S_diag) {
  if (S_diag < 0.3) return 1.0;
  const deltaG = Math.max(0, G_u - G_s);
  return Math.max(0, Math.round((1-(0.1*deltaG*S_diag))*100)/100);
}

// ── QUESTION GENERATOR ────────────────────────────────────────────────────────
// Resolves a "generated" question into a plain MCQ by substituting random numbers.
// q.variables = [{name, min, max}]   — random integers
// q.derivedVars = [{name, formula}]  — computed from others via JS expression
// q.answerFormula = "..."            — JS expression → correct answer value (or comma-separated multi-value)
// q.wrongFormulas = ["...",...]      — JS expressions → wrong answer values
// q.text contains {varName} placeholders
// Supports {expr} syntax in formulas (e.g., {a},{2*a},{3*a}) as alias for a,2*a,3*a

export function stripBraceWrappers(f) {
  // Replace standalone {expr} (not after ^) with just expr
  // Allows writing {a},{2*a},{3*a} instead of a,2*a,3*a in formula fields
  return (f || "").replace(/(?<!\^)\{([^}]+)\}/g, '$1');
}

export function splitTopLevelCommas(str) {
  // Split by commas not inside parentheses (to avoid splitting Math.max(a,b))
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(' || str[i] === '[') depth++;
    else if (str[i] === ')' || str[i] === ']') depth--;
    else if (str[i] === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts.filter(Boolean);
}

// ── Fraction utilities ───────────────────────────────────────────────────────
export function _gcdInt(a, b) { a=Math.abs(a); b=Math.abs(b); while(b){var t=b;b=a%b;a=t;} return a||1; }
export function floatToFraction(x) {
  // Continued-fraction algorithm → [numerator, denominator] (exact small fractions)
  if (!isFinite(x)) return [0,1];
  var sign = x < 0 ? -1 : 1; x = Math.abs(x);
  var h1=1,h2=0,k1=0,k2=1,b=x;
  for(var i=0;i<30;i++){
    var a=Math.floor(b),nh=a*h1+h2,nk=a*k1+k2;
    h2=h1;h1=nh;k2=k1;k1=nk;
    if(Math.abs(x-h1/k1)<1e-9||k1>9999)break;
    b=1/(b-a); if(!isFinite(b))break;
  }
  var g=_gcdInt(h1,k1); return [sign*Math.round(h1/g), Math.round(k1/g)];
}
export function formatAnswerValue(raw, answerDisplay) {
  if (typeof raw === 'string') return raw; // ДЕЛИТЕЛЬ, text templates, multi-value
  var fmt = answerDisplay || {type:'integer'};
  var type = fmt.type || 'integer';
  if (type === 'decimal') {
    var dec = typeof fmt.decimals==='number' ? fmt.decimals : 2;
    return raw.toFixed(dec).replace('.',',');
  }
  if (type === 'fraction' || type === 'mixed') {
    var nd = floatToFraction(raw);
    var num=nd[0], den=nd[1];
    if (den===1) return String(num);
    if (type==='fraction') return num+'/'+den;
    // mixed number
    var whole=Math.trunc(num/den), rem=num-whole*den;
    if (whole===0) return num+'/'+den;
    if (rem===0) return String(whole);
    var g2=_gcdInt(Math.abs(rem),den);
    return whole+' '+(rem/g2)+'/'+(den/g2);
  }
  return String(Math.round(raw)); // integer default
}

export function evalFormulaMulti(formulaRaw, vars) {
  // Evaluate a formula → number (rounded), multi-value string, or text template.
  // Used for derivedVars (always integer). For answer/wrong formulas use evalFormulaRaw.
  const evalOne = (cleaned, rawFallback) => {
    try {
      const f = preprocessFormula(cleaned, Object.keys(vars));
      const result = new Function(...Object.keys(vars), `"use strict"; return (${f});`)(...Object.values(vars));
      if (typeof result === 'string') return result;
      return Math.round(result);
    } catch {
      let text = rawFallback || cleaned;
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      });
      return text.trim();
    }
  };
  const cleaned = stripBraceWrappers(formulaRaw);
  const parts = splitTopLevelCommas(cleaned);
  if (parts.length > 1) {
    const rawParts = splitTopLevelCommas(formulaRaw);
    return parts.map((p, i) => evalOne(p, rawParts[i])).join(', ');
  }
  return evalOne(cleaned, formulaRaw);
}

export function evalFormulaRaw(formulaRaw, vars) {
  // Like evalFormulaMulti but returns raw float (no Math.round) for answer formatting.
  const evalOne = (cleaned, rawFallback) => {
    try {
      const f = preprocessFormula(cleaned, Object.keys(vars));
      const result = new Function(...Object.keys(vars), `"use strict"; return (${f});`)(...Object.values(vars));
      if (typeof result === 'string') return result;
      return result; // raw float
    } catch {
      let text = rawFallback || cleaned;
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      });
      return text.trim();
    }
  };
  const cleaned = stripBraceWrappers(formulaRaw);
  const parts = splitTopLevelCommas(cleaned);
  if (parts.length > 1) {
    const rawParts = splitTopLevelCommas(formulaRaw);
    // multi-value: format each part individually
    return parts.map((p, i) => evalOne(p, rawParts[i])).join(', ');
  }
  return evalOne(cleaned, formulaRaw);
}

export function generateQuestion(q) {
  const vars = {};
  // 1. Generate random integer variables
  (q.variables || []).forEach(v => {
    const lo = Number(v.min) || 1;
    const hi = Number(v.max) || 10;
    vars[v.name] = Math.floor(Math.random() * (hi - lo + 1)) + lo;
  });
  // 2. Compute derived variables — raw float for both display and formula eval
  const derivedVarNames = new Set();
  const rawDerivedVals = {};
  (q.derivedVars || []).forEach(v => {
    try {
      const formula = preprocessFormula(v.formula, Object.keys(vars));
      const raw = new Function(...Object.keys(vars), `"use strict"; return (${formula});`)(...Object.values(vars));
      rawDerivedVals[v.name] = typeof raw === 'number' ? raw : 0;
      vars[v.name] = rawDerivedVals[v.name];
    } catch { rawDerivedVals[v.name] = 0; vars[v.name] = 0; }
    derivedVarNames.add(v.name);
  });
  // 3. Substitute placeholders in text
  let text = q.text || "";
  const fmt = q.answerDisplay || {type:'integer'};
  Object.entries(vars).forEach(([k, val]) => {
    const displayVal = derivedVarNames.has(k)
      ? formatAnswerValue(rawDerivedVals[k], fmt)
      : String(val);
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), displayVal);
  });

  // ── MODEL type: options are expression strings, NOT computed values ──────────
  if (q.type === "model") {
    const correctExpr = (q.answerFormula || "").trim();
    const wrongExprs = (q.wrongFormulas || []).map(f => f.trim()).filter(f => f && f !== correctExpr);
    const pool = shuffle([correctExpr, ...wrongExprs.slice(0, 3)]);
    const correct = pool.indexOf(correctExpr);
    return {
      ...q,
      text,
      type: "mcq",
      options: pool,
      correct,
      _generated: true,
      _vars: vars,
      _origQuestion: q._origQuestion || q,
    };
  }

  // ── GENERATED type: options are computed numeric values ──────────────────────
  let rawAnswer;
  try { rawAnswer = evalFormulaRaw(q.answerFormula, vars); } catch { rawAnswer = 0; }
  let answer = typeof rawAnswer === 'string' ? rawAnswer : formatAnswerValue(rawAnswer, fmt);
  // 5. Evaluate wrong answers (deduplicate, exclude correct)
  const wrongs = [];
  (q.wrongFormulas || []).forEach(f => {
    if (!f.trim()) return;
    try {
      const rawW = evalFormulaRaw(f, vars);
      const w = typeof rawW === 'string' ? rawW : formatAnswerValue(rawW, fmt);
      if (String(w) !== String(answer) && !wrongs.map(String).includes(String(w))) wrongs.push(w);
    } catch { /* skip */ }
  });
  // 6. Pad wrongs if needed — only for integer display
  if (fmt.type === 'integer' || !fmt.type) {
    const ansNum = typeof rawAnswer === 'number' ? Math.round(rawAnswer) : NaN;
    if (!isNaN(ansNum)) {
      let offset = 1;
      while (wrongs.length < 3) {
        const cand = formatAnswerValue(ansNum + offset, fmt);
        const cand2 = formatAnswerValue(ansNum - offset, fmt);
        if (!wrongs.includes(cand) && cand !== answer) wrongs.push(cand);
        else if (!wrongs.includes(cand2) && cand2 !== answer) wrongs.push(cand2);
        offset++;
      }
    }
  }
  // 7. Shuffle options, track correct index
  const pool = shuffle([answer, ...wrongs.slice(0, 3)]);
  const correct = pool.indexOf(answer);
  return {
    ...q,
    text,
    type: "mcq",
    options: pool.map(String),
    correct,
    _generated: true,
    _vars: vars,
    _origQuestion: q._origQuestion || q,
  };
}
