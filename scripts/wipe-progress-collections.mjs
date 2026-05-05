/**
 * Wipe script — удаляет legacy phone-keyed данные перед миграцией phone→uid.
 *
 * Что удаляет:
 *   1. Все документы из 5 коллекций прогресса (ключ = phone):
 *      skillProgress, skillMastery, userProgress, individualPlans, quizProgress
 *   2. Документы users/{phone} — ключ начинается с "+" (старая структура).
 *      Документы users/{uid} — НЕ трогает.
 *   3. Всех пользователей из Firebase Authentication.
 *
 * Запуск:
 *   node scripts/wipe-progress-collections.mjs
 *
 * Требует подтверждения в терминале: введи слово DELETE
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

// ── Конфигурация ──────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = './scripts/service-account.json';

const PROGRESS_COLLECTIONS = [
  'skillProgress',
  'skillMastery',
  'userProgress',
  'individualPlans',
  'quizProgress',
];

// ── Проверка бэкапа ───────────────────────────────────────────────────────────

const backupsDir = resolve('migration/backups');
if (!existsSync(backupsDir) || readdirSync(backupsDir).length === 0) {
  console.error('\n❌ Папка migration/backups/ пуста или не существует.');
  console.error('   Сначала запусти: node scripts/backup-firestore.mjs');
  process.exit(1);
}

// ── Инициализация ─────────────────────────────────────────────────────────────

let sa;
try {
  sa = JSON.parse(readFileSync(resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
} catch (e) {
  console.error(`\n❌ Не удалось прочитать service account: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

// ── Утилита: удалить все документы коллекции батчами ─────────────────────────

async function deleteCollection(colName) {
  let deleted = 0;
  let snapshot;
  do {
    snapshot = await db.collection(colName).limit(400).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
  } while (!snapshot.empty);
  return deleted;
}

// ── Утилита: удалить всех Auth-пользователей постранично ──────────────────────

async function deleteAllAuthUsers() {
  let deleted = 0;
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    if (result.users.length > 0) {
      const uids = result.users.map(u => u.uid);
      await auth.deleteUsers(uids);
      deleted += uids.length;
    }
    pageToken = result.pageToken;
  } while (pageToken);
  return deleted;
}

// ── Подтверждение в терминале ─────────────────────────────────────────────────

function askConfirmation() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  Введи DELETE для подтверждения: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Главная функция ───────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log('  ⚠️  WIPE SCRIPT — НЕОБРАТИМАЯ ОПЕРАЦИЯ');
console.log('═'.repeat(60));
console.log('\n  Будет удалено:');
console.log('  • Все документы из коллекций:');
PROGRESS_COLLECTIONS.forEach(c => console.log(`    - ${c}`));
console.log('  • Документы users/{phone} (ключ начинается с "+")');
console.log('  • Все пользователи из Firebase Authentication');
console.log('\n  Бэкап: migration/backups/');
console.log('\n' + '─'.repeat(60));

const answer = await askConfirmation();

if (answer !== 'DELETE') {
  console.log('\n  Отменено. Данные не тронуты.\n');
  process.exit(0);
}

console.log('\n  Начинаю удаление...\n');

// 1. Коллекции прогресса
for (const col of PROGRESS_COLLECTIONS) {
  const count = await deleteCollection(col);
  console.log(`  ✓ ${col.padEnd(20)} удалено ${count} документов`);
}

// 2. Документы users/{phone} — ключ начинается с "+"
{
  const snapshot = await db.collection('users').get();
  const phoneDocs = snapshot.docs.filter(d => d.id.startsWith('+'));
  if (phoneDocs.length > 0) {
    const batch = db.batch();
    phoneDocs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`  ✓ users (phone-ключи)   удалено ${phoneDocs.length} документов`);
  } else {
    console.log(`  ✓ users (phone-ключи)   0 документов — пропущено`);
  }
}

// 3. Firebase Authentication
{
  const count = await deleteAllAuthUsers();
  console.log(`  ✓ Firebase Auth         удалено ${count} пользователей`);
}

console.log('\n' + '─'.repeat(60));
console.log('  ✅ Удаление завершено.');
console.log('\n  Следующий шаг:');
console.log('  1. Зарегистрируйся заново через UI (email/пароль).');
console.log('  2. В Firebase Console → Firestore → users → поставь role=admin своему новому uid.');
console.log('  3. Сообщи мне — перейдём к Фазе 2 (замена phone→uid в коде).\n');
