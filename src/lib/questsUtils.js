// Логика прогресса ежедневных/еженедельных квестов.
// Хранение: users/{uid}.dailyQuests (с полем date) и users/{uid}.weeklyQuests (с полем weekId).
// Переиспользуем существующие утилиты, чтобы не плодить расхождения:
//   getWeekId      — pointsUtils.js (формат '2026-W22', та же неделя, что у рейтинга)
//   getAlmatyDateStr — srsUtils.js  (дата UTC+5)
//   addCrystals    — crystalsUtils.js (атомарное начисление)

import { doc, getDoc, updateDoc, db } from '../firestore-rest.js';
import { getWeekId } from './pointsUtils.js';
import { getAlmatyDateStr } from './srsUtils.js';
import { addCrystals } from './crystalsUtils.js';
import { addXp, XP_REWARDS } from './levelUtils.js';
import { DAILY_QUESTS, WEEKLY_QUESTS } from './quests.js';

export const getTodayAlmaty   = () => getAlmatyDateStr(0);
export const getCurrentWeekId = () => getWeekId();

// ── Мини-эмиттер выполненных квестов (мост updateQuestProgress → App для сундука) ─
const _questListeners = new Set();
export function subscribeQuest(cb) {
  _questListeners.add(cb);
  return () => _questListeners.delete(cb);
}
function emitQuest(payload) {
  for (const cb of _questListeners) { try { cb(payload); } catch (e) { console.warn('[quest] listener error', e); } }
}

function freshBucket(defs, keyField, keyValue) {
  const b = { [keyField]: keyValue };
  for (const q of defs) b[q.id] = { progress: 0, completed: false };
  return b;
}

/**
 * Сбрасывает dailyQuests, если сохранённая дата != сегодня (UTC+5).
 * Возвращает user с актуальным полем dailyQuests (без мутации входного).
 */
export async function initDailyQuests(uid, user) {
  if (!uid) return user;
  const today = getTodayAlmaty();
  const cur = user?.dailyQuests;
  if (cur && cur.date === today) return user;
  const fresh = freshBucket(DAILY_QUESTS, 'date', today);
  try { await updateDoc(doc(db, 'users', uid), { dailyQuests: fresh }); }
  catch (e) { console.warn('[quests] initDaily failed:', e?.message || e); }
  return { ...(user || {}), dailyQuests: fresh };
}

/**
 * Сбрасывает weeklyQuests, если сохранённый weekId != текущий.
 */
export async function initWeeklyQuests(uid, user) {
  if (!uid) return user;
  const weekId = getCurrentWeekId();
  const cur = user?.weeklyQuests;
  if (cur && cur.weekId === weekId) return user;
  const fresh = freshBucket(WEEKLY_QUESTS, 'weekId', weekId);
  try { await updateDoc(doc(db, 'users', uid), { weeklyQuests: fresh }); }
  catch (e) { console.warn('[quests] initWeekly failed:', e?.message || e); }
  return { ...(user || {}), weeklyQuests: fresh };
}

function findQuest(questType) {
  const d = DAILY_QUESTS.find(q => q.type === questType);
  if (d) return { def: d, bucket: 'dailyQuests' };
  const w = WEEKLY_QUESTS.find(q => q.type === questType);
  if (w) return { def: w, bucket: 'weeklyQuests' };
  return null;
}

/**
 * Обновляет прогресс квеста по его type.
 *   mode='inc' (по умолчанию) — прибавить value к текущему прогрессу;
 *   mode='set'                — установить прогресс в value (для стрика).
 * Прогресс ограничивается target. При достижении target и !completed —
 * отмечает completed и атомарно начисляет кристаллы (идемпотентно: повторные
 * вызовы по уже выполненному квесту — no-op). Не бросает.
 *
 * @returns {{completed:boolean, awarded:number}|false}
 */
export async function updateQuestProgress(uid, questType, value, _user, mode = 'inc') {
  if (!uid) return false;
  const found = findQuest(questType);
  if (!found) { console.warn('[quests] unknown questType:', questType); return false; }
  const { def, bucket } = found;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : {};
    const cur = data?.[bucket]?.[def.id] || { progress: 0, completed: false };
    if (cur.completed) return { completed: true, awarded: 0 };

    const base = Number(cur.progress) || 0;
    let next = mode === 'set' ? Number(value) : base + Number(value);
    if (!Number.isFinite(next)) next = base;
    next = Math.max(0, Math.min(next, def.target));
    const completed = next >= def.target;

    await updateDoc(doc(db, 'users', uid), {
      [`${bucket}.${def.id}.progress`]: next,
      [`${bucket}.${def.id}.completed`]: completed,
    });

    if (completed) {
      await addCrystals(uid, def.crystals, 'quest_' + def.id);
      const isDaily = bucket === 'dailyQuests';
      addXp(uid, isDaily ? XP_REWARDS.daily_quest : XP_REWARDS.weekly_quest, isDaily ? 'daily_quest' : 'weekly_quest', _user);
      // Сундук-награда (визуализация; кристаллы уже начислены выше).
      emitQuest({ id: def.id, icon: def.icon, title: def.title, crystals: def.crystals });
      return { completed: true, awarded: def.crystals };
    }
    return { completed: false, awarded: 0 };
  } catch (e) {
    console.warn('[quests] updateQuestProgress failed:', questType, e?.message || e);
    return false;
  }
}
