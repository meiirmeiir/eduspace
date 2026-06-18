// Покупка и экипировка предметов магазина.
// Покупка — атомарный REST `:commit` с двумя transforms на одном документе:
//   1) crystals -= price (через increment с отрицательным delta)
//   2) inventory ⊕= [itemId] (через appendMissingElements / arrayUnion)
// Идемпотентно: повторное нажатие «Купить» через UI не должно произойти
// (кнопка дизейблится во время запроса), но даже если случится — arrayUnion
// дедуплицирует itemId, а crystals декрементируются ещё раз — поэтому
// клиентский guard критичен.

import { getToken } from 'firebase/app-check';
import { auth, app } from './firebase.js';
import { getShopItem } from './shopItems.js';
import { devLog } from './devLog.js';
import { doc, updateDoc, db } from '../firestore-rest.js';

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
 * Покупка предмета магазина: атомарно списать кристаллы и добавить itemId в inventory.
 *
 * @param {string} uid
 * @param {string} itemId
 * @param {number} userCrystals — текущий баланс из локального state (для pre-check)
 * @returns {{ success: boolean, error?: string, item?: object, newCrystals?: number }}
 */
export async function purchaseItem(uid, itemId, userCrystals, priceOverride = null) {
  if (!uid || !auth.currentUser) return { success: false, error: 'not_authenticated' };
  const item = getShopItem(itemId);
  if (!item) return { success: false, error: 'unknown_item' };
  // priceOverride — скидочная цена (предложение недели); по умолчанию каталожная.
  const price = priceOverride != null ? priceOverride : item.price;
  if ((userCrystals | 0) < price) return { success: false, error: 'not_enough_crystals' };

  const writes = [{
    transform: {
      document: DOC(`users/${uid}`),
      fieldTransforms: [
        { fieldPath: 'crystals',  increment: { integerValue: String(-price) } },
        { fieldPath: 'inventory', appendMissingElements: { values: [{ stringValue: itemId }] } },
      ],
    },
  }];

  devLog('[shop] purchase attempting', itemId, '-' + price + '💎', 'uid=' + uid);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) },
      body: JSON.stringify({ writes }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '<no body>');
      console.error('[shop] purchase FAILED', itemId, r.status, t.slice(0, 300));
      return { success: false, error: `commit_failed_${r.status}` };
    }
    devLog('[shop] purchase success', itemId, 'uid=' + uid);
    return {
      success: true,
      item,
      newCrystals: userCrystals - price,
    };
  } catch (e) {
    console.error('[shop] purchase exception', itemId, e?.message || e);
    return { success: false, error: 'exception' };
  }
}

/**
 * Покупка набора снаряжения одним атомарным :commit:
 * списываются кристаллы (скидочная цена за недостающие предметы) и все
 * недостающие itemId добавляются в inventory (arrayUnion дедуплицирует).
 *
 * @param {string} uid
 * @param {string[]} itemIds — недостающие предметы сета
 * @param {number} price — итоговая скидочная цена
 * @param {number} userCrystals — баланс для pre-check
 */
export async function purchaseSet(uid, itemIds, price, userCrystals) {
  if (!uid || !auth.currentUser) return { success: false, error: 'not_authenticated' };
  if (!itemIds?.length) return { success: false, error: 'nothing_to_buy' };
  if ((userCrystals | 0) < price) return { success: false, error: 'not_enough_crystals' };

  const writes = [{
    transform: {
      document: DOC(`users/${uid}`),
      fieldTransforms: [
        { fieldPath: 'crystals',  increment: { integerValue: String(-price) } },
        { fieldPath: 'inventory', appendMissingElements: { values: itemIds.map(id => ({ stringValue: id })) } },
      ],
    },
  }];

  devLog('[shop] set purchase attempting', itemIds.join(','), '-' + price + '💎', 'uid=' + uid);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) },
      body: JSON.stringify({ writes }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '<no body>');
      console.error('[shop] set purchase FAILED', r.status, t.slice(0, 300));
      return { success: false, error: `commit_failed_${r.status}` };
    }
    devLog('[shop] set purchase success', 'uid=' + uid);
    return { success: true, newCrystals: userCrystals - price };
  } catch (e) {
    console.error('[shop] set purchase exception', e?.message || e);
    return { success: false, error: 'exception' };
  }
}

/**
 * Надеть предмет (поставить в equipped.{type} = itemId).
 * Использует updateDoc из firestore-rest — он передаст nested поле через dot-path.
 */
export async function equipItem(uid, itemId, type) {
  if (!uid || !type) return { success: false, error: 'bad_args' };
  try {
    await updateDoc(doc(db, 'users', uid), { [`equipped.${type}`]: itemId });
    devLog('[shop] equipped', type, '=', itemId, 'uid=' + uid);
    return { success: true };
  } catch (e) {
    console.error('[shop] equip FAILED', type, itemId, e?.message || e);
    return { success: false, error: 'update_failed' };
  }
}
