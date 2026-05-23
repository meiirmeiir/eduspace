import React, { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import { getWeekId, getLeague } from "../lib/pointsUtils.js";
import { getToken } from 'firebase/app-check';
import { auth, app } from "../lib/firebase.js";
import Logo from "../components/ui/Logo.jsx";
import { FRAME_STYLES, getShopItem } from "../lib/shopItems.js";

const PROJECT = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const KEY     = () => import.meta.env.VITE_FIREBASE_API_KEY;

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
    };
  });
}

const TABS = [
  { id: 'all',    icon: '🌍', label: 'Все' },
  { id: 'grade',  icon: '🏫', label: 'Мой класс' },
  { id: 'region', icon: '📍', label: 'Моя область' },
];

export default function LeaderboardScreen({ user, onBack, onOpenPublicProfile }) {
  const { theme: THEME } = useTheme();
  const [tab, setTab] = useState('all');
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const weekId = getWeekId();

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
    if (tab === 'grade')  return allEntries.filter(e => e.grade  && e.grade  === user?.details);
    if (tab === 'region') return allEntries.filter(e => e.region && e.region === user?.region);
    return allEntries;
  })().sort((a, b) => b.points - a.points);

  const top = filtered.slice(0, 50);
  const myIdx = filtered.findIndex(e => e.uid === user?.uid);
  const myEntry = myIdx >= 0 ? filtered[myIdx] : null;
  const myRank = myIdx >= 0 ? myIdx + 1 : null;
  const myInTop = myIdx >= 0 && myIdx < 50;

  const renderRow = (e, idx, opts = {}) => {
    const rank = opts.rank ?? (idx + 1);
    const mine = e.uid === user?.uid;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    const initials = ((e.firstName?.[0] || '') + (e.lastName?.[0] || '')).toUpperCase() || '?';
    const frameStyle = e.equippedFrame ? (FRAME_STYLES[e.equippedFrame] || null) : null;
    const titleItem = e.equippedTitle ? getShopItem(e.equippedTitle) : null;
    const titleText = titleItem?.value || '';
    const league = getLeague(e.points).current;
    const avatarSize = rank <= 3 ? 48 : 32;
    const clickable = !!onOpenPublicProfile;
    const handleOpen = () => clickable && onOpenPublicProfile(e.uid);
    // FACEIT-стиль выделение топ-3: золотой/серебряный/бронзовый glow + border.
    const topBorder = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : null;
    const topShadow = rank === 1 ? '0 2px 12px rgba(212,175,55,0.3)' : rank === 2 ? '0 2px 8px rgba(148,163,184,0.3)' : rank === 3 ? '0 2px 8px rgba(180,83,9,0.3)' : null;
    return (
      <div
        key={`${e.uid}_${rank}`}
        className="theme-row"
        onClick={handleOpen}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleOpen(); } } : undefined}
        style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'10px 14px', borderRadius:12,
          background: mine ? 'rgba(212,175,55,0.12)' : THEME.surface,
          border: `1px solid ${mine ? THEME.accent : (topBorder || THEME.border)}`,
          boxShadow: topShadow || 'none',
          marginBottom:8,
          cursor: clickable ? 'pointer' : 'default',
          transition: 'transform 0.1s, box-shadow 0.15s',
        }}
        onMouseEnter={clickable ? (ev) => { ev.currentTarget.style.boxShadow = topShadow || '0 4px 14px rgba(15,23,42,0.08)'; } : undefined}
        onMouseLeave={clickable ? (ev) => { ev.currentTarget.style.boxShadow = topShadow || ''; } : undefined}
      >
        <div style={{
          minWidth:36, textAlign:'center', fontWeight:800, fontSize:medal?22:14,
          color: rank<=3 ? THEME.primary : THEME.textLight,
          fontFamily:"'Montserrat',sans-serif",
        }}>{medal || `#${rank}`}</div>

        {/* Лига (Бронза/Серебро/Золото/Алмаз) — иконка лиги по сумме очков */}
        <div style={{minWidth:36, textAlign:'center', fontSize:18}} title={league.name}>
          {league.icon}
        </div>

        {/* Аватар: 48×48 для топ-3, иначе 32×32. Фото или fallback с инициалами. */}
        {e.avatarUrl
          ? <img src={e.avatarUrl} alt="" style={{
              width:avatarSize, height:avatarSize, borderRadius:'50%', objectFit:'cover',
              border: `2px solid ${THEME.accent}`, flexShrink:0,
              ...(frameStyle || {}),
            }}/>
          : <div style={{
              width:avatarSize, height:avatarSize, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg, #6366f1, #a78bfa)',
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'Montserrat',sans-serif", fontWeight:800,
              fontSize: rank<=3 ? 16 : 12,
              border: `2px solid ${THEME.accent}`,
              ...(frameStyle || {}),
            }}>{initials}</div>
        }

        <div style={{flex:1, minWidth:0}}>
          <div style={{fontWeight:700, fontSize:14, color:THEME.primary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {initials}{mine ? ' (вы)' : ''}
          </div>
          {titleText && (
            <div style={{
              display:'inline-block', marginTop:2,
              fontSize:11, fontWeight:600, color:'#d4af37',
              background:'rgba(212,175,55,0.12)', borderRadius:6, padding:'1px 6px',
              maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{titleText}</div>
          )}
          {!titleText && (e.grade || e.region) && (
            <div style={{fontSize:12, color:THEME.textLight, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {[e.grade, e.region].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{fontWeight:800, fontSize:15, color:THEME.primary, fontFamily:"'Montserrat',sans-serif", whiteSpace:'nowrap'}}>
          {e.points.toLocaleString('ru-RU')} очк.
        </div>
      </div>
    );
  };

  return (
    <div className="page-themed" style={{minHeight:'100vh', background:`linear-gradient(180deg, ${THEME.primary}15 0%, ${THEME.bg} 100%)`, paddingBottom:80}}>
      <div style={{background:THEME.primary, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64}}>
        <Logo size={32} light/>
        <button onClick={onBack} style={{background:'transparent', border:`1px solid ${THEME.onPrimary ?? 'rgba(255,255,255,0.2)'}33`, color:THEME.onPrimary ?? '#fff', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontFamily:"'Inter',sans-serif"}}>← Назад</button>
      </div>

      <div style={{maxWidth:720, margin:'0 auto', padding:'24px 16px'}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color:THEME.primary, marginBottom:6}}>🏆 Рейтинг</h1>
        <p style={{fontSize:13, color:THEME.textLight, marginBottom:18}}>Неделя {weekId} · обновляется в реальном времени</p>

        <div style={{display:'flex', gap:6, marginBottom:18, flexWrap:'wrap'}}>
          {TABS.map(t => (
            <button key={t.id} className={`theme-tab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)} style={{
              padding:'8px 14px', borderRadius:99, fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:"'Inter',sans-serif",
              background: tab===t.id ? THEME.primary : THEME.surface,
              color: tab===t.id ? (THEME.onPrimary ?? '#fff') : THEME.text,
              border: `1px solid ${tab===t.id ? THEME.primary : THEME.border}`,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {loading && <div style={{textAlign:'center', color:THEME.textLight, padding:'40px 0'}}>Загрузка...</div>}
        {err && <div style={{textAlign:'center', color:'#dc2626', padding:'20px 0', fontSize:13}}>Не удалось загрузить рейтинг: {err}</div>}

        {!loading && !err && top.length === 0 && (
          <div style={{textAlign:'center', color:THEME.textLight, padding:'40px 16px'}}>
            {tab==='all'    && 'На этой неделе пока нет участников. Решай задачи — попадёшь в рейтинг!'}
            {tab==='grade'  && `В рейтинге ${user?.details||'твоего класса'} ещё никого нет.`}
            {tab==='region' && `В рейтинге ${user?.region||'твоей области'} ещё никого нет.`}
          </div>
        )}

        {!loading && !err && top.length > 0 && (
          <div>
            {/* Заголовочная строка таблицы (FACEIT-стиль) */}
            <div style={{display:'flex', alignItems:'center', gap:12, padding:'6px 14px', marginBottom:4, opacity:0.6, color:THEME.text}}>
              <div style={{minWidth:36, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Место</div>
              <div style={{minWidth:36, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Лига</div>
              <div style={{width:36, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Игрок</div>
              <div style={{flex:1, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Имя</div>
              <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Очки</div>
            </div>
            {top.map((e, i) => renderRow(e, i))}
            {!myInTop && myEntry && (
              <>
                <div style={{textAlign:'center', color:THEME.textLight, fontSize:12, margin:'14px 0 6px'}}>· · ·</div>
                {renderRow(myEntry, 0, { rank: myRank })}
              </>
            )}
            {!myEntry && (
              <div style={{textAlign:'center', color:THEME.textLight, fontSize:12, margin:'16px 0', fontStyle:'italic'}}>
                Тебя пока нет в этом рейтинге — заработай первые очки и попади в топ.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
