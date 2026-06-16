// Rules-тесты привязки Telegram (Этап 2, фаза B5). Атаки на детские данные +
// регресс существующих правил. Эмулятор firestore :8080 (npm run test:rules).
import { describe, test, beforeAll, afterEach, afterAll } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { getTestEnv, authedDb, seed, clearData, destroyEnv } from './helpers.js';

const FUTURE = 1893456000000;   // фикс. future epoch ms (int) — корректный expiresAt

describe('Telegram-привязка (Этап 2, фаза B)', () => {
  let env;
  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  // ── telegramLinkCodes: создание кода родителем ────────────────────────────
  test('#1 родитель создаёт код со СВОИМ parentUid — succeed', async () => {
    const db = authedDb(env, 'alice');
    await assertSucceeds(setDoc(doc(db, 'telegramLinkCodes/123456'), { parentUid: 'alice', expiresAt: FUTURE }));
  });

  test('#2 код с ЧУЖИМ parentUid — deny', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(setDoc(doc(db, 'telegramLinkCodes/123456'), { parentUid: 'bob', expiresAt: FUTURE }));
  });

  test('#3 код с лишними ключами — deny (hasOnly)', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(setDoc(doc(db, 'telegramLinkCodes/123456'), { parentUid: 'alice', expiresAt: FUTURE, evil: 1 }));
  });

  test('#4 код с expiresAt не-int (float) — deny', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(setDoc(doc(db, 'telegramLinkCodes/123456'), { parentUid: 'alice', expiresAt: 123.45 }));
  });

  test('#5 code-id не 6 цифр — deny (code.matches)', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(setDoc(doc(db, 'telegramLinkCodes/abc12'), { parentUid: 'alice', expiresAt: FUTURE }));
  });

  test('#6 get своего кода — succeed; list коллекции — deny', async () => {
    await seed(env, 'telegramLinkCodes/123456', { parentUid: 'alice', expiresAt: FUTURE });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'telegramLinkCodes/123456')));
    await assertFails(getDocs(collection(db, 'telegramLinkCodes')));
  });

  test('#7 delete своего кода — succeed; чужого — deny', async () => {
    await seed(env, 'telegramLinkCodes/111111', { parentUid: 'alice', expiresAt: FUTURE });
    await seed(env, 'telegramLinkCodes/222222', { parentUid: 'bob', expiresAt: FUTURE });
    const db = authedDb(env, 'alice');
    await assertSucceeds(deleteDoc(doc(db, 'telegramLinkCodes/111111')));
    await assertFails(deleteDoc(doc(db, 'telegramLinkCodes/222222')));
  });

  // ── telegramLinks: только Cloud Function (клиенту закрыто) ─────────────────
  test('#8 telegramLinks read/list/write клиентом — deny (все)', async () => {
    await seed(env, 'telegramLinks/842968471', { parentUid: 'alice', active: true, linkedAt: 'x' });
    const db = authedDb(env, 'alice');
    await assertFails(getDoc(doc(db, 'telegramLinks/842968471')));
    await assertFails(getDocs(collection(db, 'telegramLinks')));
    await assertFails(setDoc(doc(db, 'telegramLinks/999'), { parentUid: 'alice', active: true }));
    await assertFails(deleteDoc(doc(db, 'telegramLinks/842968471')));
  });

  // ── users: telegramLink (webhook-only) vs telegramLinkCode (клиент) ────────
  test('#9 self-update telegramLink — deny (blocked-key)', async () => {
    await seed(env, 'users/alice', { role: 'student', name: 'A' });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'users/alice'), { telegramLink: { chatId: '1', tgName: 'fake' } }));
  });

  test('#10 self-update telegramLinkCode — SUCCEED (B1 не сломан)', async () => {
    await seed(env, 'users/alice', { role: 'student', name: 'A' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { telegramLinkCode: '123456' }));
  });

  test('#11 self-update обычного поля (имя) — succeed (регресс)', async () => {
    await seed(env, 'users/alice', { role: 'student', name: 'A' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { name: 'A2' }));
  });

  // ── telegramUnlinkRequests (B4) ───────────────────────────────────────────
  test('#12 unlink-request: свой parentUid+pending — succeed; чужой/не-pending — deny', async () => {
    const db = authedDb(env, 'alice');
    await assertSucceeds(setDoc(doc(db, 'telegramUnlinkRequests/r1'), { parentUid: 'alice', status: 'pending' }));
    await assertFails(setDoc(doc(db, 'telegramUnlinkRequests/r2'), { parentUid: 'bob', status: 'pending' }));
    await assertFails(setDoc(doc(db, 'telegramUnlinkRequests/r3'), { parentUid: 'alice', status: 'done' }));
  });

  test('#13 unlink-request: read свой — succeed; чужой — deny; update/delete — deny', async () => {
    await seed(env, 'telegramUnlinkRequests/r1', { parentUid: 'alice', status: 'pending' });
    const alice = authedDb(env, 'alice');
    const bob = authedDb(env, 'bob');
    await assertSucceeds(getDoc(doc(alice, 'telegramUnlinkRequests/r1')));
    await assertFails(getDoc(doc(bob, 'telegramUnlinkRequests/r1')));
    await assertFails(updateDoc(doc(alice, 'telegramUnlinkRequests/r1'), { status: 'done' }));
    await assertFails(deleteDoc(doc(alice, 'telegramUnlinkRequests/r1')));
  });

  // ── Регресс: существующие правила детских данных НЕ сломаны ────────────────
  test('#14 регресс: parentLinkCodes create + isParentOf (skillMastery/progressSnapshots)', async () => {
    // parentLinkCode ученика
    const child = authedDb(env, 'kid');
    await assertSucceeds(setDoc(doc(child, 'parentLinkCodes/654321'), { uid: 'kid' }));
    // родитель привязан к ребёнку (parentUids ребёнка)
    await seed(env, 'users/kid', { role: 'student', parentUids: ['mom'] });
    await seed(env, 'skillMastery/kid', { skills: {} });
    await seed(env, 'progressSnapshots/kid/weeks/2026-W24', { weekId: '2026-W24', overallPct: 50 });
    const mom = authedDb(env, 'mom');
    await assertSucceeds(getDoc(doc(mom, 'skillMastery/kid')));
    await assertSucceeds(getDoc(doc(mom, 'progressSnapshots/kid/weeks/2026-W24')));
    // посторонний — НЕ родитель — не читает
    const stranger = authedDb(env, 'stranger');
    await assertFails(getDoc(doc(stranger, 'skillMastery/kid')));
  });
});
