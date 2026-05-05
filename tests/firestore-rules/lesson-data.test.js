/**
 * Тесты для учительских/урочных коллекций:
 * homework, schedule, lessons, lessonLogs, wbImages, wbStrokes, whiteboards
 */
import { describe, test, beforeAll, afterEach, afterAll } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc, collection } from 'firebase/firestore';
import { getTestEnv, authedDb, anonDb, seed, clearData, destroyEnv } from './helpers.js';

// ── homework ──────────────────────────────────────────────────────────────────

describe('homework', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('студент читает своё ДЗ (userId == uid)', async () => {
    await seed(env, 'homework/hw1', { userId: 'alice', title: 'Задание 1' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'homework/hw1')));
  });

  test('студент читает ДЗ для всех (userId == "")', async () => {
    await seed(env, 'homework/hw2', { userId: '', title: 'Для всех' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'homework/hw2')));
  });

  test('студент НЕ читает чужое ДЗ', async () => {
    await seed(env, 'homework/hw1', { userId: 'bob', title: 'Задание боба' });
    const db = authedDb(env, 'alice');
    await assertFails(getDoc(doc(db, 'homework/hw1')));
  });

  test('анонимный НЕ читает ДЗ', async () => {
    await seed(env, 'homework/hw1', { userId: 'alice', title: 'Задание' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'homework/hw1')));
  });

  test('admin создаёт ДЗ', async () => {
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(addDoc(collection(db, 'homework'), { userId: 'alice', title: 'Новое ДЗ' }));
  });

  test('студент НЕ может создать ДЗ', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'homework'), { userId: 'alice', title: 'Сам себе ДЗ' }));
  });

  test('admin читает любое ДЗ', async () => {
    await seed(env, 'homework/hw1', { userId: 'alice', title: 'Задание' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'homework/hw1')));
  });
});

// ── schedule ──────────────────────────────────────────────────────────────────

describe('schedule', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('залогиненный студент читает расписание', async () => {
    await seed(env, 'schedule/sc1', { subject: 'Math', userIds: ['alice'] });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'schedule/sc1')));
  });

  test('анонимный НЕ читает расписание', async () => {
    await seed(env, 'schedule/sc1', { subject: 'Math', userIds: ['alice'] });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'schedule/sc1')));
  });

  test('admin создаёт запись расписания', async () => {
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(addDoc(collection(db, 'schedule'), { subject: 'Math', userIds: ['alice'] }));
  });

  test('студент НЕ может создать запись расписания', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'schedule'), { subject: 'Hack', userIds: ['alice'] }));
  });

  test('admin удаляет запись расписания', async () => {
    await seed(env, 'schedule/sc1', { subject: 'Math' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(deleteDoc(doc(db, 'schedule/sc1')));
  });
});

// ── lessons ───────────────────────────────────────────────────────────────────

describe('lessons', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('залогиненный читает урок', async () => {
    await seed(env, 'lessons/les1', { studentId: 'alice', subject: 'Math' });
    const db = authedDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'lessons/les1')));
  });

  test('анонимный НЕ читает урок', async () => {
    await seed(env, 'lessons/les1', { studentId: 'alice', subject: 'Math' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'lessons/les1')));
  });

  test('студент НЕ может создать урок', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'lessons'), { studentId: 'alice', subject: 'Math' }));
  });

  test('admin создаёт урок', async () => {
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(addDoc(collection(db, 'lessons'), { studentId: 'alice', subject: 'Math' }));
  });
});

// ── lessonLogs ────────────────────────────────────────────────────────────────

describe('lessonLogs', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  test('admin читает лог урока', async () => {
    await seed(env, 'lessonLogs/log1', { studentId: 'alice', skillName: 'algebra' });
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(getDoc(doc(db, 'lessonLogs/log1')));
  });

  test('студент НЕ читает лог урока', async () => {
    await seed(env, 'lessonLogs/log1', { studentId: 'alice', skillName: 'algebra' });
    const db = authedDb(env, 'alice');
    await assertFails(getDoc(doc(db, 'lessonLogs/log1')));
  });

  test('анонимный НЕ читает лог урока', async () => {
    await seed(env, 'lessonLogs/log1', { studentId: 'alice' });
    const db = anonDb(env);
    await assertFails(getDoc(doc(db, 'lessonLogs/log1')));
  });

  test('admin создаёт лог урока', async () => {
    const db = authedDb(env, 'admin-uid', { role: 'admin' });
    await assertSucceeds(addDoc(collection(db, 'lessonLogs'), { studentId: 'alice', skillName: 'algebra' }));
  });

  test('студент НЕ может создать лог урока', async () => {
    const db = authedDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'lessonLogs'), { studentId: 'alice', skillName: 'algebra' }));
  });
});

// ── whiteboard коллекции ──────────────────────────────────────────────────────

const WB_COLLECTIONS = ['wbImages', 'wbStrokes', 'whiteboards'];

describe('whiteboard коллекции', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  for (const col of WB_COLLECTIONS) {
    test(`[${col}] залогиненный читает документ`, async () => {
      await seed(env, `${col}/wb1`, { wbId: 'lesson1', data: 'x' });
      const db = authedDb(env, 'alice');
      await assertSucceeds(getDoc(doc(db, col, 'wb1')));
    });

    test(`[${col}] анонимный НЕ читает документ`, async () => {
      await seed(env, `${col}/wb1`, { wbId: 'lesson1', data: 'x' });
      const db = anonDb(env);
      await assertFails(getDoc(doc(db, col, 'wb1')));
    });

    test(`[${col}] залогиненный может писать (участник урока)`, async () => {
      const db = authedDb(env, 'alice');
      await assertSucceeds(setDoc(doc(db, col, 'wb_alice'), { wbId: 'lesson1', data: 'stroke' }));
    });

    test(`[${col}] анонимный НЕ может писать`, async () => {
      const db = anonDb(env);
      await assertFails(setDoc(doc(db, col, 'wb1'), { wbId: 'lesson1', data: 'stroke' }));
    });
  }
});
