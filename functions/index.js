// Cloud Function (Gen 2): начисление недельных медалей.
//
// Запускается каждый понедельник в 00:05 UTC. Берёт прошлую завершённую
// ISO-неделю, читает leaderboard/{prevWeekId}/entries, формирует три рейтинга:
//   - global: все участники
//   - grade:  группировка по полю grade (пустые скипаем)
//   - region: группировка по полю region (пустые скипаем)
//
// Распределение наград (top-10 на категорию):
//   #1     → gold
//   #2-3   → silver
//   #4-10  → bronze
//
// Медаль пишется в users/{uid}/medals/{stableId}, где
//   stableId = `${weekId}_${category}_${type}` — детерминирован, повторный
// запуск перезаписывает то же самое (никаких дубликатов).

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger }     = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Telegram креды читаются из env (functions/.env). Если отсутствуют — уведомления
// просто не отправляются, основная логика медалей продолжает работать.
const TG_TOKEN = process.env.TELEGRAM_TOKEN || '';
const TG_CHAT  = process.env.TELEGRAM_CHAT  || '';

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) {
    logger.warn('Telegram disabled: TELEGRAM_TOKEN or TELEGRAM_CHAT missing in env');
    return;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      logger.error('Telegram send failed', { status: r.status, body: body.slice(0, 200) });
    }
  } catch (e) {
    logger.error('Telegram send threw', { err: String(e) });
  }
}

// ── Родительский Telegram-бот (Этап 2) — отдельный бот @parent_aapa_bot ───────
// НЕ путать с админ-ботом выше (тот на .env для медаль-алёртов). Здесь — токен и
// webhook-секрет в Secret Manager (детские данные → сильнее .env). Секреты
// прокидываются в функцию через опцию `secrets:[...]`; .value() доступен в рантайме.
const PARENT_BOT_TOKEN = defineSecret('PARENT_BOT_TOKEN');
const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');

// Отправка сообщения в конкретный чат родителя (chat_id известен из апдейта).
// Параметризован токеном — в отличие от sendTelegram, который шлёт админу.
async function sendBotMessage(token, chatId, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      logger.error('parentBot send failed', { status: r.status, body: body.slice(0, 200) });
    }
  } catch (e) {
    logger.error('parentBot send threw', { err: String(e) });
  }
}

// Извлечь 6-значный код привязки из аргумента команды (срезать необязательный T-/пробелы).
function parseTgCode(raw) {
  const m = String(raw || '').trim().toUpperCase().replace(/^T-?/, '').replace(/\s/g, '');
  return /^[0-9]{6}$/.test(m) ? m : null;
}

// Экранирование для parse_mode HTML (имена детей могут содержать &, <, >).
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Привязка чата к родителю по коду (Этап 2, фаза B3). Резолвит telegramLinkCodes/{code}
// (Admin SDK обходит rules), проверяет TTL, переносит привязку (один чат на родителя),
// пишет telegramLinks/{chatId} + users.telegramLink (родитель видит «кто привязан» — закрывает
// слепую зону перехвата кода), удаляет код (single-use) + указатель users.telegramLinkCode,
// отвечает с именами детей. Источник имени/username — message.from (username опционален).
async function handleTelegramLink(token, msg, rawArg) {
  const chatId = String(msg?.chat?.id);
  const code = parseTgCode(rawArg);
  if (!code) {
    await sendBotMessage(token, chatId, '⚠️ Неверный формат кода. Сгенерируйте код в кабинете родителя и пришлите его.');
    return;
  }
  const codeRef = db.collection('telegramLinkCodes').doc(code);
  const snap = await codeRef.get();
  if (!snap.exists) {
    await sendBotMessage(token, chatId, '❌ Код неверный или уже использован. Сгенерируйте новый в кабинете родителя.');
    return;
  }
  const cdata = snap.data() || {};
  if (!cdata.expiresAt || cdata.expiresAt <= Date.now()) {
    await codeRef.delete().catch(() => {});
    await sendBotMessage(token, chatId, '⌛ Код истёк (срок действия 10 минут). Сгенерируйте новый в кабинете родителя.');
    return;
  }
  const parentUid = cdata.parentUid;
  if (!parentUid) {
    await codeRef.delete().catch(() => {});
    await sendBotMessage(token, chatId, '❌ Код повреждён. Сгенерируйте новый в кабинете родителя.');
    return;
  }

  const linkedAt = new Date().toISOString();
  const from = msg.from || {};
  const tgName = `${from.first_name || ''} ${from.last_name || ''}`.trim() || null;
  const tgUsername = from.username || null;

  // Один чат на родителя: убрать прежние привязки ЭТОГО родителя (другой chatId → перенос).
  const prevOfParent = await db.collection('telegramLinks').where('parentUid', '==', parentUid).get();
  // Старый владелец ЭТОГО чата (если был ДРУГОЙ родитель) — для снятия его флага (шаг 7).
  const existingChat = await db.collection('telegramLinks').doc(chatId).get();
  const oldParent = existingChat.exists ? (existingChat.data()?.parentUid || null) : null;

  const batch = db.batch();
  prevOfParent.forEach(d => { if (d.id !== chatId) batch.delete(d.ref); });
  batch.set(db.collection('telegramLinks').doc(chatId), { parentUid, active: true, linkedAt });
  batch.set(db.collection('users').doc(parentUid),
    { telegramLink: { chatId, tgUsername, tgName, linkedAt }, telegramLinkCode: FieldValue.delete() },
    { merge: true });
  batch.delete(codeRef);   // single-use: код мёртв после первого потребления
  await batch.commit();

  // Шаг 7: чат переехал с другого родителя — если у старого больше нет чатов, снять его флаг
  // (иначе старый родитель видел бы в кабинете ложное «✓ Подключён»).
  if (oldParent && oldParent !== parentUid) {
    const left = await db.collection('telegramLinks').where('parentUid', '==', oldParent).get();
    if (left.empty) {
      await db.collection('users').doc(oldParent)
        .set({ telegramLink: FieldValue.delete() }, { merge: true }).catch(() => {});
    }
  }

  // Имена детей для подтверждения (из publicProfiles; HTML-escape под parse_mode HTML).
  const names = [];
  try {
    const u = await db.collection('users').doc(parentUid).get();
    const childUids = (u.exists ? u.data()?.childUids : null) || [];
    for (const cid of childUids) {
      const p = await db.collection('publicProfiles').doc(cid).get();
      const pd = p.exists ? p.data() : {};
      const nm = `${pd.firstName || ''} ${pd.lastName || ''}`.trim();
      if (nm) names.push(escapeHtml(nm));
    }
  } catch (e) { logger.error('telegramWebhook: child names failed', { parentUid, err: String(e) }); }

  logger.info('telegram linked', { parentUid, chatId, children: names.length });
  await sendBotMessage(token, chatId,
    names.length
      ? `✅ Готово! Telegram подключён.\n\nБуду присылать отчёты о: <b>${names.join(', ')}</b>.\n` +
        'Команда /report покажет текущий отчёт (скоро).'
      : '✅ Готово, Telegram подключён!\n\nПока к вашему аккаунту не привязан ни один ребёнок — ' +
        'добавьте его в кабинете родителя.');
}

// Отвязка чата от родителя по команде бота (Этап 2, фаза B4). Чат-центрично: рвёт
// привязку чата, из которого пришёл /unlink. Флаг users.telegramLink снимаем, если у
// родителя не осталось чатов (guard симметричен шагу 7 — булетпруф под инвариантом «один чат»).
async function handleTelegramUnlink(token, msg) {
  const chatId = String(msg?.chat?.id);
  const ref = db.collection('telegramLinks').doc(chatId);
  const snap = await ref.get();
  if (!snap.exists) {
    await sendBotMessage(token, chatId, 'ℹ️ У этого чата нет активной привязки.');
    return;
  }
  const parentUid = snap.data()?.parentUid || null;
  await ref.delete();
  if (parentUid) {
    const left = await db.collection('telegramLinks').where('parentUid', '==', parentUid).get();
    if (left.empty) {
      await db.collection('users').doc(parentUid)
        .set({ telegramLink: FieldValue.delete() }, { merge: true }).catch(() => {});
    }
  }
  logger.info('telegram unlinked (bot)', { parentUid, chatId });
  await sendBotMessage(token, chatId,
    '✅ Отвязано. Отчёты больше не приходят.\n\nСнова подключить — в кабинете родителя.');
}

// ── ISO-неделя (год + неделя четверга) ──────────────────────────────────────
function getWeekId(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getPrevWeekId(now = new Date()) {
  const seven = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getWeekId(seven);
}

function tierForPosition(pos) {
  if (pos === 1) return 'gold';
  if (pos <= 3)  return 'silver';
  if (pos <= 10) return 'bronze';
  return null;
}

// Из weekId «2026-W21» делаем {year, week} для записи в документ медали.
function parseWeek(weekId) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekId || '');
  return m ? { year: Number(m[1]), week: Number(m[2]) } : { year: 0, week: 0 };
}

async function loadEntries(weekId) {
  const snap = await db.collection('leaderboard').doc(weekId).collection('entries').get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// Группируем по ключу (grade или region), пропуская пустые.
function groupByNonEmpty(entries, key) {
  const groups = new Map();
  for (const e of entries) {
    const v = (e[key] || '').trim();
    if (!v) continue;
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(e);
  }
  return groups;
}

function rankEntries(entries) {
  return [...entries].sort((a, b) => (b.points || 0) - (a.points || 0));
}

// ── Достижения ──────────────────────────────────────────────────────────────
// Пороги ДУБЛИРУЮТСЯ из src/lib/achievements.js (functions — отдельный пакет,
// не импортирует src/). При изменении — синхронизировать.
const ACH = {
  scholar:  { tiers: ['bronze', 'silver', 'gold'], crystals: [25, 75, 150], thresholds: [1, 5, 15] },
  streak:   { tiers: ['bronze', 'silver', 'gold'], crystals: [25, 75, 150], thresholds: [3, 14, 30] },
  accuracy: { tiers: ['bronze', 'silver', 'gold'], crystals: [25, 75, 150], thresholds: [70, 80, 90] },
  wealth:   { tiers: ['bronze', 'silver', 'gold'], crystals: [25, 75, 150], thresholds: [100, 500, 2000] },
  ranking:  { tiers: ['bronze', 'silver', 'gold'], crystals: [25, 75, 150] }, // пороги = перцентиль (в awardWeeklyMedals)
};
const CREATOR_UID = 'TQR8qCK1qdPRWX5AvrugemGxw6G3';

// Строит кандидатов всех уровней threshold-достижения, где value >= порога.
function leveledCandidates(achievementId, value) {
  const def = ACH[achievementId];
  const out = [];
  def.thresholds.forEach((th, i) => {
    if (value >= th) out.push({ achievementId, level: i + 1, tier: def.tiers[i], crystals: def.crystals[i] });
  });
  return out;
}

// Идемпотентная выдача: проверяет существование, пишет ОДНИМ батчем только
// новые достижения + инкремент crystals + arrayUnion pendingAchievements.
// Не выдаёт повторно (повторный триггер → fresh пуст → no-op → рекурсия сходится).
async function commitAchievements(uid, candidates) {
  if (!uid || !candidates || !candidates.length) return;
  const userRef = db.collection('users').doc(uid);
  const achCol = userRef.collection('achievements');
  const snaps = await Promise.all(candidates.map(c => achCol.doc(`${c.achievementId}_${c.level}`).get()));
  const fresh = candidates.filter((_, i) => !snaps[i].exists);
  if (!fresh.length) return;

  const batch = db.batch();
  const awardedAt = new Date().toISOString();
  const keys = [];
  let crystalsTotal = 0;
  for (const c of fresh) {
    batch.set(achCol.doc(`${c.achievementId}_${c.level}`), {
      achievementId: c.achievementId, level: c.level, tier: c.tier, crystals: c.crystals, awardedAt,
    }, { merge: true });
    keys.push(`${c.achievementId}_${c.level}`);
    crystalsTotal += Number(c.crystals) || 0;
  }
  const userUpdate = { pendingAchievements: FieldValue.arrayUnion(...keys) };
  if (crystalsTotal > 0) userUpdate.crystals = FieldValue.increment(crystalsTotal);
  batch.set(userRef, userUpdate, { merge: true });
  await batch.commit();
  logger.info('achievements awarded', { uid, keys, crystalsTotal });
}

// ── Cloud Function: зеркало публичных полей профиля ────────────────────────
// users/{uid} → publicProfiles/{uid}. Только публичные поля, чтобы клиент
// мог открыть чужой профиль с разрешением `read: if isSignedIn()` без утечки
// phone/email/status/smartDiag*. Запускается на любой write users/{uid}.
exports.mirrorUserToPublicProfile = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const uid = event.params.uid;
    const ref = db.collection('publicProfiles').doc(uid);
    if (!event.data?.after?.exists) {
      // user удалён — зеркало тоже снести (на будущее; сейчас delete users запрещён)
      try { await ref.delete(); } catch (e) { logger.warn('mirror delete failed', { uid, err: String(e) }); }
      return;
    }
    const d = event.data.after.data() || {};
    const publicData = {
      uid,
      firstName:   d.firstName   || '',
      lastName:    d.lastName    || '',
      avatarUrl:   d.avatarUrl   || '',
      equipped:    d.equipped    || {},
      totalPoints: Number(d.totalPoints || 0),
      weekPoints:  Number(d.weekPoints  || 0),
      xp:          Number(d.xp          || 0),
      // crystals/streak — публичные игровые метрики для карточек друзей
      // (FriendsScreen читает прогресс друзей из publicProfiles).
      crystals:    Number(d.crystals    || 0),
      streak:      Number(d.streak     || 0),
      details:     d.details     || '',
      region:      d.region      || '',
      updatedAt:   new Date().toISOString(),
    };
    await ref.set(publicData, { merge: true });
  }
);

// ── Cloud Function: обоюдная дружба при акцепте запроса ─────────────────────
// Клиент не может писать в чужой users-док (rules), поэтому при переходе
// friendRequests/{id}.status → 'accepted' Admin SDK добавляет uid обеих
// сторон в массивы friends друг друга. Идемпотентно (arrayUnion).
exports.onFriendRequestWritten = onDocumentWritten(
  { document: 'friendRequests/{reqId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const a = after.data() || {};
    const before = event.data?.before?.exists ? (event.data.before.data() || {}) : {};
    if (a.status !== 'accepted' || before.status === 'accepted') return;
    const { fromUid, toUid } = a;
    if (!fromUid || !toUid || fromUid === toUid) return;
    const batch = db.batch();
    batch.set(db.collection('users').doc(fromUid), { friends: FieldValue.arrayUnion(toUid) },   { merge: true });
    batch.set(db.collection('users').doc(toUid),   { friends: FieldValue.arrayUnion(fromUid) }, { merge: true });
    await batch.commit();
    logger.info('friendship accepted', { fromUid, toUid, reqId: event.params.reqId });
  }
);

// ── Cloud Function: привязка родителя к ученику по коду ──────────────────────
// Родитель пишет parentLinkRequests/{id} = { parentUid, code, status:'pending' }.
// Admin SDK резолвит код → studentUid и добавляет связь с обеих сторон:
//   parent.childUids  += studentUid
//   student.parentUids += parentUid   (поле создаётся лениво arrayUnion)
// Код = согласие ученика (он сам показал код) → отдельного акцепта нет.
// Идемпотентно: обрабатываем только status:'pending'; повторный триггер на
// 'linked'/'invalid' → ранний return. arrayUnion не плодит дубликатов.
exports.onParentLinkRequestWritten = onDocumentWritten(
  { document: 'parentLinkRequests/{reqId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const a = after.data() || {};
    if (a.status !== 'pending') return;        // доводим только свежий pending
    const ref = after.ref;
    const parentUid = a.parentUid;
    const code = a.code != null ? String(a.code) : '';
    if (!parentUid || !code) {
      await ref.set({ status: 'invalid', reason: 'missing_fields' }, { merge: true });
      return;
    }
    // резолв кода → studentUid (Admin SDK обходит rules)
    const codeSnap = await db.collection('parentLinkCodes').doc(code).get();
    const studentUid = codeSnap.exists ? (codeSnap.data()?.uid || null) : null;
    if (!studentUid) {
      await ref.set({ status: 'invalid', reason: 'code_not_found' }, { merge: true });
      return;
    }
    if (studentUid === parentUid) {
      await ref.set({ status: 'invalid', reason: 'self_link' }, { merge: true });
      return;
    }
    const batch = db.batch();
    batch.set(db.collection('users').doc(parentUid),  { childUids:  FieldValue.arrayUnion(studentUid) }, { merge: true });
    batch.set(db.collection('users').doc(studentUid), { parentUids: FieldValue.arrayUnion(parentUid)  }, { merge: true });
    batch.set(ref, { status: 'linked', studentUid, linkedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
    logger.info('parent linked', { parentUid, studentUid, reqId: event.params.reqId });
  }
);

// ── Cloud Function: отвязка ребёнка от родителя ──────────────────────────────
// Родитель пишет parentUnlinkRequests/{id} = { parentUid, childUid, status:'pending' }.
// Admin SDK убирает связь с обеих сторон (self-write childUids/parentUids
// заблокирован rules Шага 4). Безопасно: arrayRemove удаляет ТОЛЬКО значения,
// привязанные к запросчику (childUid из ЕГО childUids; parentUid=ЕГО uid из
// parentUids ребёнка) → чужую связь снять нельзя, мимо = no-op.
// Идемпотентно: только status:'pending'; повторный arrayRemove = no-op.
exports.onParentUnlinkRequestWritten = onDocumentWritten(
  { document: 'parentUnlinkRequests/{reqId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const a = after.data() || {};
    if (a.status !== 'pending') return;        // гасит ретриггер
    const ref = after.ref;
    const parentUid = a.parentUid;
    const childUid = a.childUid;
    if (!parentUid || !childUid) {
      await ref.set({ status: 'invalid', reason: 'missing_fields' }, { merge: true });
      return;
    }
    const batch = db.batch();
    batch.set(db.collection('users').doc(parentUid), { childUids:  FieldValue.arrayRemove(childUid)  }, { merge: true });
    batch.set(db.collection('users').doc(childUid),  { parentUids: FieldValue.arrayRemove(parentUid) }, { merge: true });
    batch.set(ref, { status: 'done', unlinkedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
    logger.info('parent unlinked', { parentUid, childUid, reqId: event.params.reqId });
  }
);

// ── Достижения по освоению навыков: scholar (1/5/15) + master (весь план) ────
exports.onSkillMasteryWrite = onDocumentWritten(
  { document: 'skillMastery/{uid}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after;
    if (!after?.exists) return;
    const skills = after.data()?.skills || {};
    const masteredIds = Object.entries(skills)
      .filter(([, s]) => Number(s?.stagesCompleted || 0) >= 3)
      .map(([id]) => id);

    const candidates = leveledCandidates('scholar', masteredIds.length);

    // master: все навыки из individualPlans/{uid}.modules[].skills_list[] освоены
    try {
      const planSnap = await db.collection('individualPlans').doc(uid).get();
      if (planSnap.exists) {
        const modules = planSnap.data()?.modules || [];
        const planSkillIds = [...new Set(modules.flatMap(m => (m && m.skills_list) || []))];
        if (planSkillIds.length > 0) {
          const masteredSet = new Set(masteredIds);
          if (planSkillIds.every(id => masteredSet.has(id))) {
            candidates.push({ achievementId: 'master', level: 1, tier: 'exclusive', crystals: 300 });
          }
        }
      }
    } catch (e) { logger.error('master check failed', { uid, err: String(e) }); }

    await commitAchievements(uid, candidates);
  }
);

// ── Достижения по полям users: streak, wealth, accuracy, creator ─────────────
// ВНИМАНИЕ: commitAchievements пишет в users (crystals/pendingAchievements) →
// этот триггер сработает повторно; идемпотентность гасит рекурсию (fresh пуст).
exports.onUserWrite = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after;
    if (!after?.exists) return;
    const d = after.data() || {};
    const candidates = [];

    candidates.push(...leveledCandidates('streak', Number(d.streak || 0)));
    candidates.push(...leveledCandidates('wealth', Number(d.crystals || 0)));

    // accuracy — только при полном окне (>=50 ответов)
    const ra = Array.isArray(d.recentAnswers) ? d.recentAnswers : [];
    if (ra.length >= 50) {
      const window = ra.slice(-50);
      const pct = Math.round((window.filter(Boolean).length / window.length) * 100);
      candidates.push(...leveledCandidates('accuracy', pct));
    }

    if (uid === CREATOR_UID) {
      candidates.push({ achievementId: 'creator', level: 1, tier: 'exclusive', crystals: 0 });
    }

    await commitAchievements(uid, candidates);
  }
);

// ── Достижение oracle: диагностика с результатом 90%+ ────────────────────────
exports.onDiagnosticWrite = onDocumentWritten(
  { document: 'diagnosticResults/{docId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const d = after.data() || {};
    const uid = d.userId;
    if (!uid) return;
    if (Number(d.score || 0) >= 90) {
      await commitAchievements(uid, [{ achievementId: 'oracle', level: 1, tier: 'exclusive', crystals: 300 }]);
    }
  }
);

exports.awardWeeklyMedals = onSchedule(
  {
    schedule: '5 0 * * 1',
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 540,
    retryCount: 0, // повторный запуск не нужен — стабильный medalId дедуплицирует
  },
  async (event) => {
    const now = new Date();
    const weekId = getPrevWeekId(now);
    const { year, week } = parseWeek(weekId);
    const awardedAt = now.toISOString();

    logger.info('awardWeeklyMedals start', { weekId, year, week });

    const entries = await loadEntries(weekId);
    if (entries.length === 0) {
      logger.warn('No leaderboard entries for week — nothing to award', { weekId });
      return;
    }

    // Helper: записать медаль одному пользователю.
    const writes = [];
    const award = (uid, type, category, position) => {
      const medalId = `${weekId}_${category}_${type}`;
      const ref = db.collection('users').doc(uid).collection('medals').doc(medalId);
      writes.push(ref.set({
        type, category, weekId, year, week, position, awardedAt,
      }, { merge: true }));
    };

    let granted = { global: 0, grade: 0, region: 0 };
    // Глобальный #1 этой недели — для счётчика topOneCount и Telegram-алёрта.
    let globalTopUid = null;

    // 1. Global
    const globalRanked = rankEntries(entries);
    globalRanked.slice(0, 10).forEach((e, i) => {
      const t = tierForPosition(i + 1);
      if (t) { award(e.uid, t, 'global', i + 1); granted.global++; }
      if (i === 0) globalTopUid = e.uid;
    });

    // 2. Grade groups
    const gradeGroups = groupByNonEmpty(entries, 'grade');
    for (const list of gradeGroups.values()) {
      rankEntries(list).slice(0, 10).forEach((e, i) => {
        const t = tierForPosition(i + 1);
        if (t) { award(e.uid, t, 'grade', i + 1); granted.grade++; }
      });
    }

    // 3. Region groups
    const regionGroups = groupByNonEmpty(entries, 'region');
    for (const list of regionGroups.values()) {
      rankEntries(list).slice(0, 10).forEach((e, i) => {
        const t = tierForPosition(i + 1);
        if (t) { award(e.uid, t, 'region', i + 1); granted.region++; }
      });
    }

    // Параллельная запись. Cloud Functions держит ~500 одновременных Firestore writes
    // без проблем; для AAPA-объёмов хватит с запасом.
    await Promise.all(writes);

    // topOneCount: учёт побед в глобальном недельном рейтинге. ≥3 побед →
    // Telegram-алёрт админу: «у этого ученика заработано право на кастомизацию».
    let topOneAlert = null;
    if (globalTopUid) {
      try {
        const userRef = db.collection('users').doc(globalTopUid);
        await userRef.update({ topOneCount: FieldValue.increment(1) });
        const userSnap = await userRef.get();
        const data = userSnap.data() || {};
        const newCount = Number(data.topOneCount || 0);
        topOneAlert = { uid: globalTopUid, newCount, firstName: data.firstName || '', lastName: data.lastName || '' };
        if (newCount >= 3) {
          const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || '(без имени)';
          await sendTelegram(
            `👑 <b>${name}</b> заработал право на кастомизацию!\n` +
            `uid: <code>${globalTopUid}</code>\n` +
            `topOneCount: <b>${newCount}</b>\n` +
            `weekId: ${weekId}`
          );
        }
      } catch (e) {
        logger.error('topOneCount update failed', { uid: globalTopUid, err: String(e) });
      }
    }

    // ── Достижения рейтинга: champion (#1), ranking (топ 50/25/10%), legend ──
    try {
      const total = globalRanked.length;
      const top50 = Math.max(1, Math.ceil(total * 0.50));
      const top25 = Math.max(1, Math.ceil(total * 0.25));
      const top10 = Math.max(1, Math.ceil(total * 0.10));
      const achPromises = [];
      globalRanked.forEach((e, i) => {
        const pos = i + 1;
        const c = [];
        if (pos <= top50) c.push({ achievementId: 'ranking', level: 1, tier: 'bronze', crystals: 25 });
        if (pos <= top25) c.push({ achievementId: 'ranking', level: 2, tier: 'silver', crystals: 75 });
        if (pos <= top10) c.push({ achievementId: 'ranking', level: 3, tier: 'gold', crystals: 150 });
        if (pos === 1)    c.push({ achievementId: 'champion', level: 1, tier: 'exclusive', crystals: 300 });
        if (c.length) achPromises.push(commitAchievements(e.uid, c));
      });
      await Promise.all(achPromises);
      // legend — глобальный топ-1 с 3+ победами всего
      if (topOneAlert && topOneAlert.newCount >= 3) {
        await commitAchievements(topOneAlert.uid, [{ achievementId: 'legend', level: 1, tier: 'exclusive', crystals: 300 }]);
      }
    } catch (e) {
      logger.error('ranking achievements failed', { weekId, err: String(e) });
    }

    logger.info('awardWeeklyMedals done', {
      weekId,
      entries: entries.length,
      grades:  gradeGroups.size,
      regions: regionGroups.size,
      granted,
      totalWrites: writes.length,
      topOneAlert,
    });
  }
);

// ── Cloud Function: недельный снимок прогресса ученика ──────────────────────
// Фундамент истории для родительского дашборда: раз в неделю фиксируем состояние
// каждого ученика → progressSnapshots/{uid}/weeks/{weekId}. Через накопление даёт
// настоящий «рост освоения за месяц/неделю» (дельты между снимками).
// overallPct — skill-level avg ([0,40,80,100][stages]) по навыкам ПЛАНА: модульный
// buildDiagModuleTree React-связан и в CF недоступен; дельта консистентна.
// Идемпотентно: doc id = weekId, set(merge) → повторный запуск перезаписывает.
exports.weeklyProgressSnapshot = onSchedule(
  {
    schedule: '10 0 * * 1',      // понедельник 00:10 UTC (после awardWeeklyMedals в 00:05)
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 540,
    retryCount: 0,               // идемпотентно по weekId — повтор не нужен
  },
  async () => {
    const now = new Date();
    const weekId = getPrevWeekId(now);   // завершившаяся неделя — синхронно с leaderboard/medals
    const date = now.toISOString();
    const PCT = st => [0, 40, 80, 100][Math.min(Number(st) || 0, 3)];
    const stagesOf = s => Number(s?.stagesCompleted || 0);

    const masterySnaps = await db.collection('skillMastery').get();
    let written = 0;

    for (const ms of masterySnaps.docs) {
      try {
        const uid = ms.id;
        const skills = ms.data()?.skills || {};

        // агрегаты из стадий + счётчиков
        let masteredCount = 0, inProgressCount = 0, cumAtt = 0, cumCor = 0;
        for (const v of Object.values(skills)) {
          const st = stagesOf(v);
          if (st >= 3) masteredCount++; else if (st > 0) inProgressCount++;
          cumAtt += Number(v?.dailyAttempts || 0);
          cumCor += Number(v?.dailyCorrect || 0);
        }

        // план → overallPct (skill-level) + byVerticalPct
        const planSnap = await db.collection('individualPlans').doc(uid).get();
        const plan = planSnap.exists ? planSnap.data() : null;
        const planSkillIds = [...new Set((plan?.modules || []).flatMap(m => (m && m.skills_list) || []))];
        const pctOfSkill = id => PCT(stagesOf(skills[id]));
        const overallPct = planSkillIds.length
          ? Math.round(planSkillIds.reduce((s, id) => s + pctOfSkill(id), 0) / planSkillIds.length)
          : (Object.keys(skills).length
              ? Math.round(Object.values(skills).reduce((s, v) => s + PCT(stagesOf(v)), 0) / Object.keys(skills).length)
              : 0);
        const byVerticalPct = {};
        (plan?.modules || []).forEach(m => Object.entries(m?.by_vertical || {}).forEach(([vert, arr]) => {
          const ids = (arr || []).map(x => x && x.id).filter(Boolean);
          if (ids.length) byVerticalPct[vert] = Math.round(ids.reduce((s, id) => s + pctOfSkill(id), 0) / ids.length);
        }));

        // weekPoints из leaderboard завершившейся недели
        const lbSnap = await db.collection('leaderboard').doc(weekId).collection('entries').doc(uid).get();
        const weekPoints = lbSnap.exists ? Number(lbSnap.data()?.points || 0) : 0;

        // lastActiveDate из users (родителю users закрыт → отдаём через снимок)
        const uSnap = await db.collection('users').doc(uid).get();
        const lastActiveDate = uSnap.exists ? (uSnap.data()?.lastActiveDate || null) : null;

        await db.collection('progressSnapshots').doc(uid).collection('weeks').doc(weekId).set({
          weekId, date, overallPct, masteredCount, inProgressCount,
          planSkillCount: planSkillIds.length,
          cumulativeAttempts: cumAtt, cumulativeCorrect: cumCor,
          weekPoints, byVerticalPct, lastActiveDate,
        }, { merge: true });
        written++;
      } catch (e) {
        logger.error('snapshot failed for student', { uid: ms.id, err: String(e) });
      }
    }
    logger.info('weeklyProgressSnapshot done', { weekId, students: masterySnaps.size, written });
  }
);

// ── Cloud Function: webhook родительского Telegram-бота (Этап 2, фаза A) ──────
// ПЕРВЫЙ HTTP-эндпоинт проекта. Telegram POST-ит сюда апдейты. Публичный URL →
// защита обязательна: при setWebhook задаётся secret_token, который Telegram шлёт
// в заголовке X-Telegram-Bot-Api-Secret-Token; сверяем с TELEGRAM_WEBHOOK_SECRET →
// иначе 401 (поддельный апдейт отбрасывается). Легитимный трафик Telegram всегда
// несёт верный секрет, поэтому 401 ловит только посторонних.
// Telegram ждёт быстрый 200 на принятый апдейт — иначе ретраит; поэтому на любой
// обработанный апдейт (даже проигнорированный) отвечаем 200.
// Фаза A: реализован только /start (приветствие-заглушка). /link, /report,
// /unlink — фазы B/C.
exports.telegramWebhook = onRequest(
  { region: 'us-central1', memory: '256MiB', secrets: [PARENT_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET] },
  async (req, res) => {
    // 1) только POST от Telegram
    if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
    // 2) подлинность апдейта — secret_token из setWebhook
    if (req.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET.value()) {
      logger.warn('telegramWebhook: bad secret token', { ip: req.ip });
      res.status(401).send('unauthorized');
      return;
    }

    try {
      const update = req.body || {};
      const msg = update.message || update.edited_message || null;
      const chatId = msg?.chat?.id;
      const text = (msg?.text || '').trim();

      // не текстовое сообщение — подтверждаем приём, ничего не делаем
      if (chatId && text) {
        const token = PARENT_BOT_TOKEN.value();
        const parts = text.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts[1] || '';

        if ((cmd === '/start' && arg) || cmd === '/link') {
          // deep-link «/start КОД» (из кабинета) или ручной «/link КОД» → привязка
          await handleTelegramLink(token, msg, arg);
        } else if (cmd === '/unlink') {
          await handleTelegramUnlink(token, msg);
        } else if (cmd === '/start') {
          await sendBotMessage(token, chatId,
            'Здравствуйте! Это бот <b>EduSpace</b> для родителей — сюда приходят отчёты о ' +
            'прогрессе вашего ребёнка.\n\n' +
            'Чтобы подключить: откройте кабинет родителя на сайте → «Подключить Telegram» → ' +
            'нажмите «Открыть бота» или пришлите мне код командой <code>/link КОД</code>.');
        } else {
          await sendBotMessage(token, chatId,
            'Команда недоступна. Отправьте /start или подключитесь кодом: /link КОД.');
        }
      }
    } catch (e) {
      logger.error('telegramWebhook handler threw', { err: String(e) });
    }

    // Telegram ждёт 200, иначе ретраит апдейт
    res.status(200).send('ok');
  }
);

// ── Cloud Function: отвязка Telegram из кабинета (Этап 2, фаза B4) ────────────
// Родитель пишет telegramUnlinkRequests/{id} = { parentUid, status:'pending' }.
// Admin SDK удаляет ВСЕ telegramLinks этого родителя + сбрасывает users.telegramLink
// (клиент telegramLinks не пишет — write:false в B5). Зеркало onParentUnlinkRequestWritten.
// Идемпотентно: доводим только свежий pending; повторный триггер на 'done' выходит.
exports.onTelegramUnlinkRequestWritten = onDocumentWritten(
  { document: 'telegramUnlinkRequests/{reqId}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const a = after.data() || {};
    if (a.status !== 'pending') return;        // гасит ретриггер
    const ref = after.ref;
    const parentUid = a.parentUid;
    if (!parentUid) {
      await ref.set({ status: 'invalid', reason: 'missing_fields' }, { merge: true });
      return;
    }
    const links = await db.collection('telegramLinks').where('parentUid', '==', parentUid).get();
    const batch = db.batch();
    links.forEach(d => batch.delete(d.ref));
    batch.set(db.collection('users').doc(parentUid), { telegramLink: FieldValue.delete() }, { merge: true });
    batch.set(ref, { status: 'done', unlinkedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
    logger.info('telegram unlinked (cabinet)', { parentUid, removed: links.size, reqId: event.params.reqId });
  }
);
