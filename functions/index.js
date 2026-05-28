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
      details:     d.details     || '',
      region:      d.region      || '',
      updatedAt:   new Date().toISOString(),
    };
    await ref.set(publicData, { merge: true });
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
