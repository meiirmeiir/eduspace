// Очки и недельный рейтинг.
// Запись делается атомарно через REST `:commit` с increment-transforms, чтобы
// параллельные начисления не теряли очки (read→+N→write был бы lost-update).

import { getToken } from 'firebase/app-check';
import { devLog } from './devLog.js';
import { auth, app } from './firebase.js';
import { isTestAccount } from './testAccounts.js';

export const POINTS = {
  daily_correct:  10,
  daily_streak_3: 15,
  skill_mastered: 100,
  diagnostic_done: 50,
  day_streak_7:   200,
  fast_answer:    5,
};

// ── Лиги (по недельным очкам) ────────────────────────────────────────────────
export const LEAGUES = [
  { name: 'Бронза',  icon: '🥉', color: '#cd7f32', min: 0,    max: 299,      next: 300  },
  { name: 'Серебро', icon: '🥈', color: '#94a3b8', min: 300,  max: 699,      next: 700  },
  { name: 'Золото',  icon: '🥇', color: '#fbbf24', min: 700,  max: 1199,     next: 1200 },
  { name: 'Алмаз',   icon: '💎', color: '#a78bfa', min: 1200, max: Infinity, next: null },
];

/**
 * По очкам возвращает текущую лигу, следующую (если есть), и прогресс
 * заполнения бара 0..1 от начала текущей до начала следующей.
 */
export function getLeague(points) {
  const p = Number(points) || 0;
  const current = LEAGUES.find(l => p >= l.min && p <= l.max) || LEAGUES[LEAGUES.length - 1];
  const idx = LEAGUES.indexOf(current);
  const nextLeague = current.next != null ? LEAGUES[idx + 1] : null;
  const span = (current.next ?? current.max) - current.min;
  const progress = current.next == null ? 1 : Math.min(1, Math.max(0, (p - current.min) / Math.max(1, span)));
  const pointsToNext = current.next != null ? Math.max(0, current.next - p) : null;
  return { current, nextLeague, nextName: nextLeague?.name || null, progress, pointsToNext };
}

const PROJECT = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const KEY     = () => import.meta.env.VITE_FIREBASE_API_KEY;
const BASE    = () => `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents`;
const DOC     = (path) => `projects/${PROJECT()}/databases/(default)/documents/${path}`;

// ── ISO-неделя (год + неделя четверга), для устойчивости на границе года ─────
export function getWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;          // понедельник=1...воскресенье=7
  d.setUTCDate(d.getUTCDate() + 4 - day);  // четверг текущей недели
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Понедельник 00:00 UTC текущей недели — ISO string. Единый источник правды.
export function getMondayUtcIso(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString();
}

// Имя для лидерборда: «Имя Ф.»
function buildDisplayName(user) {
  const first = (user?.firstName || '').trim();
  const lastInitial = (user?.lastName || '').trim().charAt(0);
  return lastInitial ? `${first} ${lastInitial}.` : first || 'Аноним';
}

async function _authHeader() {
  const t = await auth.currentUser?.getIdToken().catch(() => null);
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function _appCheckHeader() {
  try { const r = await getToken(app, false); return { 'X-Firebase-AppCheck': r.token }; }
  catch { return {}; }
}

// ── Главная функция ─────────────────────────────────────────────────────────
//
// Возвращает true при успешной записи, false при ошибке (не бросает —
// начисление очков не должно ломать пользовательский flow).
//
// userProfile — текущий `user` из React state (нужен displayName/grade/region).
export async function addPoints(uid, action, userProfile) {
  if (!uid || !auth.currentUser) return false;
  const delta = POINTS[action];
  if (!Number.isInteger(delta) || delta <= 0) {
    console.warn('[points] unknown action:', action); return false;
  }

  // Читаем users/{uid}, чтобы понять нужен ли weekly reset и каков weekId.
  let weekReset = null;
  let needReset = false;
  const userDocUrl = `${BASE()}/users/${encodeURIComponent(uid)}?key=${KEY()}`;
  try {
    const r = await fetch(userDocUrl, { headers: { ...(await _authHeader()), ...(await _appCheckHeader()) } });
    if (r.ok) {
      const j = await r.json();
      weekReset = j?.fields?.weekReset?.stringValue || null;
    }
  } catch (e) { console.warn('[points] read user failed:', e); }

  const mondayIso = getMondayUtcIso();
  if (!weekReset || weekReset < mondayIso) needReset = true;

  const weekId = getWeekId();
  const displayName = buildDisplayName(userProfile);
  const grade  = userProfile?.details || '';
  const region = userProfile?.region  || '';

  // Структура writes для :commit.
  // 1) users/{uid}: weekPoints — set или inc; totalPoints — всегда inc; weekReset — на ресет.
  // 2) leaderboard/{weekId}/{uid}: points — set или inc; имя/класс/область — set.
  const userTransforms = [{ fieldPath: 'totalPoints', increment: { integerValue: String(delta) } }];
  const userUpdateFields = {};
  const userUpdateMask = [];

  if (needReset) {
    // Не inc — абсолют, чтобы сбросить прошлую неделю
    userUpdateFields.weekPoints = { integerValue: String(delta) };
    userUpdateFields.weekReset  = { stringValue: mondayIso };
    userUpdateMask.push('weekPoints', 'weekReset');
  } else {
    userTransforms.push({ fieldPath: 'weekPoints', increment: { integerValue: String(delta) } });
  }

  // Денормализуем публичные кастомизации в entry, чтобы LeaderboardScreen
  // рендерил аватар + рамку + титул одним запросом, без N+1 чтения users/{uid}.
  const equipped = userProfile?.equipped || {};
  const leaderboardPath = `leaderboard/${weekId}/entries/${uid}`;
  const lbTransforms = [];
  const lbUpdateFields = {
    uid:           { stringValue: uid },
    displayName:   { stringValue: displayName },
    firstName:     { stringValue: userProfile?.firstName || '' },
    lastName:      { stringValue: userProfile?.lastName  || '' },
    avatarUrl:     { stringValue: userProfile?.avatarUrl || '' },
    equippedFrame: { stringValue: equipped.frame || '' },
    equippedTitle: { stringValue: equipped.title || '' },
    grade:         { stringValue: grade },
    region:        { stringValue: region },
    // XP денормализуем для бейджа уровня в строках лидерборда. Обновляется при
    // начислении очков (addPoints), поэтому может слегка отставать от users/{uid}.xp.
    xp:            { integerValue: String(Number(userProfile?.xp || 0)) },
  };
  const lbUpdateMask = ['uid', 'displayName', 'firstName', 'lastName', 'avatarUrl', 'equippedFrame', 'equippedTitle', 'grade', 'region', 'xp'];

  if (needReset) {
    lbUpdateFields.points = { integerValue: String(delta) };
    lbUpdateMask.push('points');
  } else {
    lbTransforms.push({ fieldPath: 'points', increment: { integerValue: String(delta) } });
  }

  const writes = [];
  // user: всегда обновляем хотя бы totalPoints (inc); update-часть только если есть set-поля.
  if (userUpdateMask.length) {
    writes.push({
      update: { name: DOC(`users/${uid}`), fields: userUpdateFields },
      updateMask: { fieldPaths: userUpdateMask },
      currentDocument: { exists: true },
    });
  }
  writes.push({
    transform: { document: DOC(`users/${uid}`), fieldTransforms: userTransforms },
  });

  // ГАРД РЕЙТИНГА: тест-аккаунты (видео-пайплайн bsZhaekY + ручные тесты) НЕ
  // пишут entry лидерборда → не засоряют топ, который видят реальные ученики.
  // Профиль-очки (users.totalPoints/weekPoints выше) копятся как обычно.
  // Список — src/lib/testAccounts.js (затравка-трио и реальные НЕ включены).
  if (!isTestAccount(uid)) {
    // leaderboard entry: всегда set имя/класс/область (на случай смены) + points
    writes.push({
      update: { name: DOC(leaderboardPath), fields: lbUpdateFields },
      updateMask: { fieldPaths: lbUpdateMask },
    });
    if (lbTransforms.length) {
      writes.push({
        transform: { document: DOC(leaderboardPath), fieldTransforms: lbTransforms },
      });
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  devLog('[points] attempting', action, uid, '(+'+delta+', weekId='+weekId+', reset='+needReset+')');
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) },
      body: JSON.stringify({ writes }),
    });
    if (!r.ok) {
      const t = await r.text().catch(()=>'<no body>');
      console.error('[points] FAILED', action, r.status, t.slice(0, 500));
      return false;
    }
    devLog('[points] success', action, '+'+delta, 'uid='+uid);
    return true;
  } catch (e) {
    console.error('[points] FAILED', action, 'exception:', e?.message || e);
    return false;
  }
}

// ── Позиция пользователя в текущем недельном рейтинге ─────────────────────────
// Возвращает { rank, total, myPoints } или null при ошибке.
// Глобальный rank (без фильтра по grade/region) — для виджета на дашборде.
/**
 * Загружает leaderboard текущей недели и считает 3 ранга для текущего пользователя:
 * глобальный, в своём классе (по `grade`) и в своей области (по `region`).
 * Также делает 1 дополнительный get-doc на прошлую неделю чтобы посчитать weekChange.
 *
 * @param {string} uid
 * @param {string?} grade   — user.details (например "10 класс"); пустой пропускает gradeRank
 * @param {string?} region  — user.region; пустой пропускает regionRank
 * @returns {{ globalRank, globalTotal, gradeRank, gradeTotal, regionRank, regionTotal, myPoints, weekChange }|null}
 */
export async function getMyWeeklyRank(uid, grade, region) {
  if (!uid) return null;
  try {
    const weekId = getWeekId();
    const url = `${BASE()}/leaderboard/${weekId}/entries?key=${KEY()}&pageSize=300`;
    let allDocs = [];
    let pageToken = null;
    do {
      const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const r = await fetch(`${url}${tokenParam}`, { headers: { ...(await _authHeader()), ...(await _appCheckHeader()) } });
      if (!r.ok) return null;
      const j = await r.json();
      if (j.documents) allDocs = allDocs.concat(j.documents);
      pageToken = j.nextPageToken || null;
    } while (pageToken);

    // Парсим все entries недели с тремя полями для фильтров.
    const entries = allDocs.map(d => {
      const id = d.name.split('/').pop();
      const f  = d.fields || {};
      return {
        id,
        points: Number(f.points?.integerValue || 0),
        grade:  f.grade?.stringValue  || '',
        region: f.region?.stringValue || '',
      };
    }).sort((a, b) => b.points - a.points);

    // Глобальный ранг — индекс пользователя в полном списке.
    const globalIdx = entries.findIndex(e => e.id === uid);
    const myPoints  = globalIdx >= 0 ? entries[globalIdx].points : 0;
    const globalRank  = globalIdx >= 0 ? globalIdx + 1 : null;
    const globalTotal = entries.length;

    // Ранги по группам — клиентский фильтр (низкие N, нормально).
    let gradeRank = null, gradeTotal = 0;
    if (grade) {
      const groupG = entries.filter(e => e.grade === grade);
      gradeTotal = groupG.length;
      const i = groupG.findIndex(e => e.id === uid);
      gradeRank = i >= 0 ? i + 1 : null;
    }
    let regionRank = null, regionTotal = 0;
    if (region) {
      const groupR = entries.filter(e => e.region === region);
      regionTotal = groupR.length;
      const i = groupR.findIndex(e => e.id === uid);
      regionRank = i >= 0 ? i + 1 : null;
    }

    // weekChange — points текущей недели минус прошлой (если запись прошлой есть).
    // Один лишний get-doc; ошибку глотаем как 0.
    let weekChange = 0;
    try {
      const prevWeekId = getPrevWeekId();
      const prevUrl = `${BASE()}/leaderboard/${prevWeekId}/entries/${encodeURIComponent(uid)}?key=${KEY()}`;
      const r = await fetch(prevUrl, { headers: { ...(await _authHeader()), ...(await _appCheckHeader()) } });
      if (r.ok) {
        const j = await r.json();
        const prevPoints = Number(j?.fields?.points?.integerValue || 0);
        weekChange = myPoints - prevPoints;
      }
      // 404 = нет записи прошлой недели → weekChange остаётся 0 (нечего сравнивать)
    } catch (_) {}

    return {
      globalRank, globalTotal,
      gradeRank,  gradeTotal,
      regionRank, regionTotal,
      myPoints,
      weekChange,
    };
  } catch (e) {
    console.warn('[points] getMyWeeklyRank failed', e);
    return null;
  }
}

// weekId прошлой недели (для weekChange)
function getPrevWeekId(now = new Date()) {
  const seven = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getWeekId(seven);
}
