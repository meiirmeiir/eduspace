// Публичный профиль ученика. Открывается из LeaderboardScreen по клику на
// строку. Читает publicProfiles/{uid} (денормализованная коллекция, наполняется
// триггером mirrorUserToPublicProfile из users/{uid}), плюс skillMastery/{uid}
// и medals where userId == uid. Приватные поля (phone/email/crystals/история)
// не показываем — но и не читаем (publicProfiles их не содержит).

import React, { useEffect, useState, useMemo } from 'react';
import { THEME } from '../lib/appConstants.js';
import { getLeague } from '../lib/pointsUtils.js';
import { FRAME_STYLES, getShopItem } from '../lib/shopItems.js';
import AppTopbar from '../components/AppTopbar.jsx';
import { getToken } from 'firebase/app-check';
import { auth, app } from '../lib/firebase.js';

const PROJECT = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const KEY     = () => import.meta.env.VITE_FIREBASE_API_KEY;
const BASE    = () => `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents`;

async function _headers() {
  const t = await auth.currentUser?.getIdToken().catch(() => null);
  let ac = null;
  try { ac = (await getToken(app, false))?.token; } catch {}
  return {
    ...(t  ? { Authorization: `Bearer ${t}` } : {}),
    ...(ac ? { 'X-Firebase-AppCheck': ac }    : {}),
  };
}

// Парсер Firestore REST value → JS
function fromFsValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue'    in v) return v.stringValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return Number(v.doubleValue);
  if ('booleanValue'   in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue'       in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, vv]) => [k, fromFsValue(vv)]));
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromFsValue);
  return null;
}
function fromFsDoc(d) {
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFsValue(v)]));
}

export default function PublicProfileScreen({ uid, onBack }) {
  const [profile, setProfile] = useState(null);
  const [masteredCount, setMasteredCount] = useState(null);
  const [medals, setMedals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      setLoading(true); setErr(null);
      try {
        const H = await _headers();

        // 1) publicProfiles/{uid}
        const pubRes = await fetch(`${BASE()}/publicProfiles/${encodeURIComponent(uid)}?key=${KEY()}`, { headers: H });
        if (!pubRes.ok) throw new Error(`Профиль недоступен (HTTP ${pubRes.status})`);
        const pubJson = await pubRes.json();
        const pub = fromFsDoc(pubJson);

        // 2) skillMastery/{uid} → считаем кол-во skills где stagesCompleted >= 3
        let mastered = 0;
        try {
          const smRes = await fetch(`${BASE()}/skillMastery/${encodeURIComponent(uid)}?key=${KEY()}`, { headers: H });
          if (smRes.ok) {
            const sm = fromFsDoc(await smRes.json());
            const skills = sm.skills || {};
            mastered = Object.values(skills).filter(s => Number(s?.stagesCompleted || 0) >= 3).length;
          }
        } catch {}

        // 3) Медали — субколлекция users/{uid}/medals (см. functions/index.js)
        let medalsList = [];
        try {
          const mRes = await fetch(`${BASE()}/users/${encodeURIComponent(uid)}/medals?key=${KEY()}&pageSize=50`, { headers: H });
          if (mRes.ok) {
            const mj = await mRes.json();
            medalsList = (mj.documents || []).map(d => {
              const data = fromFsDoc(d);
              return {
                id: d.name.split('/').pop(),
                type: data.type || '',         // gold/silver/bronze
                category: data.category || '', // global/grade/region
                position: data.position || 0,
                weekId: data.weekId || '',
              };
            });
          }
        } catch {}

        if (!cancelled) {
          setProfile(pub);
          setMasteredCount(mastered);
          setMedals(medalsList);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { setErr(String(e?.message || e)); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

  // ── Derived ──
  const equipped     = profile?.equipped || {};
  const equippedBg   = equipped.background ? getShopItem(equipped.background) : null;
  const frameStyle   = equipped.frame ? (FRAME_STYLES[equipped.frame] || null) : null;
  const titleItem    = equipped.title ? getShopItem(equipped.title) : null;
  const titleText    = titleItem?.value || '';
  const initials     = useMemo(() => ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || '?', [profile]);
  const displayName  = profile ? `${profile.firstName || ''} ${(profile.lastName || '').charAt(0)}${(profile.lastName || '').charAt(0) ? '.' : ''}`.trim() : '';
  const weekPts      = Number(profile?.weekPoints || 0);
  const league       = getLeague(weekPts);
  const accent       = league.current.color;

  if (loading) {
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
        <AppTopbar title="Профиль" onBack={onBack}/>
        <div style={{ textAlign:'center', padding:80, color:THEME.textLight }}>Загрузка профиля…</div>
      </div>
    );
  }
  if (err || !profile) {
    return (
      <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
        <AppTopbar title="Профиль" onBack={onBack}/>
        <div style={{ textAlign:'center', padding:60, color:'#dc2626' }}>{err || 'Профиль не найден'}</div>
      </div>
    );
  }

  return (
    <div className="page-themed" style={{ minHeight:'100vh', background:THEME.bg }}>
      <AppTopbar title="Профиль" onBack={onBack}/>

      <div
        className={`profile-page${equippedBg ? ' has-bg' : ''}`}
        style={{
          position:'relative', maxWidth:760, margin:'24px auto', padding:'0 16px 48px',
          ...(equippedBg ? { isolation:'isolate' } : {}),
        }}
      >
        {equippedBg && (
          <div aria-hidden="true" style={{
            position:'absolute', inset:0, zIndex:-1, pointerEvents:'none',
            backgroundImage:`url(${equippedBg.file})`,
            backgroundSize:'cover', backgroundPosition:'center',
            opacity:0.6, borderRadius:16,
          }}/>
        )}

        {/* Карточка профиля */}
        <div className="dashboard-section" style={{ display:'flex', alignItems:'center', gap:18, padding:'24px 22px', marginBottom:18 }}>
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt="" style={{
                width:96, height:96, borderRadius:'50%', objectFit:'cover',
                border:`3px solid ${THEME.accent}`, flexShrink:0,
                ...(frameStyle || {}),
              }}/>
            : <div style={{
                width:96, height:96, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg, #6366f1, #a78bfa)',
                color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:32,
                border:`3px solid ${THEME.accent}`,
                ...(frameStyle || {}),
              }}>{initials}</div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontFamily:"'Montserrat',sans-serif", fontSize:24, fontWeight:800, color:THEME.primary, margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis' }}>
              {displayName || initials}
            </h1>
            {titleText && (
              <div style={{
                display:'inline-block', marginBottom:8,
                fontSize:12, fontWeight:700, color:'#d4af37',
                background:'rgba(212,175,55,0.12)', borderRadius:8, padding:'3px 10px',
              }}>{titleText}</div>
            )}
            <div style={{ fontSize:13, color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>
              {[profile.details, profile.region].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>

        {/* ESR-блок */}
        <div className="dashboard-section" style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          color:'#fff', padding:'20px 24px', marginBottom:18,
          border:`1px solid ${accent}55`, borderRadius:14,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:1.6, color:accent, textTransform:'uppercase' }}>⭐ ESR Рейтинг</div>
            <div style={{ fontSize:13, color:'#cbd5e1' }}>{league.current.icon} {league.current.name}</div>
          </div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:42, fontWeight:800, lineHeight:1, marginBottom:10 }}>
            {weekPts.toLocaleString('ru-RU')}
          </div>
          <div style={{ height:6, background:'rgba(255,255,255,0.1)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ width:`${Math.round(league.progress * 100)}%`, height:'100%', background:accent }}/>
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:8 }}>
            Всего за всё время: <b style={{ color:'#fff' }}>{Number(profile.totalPoints || 0).toLocaleString('ru-RU')}</b> очк.
          </div>
        </div>

        {/* Освоено навыков */}
        <div className="dashboard-section" style={{ padding:'18px 22px', marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:12, color:THEME.textLight, fontFamily:"'Inter',sans-serif", marginBottom:2 }}>Освоено навыков</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:800, color:THEME.primary }}>
              {masteredCount ?? '—'}
            </div>
          </div>
          <div style={{ fontSize:32 }}>📖</div>
        </div>

        {/* Медали */}
        <div className="dashboard-section" style={{ padding:'18px 22px' }}>
          <div className="section-title" style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:800, color:THEME.primary, marginBottom:12 }}>
            🏆 Медали ({medals.length})
          </div>
          {medals.length === 0
            ? <div style={{ color:THEME.textLight, fontSize:13 }}>Пока без медалей. Попади в топ-10 рейтинга недели.</div>
            : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {medals.slice(0, 12).map(m => {
                  const icon = m.type === 'gold' ? '🥇' : m.type === 'silver' ? '🥈' : '🥉';
                  const catLabel = m.category === 'global' ? 'Мир' : m.category === 'grade' ? 'Класс' : 'Область';
                  return (
                    <div key={m.id} title={`${m.weekId} · ${catLabel} · #${m.position}`} style={{
                      display:'flex', alignItems:'center', gap:6,
                      background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.3)',
                      borderRadius:10, padding:'6px 10px', fontSize:12, fontWeight:600, color:THEME.primary,
                    }}>
                      <span style={{ fontSize:16 }}>{icon}</span>
                      <span>{catLabel} #{m.position}</span>
                    </div>
                  );
                })}
                {medals.length > 12 && (
                  <div style={{ fontSize:12, color:THEME.textLight, padding:'6px 10px' }}>+{medals.length - 12}</div>
                )}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
