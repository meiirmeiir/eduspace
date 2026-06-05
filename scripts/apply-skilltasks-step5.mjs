/**
 * apply-skilltasks-step5.mjs — применяет очистку explanation (Шаг 5).
 * Источник: audit/_st5_result.json (items с after) + audit/_st5_cases.json (оригиналы).
 * Пост-чек перед записью КАЖДОГО поля:
 *   • live.explanation совпадает с оригиналом (before) — иначе skip (данные изменились);
 *   • каждый $...$ сегмент в after присутствует ДОСЛОВНО в before (только удаление, не правка математики);
 *   • after непустой, без мусорных маркеров, не длиннее before; changed=true.
 *   node scripts/apply-skilltasks-step5.mjs            # DRY-RUN
 *   node scripts/apply-skilltasks-step5.mjs --apply    # backup + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const items = JSON.parse(readFileSync(resolve(__dirname, '../audit/_st5_result.json'), 'utf8')).items;
const cases = JSON.parse(readFileSync(resolve(__dirname, '../audit/_st5_cases.json'), 'utf8'));
const origBy = new Map(cases.map((c) => [`${c.bank}|${c.level}|${c.ti}`, c.explanation]));

const MATHSPAN = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const MARKERS = [/Пересч[её]т/i, /\bНет:/i, /Исправ(им|лено)/i, /Ошибка в вариант/i, /ближайш/i, /выбер[еи]м/i, /Уточнение:/i, /если бы/i, /\(Пересчет/i];
const segs = (s) => (String(s).match(MATHSPAN) || []);
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '');

const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · читаю skillTasks…\n`);
const snap = await db.collection('skillTasks').get();
const docs = {};
snap.forEach((d) => { docs[d.id] = d.data(); });

const FLAG = /ВНИМАНИЕ|не совпадает|недостижим|конфликт|требует ручной|противореч|нет.*вывода|answer недостижим/i;
const ok = [], skip = [];
for (const it of items) {
  if (!it.changed) { skip.push({ it, why: 'не менялось' }); continue; }
  if (FLAG.test(it.note || '')) { skip.push({ it, why: 'конфликт answer → манульный' }); continue; }
  const key = `${it.bank}|${it.level}|${it.ti}`;
  const before = origBy.get(key);
  if (before == null) { skip.push({ it, why: 'нет оригинала' }); continue; }
  const t = docs[it.bank]?.[it.level]?.[it.ti];
  if (!t) { skip.push({ it, why: 'нет задачи' }); continue; }
  if (norm(t.explanation) !== norm(before)) { skip.push({ it, why: 'live≠оригинал' }); continue; }
  const after = String(it.after || '');
  if (!after.trim()) { skip.push({ it, why: 'after пустой' }); continue; }
  if (after.length > before.length + 5) { skip.push({ it, why: 'after длиннее (добавление?)' }); continue; }
  // каждый $-сегмент after ⊆ $-сегменты before (дословно)
  const bSet = new Set(segs(before).map(norm));
  const bad = segs(after).find((s) => !bSet.has(norm(s)));
  if (bad) { skip.push({ it, why: 'новый/изменённый $-сегмент: ' + bad.slice(0, 30) }); continue; }
  if (MARKERS.some((m) => m.test(after))) { skip.push({ it, why: 'остался маркер' }); continue; }
  ok.push({ ...it, before, after });
}

console.log(`📊 к записи: ${ok.length} · пропуск: ${skip.length}\n`);
for (const e of ok.slice(0, 6)) {
  console.log(`\n  [${e.bank} ${e.level}[${e.ti}]]`);
  console.log(`    до:    ${e.before.replace(/\n/g, ' ').slice(0, 120)}`);
  console.log(`    после: ${e.after.replace(/\n/g, ' ').slice(0, 120)}`);
}
const skipReasons = {}; for (const s of skip) skipReasons[s.why.replace(/:.*/, '')] = (skipReasons[s.why.replace(/:.*/, '')] || 0) + 1;
console.log('\n— пропуск по причинам —', JSON.stringify(skipReasons));

if (!APPLY) { console.log('\n🔵 DRY-RUN.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-skilltasks-expl`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'skillTasks.json'), JSON.stringify(docs, null, 2), 'utf8');
console.log(`\n💾 Backup → migration/backups/${ts}-skilltasks-expl/skillTasks.json`);
const byDoc = {};
for (const e of ok) (byDoc[e.bank] ||= []).push(e);
let w = 0;
for (const [id, list] of Object.entries(byDoc)) {
  const data = docs[id];
  for (const e of list) data[e.level][e.ti].explanation = e.after;
  const upd = {};
  for (const lvl of ['a', 'b', 'c']) if (list.some((x) => x.level === lvl)) upd[lvl] = data[lvl];
  await db.collection('skillTasks').doc(id).update(upd);
  w++;
}
console.log(`\n✅ Обновлено документов: ${w} (explanation: ${ok.length}).\n`);
