/**
 * count-legacy-docs.mjs
 * Считает документы без поля userId в указанных коллекциях.
 * Запуск: node scripts/count-legacy-docs.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'service-account.json'), 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const COLLECTIONS = [
  'hwSubmissions',
  'medals',
  'diagnosticResults',
  'expertReports',
  'homework',
  'lessonLogs',
];

async function countLegacy() {
  console.log('\n=== Сводка по legacy-документам (без поля userId) ===\n');
  console.log('Коллекция'.padEnd(22), 'Всего'.padEnd(8), 'Без userId'.padEnd(12), 'Примеры userPhone');
  console.log('-'.repeat(80));

  let totalAll = 0;
  let totalLegacy = 0;

  for (const colName of COLLECTIONS) {
    const snap = await db.collection(colName).get();
    const all = snap.size;
    const legacyDocs = snap.docs.filter(d => !Object.prototype.hasOwnProperty.call(d.data(), 'userId'));
    const legacy = legacyDocs.length;

    // Собираем примеры userPhone (до 3 штук)
    const samples = legacyDocs
      .slice(0, 3)
      .map(d => d.data().userPhone ?? d.data().phone ?? '(нет поля)')
      .join(', ');

    console.log(
      colName.padEnd(22),
      String(all).padEnd(8),
      String(legacy).padEnd(12),
      samples || '—'
    );

    totalAll += all;
    totalLegacy += legacy;
  }

  console.log('-'.repeat(80));
  console.log('ИТОГО'.padEnd(22), String(totalAll).padEnd(8), String(totalLegacy).padEnd(12));
  console.log('\nДокументы С полем userId (новые, корректные) будут сохранены.');
  console.log('К удалению: только те, у которых userId отсутствует.\n');
}

countLegacy().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
