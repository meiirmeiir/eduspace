/**
 * Тесты для 5 uid-keyed коллекций прогресса:
 * skillProgress, skillMastery, userProgress, individualPlans, quizProgress
 */
import { describe, test, beforeAll, afterEach, afterAll } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { getTestEnv, authedDb, anonDb, seed, clearData, destroyEnv } from './helpers.js';

const PROGRESS_COLLECTIONS = [
  'skillProgress',
  'skillMastery',
  'userProgress',
  'individualPlans',
  'quizProgress',
];

describe('uid-keyed прогресс-коллекции', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  for (const col of PROGRESS_COLLECTIONS) {

    test(`[${col}] владелец читает свой документ`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'alice');
      await assertSucceeds(getDoc(doc(db, col, 'alice')));
    });

    test(`[${col}] другой пользователь НЕ может читать чужой документ`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'bob');
      await assertFails(getDoc(doc(db, col, 'alice')));
    });

    test(`[${col}] анонимный НЕ может читать`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = anonDb(env);
      await assertFails(getDoc(doc(db, col, 'alice')));
    });

    test(`[${col}] владелец может создать свой документ`, async () => {
      const db = authedDb(env, 'alice');
      await assertSucceeds(setDoc(doc(db, col, 'alice'), { skills: {} }));
    });

    test(`[${col}] другой пользователь НЕ может писать в чужой документ`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'bob');
      await assertFails(setDoc(doc(db, col, 'alice'), { skills: { hacked: true } }));
    });

    test(`[${col}] анонимный НЕ может писать`, async () => {
      const db = anonDb(env);
      await assertFails(setDoc(doc(db, col, 'alice'), { skills: {} }));
    });

    test(`[${col}] list-запрос запрещён для всех`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'alice');
      await assertFails(getDocs(collection(db, col)));
    });

    test(`[${col}] admin читает любой документ`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'admin-uid', { role: 'admin' });
      await assertSucceeds(getDoc(doc(db, col, 'alice')));
    });

    test(`[${col}] admin может обновить документ`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'admin-uid', { role: 'admin' });
      // quizProgress: admin не может обновлять (только владелец); остальные — admin может
      if (col === 'quizProgress') {
        await assertFails(updateDoc(doc(db, col, 'alice'), { updatedByAdmin: true }));
      } else {
        await assertSucceeds(updateDoc(doc(db, col, 'alice'), { updatedByAdmin: true }));
      }
    });

    test(`[${col}] никто НЕ может удалить документ`, async () => {
      await seed(env, `${col}/alice`, { skills: {} });
      const db = authedDb(env, 'alice');
      // quizProgress: владелец может удалить (сброс прогресса при выходе из теста)
      if (col === 'quizProgress') {
        await assertSucceeds(deleteDoc(doc(db, col, 'alice')));
      } else {
        await assertFails(deleteDoc(doc(db, col, 'alice')));
      }
    });
  }
});
