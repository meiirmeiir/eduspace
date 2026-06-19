// Бэкофилл trialExpiry ТЕСТ-аккаунту bsZhaekY — чтобы увидеть рабочий trial-countdown
// («Пробный период: осталось 7 дней»). Старый аккаунт без trialExpiry → d=0 → баннер
// после фикса гейта (trialExpiry-presence) скрыт; с trialExpiry=today+6 → d=7.
//
// Безопасность: БЭКАП перед записью + DRY-RUN по умолчанию + точечно (1 поле, merge).
//   node scripts/_backfill_bszhaek_trial.mjs                 # dry-run: бэкап + печать, НЕ пишет
//   node scripts/_backfill_bszhaek_trial.mjs --apply         # запись trialExpiry
//   node scripts/_backfill_bszhaek_trial.mjs --days=2 --apply # иной горизонт (d=3, warn)
//   node scripts/_backfill_bszhaek_trial.mjs --days=-1 --apply# в прошлое (истечение → inactive при логине)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';

const sa = JSON.parse(readFileSync('./scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
// +6 = «осталось 7 дней» (trialExpiry — ПОСЛЕДНИЙ валидный день включительно, как
// регистрация EmailAuthScreen: new Date(Date.now()+6*864e5)). Формат "YYYY-MM-DD" UTC —
// как читают App.jsx:398 (строковое сравнение) и DashboardScreen:92 (trialExpiry+"T23:59:59").
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 6;
const UID = 'bsZhaekYhxODSY9Xanxvh3WutIQ2';
const BACKUP = 'audit/_bszhaek_trial_backup.json';

const trialExpiry = new Date(Date.now() + DAYS * 864e5).toISOString().slice(0, 10);
const TARGET = { trialExpiry };

const snap = await db.collection('users').doc(UID).get();
if (!snap.exists) { console.error('❌ users/' + UID + ' не найден'); process.exit(1); }
const data = snap.data() || {};

const backup = {
  savedAt: new Date().toISOString().slice(0, 10), uid: UID,
  status: data.status ?? null,
  trialExpiry: data.trialExpiry ?? null,
};
writeFileSync(BACKUP, JSON.stringify(backup, null, 2), 'utf8');
console.log('✅ Бэкап (откат):', BACKUP);
console.log('   ТЕКУЩЕЕ :', { status: backup.status, trialExpiry: backup.trialExpiry });
console.log('   ЦЕЛЕВОЕ :', TARGET, `(merge — только trialExpiry; d ≈ ${DAYS + 1})`);

if (!APPLY) {
  console.log('\n⚠️ DRY-RUN — ничего не записано. Для записи: node scripts/_backfill_bszhaek_trial.mjs --apply');
  console.log('   Откат: записать обратно backup.trialExpiry (null) из', BACKUP);
  process.exit(0);
}

await db.collection('users').doc(UID).set(TARGET, { merge: true });
console.log('\n✅ ЗАПИСАНО: bsZhaekY trialExpiry=' + trialExpiry + ' (остальные поля целы).');
console.log('   Откат при необходимости: вернуть trialExpiry из', BACKUP, '(было', backup.trialExpiry + ').');
process.exit(0);
