// Привязка родитель↔ученик по коду. Архитектура (зеркало friendsUtils):
//   users/{studentUid}.parentLinkCode  — 6-значный код (ХРАНИМ только цифры)
//   users/{studentUid}.parentUids      — массив uid родителей (создаётся лениво
//                                         Cloud Function через arrayUnion)
//   parentLinkCodes/{code}             — { uid:studentUid } резолв кода → ученик
//   parentLinkRequests/{autoId}        — { parentUid, code, status, ... } запрос
//
// Префикс "P-" — ТОЛЬКО UI-слой (отличить от 6-значного friendCode). В реестре
// parentLinkCodes ключ — голые 6 цифр (единообразно с friendCodes). formatParentCode
// добавляет префикс при показе ученику, parseParentCode убирает при вводе родителем.
//
// Двустороннюю связь (parent.childUids[] + student.parentUids[]) пишет Cloud
// Function onParentLinkRequestWritten (Admin SDK) — клиент не пишет в чужой users.
// Код = согласие ученика (он сам показал код) → отдельного акцепта нет.

import {
  db, doc, getDoc, setDoc, updateDoc, deleteDoc,
} from '../firestore-rest.js';

// ── Код привязки ────────────────────────────────────────────────────────────
export function genParentLinkCode() {
  // 6 цифр, без ведущего нуля — читается и диктуется (как genFriendCode)
  return String(100000 + Math.floor(Math.random() * 900000));
}

// UI: показать ученику код с префиксом "P-"
export function formatParentCode(code) {
  return code ? `P-${code}` : '';
}

// Парс ввода родителя: убрать "P-"/"p-"/пробелы → вернуть 6 цифр или null
export function parseParentCode(raw) {
  const m = String(raw || '').trim().toUpperCase().replace(/^P-?/, '').replace(/\s/g, '');
  return /^\d{6}$/.test(m) ? m : null;
}

// Гарантирует наличие parentLinkCode у ученика (страховка для аккаунтов,
// созданных до фичи). Возвращает код (6 цифр) или null при провале.
// Зеркало ensureFriendCode: валидация по реестру + коллизия-ретрай.
export async function ensureParentLinkCode(user) {
  if (!user?.uid) return null;
  const validate = async (code) => {
    if (!code) return false;
    try {
      const reg = await getDoc(doc(db, 'parentLinkCodes', code));
      // НЕ дозаписываем отсутствующий код: иначе stale user.parentLinkCode
      // (старый, удалённый revoke) воскрешает отозванный код. Нет в реестре /
      // указывает на чужой uid → невалиден, ensure сгенерит новый.
      return reg.exists() && reg.data()?.uid === user.uid;
    } catch { return false; }
  };
  if (user.parentLinkCode && await validate(user.parentLinkCode)) return user.parentLinkCode;
  // свежая проверка — профиль в localStorage может отставать
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const existing = snap.exists() ? snap.data()?.parentLinkCode : null;
    if (existing && existing !== user.parentLinkCode && await validate(existing)) return existing;
  } catch {}
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genParentLinkCode();
    try {
      const taken = await getDoc(doc(db, 'parentLinkCodes', code));
      if (taken.exists()) continue;
      await setDoc(doc(db, 'parentLinkCodes', code), { uid: user.uid });
      await updateDoc(doc(db, 'users', user.uid), { parentLinkCode: code });
      return code;
    } catch (e) {
      console.warn('[parentLink] ensureParentLinkCode attempt failed', e?.message || e);
    }
  }
  return null;
}

// Резолв кода → studentUid (или null). Принимает код с префиксом или без.
// Клиенту обычно НЕ нужен (резолв делает Cloud Function через Admin SDK);
// оставлен для отладки/будущего.
export async function resolveParentLinkCode(code) {
  const clean = parseParentCode(code);
  if (!clean) return null;
  try {
    const snap = await getDoc(doc(db, 'parentLinkCodes', clean));
    return snap.exists() ? (snap.data()?.uid || null) : null;
  } catch { return null; }
}

// REVOKE: перегенерация кода с инвалидацией старого (утёкший код перестаёт
// работать). Отличие от ensureFriendCode — старый ключ реестра УДАЛЯЕТСЯ.
// Порядок: сначала записать новый, потом удалить старый (без окна «нет кода»).
// Возвращает новый код (6 цифр) или null.
export async function regenerateParentLinkCode(user) {
  if (!user?.uid) return null;
  const oldCode = user.parentLinkCode || null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genParentLinkCode();
    if (code === oldCode) continue; // не выдать тот же
    try {
      const taken = await getDoc(doc(db, 'parentLinkCodes', code));
      if (taken.exists()) continue;
      await setDoc(doc(db, 'parentLinkCodes', code), { uid: user.uid });
      await updateDoc(doc(db, 'users', user.uid), { parentLinkCode: code });
      // инвалидируем старый ТОЛЬКО после успешной записи нового
      if (oldCode && oldCode !== code) {
        try { await deleteDoc(doc(db, 'parentLinkCodes', oldCode)); } catch {}
      }
      return code;
    } catch (e) {
      console.warn('[parentLink] regenerateParentLinkCode attempt failed', e?.message || e);
    }
  }
  return null;
}
