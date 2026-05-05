/**
 * Контентные коллекции: sections, questions, theories, topics,
 * skills, skillsDb, prereqMap, skillHierarchies, skillTheory,
 * skillTasks, taskBank, dailyTasks, crossGradeLinks, globalSkillMap
 *
 * Правило: залогиненные читают, только admin пишет.
 */
import { describe, test, beforeAll, afterEach, afterAll } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getTestEnv, authedDb, anonDb, seed, clearData, destroyEnv } from './helpers.js';

const CONTENT_COLLECTIONS = [
  'sections', 'questions', 'theories', 'topics',
  'skills', 'skillsDb', 'prereqMap', 'skillHierarchies',
  'skillTheory', 'skillTasks', 'taskBank', 'dailyTasks',
  'crossGradeLinks', 'globalSkillMap',
];

describe('контентные коллекции', () => {
  let env;

  beforeAll(async () => { env = await getTestEnv(); });
  afterEach(async () => { await clearData(env); });
  afterAll(async () => { await destroyEnv(); });

  for (const col of CONTENT_COLLECTIONS) {
    test(`залогиненный ученик МОЖЕТ прочитать документ из "${col}"`, async () => {
      await seed(env, `${col}/doc1`, { title: 'Test' });
      const db = authedDb(env, 'alice');
      await assertSucceeds(getDoc(doc(db, `${col}/doc1`)));
    });

    test(`анонимный НЕ МОЖЕТ прочитать документ из "${col}"`, async () => {
      await seed(env, `${col}/doc1`, { title: 'Test' });
      const db = anonDb(env);
      await assertFails(getDoc(doc(db, `${col}/doc1`)));
    });

    test(`ученик НЕ МОЖЕТ создать/изменить документ в "${col}"`, async () => {
      await seed(env, `${col}/doc1`, { title: 'Test' });
      const db = authedDb(env, 'alice');
      await assertFails(updateDoc(doc(db, `${col}/doc1`), { title: 'Hacked' }));
    });

    test(`admin МОЖЕТ создать/изменить документ в "${col}"`, async () => {
      await seed(env, `${col}/doc1`, { title: 'Test' });
      const db = authedDb(env, 'admin-uid', { role: 'admin' });
      await assertSucceeds(updateDoc(doc(db, `${col}/doc1`), { title: 'Updated by admin' }));
    });

    test(`ученик НЕ МОЖЕТ удалить документ из "${col}"`, async () => {
      await seed(env, `${col}/doc1`, { title: 'Test' });
      const db = authedDb(env, 'alice');
      await assertFails(deleteDoc(doc(db, `${col}/doc1`)));
    });
  }
});
