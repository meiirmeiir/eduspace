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

/**
 * Онбординг Пикселя: ОДИН раз объясняет кристаллы при ПЕРВОМ начислении.
 * Вызывать СРАЗУ после addCrystals в точке начисления, передав текущий `user`
 * и `showNpcMessage` из useNpc().
 *
 * Детект «впервые»: addCrystals пишет в Firestore и НЕ трогает локальный
 * user.crystals (он заморожен с логина) — поэтому на момент вызова
 * `user.crystals` ещё хранит ПРЕД-начисление. Если оно 0 — кристаллы стали
 * >0 впервые. Однократность — флаг aapa_npc_first_crystals_{uid}
 * (консистентно с greeted/skillmap-флагами онбординга).
 *
 * Ничего не пишет в Firestore и не меняет логику начисления.
 */
export function onboardFirstCrystals(user, showNpcMessage) {
  const uid = user?.uid;
  if (!uid || typeof showNpcMessage !== 'function') return;
  if ((user?.crystals ?? 0) !== 0) return; // у юзера уже были кристаллы — не онбординг
  const key = `aapa_npc_first_crystals_${uid}`;
  try {
    if (localStorage.getItem(key)) return;  // уже показывали
    localStorage.setItem(key, '1');         // ставим СИНХРОННО (защита от двойных вызовов)
  } catch { return; }
  // Задержка: в момент начисления могут идти success(6с)/streak(4с) — даём им
  // догореть, чтобы не накладываться. Spotlight на чип кристаллов — только если
  // он сейчас в DOM (чип скрыт, пока user.weekPoints == null); иначе просто реплика.
  setTimeout(() => {
    const hasChip = !!document.querySelector('[data-tour="crystals-chip"]');
    showNpcMessage('onboard_crystals', 14000, hasChip ? { selector: '[data-tour="crystals-chip"]' } : {});
  }, 6500);
}
