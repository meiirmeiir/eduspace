import React, { useEffect, useState } from "react";
import { THEME } from "../lib/appConstants.js";
import { getWeekId } from "../lib/pointsUtils.js";
import { getToken } from 'firebase/app-check';
import { auth, app } from "../lib/firebase.js";
import Logo from "../components/ui/Logo.jsx";

const PROJECT = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const KEY     = () => import.meta.env.VITE_FIREBASE_API_KEY;

// ── Загрузка entries недельного рейтинга через REST ─────────────────────────
async function fetchEntries(weekId) {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  let appCheck = null;
  try { appCheck = (await getToken(app, false))?.token; } catch {}
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
  };
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
      uid:         id,
      points:      Number(f.points?.integerValue || 0),
      displayName: f.displayName?.stringValue || 'Аноним',
      grade:       f.grade?.stringValue || '',
      region:      f.region?.stringValue || '',
    };
  });
}

const TABS = [
  { id: 'all',    icon: '🌍', label: 'Все' },
  { id: 'grade',  icon: '🏫', label: 'Мой класс' },
  { id: 'region', icon: '📍', label: 'Моя область' },
];

export default function LeaderboardScreen({ user, onBack }) {
  const [tab, setTab] = useState('all');
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const weekId = getWeekId();

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetchEntries(weekId)
      .then(list => { if (!cancelled) { setAllEntries(list); setLoading(false); } })
      .catch(e => { if (!cancelled) { setErr(String(e)); setLoading(false); } });
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
    return (
      <div key={`${e.uid}_${rank}`} style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'12px 16px', borderRadius:12,
        background: mine ? 'rgba(212,175,55,0.12)' : '#fff',
        border: `1px solid ${mine ? THEME.accent : THEME.border}`,
        marginBottom:8,
      }}>
        <div style={{
          minWidth:38, textAlign:'center', fontWeight:800, fontSize:medal?22:14,
          color: rank<=3 ? THEME.primary : THEME.textLight,
          fontFamily:"'Montserrat',sans-serif",
        }}>{medal || `#${rank}`}</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontWeight:700, fontSize:14, color:THEME.primary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {e.displayName}{mine ? ' (вы)' : ''}
          </div>
          {(e.grade || e.region) && (
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
    <div style={{minHeight:'100vh', background:THEME.bg, paddingBottom:80}}>
      <div style={{background:THEME.primary, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64}}>
        <Logo size={32} light/>
        <button onClick={onBack} style={{background:'transparent', border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.7)', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontFamily:"'Inter',sans-serif"}}>← Назад</button>
      </div>

      <div style={{maxWidth:720, margin:'0 auto', padding:'24px 16px'}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color:THEME.primary, marginBottom:6}}>🏆 Рейтинг</h1>
        <p style={{fontSize:13, color:THEME.textLight, marginBottom:18}}>Неделя {weekId} · обновляется в реальном времени</p>

        <div style={{display:'flex', gap:6, marginBottom:18, flexWrap:'wrap'}}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'8px 14px', borderRadius:99, fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:"'Inter',sans-serif",
              background: tab===t.id ? THEME.primary : '#fff',
              color: tab===t.id ? '#fff' : THEME.textLight,
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
