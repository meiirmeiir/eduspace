// Друзья и локальный лидерборд. Архитектура:
//   users/{uid}.friendCode      — 6-значный код приглашения (уникальный)
//   users/{uid}.friends         — массив uid друзей (обоюдный)
//   friendCodes/{code}          — { uid } резолв кода → uid (read: все залогиненные)
//   friendRequests/{autoId}     — { fromUid, fromName, toUid, status, createdAt,
//                                   respondedAt?, seenByFrom } запросы дружбы
//
// Обоюдное добавление в friends при акцепте делает Cloud Function
// onFriendRequestWritten (Admin SDK, functions/index.js) — клиент не может
// писать в чужой users-док. Исключение: unfriend — rules разрешают удалить
// РОВНО СВОЙ uid из чужого поля friends (см. firestore.rules, users update).
//
// Прогресс друзей читается из publicProfiles/{uid} (зеркало публичных полей,
// read: isSignedIn) — приватные поля users недоступны.

import { getToken } from 'firebase/app-check';
import { auth, app } from './firebase.js';
import {
  db, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where,
} from '../firestore-rest.js';

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

// ── Код приглашения ───────────────────────────────────────────────────────────
export function genFriendCode() {
  // 6 цифр, без ведущего нуля — читается и диктуется по телефону
  return String(100000 + Math.floor(Math.random() * 900000));
}

// Гарантирует наличие friendCode у пользователя (страховка для аккаунтов,
// созданных до фичи/миграции). Возвращает код или null при провале.
export async function ensureFriendCode(user) {
  if (!user?.uid) return null;
  // Проверяем и сам код, и его запись в реестре friendCodes: при (маловероятной)
  // коллизии на регистрации код в users может указывать на чужой uid в реестре.
  const validate = async (code) => {
    if (!code) return false;
    try {
      const reg = await getDoc(doc(db, 'friendCodes', code));
      if (reg.exists()) return reg.data()?.uid === user.uid;
      // кода нет в реестре (старый аккаунт/фейл регистрации) — дозаписываем
      await setDoc(doc(db, 'friendCodes', code), { uid: user.uid });
      return true;
    } catch { return false; }
  };
  if (user.friendCode && await validate(user.friendCode)) return user.friendCode;
  // свежая проверка — профиль в localStorage может отставать
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const existing = snap.exists() ? snap.data()?.friendCode : null;
    if (existing && existing !== user.friendCode && await validate(existing)) return existing;
  } catch {}
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genFriendCode();
    try {
      const taken = await getDoc(doc(db, 'friendCodes', code));
      if (taken.exists()) continue;
      await setDoc(doc(db, 'friendCodes', code), { uid: user.uid });
      await updateDoc(doc(db, 'users', user.uid), { friendCode: code });
      return code;
    } catch (e) {
      console.warn('[friends] ensureFriendCode attempt failed', e?.message || e);
    }
  }
  return null;
}

// Резолв кода → uid (или null).
export async function resolveFriendCode(code) {
  const clean = String(code || '').trim();
  if (!/^\d{6}$/.test(clean)) return null;
  try {
    const snap = await getDoc(doc(db, 'friendCodes', clean));
    return snap.exists() ? (snap.data()?.uid || null) : null;
  } catch { return null; }
}

export function inviteLink(code) {
  return `https://eduspace-murex.vercel.app/invite/${code}`;
}

// ── Запросы дружбы ────────────────────────────────────────────────────────────
// Возвращает: 'sent' | 'already_friends' | 'already_pending' | 'incoming_pending'
// | 'self' | 'not_found' | 'error'
export async function sendFriendRequest(me, toUid) {
  if (!me?.uid || !toUid) return 'error';
  if (toUid === me.uid) return 'self';
  try {
    if ((me.friends || []).includes(toUid)) return 'already_friends';
    const [outgoing, incoming] = await Promise.all([
      fetchRequests('fromUid', me.uid),
      fetchRequests('toUid', me.uid),
    ]);
    if (outgoing.some(r => r.toUid === toUid && r.status === 'pending')) return 'already_pending';
    // встречный pending-запрос от него — не плодим дубль, пусть примет/примем
    if (incoming.some(r => r.fromUid === toUid && r.status === 'pending')) return 'incoming_pending';
    await addDoc(collection(db, 'friendRequests'), {
      fromUid:   me.uid,
      fromName:  `${me.firstName || ''} ${me.lastName || ''}`.trim() || 'Ученик',
      toUid,
      status:    'pending',
      seenByFrom: false,
      createdAt: new Date().toISOString(),
    });
    return 'sent';
  } catch (e) {
    console.error('[friends] sendFriendRequest failed', e?.message || e);
    return 'error';
  }
}

// Все запросы где field(fromUid|toUid) == uid. Статус фильтруем на клиенте,
// чтобы не требовать composite-индекс (объёмы — единицы документов).
export async function fetchRequests(field, uid) {
  try {
    const qs = await getDocs(query(collection(db, 'friendRequests'), where(field, '==', uid)));
    return qs.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[friends] fetchRequests failed', e?.message || e);
    return [];
  }
}

export async function fetchIncomingPending(uid) {
  return (await fetchRequests('toUid', uid)).filter(r => r.status === 'pending');
}

// Исходящие: pending (ждут ответа) и accepted+!seenByFrom («X принял запрос»).
export async function fetchOutgoing(uid) {
  const all = await fetchRequests('fromUid', uid);
  return {
    pending:    all.filter(r => r.status === 'pending'),
    acceptedNew: all.filter(r => r.status === 'accepted' && !r.seenByFrom),
  };
}

export async function acceptRequest(reqId) {
  await updateDoc(doc(db, 'friendRequests', reqId), { status: 'accepted', respondedAt: new Date().toISOString() });
}
export async function declineRequest(reqId) {
  await updateDoc(doc(db, 'friendRequests', reqId), { status: 'declined', respondedAt: new Date().toISOString() });
}
export async function markAcceptedSeen(reqId) {
  try { await updateDoc(doc(db, 'friendRequests', reqId), { seenByFrom: true }); } catch {}
}
export async function cancelRequest(reqId) {
  try { await deleteDoc(doc(db, 'friendRequests', reqId)); } catch {}
}

// ── Удаление друга (обоюдно, без Cloud Function) ─────────────────────────────
// Свой док: owner-update. Чужой док: REST :commit removeAllFromArray — rules
// разрешают не-владельцу убрать РОВНО свой uid из чужого friends.
export async function unfriend(myUid, otherUid) {
  if (!myUid || !otherUid) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  const headers = { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) };
  const rm = (docPath, removeUid) => ({
    transform: {
      document: DOC(docPath),
      fieldTransforms: [{ fieldPath: 'friends', removeAllFromArray: { values: [{ stringValue: removeUid }] } }],
    },
  });
  let ok = true;
  // из своего списка — убрать его
  try {
    const r1 = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ writes: [rm(`users/${myUid}`, otherUid)] }) });
    if (!r1.ok) { console.error('[friends] unfriend self failed', r1.status); ok = false; }
  } catch (e) { console.error('[friends] unfriend self threw', e); ok = false; }
  // из его списка — убрать себя (разрешено rules)
  try {
    const r2 = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ writes: [rm(`users/${otherUid}`, myUid)] }) });
    if (!r2.ok) console.warn('[friends] unfriend other failed (возможно, уже удалён)', r2.status);
  } catch (e) { console.warn('[friends] unfriend other threw', e); }
  return ok;
}

// ── Свежий список друзей (профиль в localStorage может отставать) ────────────
export async function fetchMyFriendsUids(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data()?.friends || []) : [];
  } catch { return []; }
}

// ── Публичные профили друзей одним :batchGet ─────────────────────────────────
// Возвращает Map uid → { firstName, lastName, avatarUrl, equipped, weekPoints,
// totalPoints, xp, crystals, streak, details, region }
export async function fetchFriendProfiles(uids) {
  const out = {};
  if (!uids?.length) return out;
  const headers = { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents`;
  const documents = uids.map(uid => DOC(`publicProfiles/${uid}`));
  try {
    const r = await fetch(`${base}:batchGet?key=${KEY()}`, { method: 'POST', headers, body: JSON.stringify({ documents }) });
    if (!r.ok) return out;
    const arr = await r.json();
    const num = (f) => f ? Number(f.integerValue ?? f.doubleValue ?? 0) : 0;
    for (const item of arr) {
      if (!item.found) continue;
      const uid = item.found.name.split('/').pop();
      const f = item.found.fields || {};
      out[uid] = {
        uid,
        firstName:   f.firstName?.stringValue || '',
        lastName:    f.lastName?.stringValue  || '',
        avatarUrl:   f.avatarUrl?.stringValue || '',
        equippedFrame: f.equipped?.mapValue?.fields?.frame?.stringValue || '',
        equippedTitle: f.equipped?.mapValue?.fields?.title?.stringValue || '',
        weekPoints:  num(f.weekPoints),
        totalPoints: num(f.totalPoints),
        xp:          num(f.xp),
        crystals:    num(f.crystals),
        streak:      num(f.streak),
        details:     f.details?.stringValue || '',
        region:      f.region?.stringValue || '',
      };
    }
  } catch (e) { console.warn('[friends] fetchFriendProfiles failed', e?.message || e); }
  return out;
}

// ── Шеринг приглашения ────────────────────────────────────────────────────────
export function shareLinks(code, name) {
  const link = inviteLink(code);
  const text = `${name ? name + ' приглашает' : 'Приглашаю'} тебя на AAPA — платформу по математике с планетами навыков и битвами с боссами! Заходи: ${link}`;
  return {
    link,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
  };
}
