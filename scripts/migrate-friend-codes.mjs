/**
 * migrate-friend-codes.mjs — присваивает friendCode всем существующим
 * пользователям без него + создаёт резолв-доки friendCodes/{code} = {uid}
 * + инициализирует friends: [] (если поля нет).
 *
 *   node scripts/migrate-friend-codes.mjs           # dry-run (только отчёт)
 *   node scripts/migrate-friend-codes.mjs --apply   # запись (с бэкапом users)
 *
 * Перед --apply сохраняет полный дамп users в migration/backups/.
 * Идемпотентен: юзеров с валидным friendCode пропускает; чинит случаи,
 * когда код в users есть, а реестровый док friendCodes отсутствует.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const SERVICE_ACCOUNT_PATH = './scripts/service-account.json';

initializeApp({ credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) });
const db = getFirestore();

const usersSnap = await db.collection('users').get();
const codesSnap = await db.collection('friendCodes').get();
const takenCodes = new Set(codesSnap.docs.map(d => d.id));
const codeOwners = new Map(codesSnap.docs.map(d => [d.id, d.data()?.uid]));

console.log(`users: ${usersSnap.size} · занятых кодов: ${takenCodes.size} · режим: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

function genCode() {
  for (;;) {
    const code = String(100000 + Math.floor(Math.random() * 900000));
    if (!takenCodes.has(code)) { takenCodes.add(code); return code; }
  }
}

const plan = []; // { uid, action, code, setFriends }
for (const docSnap of usersSnap.docs) {
  const uid = docSnap.id;
  const d = docSnap.data() || {};
  const needFriendsInit = !Array.isArray(d.friends);
  const cur = d.friendCode;
  if (cur && codeOwners.get(cur) === uid) {
    if (needFriendsInit) plan.push({ uid, action: 'init_friends_only', code: cur, setFriends: true });
    continue; // код валиден
  }
  if (cur && !codeOwners.has(cur)) {
    // код есть в users, реестра нет — дозаписываем реестр
    takenCodes.add(cur);
    codeOwners.set(cur, uid);
    plan.push({ uid, action: 'register_existing', code: cur, setFriends: needFriendsInit });
    continue;
  }
  // кода нет (или коллизия: реестр указывает на другого) — новый код
  const code = genCode();
  codeOwners.set(code, uid);
  plan.push({ uid, action: cur ? 'regen_collision' : 'assign_new', code, setFriends: needFriendsInit });
}

const byAction = plan.reduce((m, p) => ((m[p.action] = (m[p.action] || 0) + 1), m), {});
console.log('план:', JSON.stringify(byAction), `· всего операций: ${plan.length}`);
for (const p of plan.slice(0, 15)) console.log(`  ${p.action.padEnd(20)} ${p.uid} → ${p.code}${p.setFriends ? ' (+friends:[])' : ''}`);
if (plan.length > 15) console.log(`  ... и ещё ${plan.length - 15}`);

if (!APPLY) { console.log('\nDRY-RUN: ничего не записано. Запусти с --apply для применения.'); process.exit(0); }
if (!plan.length) { console.log('\nВсё уже мигрировано — записывать нечего.'); process.exit(0); }

// ── Бэкап users перед записью ────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `migration/backups/${stamp}-friend-codes`;
mkdirSync(backupDir, { recursive: true });
writeFileSync(`${backupDir}/users.json`, JSON.stringify(
  Object.fromEntries(usersSnap.docs.map(d => [d.id, d.data()])), null, 2));
console.log(`\nбэкап users → ${backupDir}/users.json`);

// ── Запись батчами по 400 (лимит 500 операций, у нас до 2 на юзера) ──────────
let written = 0;
for (let i = 0; i < plan.length; i += 200) {
  const chunk = plan.slice(i, i + 200);
  const batch = db.batch();
  for (const p of chunk) {
    const userUpdate = {};
    if (p.action !== 'init_friends_only' && p.action !== 'register_existing') userUpdate.friendCode = p.code;
    if (p.setFriends) userUpdate.friends = [];
    if (Object.keys(userUpdate).length) batch.set(db.collection('users').doc(p.uid), userUpdate, { merge: true });
    if (p.action !== 'init_friends_only') batch.set(db.collection('friendCodes').doc(p.code), { uid: p.uid }, { merge: true });
  }
  await batch.commit();
  written += chunk.length;
  console.log(`записано ${written}/${plan.length}`);
}
console.log('\n✅ миграция завершена. Бонус: каждый затронутый users-док триггернёт mirrorUserToPublicProfile → зеркала publicProfiles прогреются с новыми полями (crystals/streak).');
