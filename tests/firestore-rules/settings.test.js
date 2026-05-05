/**
 * settings/{docId} — только admin
 */
import { describe, test, beforeAll, afterEach, afterAll } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getTestEnv, authedDb, anonDb, seed, clearData, destroyEnv } from './helpers.js';

describe('settings/{docId}', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('ученик НЕ МОЖЕТ прочитать системные настройки', async () => {
    await seed(env, 'settings/admin', { geminiKey: 'secret' });
    const db = authedDb(env, 'alice');
    await assertFails(getDoc(doc(db, 'settings/admin')));
  });

  test('анонимный НЕ МОЖЕТ прочитать настройки', async () => {
    await seed(env, 'settings/admin', { geminiKey: 'secret' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'settings/admin')));
  });

  test('ученик НЕ МОЖЕТ изменить настройки', async () => {
    await seed(env, 'settings/admin', { geminiKey: 'secret' });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'settings/admin'), { geminiKey: 'hacked' }));
  });

  test('admin МОЖЕТ прочитать настройки', async () => {
    await seed(env, 'settings/admin', { geminiKey: 'secret' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'settings/admin')));
  });

  test('admin МОЖЕТ изменить настройки', async () => {
    await seed(env, 'settings/admin', { geminiKey: 'old' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(updateDoc(doc(db, 'settings/admin'), { geminiKey: 'new' }));
  });
});
