// Кристаллы — отдельная игровая валюта (в дополнение к weekPoints).
// Хранение: users/{uid}.crystals (integer). Атомарный инкремент через
// Firestore REST `:commit` с fieldTransforms.

import { getToken } from 'firebase/app-check';
import { auth, app } from './firebase.js';

const PROJECT = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const KEY     = () => import.meta.env.VITE_FIREBASE_API_KEY;
const DOC     = (path) => `projects/${PROJECT()}/databases/(default)/documents/${path}`;

async function _authHeader() {
  const t = await auth.currentUser?.getIdToken().catch(() => null);
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function _appCheckHeader() {
  try { const r = await getToken(app, false); return { 'X-Firebase-AppCheck': r.token }; }
  catch { return {}; }
}

/**
 * Атомарно прибавляет amount к users/{uid}.crystals.
 * @returns true при успешной записи, false при любом провале (не бросает).
 */
export async function addCrystals(uid, amount, reason) {
  if (!uid || !auth.currentUser) return false;
  if (!Number.isInteger(amount) || amount <= 0) {
    console.warn('[crystals] invalid amount', amount); return false;
  }

  const writes = [{
    transform: {
      document: DOC(`users/${uid}`),
      fieldTransforms: [{ fieldPath: 'crystals', increment: { integerValue: String(amount) } }],
    },
  }];

  console.log('[crystals]', '+' + amount, reason, uid);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) },
      body: JSON.stringify({ writes }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '<no body>');
      console.error('[crystals] FAILED', reason, r.status, t.slice(0, 300));
      return false;
    }
    console.log('[crystals] success', reason, '+' + amount, 'uid=' + uid);
    return true;
  } catch (e) {
    console.error('[crystals] FAILED', reason, 'exception:', e?.message || e);
    return false;
  }
}
