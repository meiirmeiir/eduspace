import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv;

export async function getTestEnv() {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'aapa-test',
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  }
  return testEnv;
}

/** Контекст аутентифицированного пользователя */
export function authedDb(env, uid, claims = {}) {
  return env.authenticatedContext(uid, claims).firestore();
}

/** Контекст анонимного пользователя */
export function anonDb(env) {
  return env.unauthenticatedContext().firestore();
}

/** Записать данные в обход правил (для подготовки тестов) */
export async function seed(env, path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

export async function clearData(env) {
  await env.clearFirestore();
}

export async function destroyEnv() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}
