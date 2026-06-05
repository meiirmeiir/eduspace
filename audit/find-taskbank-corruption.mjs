import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// 1) найти complex_eq_std_1 — в какой коллекции?
const RUN = /\?{2,}/;
const collections = ['taskBank', 'questions', 'sections', 'skills'];
for (const col of collections) {
  const snap = await db.collection(col).get();
  let found = null, corruptDocs = 0, corruptItems = 0, total = 0;
  snap.forEach((d) => {
    const data = d.data();
    const blob = JSON.stringify(data);
    // содержит ли документ complex_eq_std_1
    if (blob.includes('complex_eq_std_1') && !found) found = d.id;
    // считаем порчу: ?? в любом строковом поле/вложенных вопросах
    let docCorrupt = false;
    const scan = (obj) => {
      if (typeof obj === 'string') { if (RUN.test(obj)) { corruptItems++; docCorrupt = true; } total++; }
      else if (Array.isArray(obj)) obj.forEach(scan);
      else if (obj && typeof obj === 'object') Object.values(obj).forEach(scan);
    };
    scan(data);
    if (docCorrupt) corruptDocs++;
  });
  console.log(`[${col}] докум: ${snap.size} · с complex_eq_std_1: ${found || '—'} · документов с ??-порчей: ${corruptDocs} · строк с ??: ${corruptItems}`);
}
process.exit(0);
