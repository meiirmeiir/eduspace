import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// Путь к скачанному Service Account JSON
const SERVICE_ACCOUNT_PATH = './scripts/service-account.json';

// UID админа
const ADMIN_UID = 'TQR8qCK1qdPRWX5AvrugemGxw6G3';

initializeApp({ credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) });

await getAuth().setCustomUserClaims(ADMIN_UID, { role: 'admin' });
console.log(`✓ Custom claim role=admin выставлен для UID: ${ADMIN_UID}`);
console.log('Перелогинься в браузере — токен обновится автоматически.');
