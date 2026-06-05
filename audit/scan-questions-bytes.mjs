/**
 * scan-questions-bytes.mjs — READ-ONLY диагностика коллекции `questions` (диагностика, ~1600 док).
 * Ищет порчу текста: U+FFFD, control-байты (C0, кроме \t\n), одиночные суррогаты (остатки битого UTF-8).
 * Выводит примеры в hex, поля, темы, агрегаты. Ничего не пишет.
 *   node audit/scan-questions-bytes.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const hx = (n) => 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
const ctrlName = { 0x08: '\\b BACKSPACE', 0x0c: '\\f FORM-FEED', 0x0d: '\\r CR', 0x0b: '\\v VTAB', 0x00: 'NUL', 0x1b: 'ESC', 0x07: 'BEL', 0x09: 'TAB', 0x0a: 'LF' };

// классифицируем подозрительный символ
function classify(code, prevCh, nextCh) {
  if (code === 0xfffd) return { type: 'U+FFFD (replacement)', sev: 'high' };
  if (code >= 0xd800 && code <= 0xdfff) return { type: 'lone-surrogate', sev: 'high' };
  if (code < 0x20 && code !== 0x09 && code !== 0x0a) {
    // \r как обычное окончание строки (перед \n) — низкий приоритет; \r/\b/\f внутри слова — порча
    if (code === 0x0d && nextCh === '\n') return { type: 'CR (line-ending)', sev: 'low' };
    const midWord = /[A-Za-zА-Яа-яёЁ\\]/.test(prevCh || '') || /[A-Za-zА-Яа-яёЁ]/.test(nextCh || '');
    return { type: 'control ' + (ctrlName[code] || hx(code)) + (midWord ? ' (mid-word!)' : ''), sev: code === 0x08 || code === 0x0c ? 'high' : 'med' };
  }
  return null;
}

// hex-окно вокруг позиции
function hexWindow(s, i) {
  const a = Math.max(0, i - 8), b = Math.min(s.length, i + 9);
  const parts = [];
  for (let j = a; j < b; j++) {
    const c = s.charCodeAt(j);
    const mark = j === i ? '»' : '';
    const printable = c >= 0x20 && c !== 0x7f && !(c >= 0xd800 && c <= 0xdfff) && c !== 0xfffd;
    parts.push(mark + (printable ? s[j] : '[' + hx(c) + ']'));
  }
  return parts.join('');
}

// рекурсивный обход строковых полей
function walk(val, path, out) {
  if (typeof val === 'string') {
    for (let i = 0; i < val.length; i++) {
      const code = val.charCodeAt(i);
      if (code === 0xfffd || (code >= 0xd800 && code <= 0xdfff) || (code < 0x20 && code !== 0x09 && code !== 0x0a)) {
        // суррогатная пара? пропускаем валидную
        if (code >= 0xd800 && code <= 0xdbff) {
          const nx = val.charCodeAt(i + 1);
          if (nx >= 0xdc00 && nx <= 0xdfff) { i++; continue; }
        }
        const cls = classify(code, val[i - 1], val[i + 1]);
        if (cls) out.push({ path, code, hex: hx(code), ...cls, ctx: hexWindow(val, i), idx: i });
      }
    }
  } else if (Array.isArray(val)) {
    val.forEach((v, k) => walk(v, `${path}[${k}]`, out));
  } else if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) walk(v, path ? `${path}.${k}` : k, out);
  }
}

console.log('\nЧитаю questions…');
const snap = await db.collection('questions').get();
console.log(`docs: ${snap.size}\n`);

const findings = [];
snap.forEach((d) => {
  const data = d.data();
  const out = [];
  walk(data, '', out);
  for (const f of out) findings.push({ id: d.id, topic: data.topic || '?', type_: data.type || '?', section: data.sectionName || '', field: f.path, ...f });
});

console.log('═══ ИТОГ ═══');
console.log(`Проблемных вхождений: ${findings.length} в ${new Set(findings.map(f => f.id)).size} документах\n`);

const by = (key) => {
  const m = {};
  for (const f of findings) m[f[key]] = (m[f[key]] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

console.log('— по типу —');
for (const [k, v] of by('type')) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\n— по полю —');
for (const [k, v] of by('field').slice(0, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\n— по теме (топ-15) —');
for (const [k, v] of by('topic').slice(0, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`);

console.log('\n═══ ПРИМЕРЫ (hex-контекст), до 30 ═══');
const seen = new Set();
let shown = 0;
for (const f of findings.sort((a, b) => (a.sev === 'high' ? -1 : 1))) {
  const key = f.type + '|' + f.field;
  if (seen.has(key) && shown > 20) continue; // приоритет разнообразию
  seen.add(key);
  if (shown++ >= 30) break;
  console.log(`\n[${f.id}] поле=${f.field} тема="${f.topic}" (${f.type_})`);
  console.log(`   ${f.type} @${f.idx}  ${f.hex}`);
  console.log(`   ctx: ${f.ctx}`);
}
console.log('');
