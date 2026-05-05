/**
 * Firestore backup script — экспортирует 16 коллекций прогресса в JSON.
 *
 * Запуск:
 *   node scripts/backup-firestore.mjs
 *
 * Service account берётся из ./scripts/service-account.json
 * (уже используется в set-admin-claim.mjs)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

// ── Конфигурация ──────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = './scripts/service-account.json';

const COLLECTIONS = [
  // 5 коллекций с doc-ключом = phone (основная цель миграции)
  'skillProgress',
  'skillMastery',
  'userProgress',
  'individualPlans',
  'quizProgress',
  // остальные коллекции с if true (для полноты бэкапа)
  'diagnosticResults',
  'expertReports',
  'medals',
  'hwSubmissions',
  'lessonLogs',
  'schedule',
  'homework',
  'lessons',
  'wbImages',
  'wbStrokes',
  'whiteboards',
];

// ── Инициализация ─────────────────────────────────────────────────────────────

let sa;
try {
  sa = JSON.parse(readFileSync(resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
} catch (e) {
  console.error(`\n❌ Не удалось прочитать service account: ${SERVICE_ACCOUNT_PATH}`);
  console.error('   Убедись, что файл существует и содержит валидный JSON.');
  process.exit(1);
}

initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── Бэкап ─────────────────────────────────────────────────────────────────────

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(`migration/backups/${timestamp}`);
mkdirSync(backupDir, { recursive: true });

console.log(`\n📦 Бэкап Firestore → ${backupDir}\n`);

let totalDocs = 0;
let totalBytes = 0;

for (const colName of COLLECTIONS) {
  try {
    const snapshot = await db.collection(colName).get();
    const docs = {};
    snapshot.forEach(doc => { docs[doc.id] = doc.data(); });

    const count = Object.keys(docs).length;
    const json = JSON.stringify(docs, null, 2);
    const bytes = Buffer.byteLength(json, 'utf8');

    const filePath = join(backupDir, `${colName}.json`);
    writeFileSync(filePath, json, 'utf8');

    totalDocs += count;
    totalBytes += bytes;

    console.log(`  ✓ ${colName.padEnd(20)} ${String(count).padStart(4)} документов   ${(bytes / 1024).toFixed(1)} KB`);
  } catch (e) {
    console.error(`  ✗ ${colName}: ${e.message}`);
  }
}

console.log(`\n─────────────────────────────────────────────────`);
console.log(`  Итого: ${totalDocs} документов, ${(totalBytes / 1024).toFixed(1)} KB`);
console.log(`  Папка: migration/backups/${timestamp}/`);
console.log(`\n✅ Бэкап завершён. Проверь файлы перед следующим шагом.\n`);
