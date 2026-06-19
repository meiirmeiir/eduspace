import React, { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import { getWeekId, getMondayUtcIso, getLeague, LEAGUES } from "../lib/pointsUtils.js";
import { getToken } from 'firebase/app-check';
import { auth, app } from "../lib/firebase.js";
import Logo from "../components/ui/Logo.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import { FRAME_STYLES, getShopItem } from "../lib/shopItems.js";
import { getLevelInfo } from "../lib/levelUtils.js";
import InfoTooltip from "../components/InfoTooltip.jsx";
import Podium3D from "../components/Podium3D.jsx";
import { isCreator } from "../lib/creator.js";
import { ensureCreatorStyles } from "../components/creatorFx.js";

const PROJECT = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const KEY     = () => import.meta.env.VITE_FIREBASE_API_KEY;

// Человекочитаемый диапазон текущей недели (вместо ISO «2026-W24»).
const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function formatCurrentWeekRange() {
  const monday = new Date(getMondayUtcIso());
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  const d1 = monday.getUTCDate(), d2 = sunday.getUTCDate();
  const m1 = RU_MONTHS[monday.getUTCMonth()], m2 = RU_MONTHS[sunday.getUTCMonth()];
  const year = sunday.getUTCFullYear();
  return m1 === m2 ? `${d1}–${d2} ${m1} ${year}` : `${d1} ${m1} – ${d2} ${m2} ${year}`;
}

async function _commonHeaders() {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  let appCheck = null;
  try { appCheck = (await getToken(app, false))?.token; } catch {}
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
  };
}

// Подтянуть publicProfiles для тех uid, чьи строки рейтинга были созданы до
// денормализации firstName/avatarUrl/equipped в leaderboard entries. Один
// :batchGet вместо N отдельных GET-ов. Возвращает Map<uid, publicProfile>.
async function fetchPublicProfilesByUids(uids) {
  if (!uids.length) return {};
  const headers = { 'Content-Type': 'application/json', ...(await _commonHeaders()) };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents`;
  const docs = uids.map(uid => `projects/${PROJECT()}/databases/(default)/documents/publicProfiles/${uid}`);
  const body = JSON.stringify({ documents: docs });
  const out = {};
  try {
    const r = await fetch(`${base}:batchGet?key=${KEY()}`, { method: 'POST', headers, body });
    if (!r.ok) return out;
    const arr = await r.json();
    for (const item of arr) {
      if (!item.found) continue;
      const uid = item.found.name.split('/').pop();
      const f = item.found.fields || {};
      out[uid] = {
        firstName:     f.firstName?.stringValue || '',
        lastName:      f.lastName?.stringValue  || '',
        avatarUrl:     f.avatarUrl?.stringValue || '',
        equippedFrame: f.equipped?.mapValue?.fields?.frame?.stringValue || '',
        equippedTitle: f.equipped?.mapValue?.fields?.title?.stringValue || '',
        xp:            f.xp ? Number(f.xp.integerValue || 0) : null,
      };
    }
  } catch (e) { console.warn('[leaderboard] batchGet publicProfiles failed', e); }
  return out;
}

// ── Загрузка entries недельного рейтинга через REST ─────────────────────────
async function fetchEntries(weekId) {
  const headers = await _commonHeaders();
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents`;
  const url  = `${base}/leaderboard/${weekId}/entries?key=${KEY()}&pageSize=300`;
  let all = [];
  let pageToken = null;
  do {
    const t = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const r = await fetch(`${url}${t}`, { headers });
    if (!r.ok) throw new Error(`leaderboard fetch ${r.status}`);
    const j = await r.json();
    if (j.documents) all = all.concat(j.documents);
    pageToken = j.nextPageToken || null;
  } while (pageToken);
  return all.map(d => {
    const id = d.name.split('/').pop();
    const f  = d.fields || {};
    return {
      uid:           id,
      points:        Number(f.points?.integerValue || 0),
      displayName:   f.displayName?.stringValue || 'Аноним',
      firstName:     f.firstName?.stringValue || '',
      lastName:      f.lastName?.stringValue  || '',
      avatarUrl:     f.avatarUrl?.stringValue || '',
      equippedFrame: f.equippedFrame?.stringValue || '',
      equippedTitle: f.equippedTitle?.stringValue || '',
      grade:         f.grade?.stringValue  || '',
      region:        f.region?.stringValue || '',
      xp:            f.xp ? Number(f.xp.integerValue || 0) : null, // null = старая запись без xp
    };
  });
}

const TABS = [
  { id: 'all',     icon: '🌍', label: 'Все' },
  { id: 'grade',   icon: '🏫', label: 'Мой класс' },
  { id: 'region',  icon: '📍', label: 'Моя область' },
  { id: 'friends', icon: '👥', label: 'Друзья' },
];

// Время до следующего сброса рейтинга — понедельник 00:00 UTC.
function getTimeUntilReset() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  const day = next.getUTCDay() || 7; // 1=пн ... 7=вс
  const daysToAdd = ((8 - day) % 7) || 7; // если сейчас пн 00:00, ждём 7 дней
  next.setUTCDate(next.getUTCDate() + daysToAdd);
  const ms = Math.max(0, next.getTime() - now.getTime());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return { days, hours, minutes };
}

export default function LeaderboardScreen({ user, onBack, onOpenPublicProfile, onOpenFriends, onGoDaily }) {
  const { theme: THEME, shopTheme } = useTheme();
  const [tab, setTab] = useState('all');
  // Свежий список друзей из Firestore — user.friends в localStorage может
  // отставать (друг принял запрос с другого устройства).
  const [myFriends, setMyFriends] = useState(user?.friends || []);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilReset());
  // Ранги прошлой недели (общий рейтинг) — для стрелок ↑/↓ на подиуме и в hero.
  const [prevRankByUid, setPrevRankByUid] = useState(null); // Map uid → rank | null
  const weekId = getWeekId();
  // Кастомный wallpaper из equipped.background ученика. Если есть — рисуем
  // фиксированный слой и помечаем .has-bg чтобы page-themed стала transparent.
  const equippedBg = user?.equipped?.background ? getShopItem(user.equipped.background) : null;
  // Wallpaper активен → принудительно светлый текст поверх обоев независимо
  // от темы (на тёмном градиенте leaderboard-bg тоже нужен светлый — формула
  // ниже учитывает оба случая через forceLightText || !equippedBg).
  const forceLightText = !!equippedBg;
  // Страница рейтинга ВСЕГДА на тёмном фоне (leaderboard-bg #0f172a или
  // wallpaper) → все тексты принудительно светлые независимо от base/shop темы.
  // THEME.text/textLight/primary в color: заменены на lt/ltd по всему компоненту.
  const lt  = '#e2e8f0';                    // light text
  const ltd = 'rgba(226,232,240,0.7)';      // light text dimmed

  // Таймер до сброса рейтинга — тик каждую секунду (показываем минуты).
  useEffect(() => {
    const tick = setInterval(() => setTimeLeft(getTimeUntilReset()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Свежий friends для таба «Друзья».
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    import('../lib/friendsUtils.js').then(({ fetchMyFriendsUids }) =>
      fetchMyFriendsUids(user.uid).then(uids => { if (!cancelled) setMyFriends(uids); })
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Предыдущая неделя — нужна для week-delta в карточке «Твоя позиция».
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const prevDate = new Date(Date.now() - 7 * 86400000);
    const prevId = getWeekId(prevDate);
    (async () => {
      try {
        const entries = await fetchEntries(prevId);
        if (cancelled) return;
        // Ранги прошлой недели (по общему рейтингу) — для дельт позиций.
        const sorted = [...entries].sort((a, b) => b.points - a.points);
        const rankMap = {};
        sorted.forEach((e, i) => { rankMap[e.uid] = i + 1; });
        setPrevRankByUid(rankMap);
      } catch { /* prev-week может не существовать — оставим null */ }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    (async () => {
      try {
        const list = await fetchEntries(weekId);
        // Старые записи (до денормализации) не имеют firstName/lastName/avatarUrl/
        // equipped*. Подтягиваем недостающее одним :batchGet из publicProfiles.
        const need = list
          .filter(e => !e.firstName && !e.lastName && !e.avatarUrl && !e.equippedFrame && !e.equippedTitle)
          .map(e => e.uid);
        if (need.length) {
          const ppMap = await fetchPublicProfilesByUids(need);
          for (const e of list) {
            const pp = ppMap[e.uid];
            if (!pp) continue;
            e.firstName     = e.firstName     || pp.firstName;
            e.lastName      = e.lastName      || pp.lastName;
            e.avatarUrl     = e.avatarUrl     || pp.avatarUrl;
            e.equippedFrame = e.equippedFrame || pp.equippedFrame;
            e.equippedTitle = e.equippedTitle || pp.equippedTitle;
            if (e.xp == null && pp.xp != null) e.xp = pp.xp;
          }
        }
        if (!cancelled) { setAllEntries(list); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setErr(String(e)); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [weekId]);

  // Фильтр по вкладке
  const filtered = (() => {
    if (tab === 'grade')   return allEntries.filter(e => e.grade  && e.grade  === user?.details);
    if (tab === 'region')  return allEntries.filter(e => e.region && e.region === user?.region);
    if (tab === 'friends') return allEntries.filter(e => e.uid === user?.uid || myFriends.includes(e.uid));
    return allEntries;
  })().sort((a, b) => b.points - a.points);
  const friendsTabEmpty = tab === 'friends' && myFriends.length === 0;

  const top = filtered.slice(0, 50);
  const myIdx = filtered.findIndex(e => e.uid === user?.uid);
  const myEntry = myIdx >= 0 ? filtered[myIdx] : null;
  const myRank = myIdx >= 0 ? myIdx + 1 : null;
  const myInTop = myIdx >= 0 && myIdx < 50;

  // Дельта позиции к прошлой неделе. Ранги прошлой недели считаны по ОБЩЕМУ
  // рейтингу, поэтому стрелки показываем только на табе «Все».
  const rankDelta = (uid, curRank) => {
    if (tab !== 'all' || !prevRankByUid || !(uid in prevRankByUid)) return null;
    return prevRankByUid[uid] - curRank; // >0 — поднялся, <0 — опустился
  };
  const deltaArrow = (d, size = 12) => d == null || d === 0 ? null : (
    <span style={{ fontSize: size, fontWeight: 800, color: d > 0 ? '#10b981' : '#ef4444', whiteSpace:'nowrap' }}>
      {d > 0 ? `↑${d}` : `↓${-d}`}
    </span>
  );

  const renderRow = (e, idx, opts = {}) => {
    const rank = opts.rank ?? (idx + 1);
    const mine = e.uid === user?.uid;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    const initials = ((e.firstName?.[0] || '') + (e.lastName?.[0] || '')).toUpperCase() || '?';
    const frameStyle = e.equippedFrame ? (FRAME_STYLES[e.equippedFrame] || null) : null;
    const titleItem = e.equippedTitle ? getShopItem(e.equippedTitle) : null;
    const titleText = titleItem?.value || '';
    const league = getLeague(e.points);
    const avatarSize = rank <= 3 ? 64 : 44;
    const clickable = !!onOpenPublicProfile;
    const handleOpen = () => clickable && onOpenPublicProfile(e.uid);
    const topBorder = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : null;
    const topShadow = rank === 1 ? '0 2px 12px rgba(212,175,55,0.3)' : rank === 2 ? '0 2px 8px rgba(148,163,184,0.3)' : rank === 3 ? '0 2px 8px rgba(180,83,9,0.3)' : null;
    const cr = isCreator(e.uid);            // строка Создателя — особая золото-пурпур подсветка
    if (cr) ensureCreatorStyles();
    return (
      <div
        key={`${e.uid}_${rank}`}
        className={`theme-row${cr ? ' creator-row' : ''}`}
        onClick={handleOpen}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleOpen(); } } : undefined}
        style={{
          display:'flex', alignItems:'center', gap:0,
          padding:'14px 16px', borderRadius:14, marginBottom:10,
          // Фон и backdrop полностью под управлением CSS .theme-row
          // (+ .page-themed.has-bg .theme-row для wallpaper). mine выделяем границей.
          // Создатель — золотая граница + анимированный glow из .creator-row.
          border: cr ? '2px solid #fbbf24' : `1px solid ${mine ? THEME.accent : (topBorder || THEME.border)}`,
          ...(cr ? {} : { boxShadow: topShadow || 'none' }),
          cursor: clickable ? 'pointer' : 'default',
          transition: 'transform 0.1s, box-shadow 0.15s',
        }}
        onMouseEnter={clickable && !cr ? (ev) => { ev.currentTarget.style.boxShadow = topShadow || '0 4px 14px rgba(15,23,42,0.08)'; } : undefined}
        onMouseLeave={clickable && !cr ? (ev) => { ev.currentTarget.style.boxShadow = topShadow || ''; } : undefined}
      >
        {/* Ранг: топ-3 — медаль, 4–10 — серебристый кружок с номером (плавный
            переход вместо резкого обрыва), 11+ — текст #N */}
        <div style={{minWidth:48, fontSize: rank<=3?22:15, fontWeight:700, color: rank<=3?THEME.accent:ltd, fontFamily:"'Montserrat',sans-serif"}}>
          {medal || (rank <= 10
            ? <span style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:28, height:28, borderRadius:'50%',
                background:'linear-gradient(135deg, #cbd5e1, #64748b)',
                border:'1px solid rgba(226,232,240,0.5)',
                color:'#0f172a', fontWeight:800, fontSize:13,
                boxShadow:'0 1px 6px rgba(148,163,184,0.35)',
              }}>{rank}</span>
            : `#${rank}`)}
        </div>

        {/* Ученик — аватар + инициалы + титул/класс */}
        <div style={{flex:1, display:'flex', alignItems:'center', gap:12, minWidth:0}}>
          <div style={{position:'relative', flexShrink:0}}>
            {e.avatarUrl
              ? <img src={e.avatarUrl} alt="" style={{
                  width:avatarSize, height:avatarSize, borderRadius:'50%', objectFit:'cover',
                  border: `2px solid ${THEME.accent}`, display:'block',
                  ...(frameStyle || {}),
                }}/>
              : <div style={{
                  width:avatarSize, height:avatarSize, borderRadius:'50%',
                  background:'linear-gradient(135deg, #6366f1, #a78bfa)',
                  color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Montserrat',sans-serif", fontWeight:800,
                  fontSize: rank<=3 ? 16 : 12,
                  border: `2px solid ${THEME.accent}`,
                  ...(frameStyle || {}),
                }}>{initials}</div>
            }
            {/* Бейдж уровня — только если xp денормализован (старые записи без xp пропускаем). */}
            {e.xp != null && (() => {
              const li = getLevelInfo(e.xp);
              const b = rank<=3 ? 22 : 18;
              return (
                <div title={`Уровень ${li.level} · ${li.tier.name}`} style={{
                  position:'absolute', right:-3, bottom:-3,
                  minWidth:b, height:b, borderRadius:b, padding:'0 3px', boxSizing:'border-box',
                  background:li.tier.color, color:'#0f172a', border:`2px solid ${THEME.surface}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize: rank<=3?11:10, lineHeight:1,
                }}>{li.level}</div>
              );
            })()}
          </div>
          <div style={{minWidth:0, overflow:'hidden'}}>
            <div style={{fontWeight:700, fontSize:15, color:lt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {initials}{mine ? ' (вы)' : ''}
            </div>
            {titleText && (
              <div style={{fontSize:11, color:'#d4af37', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {titleText}
              </div>
            )}
            {!titleText && (e.grade || e.region) && (
              <div style={{fontSize:11, color:ltd, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {e.grade}{e.grade && e.region ? ' · ' : ''}{e.region}
              </div>
            )}
          </div>
        </div>

        {/* Лига — иконка + название */}
        <div style={{minWidth:80, textAlign:'center', fontSize:22, lineHeight:1}} title={league.current.name}>
          {league.current.icon}
          <div style={{fontSize:10, color:ltd, marginTop:2, fontWeight:400}}>{league.current.name}</div>
        </div>

        {/* Рейтинг — очки */}
        <div style={{minWidth:80, textAlign:'right', fontWeight:800, fontSize:16, color:lt, fontFamily:"'Montserrat',sans-serif", lineHeight:1}}>
          {e.points.toLocaleString('ru-RU')}
          <div style={{fontSize:10, color:ltd, fontWeight:400, marginTop:2}}>очков</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`page-themed${equippedBg ? ' has-bg' : ' leaderboard-bg'}`} style={{minHeight:'100vh', paddingBottom:80, ...(equippedBg ? { background:'transparent' } : {})}}>
      {equippedBg && (
        <div aria-hidden="true" style={{
          position:'fixed', inset:0, zIndex:-1,
          backgroundImage:`url(${equippedBg.file})`,
          backgroundSize:'cover', backgroundPosition:'center',
          opacity: shopTheme === 'sakura' ? 0.2 : 0.4,
          pointerEvents:'none',
        }}/>
      )}
      <AppTopbar variant="dark" title="Рейтинг" onBack={onBack} user={user} />

      <div style={{maxWidth:720, margin:'0 auto', padding:'24px 16px'}}>
        {/* forceLightText = wallpaper активен → светлый текст поверх обоев.
            !equippedBg → тёмный градиент → светлый текст. Итог: светлый всегда. */}
        {(() => null)()}
        <h1 style={{fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color: lt, marginBottom:6, display:'inline-flex', alignItems:'center'}}>🏆 Рейтинг<InfoTooltip text="Рейтинг по очкам за неделю — за ежедневные задачи, навыки и диагностику. Сбрасывается в понедельник." /></h1>
        <p style={{fontSize:13, color: forceLightText || !equippedBg ? 'rgba(226,232,240,0.7)' : ltd, marginBottom:18}}>Текущая неделя · {formatCurrentWeekRange()} · обновляется в реальном времени</p>

        {/* Фильтры скоупа — равномерная сетка (auto-fit minmax: 2×2 на мобайле, 1 ряд
            на десктопе, равные ширины). «Пригласить друга» — ДЕЙСТВИЕ (filled), вынесено
            из группы фильтров (toggle, outlined) в отдельную строку ниже. */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom: onOpenFriends ? 10 : 18}}>
          {TABS.map(t => (
            <button key={t.id} className={`theme-tab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)} style={{
              padding:'9px 14px', borderRadius:99, fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap', textAlign:'center',
              // Неактив: стекло (страница рейтинга ВСЕГДА тёмная) + светлый текст lt —
              // читается в обеих темах. Раньше фон=THEME.surface (белый в light) → светлый
              // текст на белом = невидим в light mode.
              background: tab===t.id ? THEME.primary : 'rgba(255,255,255,0.08)',
              color: tab===t.id ? (THEME.onPrimary ?? '#fff') : lt,
              border: `1px solid ${tab===t.id ? THEME.primary : 'rgba(255,255,255,0.18)'}`,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
        {onOpenFriends && (
          <div style={{marginBottom:18}}>
            <button onClick={onOpenFriends} style={{
              padding:'9px 18px', borderRadius:99, fontSize:13, fontWeight:800,
              cursor:'pointer', fontFamily:"'Inter',sans-serif",
              background:'linear-gradient(135deg, #7c3aed, #a78bfa)', color:'#fff', border:'none',
              boxShadow:'0 2px 12px rgba(124,58,237,0.45)',
            }}>+ Пригласить друга</button>
          </div>
        )}

        {/* Hero-блок — ПЕРСОНАЛЬНАЯ статистика вместо декоративной карточки:
            ранг, дельта позиции, лига с прогрессом до следующей, таймер сброса. */}
        {!loading && !err && (() => {
          const myLeagueInfo = myEntry ? getLeague(myEntry.points) : null;
          const myDelta = myEntry ? rankDelta(myEntry.uid, myRank) : null;
          return (
            <div className="leaderboard-hero" style={{
              background:'rgba(15,23,42,0.55)',
              borderRadius:16, padding:'18px 20px', marginBottom:20,
              border:'1px solid rgba(124,58,237,0.35)',
              backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
            }}>
              {myEntry ? (
                <>
                  <div style={{display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap'}}>
                    <span style={{fontSize:13, color:ltd, fontFamily:"'Inter',sans-serif"}}>Твой ранг на этой неделе:</span>
                    <span style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:32, color:lt, lineHeight:1}}>
                      #{myRank} <span style={{fontSize:15, fontWeight:600, color:ltd}}>из {filtered.length}</span>
                    </span>
                    {deltaArrow(myDelta, 15)}
                    {myDelta != null && myDelta !== 0 && <span style={{fontSize:12, color:ltd}}>за неделю</span>}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:12, marginTop:12, flexWrap:'wrap'}}>
                    {/* Бейдж текущей лиги */}
                    <span style={{display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:99,
                      background:`${myLeagueInfo.current.color}22`, border:`1px solid ${myLeagueInfo.current.color}66`,
                      fontSize:13, fontWeight:800, color:myLeagueInfo.current.color, fontFamily:"'Inter',sans-serif"}}>
                      {myLeagueInfo.current.icon} {myLeagueInfo.current.name}
                    </span>
                    {/* Прогресс-бар до следующей лиги */}
                    <div style={{flex:'1 1 160px', minWidth:140, maxWidth:300}}>
                      <div style={{height:8, borderRadius:99, background:'rgba(148,163,184,0.2)', overflow:'hidden'}}>
                        <div style={{height:'100%', width:`${Math.round(myLeagueInfo.progress*100)}%`, borderRadius:99,
                          background:`linear-gradient(90deg, ${myLeagueInfo.current.color}, ${myLeagueInfo.nextLeague?.color || myLeagueInfo.current.color})`, transition:'width 0.4s'}}/>
                      </div>
                    </div>
                    <span style={{fontSize:12, color:ltd, fontFamily:"'Inter',sans-serif"}}>
                      {myLeagueInfo.nextLeague
                        ? <>До {myLeagueInfo.nextLeague.name === 'Серебро' ? 'Серебра' : myLeagueInfo.nextLeague.name === 'Золото' ? 'Золота' : 'Алмаза'} осталось <b style={{color:lt}}>{myLeagueInfo.pointsToNext}</b> очков</>
                        : 'Максимальная лига 💎'}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{fontSize:14, color:ltd, fontFamily:"'Inter',sans-serif"}}>
                  🏆 Ты пока не в этом рейтинге — реши пару задач, чтобы занять своё место!
                </div>
              )}
              <div style={{fontSize:13, color:ltd, marginTop:12}}>
                ⏳ До сброса: <b style={{color:lt}}>{timeLeft.days} дн {timeLeft.hours} ч {timeLeft.minutes} мин</b>
              </div>
            </div>
          );
        })()}

        {loading && <div style={{textAlign:'center', color:ltd, padding:'40px 0'}}>Загрузка...</div>}
        {err && <div style={{textAlign:'center', color:'#dc2626', padding:'20px 0', fontSize:13}}>Не удалось загрузить рейтинг: {err}</div>}

        {!loading && !err && top.length === 0 && (
          <div style={{textAlign:'center', color:ltd, padding:'40px 16px'}}>
            {tab!=='friends' && (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'12px 0 8px'}}>
                {/* Призовые места — пустой подиум приглашает занять первое место */}
                <div style={{display:'flex', alignItems:'flex-end', justifyContent:'center', gap:18}}>
                  <span style={{fontSize:44, opacity:0.85, transform:'translateY(4px)'}}>🥈</span>
                  <span style={{fontSize:64, filter:'drop-shadow(0 4px 14px rgba(212,175,55,0.45))'}}>🥇</span>
                  <span style={{fontSize:44, opacity:0.85, transform:'translateY(4px)'}}>🥉</span>
                </div>
                <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:20, color:lt}}>
                  Будь первым!
                </div>
                <div style={{fontSize:14, color:ltd, maxWidth:380, lineHeight:1.5}}>
                  {tab==='all'    && 'На этой неделе пока нет участников — займи первое место.'}
                  {tab==='grade'  && `В рейтинге ${user?.details||'твоего класса'} ещё никого нет — стань первым.`}
                  {tab==='region' && `В рейтинге ${user?.region||'твоей области'} ещё никого нет — стань первым.`}
                </div>
                {onGoDaily && (
                  <button onClick={onGoDaily} style={{
                    marginTop:4, background:'#d4af37', color:'#1a1a2e', border:'none', borderRadius:12,
                    padding:'13px 28px', fontSize:15, fontWeight:800, cursor:'pointer',
                    fontFamily:"'Montserrat',sans-serif", boxShadow:'0 8px 22px -6px rgba(212,175,55,0.5)',
                  }}>Решать задачи →</button>
                )}
              </div>
            )}
            {tab==='friends' && (
              <div>
                <div style={{fontSize:40, marginBottom:10}}>👥</div>
                <div style={{marginBottom:6, color:lt, fontWeight:700}}>
                  {friendsTabEmpty ? 'Добавь друзей, чтобы видеть их в рейтинге' : 'Твои друзья ещё не заработали очков на этой неделе'}
                </div>
                <div style={{fontSize:13, marginBottom:16}}>Одноклассники, родные, репетитор — соревнуйтесь своим кругом.</div>
                {onOpenFriends && (
                  <button onClick={onOpenFriends} style={{
                    background:THEME.accent, color:'#0f172a', border:'none', borderRadius:12,
                    padding:'12px 24px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:"'Inter',sans-serif",
                  }}>Пригласить друзей →</button>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && !err && top.length > 0 && (
          <div>
            {/* Блок 4 — мини-статы */}
            <div className="leaderboard-stats" style={{display:'flex', gap:24, marginBottom:18, fontSize:13, color: forceLightText || !equippedBg ? 'rgba(226,232,240,0.7)' : ltd, flexWrap:'wrap'}}>
              <div>👥 {filtered.length} участник{filtered.length===1?'':(filtered.length>=2&&filtered.length<=4?'а':'ов')}</div>
              {myEntry && filtered.length > 0 && <div>📊 Ты в топ <b style={{color: forceLightText || !equippedBg ? '#e2e8f0' : lt}}>{Math.max(1, Math.ceil((myRank / filtered.length) * 100))}%</b></div>}
            </div>

            {/* Блок 3 — 3D-подиум топ-3 (фолбэк на CSS-подиум при сбое Three.js) */}
            <Podium3D
              top3={top.slice(0, 3)}
              onOpenPublicProfile={onOpenPublicProfile}
              captionExtra={(e, rank) => {
                const d = rankDelta(e.uid, rank);
                return (e.grade || d != null) ? (
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:2}}>
                    {e.grade && <span style={{fontSize:11, color:'rgba(226,232,240,0.6)'}}>{e.grade}</span>}
                    {deltaArrow(d, 11)}
                  </div>
                ) : null;
              }}
              fallbackRender={() => {
              const renderPodium = (entry, rank, height) => {
                if (!entry) return <div style={{flex:1, height, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end'}}><div style={{width:'100%', height:height*0.4, background:THEME.surface, borderRadius:'12px 12px 0 0', border:`1px dashed ${THEME.border}`, opacity:0.4}}/></div>;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                const accent = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : '#b45309';
                const initials = ((entry.firstName?.[0] || '') + (entry.lastName?.[0] || '')).toUpperCase() || '?';
                const frameStyle = entry.equippedFrame ? (FRAME_STYLES[entry.equippedFrame] || null) : null;
                const avSize = rank === 1 ? 80 : 64;
                const isMine = entry.uid === user?.uid;
                const clickable = !!onOpenPublicProfile;
                return (
                  <div onClick={() => clickable && onOpenPublicProfile(entry.uid)} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', cursor: clickable?'pointer':'default'}}>
                    {rank === 1 && <div style={{fontSize:20, marginBottom:4, letterSpacing:4}}>✨⭐✨</div>}
                    <div style={{fontSize:28, marginBottom:6}}>{medal}</div>
                    {entry.avatarUrl
                      ? <img src={entry.avatarUrl} alt="" style={{width:avSize, height:avSize, borderRadius:'50%', objectFit:'cover', border:`3px solid ${accent}`, boxShadow:`0 0 20px ${accent}66`, ...(frameStyle || {})}}/>
                      : <div style={{width:avSize, height:avSize, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#a78bfa)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:rank===1?22:18, border:`3px solid ${accent}`, boxShadow:`0 0 20px ${accent}66`, ...(frameStyle || {})}}>{initials}</div>
                    }
                    <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:rank===1?16:14, color:lt, marginTop:8, textAlign:'center', display:'flex', alignItems:'center', gap:6}}>{initials}{isMine?' (вы)':''}{deltaArrow(rankDelta(entry.uid, rank), 12)}</div>
                    {entry.grade && <div style={{fontSize:11, color:ltd, marginTop:1}}>{entry.grade}</div>}
                    <div style={{fontWeight:700, fontSize:14, color:accent, marginTop:2}}>{entry.points.toLocaleString('ru-RU')} очк.</div>
                    {/* пьедестал-подножие — насыщенный градиент */}
                    <div style={{width:'100%', height, background:`linear-gradient(180deg, ${accent}, ${accent}55)`, borderRadius:'12px 12px 0 0', border:`1px solid ${accent}`, marginTop:8, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:8, fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, color:'#fff', textShadow:`0 2px 4px rgba(0,0,0,0.4)`}}>#{rank}</div>
                  </div>
                );
              };
              return (
                <div style={{display:'flex', gap:12, alignItems:'flex-end', marginBottom:24, padding:'8px 0'}}>
                  {renderPodium(top[1], 2, 80)}
                  {renderPodium(top[0], 1, 120)}
                  {renderPodium(top[2], 3, 60)}
                </div>
              );
              }}
            />

            {/* Легенда лиг: пороги из LEAGUES, текущая лига подсвечена */}
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:18, flexWrap:'wrap'}}>
              <span style={{fontSize:11, color:ltd, textTransform:'uppercase', letterSpacing:1, fontWeight:700}}>Лиги:</span>
              {LEAGUES.map(l => {
                const isMine = myEntry && getLeague(myEntry.points).current.name === l.name;
                return (
                  <span key={l.name} title={`${l.name}: ${l.min}${l.next ? `–${l.max}` : '+'} очков за неделю`} style={{
                    display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:99,
                    fontSize:12, fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap',
                    background: isMine ? `${l.color}26` : 'rgba(15,23,42,0.45)',
                    border:`1px solid ${isMine ? l.color : 'rgba(148,163,184,0.25)'}`,
                    color: isMine ? l.color : ltd, fontWeight: isMine ? 800 : 600,
                  }}>
                    {l.icon} {l.name} <span style={{opacity:0.8}}>{l.next ? `${l.min}–${l.max}` : `${l.min}+`}</span>
                  </span>
                );
              })}
            </div>

            {/* Заголовочная строка таблицы (FACEIT-стиль) */}
            <div style={{display:'flex', alignItems:'center', padding:'8px 16px', marginBottom:8, opacity:1, color:lt, fontSize:11, letterSpacing:1, textTransform:'uppercase'}}>
              <div style={{minWidth:48}}>Ранг</div>
              <div style={{flex:1, paddingLeft:8}}>Ученик</div>
              <div style={{minWidth:80, textAlign:'center'}}>Лига</div>
              <div style={{minWidth:80, textAlign:'right'}}>Рейтинг</div>
            </div>
            {top.map((e, i) => renderRow(e, i))}
            {!myInTop && myEntry && (
              <>
                <div style={{textAlign:'center', color:ltd, fontSize:12, margin:'14px 0 6px'}}>· · ·</div>
                {renderRow(myEntry, 0, { rank: myRank })}
              </>
            )}
            {!myEntry && (
              <div style={{textAlign:'center', color:ltd, fontSize:12, margin:'16px 0', fontStyle:'italic'}}>
                Тебя пока нет в этом рейтинге — заработай первые очки и попади в топ.
              </div>
            )}
            {/* Таб «Друзья», друзей мало → большой CTA-дубль кнопки приглашения */}
            {tab === 'friends' && myFriends.length > 0 && myFriends.length < 3 && onOpenFriends && (
              <div style={{textAlign:'center', marginTop:20}}>
                <button onClick={onOpenFriends} style={{
                  background:'linear-gradient(135deg, #7c3aed, #a78bfa)', color:'#fff', border:'none', borderRadius:14,
                  padding:'14px 28px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:"'Inter',sans-serif",
                  boxShadow:'0 4px 18px rgba(124,58,237,0.45)',
                }}>👥 Пригласи друга — соревноваться интереснее →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
