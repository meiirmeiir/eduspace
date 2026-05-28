// Система уровней и опыта (XP). XP накапливается в users/{uid}.xp (int, никогда
// не сбрасывается) и идёт ПАРАЛЛЕЛЬНО с ESR-очками/кристаллами, не вместо.
// Запись — атомарный increment через REST :commit (как addCrystals/addPoints).

import { getToken } from 'firebase/app-check';
import { auth, app } from './firebase.js';

// ── XP-награды ────────────────────────────────────────────────────────────────
export const XP_REWARDS = {
  correct_answer: 10,
  skill_mastered: 200,
  skill_stage: 50,
  diagnostic_section: 100,
  daily_quest: 30,
  weekly_quest: 100,
};

// Стоимость перехода с уровня `level` на `level+1`.
export function xpForLevel(level) {
  return 50 * level * (level + 1);
}

// ── Тиры уровней ──────────────────────────────────────────────────────────────
export const LEVEL_TIERS = [
  { min: 1,  max: 5,   name: 'Новичок', color: '#cd7f32', tier: 'bronze' },
  { min: 6,  max: 10,  name: 'Ученик',  color: '#94a3b8', tier: 'silver' },
  { min: 11, max: 20,  name: 'Знаток',  color: '#fbbf24', tier: 'gold' },
  { min: 21, max: 30,  name: 'Эксперт', color: '#67e8f9', tier: 'platinum' },
  { min: 31, max: 40,  name: 'Мастер',  color: '#a78bfa', tier: 'diamond' },
  { min: 41, max: 999, name: 'Легенда', color: '#f97316', tier: 'legend' },
];

function tierForLevel(level) {
  return LEVEL_TIERS.find(t => level >= t.min && level <= t.max) || LEVEL_TIERS[LEVEL_TIERS.length - 1];
}

/**
 * По общему накопленному XP считает текущий уровень и прогресс внутри него.
 * Старт — уровень 1 с 0 XP; накапливаем стоимости xpForLevel(1)+xpForLevel(2)+…
 * пока сумма не превысит totalXp.
 * @returns { level, currentLevelXp, nextLevelXp, progress, tier }
 */
export function getLevelInfo(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  let cum = 0;
  // защитный предел итераций (на случай гигантского XP)
  while (level < 999 && cum + xpForLevel(level) <= xp) {
    cum += xpForLevel(level);
    level++;
  }
  const currentLevelXp = xp - cum;
  const nextLevelXp = xpForLevel(level);
  const progress = nextLevelXp > 0 ? Math.min(1, currentLevelXp / nextLevelXp) : 1;
  return { level, currentLevelXp, nextLevelXp, progress, tier: tierForLevel(level) };
}

// ── REST helpers (как в crystalsUtils.js) ────────────────────────────────────
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
 * Атомарно прибавляет amount к users/{uid}.xp и возвращает информацию о
 * повышении уровня/тира (для анимаций). Парсит transformResults из ответа
 * :commit, поэтому новый XP получаем race-safe (без отдельного чтения).
 * Не бросает; при провале возвращает null.
 *
 * @returns {{ totalXp, newLevel, leveledUp, newTier, tierChanged }|null}
 */
export async function addXp(uid, amount, reason, _user) {
  if (!uid || !auth.currentUser) return null;
  if (!Number.isInteger(amount) || amount <= 0) {
    console.warn('[xp] invalid amount', amount, reason); return null;
  }

  const writes = [{
    transform: {
      document: DOC(`users/${uid}`),
      fieldTransforms: [{ fieldPath: 'xp', increment: { integerValue: String(amount) } }],
    },
  }];

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  console.log('[xp]', '+' + amount, reason, uid);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) },
      body: JSON.stringify({ writes }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '<no body>');
      console.error('[xp] FAILED', reason, r.status, t.slice(0, 300));
      return null;
    }
    const j = await r.json().catch(() => null);
    const newXp = Number(j?.writeResults?.[0]?.transformResults?.[0]?.integerValue);
    if (!Number.isFinite(newXp)) return null; // запись прошла, но без подтверждённого значения
    const oldXp = Math.max(0, newXp - amount);
    const before = getLevelInfo(oldXp);
    const after = getLevelInfo(newXp);
    return {
      totalXp: newXp,
      newLevel: after.level,
      leveledUp: after.level > before.level,
      newTier: after.tier,
      tierChanged: after.tier.tier !== before.tier.tier,
    };
  } catch (e) {
    console.error('[xp] FAILED', reason, 'exception:', e?.message || e);
    return null;
  }
}
