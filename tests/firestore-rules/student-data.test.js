/**
 * Тесты для auto-ID коллекций с полем userId:
 * diagnosticResults, expertReports, medals, hwSubmissions
 */
import { describe, test, beforeAll, afterEach, afterAll } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { getTestEnv, authedDb, anonDb, seed, clearData, destroyEnv } from './helpers.js';

describe('diagnosticResults', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('владелец читает свой результат', async () => {
    await seed(env, 'diagnosticResults/doc1', { userId: 'alice', score: 80 });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'diagnosticResults/doc1')));
  });

  test('другой пользователь НЕ читает чужой результат', async () => {
    await seed(env, 'diagnosticResults/doc1', { userId: 'alice', score: 80 });
    const db = authedDb(env, 'bob');
    await assertFails(getDoc(doc(db, 'diagnosticResults/doc1')));
  });

  test('анонимный НЕ читает результат', async () => {
    await seed(env, 'diagnosticResults/doc1', { userId: 'alice', score: 80 });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'diagnosticResults/doc1')));
  });

  test('студент создаёт результат со своим userId', async () => {
    const db = authedDb(env, 'alice');
    await assertSucceeds(addDoc(collection(db, 'diagnosticResults'), { userId: 'alice', score: 90 }));
  });

  test('студент НЕ может создать результат с чужим userId', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'diagnosticResults'), { userId: 'bob', score: 90 }));
  });

  test('анонимный НЕ может создать результат', async () => {
    const db = anonDb(env);
    await assertFails(addDoc(collection(db, 'diagnosticResults'), { userId: 'alice', score: 90 }));
  });

  test('admin читает любой результат', async () => {
    await seed(env, 'diagnosticResults/doc1', { userId: 'alice', score: 80 });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'diagnosticResults/doc1')));
  });

  test('admin может обновить результат', async () => {
    await seed(env, 'diagnosticResults/doc1', { userId: 'alice', score: 80 });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(updateDoc(doc(db, 'diagnosticResults/doc1'), { studentPhotos: [] }));
  });

  test('студент НЕ может обновить результат', async () => {
    await seed(env, 'diagnosticResults/doc1', { userId: 'alice', score: 80 });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'diagnosticResults/doc1'), { score: 100 }));
  });
});

describe('expertReports', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('студент читает свой отчёт', async () => {
    await seed(env, 'expertReports/rep1', { userId: 'alice', recommendations: 'ok' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'expertReports/rep1')));
  });

  test('другой студент НЕ читает чужой отчёт', async () => {
    await seed(env, 'expertReports/rep1', { userId: 'alice', recommendations: 'ok' });
    const db = authedDb(env, 'bob');
    await assertFails(getDoc(doc(db, 'expertReports/rep1')));
  });

  test('анонимный НЕ читает отчёт', async () => {
    await seed(env, 'expertReports/rep1', { userId: 'alice' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'expertReports/rep1')));
  });

  test('студент НЕ может создать отчёт', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'expertReports'), { userId: 'alice', recommendations: 'hack' }));
  });

  test('admin создаёт отчёт', async () => {
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(addDoc(collection(db, 'expertReports'), { userId: 'alice', recommendations: 'study' }));
  });

  test('admin читает любой отчёт', async () => {
    await seed(env, 'expertReports/rep1', { userId: 'alice' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'expertReports/rep1')));
  });

  test('admin обновляет отчёт', async () => {
    await seed(env, 'expertReports/rep1', { userId: 'alice', recommendations: 'ok' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(updateDoc(doc(db, 'expertReports/rep1'), { recommendations: 'updated' }));
  });
});

describe('medals', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('студент читает свою медаль', async () => {
    await seed(env, 'medals/med1', { userId: 'alice', sectionId: 's1' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'medals/med1')));
  });

  test('другой студент НЕ читает чужую медаль', async () => {
    await seed(env, 'medals/med1', { userId: 'alice', sectionId: 's1' });
    const db = authedDb(env, 'bob');
    await assertFails(getDoc(doc(db, 'medals/med1')));
  });

  test('анонимный НЕ читает медаль', async () => {
    await seed(env, 'medals/med1', { userId: 'alice', sectionId: 's1' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'medals/med1')));
  });

  test('студент создаёт медаль со своим userId', async () => {
    const db = authedDb(env, 'alice');
    await assertSucceeds(addDoc(collection(db, 'medals'), { userId: 'alice', sectionId: 's1' }));
  });

  test('студент НЕ создаёт медаль с чужим userId', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'medals'), { userId: 'bob', sectionId: 's1' }));
  });

  test('анонимный НЕ создаёт медаль', async () => {
    const db = anonDb(env);
    await assertFails(addDoc(collection(db, 'medals'), { userId: 'alice', sectionId: 's1' }));
  });

  test('никто НЕ может обновить/удалить медаль', async () => {
    await seed(env, 'medals/med1', { userId: 'alice', sectionId: 's1' });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'medals/med1'), { sectionId: 's2' }));
  });

  test('admin читает любую медаль', async () => {
    await seed(env, 'medals/med1', { userId: 'alice', sectionId: 's1' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'medals/med1')));
  });
});

describe('hwSubmissions', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('студент читает свою сдачу', async () => {
    await seed(env, 'hwSubmissions/sub1', { userId: 'alice', hwId: 'hw1', status: 'pending' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'hwSubmissions/sub1')));
  });

  test('другой студент НЕ читает чужую сдачу', async () => {
    await seed(env, 'hwSubmissions/sub1', { userId: 'alice', hwId: 'hw1', status: 'pending' });
    const db = authedDb(env, 'bob');
    await assertFails(getDoc(doc(db, 'hwSubmissions/sub1')));
  });

  test('анонимный НЕ читает сдачу', async () => {
    await seed(env, 'hwSubmissions/sub1', { userId: 'alice', hwId: 'hw1', status: 'pending' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'hwSubmissions/sub1')));
  });

  test('студент создаёт сдачу со своим userId', async () => {
    const db = authedDb(env, 'alice');
    await assertSucceeds(addDoc(collection(db, 'hwSubmissions'), { userId: 'alice', hwId: 'hw1', status: 'pending' }));
  });

  test('студент НЕ создаёт сдачу с чужим userId', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'hwSubmissions'), { userId: 'bob', hwId: 'hw1', status: 'pending' }));
  });

  test('анонимный НЕ создаёт сдачу', async () => {
    const db = anonDb(env);
    await assertFails(addDoc(collection(db, 'hwSubmissions'), { userId: 'alice', hwId: 'hw1' }));
  });

  test('admin читает любую сдачу', async () => {
    await seed(env, 'hwSubmissions/sub1', { userId: 'alice', hwId: 'hw1', status: 'pending' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'hwSubmissions/sub1')));
  });

  test('admin обновляет сдачу (ставит оценку)', async () => {
    await seed(env, 'hwSubmissions/sub1', { userId: 'alice', hwId: 'hw1', status: 'pending' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(updateDoc(doc(db, 'hwSubmissions/sub1'), { status: 'reviewed', grade: 5 }));
  });

  test('студент НЕ может обновить свою сдачу', async () => {
    await seed(env, 'hwSubmissions/sub1', { userId: 'alice', hwId: 'hw1', status: 'pending' });
    const db = authedDb(env, 'alice');
    await assertFails(updateDoc(doc(db, 'hwSubmissions/sub1'), { status: 'reviewed' }));
  });
});
