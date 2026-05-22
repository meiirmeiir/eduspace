// Очки и недельный рейтинг.
// Запись делается атомарно через REST `:commit` с increment-transforms, чтобы
// параллельные начисления не теряли очки (read→+N→write был бы lost-update).

import { getToken } from 'firebase/app-check';
import { auth, app } from './firebase.js';

export const POINTS = {
  daily_correct:  10,
  daily_streak_3: 15,
  skill_mastered: 100,
  diagnostic_done: 50,
  day_streak_7:   200,
  fast_answer:    5,
};

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

  const leaderboardPath = `leaderboard/${weekId}/entries/${uid}`;
  const lbTransforms = [];
  const lbUpdateFields = {
    uid:         { stringValue: uid },
    displayName: { stringValue: displayName },
    grade:       { stringValue: grade },
    region:      { stringValue: region },
  };
  const lbUpdateMask = ['uid', 'displayName', 'grade', 'region'];

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

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents:commit?key=${KEY()}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await _authHeader()), ...(await _appCheckHeader()) },
      body: JSON.stringify({ writes }),
    });
    if (!r.ok) {
      const t = await r.text().catch(()=>'<no body>');
      console.error('[points] commit failed', r.status, t.slice(0,200));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[points] commit threw', e);
    return false;
  }
}

// ── Позиция пользователя в текущем недельном рейтинге ─────────────────────────
// Возвращает { rank, total, myPoints } или null при ошибке.
// Глобальный rank (без фильтра по grade/region) — для виджета на дашборде.
export async function getMyWeeklyRank(uid) {
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
    const entries = allDocs.map(d => {
      const id = d.name.split('/').pop();
      const points = Number(d.fields?.points?.integerValue || 0);
      return { id, points };
    }).sort((a, b) => b.points - a.points);
    const myIdx = entries.findIndex(e => e.id === uid);
    const myPoints = myIdx >= 0 ? entries[myIdx].points : 0;
    return { rank: myIdx >= 0 ? myIdx + 1 : null, total: entries.length, myPoints };
  } catch (e) {
    console.warn('[points] getMyWeeklyRank failed', e);
    return null;
  }
}
