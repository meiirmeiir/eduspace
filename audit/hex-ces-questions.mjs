/**
 * hex-ces-questions.mjs — байтовая форензика вопросов коллекции questions.
 * 1) находит вопросы topic='complex_equation_solving' (+ варианты тегов);
 * 2) hex-дамп первых 30 байт text каждого;
 * 3) ищет аномалии: BOM, U+FFFD, литеральный '?', CP1251-mojibake, контрол-символы, не-UTF8;
 * 4) если паттерн найден — считает по всей коллекции.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('questions').get();
const all = [];
snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
console.log('всего вопросов:', all.length);

// 1) как помечены complex_equation_solving?
const re = /complex_equation_solving/i;
const tagged = all.filter((q) => re.test(JSON.stringify([q.topic, q.skillNames, q.skillId, q.sectionId, q.sectionName, q.skill])));
console.log("\nтег complex_equation_solving в любом поле:", tagged.length);
// какие вообще topic'и содержат 'уравнен' и сколько (5 класс)
const topicCount = {};
for (const q of all) { const t = q.topic || '(нет)'; topicCount[t] = (topicCount[t] || 0) + 1; }
console.log('\ntopic-значения с «уравн» (или complex):');
Object.entries(topicCount).filter(([t]) => /уравн|complex|equation/i.test(t)).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([t, n]) => console.log(`  ${String(n).padStart(3)}  ${JSON.stringify(t).slice(0, 70)}`));

// hex первых N байт
const hex = (s, n = 30) => Buffer.from(String(s), 'utf8').slice(0, n).toString('hex').replace(/(..)/g, '$1 ').trim();
const cps = (s, n = 12) => [...String(s)].slice(0, n).map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

// целевой набор: tagged ИЛИ вопросы про «Реши(те) уравнение» с арифметикой
const target = tagged.length ? tagged : all.filter((q) => /Реши(те)? уравнени|Найдите корень/.test(String(q.text || q.question || '')));
console.log(`\n=== HEX-ДАМП text (целевых: ${target.length}, показываю до 25) ===`);
for (const q of target.slice(0, 25)) {
  const t = String(q.text || q.question || '');
  console.log(`\n[${q.id}] topic=${JSON.stringify(q.topic)} type=${q.type}`);
  console.log(`  text: ${JSON.stringify(t.slice(0, 60))}`);
  console.log(`  hex30: ${hex(t)}`);
  console.log(`  cps12: ${cps(t)}`);
}

// 3) аномалии по всей коллекции
const anom = { bom: [], fffd: [], qmark: [], ctrl: [], moji: [], nonutf: [] };
const MOJI = /[ÐÑ][-¿-¿]|Ã[-¿]/; // типичные UTF8-as-Latin1 пары
for (const q of all) {
  for (const fld of ['text', 'question']) {
    const v = q[fld];
    if (typeof v !== 'string' || !v) continue;
    if (/^﻿/.test(v)) anom.bom.push(q.id);
    if (/�/.test(v)) anom.fffd.push(q.id);
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v)) anom.ctrl.push(q.id);
    if (MOJI.test(v)) anom.moji.push(q.id);
    // литеральный '?' там, где рядом кириллица (подозрение на замену)
    if (/\?{2,}/.test(v) || /[а-яё]\?|\?[а-яё]/i.test(v)) anom.qmark.push(q.id);
  }
}
console.log('\n=== АНОМАЛИИ ПО ВСЕЙ КОЛЛЕКЦИИ (1600) ===');
for (const [k, ids] of Object.entries(anom)) console.log(`  ${k}: ${ids.length}${ids.length ? ' напр. ' + ids.slice(0, 5).join(',') : ''}`);
process.exit(0);
