// Привязка Telegram-бота к родителю по одноразовому коду (Этап 2, фаза B).
// Архитектура:
//   telegramLinkCodes/{code} = { parentUid, expiresAt }
//     — резолв кода → РОДИТЕЛЬ (в отличие от parentLinkCodes: код → ученик).
//   users/{parentUid}.telegramLinkCode — текущий выданный код (для revoke при перегенерации;
//     пишет клиент-родитель).
//   users/{parentUid}.telegramLink = { chatId, tgUsername, tgName, linkedAt }
//     — привязанный Telegram-аккаунт; ставит ТОЛЬКО Cloud Function (webhook) через Admin SDK,
//     клиент читает свой (кабинет показывает «кто привязан»). В rules — blocked-key self-update.
//
// Код — 6 цифр (зеркало parentLinkUtils), TTL 10 минут, single-use: webhook удаляет код при
// первом /start КОД или /link КОД. Каждый «Подключить» генерит свежий код и инвалидирует прошлый.
// Безопасность deep-link (код в URL t.me/...?start=КОД): закрыта single-use (клик родителя
// потребляет код за секунды) + TTL + показом привязанного аккаунта в кабинете + 1-клик отвязкой.

import { db, doc, getDoc, setDoc, updateDoc, deleteDoc } from '../firestore-rest.js';

// Единый источник username бота — менять ТОЛЬКО здесь (deep-link + текст карточки).
export const TELEGRAM_BOT_USERNAME = 'parent_aapa_bot';
const CODE_TTL_MS = 10 * 60 * 1000;

// 6 цифр без ведущего нуля — легко продиктовать боту (как genParentLinkCode).
export function genTelegramLinkCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

// Diff-ссылка: клик открывает бота и авто-шлёт «/start КОД» (deep-link привязки).
export function telegramDeepLink(code) {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`;
}

// Создаёт свежий одноразовый код привязки (TTL 10 мин), инвалидируя предыдущий код родителя.
// Возвращает { code, expiresAt } или null при провале. Порядок: записать новый → обновить
// указатель users.telegramLinkCode → удалить старый (без окна «нет кода»). Зеркало
// regenerateParentLinkCode: коллизия-ретрай + старый ключ реестра удаляется.
export async function createTelegramLinkCode(user) {
  if (!user?.uid) return null;
  const oldCode = user.telegramLinkCode || null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genTelegramLinkCode();
    if (code === oldCode) continue;                 // не выдать тот же
    try {
      const taken = await getDoc(doc(db, 'telegramLinkCodes', code));
      if (taken.exists()) continue;                 // коллизия — другой код
      const expiresAt = Date.now() + CODE_TTL_MS;
      await setDoc(doc(db, 'telegramLinkCodes', code), { parentUid: user.uid, expiresAt });
      await updateDoc(doc(db, 'users', user.uid), { telegramLinkCode: code });
      // инвалидируем старый ТОЛЬКО после успешной записи нового
      if (oldCode && oldCode !== code) {
        try { await deleteDoc(doc(db, 'telegramLinkCodes', oldCode)); } catch {}
      }
      return { code, expiresAt };
    } catch (e) {
      console.warn('[telegramLink] createTelegramLinkCode attempt failed', e?.message || e);
    }
  }
  return null;
}
