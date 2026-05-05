import { describe, test, beforeAll, afterEach, afterAll, expect } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { getTestEnv, authedDb, anonDb, seed, clearData, destroyEnv } from './helpers.js';

describe('users/{uid}', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  // ── Чтение ──────────────────────────────────────────────────────────────────

  test('ученик может прочитать свой профиль', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
  });

  test('ученик НЕ может прочитать профиль другого ученика', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'bob');
    await assertFails(getDoc(doc(db, 'users/alice')));
  });

  test('анонимный пользователь НЕ может прочитать чужой профиль', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'users/alice')));
  });

  test('ученик НЕ может получить список всех пользователей', async () => {
    await seed(env, 'users/alice', { role: 'student' });
    await seed(env, 'users/bob',   { role: 'student' });
    const db = authedDb(env, 'alice');
    await assertFails(getDocs(collection(db, 'users')));
  });

  test('admin МОЖЕТ получить список всех пользователей', async () => {
    await seed(env, 'users/alice', { role: 'student' });
    await seed(env, 'users/bob',   { role: 'student' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDocs(collection(db, 'users')));
  });

  test('admin может прочитать любой профиль', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
  });

  // ── Обновление ───────────────────────────────────────────────────────────────

  test('ученик может обновить своё имя', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { name: 'Alice Updated' }));
  });

  test('ученик НЕ может обновить профиль другого ученика', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'bob');
    await assertFails(updateDoc(doc(db, 'users/alice'), { name: 'Hacked' }));
  });

  test('ученик НЕ может повысить свою роль до admin', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'admin' }));
  });

  test('ученик НЕ может изменить свой статус подписки', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student', status: 'trial' });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'premium' }));
  });

  test('admin может изменить роль пользователя', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { role: 'teacher' }));
  });

  test('admin может изменить статус пользователя', async () => {
    await seed(env, 'users/alice', { name: 'Alice', role: 'student', status: 'trial' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { status: 'active' }));
  });

  // ── Удаление ─────────────────────────────────────────────────────────────────

  test('никто НЕ может удалить профиль пользователя', async () => {
    await seed(env, 'users/alice', { name: 'Alice' });
    const db = authedDb(env, 'alice');
    await assertFails(deleteDoc(doc(db, 'users/alice')));
  });

  test('даже admin НЕ может удалить профиль', async () => {
    await seed(env, 'users/alice', { name: 'Alice' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertFails(deleteDoc(doc(db, 'users/alice')));
  });
});
