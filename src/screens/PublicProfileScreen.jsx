// Публичный профиль ученика. Открывается из LeaderboardScreen по клику на
// строку. Читает publicProfiles/{uid} (денормализованная коллекция, наполняется
// триггером mirrorUserToPublicProfile из users/{uid}), плюс skillMastery/{uid}
// и medals where userId == uid. Приватные поля (phone/email/crystals/история)
// не показываем — но и не читаем (publicProfiles их не содержит).

import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '../ThemeContext.jsx';
import { getLeague, getWeekId } from '../lib/pointsUtils.js';
import { FRAME_STYLES, getShopItem } from '../lib/shopItems.js';
import { getLevelInfo } from '../lib/levelUtils.js';
import AppTopbar from '../components/AppTopbar.jsx';
import Medal from '../components/Medal.jsx';
import Medal3DModal from '../components/Medal3DModal.jsx';
import LevelRing from '../components/LevelRing.jsx';
import AchievementsGrid from '../components/AchievementsGrid.jsx';
import { isCreator } from '../lib/creator.js';
import CreatorRing from '../components/CreatorRing.jsx';
import CreatorBackground from '../components/CreatorBackground.jsx';
import CreatorIntro from '../components/CreatorIntro.jsx';
import CreatorSignature from '../components/CreatorSignature.jsx';
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
  const { theme: THEME } = useTheme();
  const [profile, setProfile] = useState(null);
  const [masteredCount, setMasteredCount] = useState(null);
  const [medals, setMedals] = useState([]);
  const [selectedMedal, setSelectedMedal] = useState(null); // открытая 3D-модалка
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState(null); // null = loading; [] = пусто; [{weekId, points}]

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

  // Загрузка истории рейтинга — последние 5 недель.
  // Для каждой недели grab leaderboard/{weekId}/entries/{uid}. 404 → 0 очков.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const H = await _headers();
        const weekIds = Array.from({length:5}, (_,i) => getWeekId(new Date(Date.now() - i*7*86400000))).reverse();
        const results = await Promise.all(weekIds.map(async wid => {
          try {
            const r = await fetch(`${BASE()}/leaderboard/${wid}/entries/${encodeURIComponent(uid)}?key=${KEY()}`, { headers: H });
            if (!r.ok) return { weekId: wid, points: 0 };
            const doc = fromFsDoc(await r.json());
            return { weekId: wid, points: Number(doc.points || 0) };
          } catch { return { weekId: wid, points: 0 }; }
        }));
        if (!cancelled) setHistory(results);
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // Стабильность: 100% − (std/avg)*100. Категории по диапазонам.
  const stability = useMemo(() => {
    if (!history || history.length === 0) return null;
    const pts = history.map(h => h.points);
    const avg = pts.reduce((a,b) => a+b, 0) / pts.length;
    if (avg === 0) return null; // нет очков ни за одну неделю
    const std = Math.sqrt(pts.map(p => (p-avg)**2).reduce((a,b) => a+b, 0) / pts.length);
    const pct = Math.max(0, Math.min(100, Math.round(100 - (std/avg)*100)));
    let label, emoji, color;
    if (pct >= 90)      { label='Железная стабильность'; emoji='🔒'; color='#10b981'; }
    else if (pct >= 70) { label='Стабильный игрок';      emoji='✅'; color='#3b82f6'; }
    else if (pct >= 50) { label='Непостоянный';          emoji='⚡'; color='#f59e0b'; }
    else                { label='Нестабильный';          emoji='❌'; color='#ef4444'; }
    return { pct, label, emoji, color };
  }, [history]);

  // ── Derived ──
  const equipped     = profile?.equipped || {};
  const equippedBg   = equipped.background ? getShopItem(equipped.background) : null;
  const frameStyle   = equipped.frame ? (FRAME_STYLES[equipped.frame] || null) : null;
  const titleItem    = equipped.title ? getShopItem(equipped.title) : null;
  const titleText    = titleItem?.value || '';
  const initials     = useMemo(() => ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || '?', [profile]);
  const weekPts      = Number(profile?.weekPoints || 0);
  const league       = getLeague(weekPts);
  const accent       = league.current.color;
  const creator      = isCreator(uid);

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
    <div
      className={`page-themed${(equippedBg || creator) ? ' has-bg' : ''}`}
      style={{
        minHeight:'100vh', background: creator ? 'transparent' : THEME.bg,
        position:'relative',
        ...((equippedBg || creator) ? { isolation:'isolate' } : {}),
      }}
    >
      {/* Эксклюзивный космический фон Создателя */}
      {creator && <CreatorBackground />}
      {/* Фоновый layer на уровне всего экрана, не только centered-контейнера */}
      {equippedBg && !creator && (
        <div aria-hidden="true" style={{
          position:'absolute', inset:0, zIndex:-1, pointerEvents:'none',
          backgroundImage:`url(${equippedBg.file})`,
          backgroundSize:'cover', backgroundPosition:'center',
          opacity:0.6,
        }}/>
      )}
      <AppTopbar title="Профиль" onBack={onBack}/>

      <div
        style={{ maxWidth:760, margin:'24px auto', padding:'0 16px 48px' }}
      >

        {/* Карточка профиля */}
        <div className="dashboard-section" style={{ display:'flex', alignItems:'center', gap:18, padding:'24px 22px', marginBottom:18 }}>
          {creator ? (
            <div style={{ position:'relative', width:96, height:96, flexShrink:0 }}>
              <CreatorRing size={96} avatarUrl={profile.avatarUrl} equippedFrame={equipped.frame} label={initials} />
              <CreatorIntro crownSize={46} />
            </div>
          ) : (
            <LevelRing xp={profile.xp ?? 0} avatarUrl={profile.avatarUrl} equippedFrame={equipped.frame} size={96} label={initials} />
          )}
          <div style={{ flex:1, minWidth:0 }}>
            {/* Заголовок — только инициалы «ИИ»; полное имя в публичном профиле не показываем */}
            <h1 className={creator ? 'creator-name' : undefined} style={{
              fontFamily:"'Montserrat',sans-serif", fontSize:32, fontWeight:800,
              margin:'0 0 6px', lineHeight:1.1, letterSpacing:'-0.5px',
              ...(creator ? {} : { color:THEME.primary }),
            }}>
              {initials}
            </h1>
            {creator && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6, marginBottom:8 }}>
                <span className="creator-badge">⚡ Основатель AAPA</span>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, lineHeight:1.1, color:'#fbbf24', textShadow:'0 0 12px rgba(251,191,36,0.4)' }}>Основатель</div>
                <span className="creator-founded">Создал AAPA в 2026</span>
              </div>
            )}
            {titleText && (
              <div style={{
                display:'inline-block', marginBottom:8,
                fontSize:12, fontWeight:700, color:'#d4af37',
                background:'rgba(212,175,55,0.12)', borderRadius:8, padding:'3px 10px',
              }}>{titleText}</div>
            )}
            {!creator && (
              <>
                <div style={{ fontSize:13, color:THEME.textLight, fontFamily:"'Inter',sans-serif" }}>
                  {[profile.details, profile.region].filter(Boolean).join(' · ') || '—'}
                </div>
                {(() => { const li = getLevelInfo(profile.xp ?? 0); return (
                  <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, color:li.tier.color, background:`${li.tier.color}1a`, border:`1px solid ${li.tier.color}55`, borderRadius:99, padding:'3px 12px' }}>
                    Уровень {li.level} · {li.tier.name}
                  </div>
                ); })()}
              </>
            )}
          </div>
        </div>

        {/* ── Профиль Создателя: манифест + крупное достижение + подпись ── */}
        {creator && (
          <>
            <div className="dashboard-section" style={{ padding:'24px 26px', marginBottom:18, position:'relative', borderLeft:'3px solid #fbbf24' }}>
              <p style={{ fontSize:15.5, lineHeight:1.75, color:'#fbe7c2', fontFamily:"'Inter',sans-serif", margin:0, fontStyle:'italic' }}>
                {`Идея была придумана с простой мысли: «Как создать формат обучения лучше, чем то, что мы имеем в школах?». Вот и результат. Я надеюсь, что вы подойдёте к образованию с ответственностью и поймёте, что это веселее, чем кажется. Всё в ваших руках, ведь именно вы пройдёте через тернии к звёздам! 💫`}
              </p>
            </div>

            <div className="dashboard-section" style={{
              padding:'28px 22px', marginBottom:18, textAlign:'center',
              background:'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(251,191,36,0.12))',
              border:'1px solid rgba(168,85,247,0.5)', boxShadow:'0 0 26px rgba(168,85,247,0.25)',
            }}>
              <div style={{ fontSize:58, lineHeight:1, marginBottom:8, filter:'drop-shadow(0 0 16px rgba(251,191,36,0.65))' }}>⚡</div>
              <div style={{
                fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:23, marginBottom:6,
                background:'linear-gradient(90deg,#fbbf24,#a855f7)', WebkitBackgroundClip:'text', backgroundClip:'text',
                WebkitTextFillColor:'transparent', color:'transparent',
              }}>Создатель AAPA</div>
              <div style={{ fontSize:14, color:'#cbd5e1' }}>Основатель и создатель платформы</div>
            </div>

            <CreatorSignature />
          </>
        )}

        {!creator && (<>
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

        {/* История рейтинга — последние 5 недель + индекс стабильности */}
        {history && history.length > 0 && (() => {
          const W = 720, H = 120;
          const padL = 36, padR = 20, padT = 22, padB = 32;
          const chartW = W - padL - padR;
          const chartH = H - padT - padB;
          const pts = history.map(h => h.points);
          const maxPts = Math.max(1, ...pts);
          const xOf = i => padL + (history.length === 1 ? chartW/2 : (i * chartW / (history.length - 1)));
          const yOf = p => padT + chartH - (p / maxPts) * chartH;
          const path = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)},${yOf(h.points)}`).join(' ');
          const leagueColor = league.current.color;
          return (
            <div className="dashboard-section" style={{ padding:'18px 22px', marginBottom:18 }}>
              <div className="section-title" style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:800, color:THEME.primary, marginBottom:14 }}>
                📈 История рейтинга
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', overflow:'visible' }} preserveAspectRatio="none">
                <text x={padL-8} y={yOf(0)+4} fontSize="10" fill={THEME.textLight} textAnchor="end">0</text>
                <text x={padL-8} y={yOf(maxPts)+4} fontSize="10" fill={THEME.textLight} textAnchor="end">{maxPts}</text>
                <line x1={padL} y1={yOf(0)} x2={W-padR} y2={yOf(0)} stroke={THEME.border} strokeWidth="1"/>
                <path d={path} fill="none" stroke={leagueColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                {history.map((h, i) => (
                  <g key={h.weekId}>
                    <circle cx={xOf(i)} cy={yOf(h.points)} r="5" fill={THEME.surface} stroke={leagueColor} strokeWidth="2.5"/>
                    <text x={xOf(i)} y={yOf(h.points)-10} fontSize="11" fill={THEME.text} fontWeight="700" textAnchor="middle">{h.points}</text>
                    <text x={xOf(i)} y={H-10} fontSize="10" fill={THEME.textLight} textAnchor="middle">Нед. {h.weekId.split('-W')[1] || '?'}</text>
                  </g>
                ))}
              </svg>
              {stability && (
                <>
                  <div style={{ marginTop:14, fontSize:13, color:THEME.text }}>
                    📊 Стабильность: <b style={{color: stability.color}}>{stability.pct}%</b> — {stability.label} {stability.emoji}
                  </div>
                  <div style={{ height:6, background:THEME.bg, borderRadius:99, overflow:'hidden', marginTop:8, border:`1px solid ${THEME.border}` }}>
                    <div style={{ width:`${stability.pct}%`, height:'100%', background:stability.color, transition:'width 0.4s' }}/>
                  </div>
                </>
              )}
              {!stability && (
                <div style={{ marginTop:14, fontSize:13, color:THEME.textLight, fontStyle:'italic' }}>
                  Недостаточно данных для оценки стабильности.
                </div>
              )}
            </div>
          );
        })()}

        {/* Медали */}
        <div className="dashboard-section" style={{ padding:'18px 22px' }}>
          <div className="section-title" style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:800, color:THEME.primary, marginBottom:12 }}>
            🏆 Медали ({medals.length})
          </div>
          {medals.length === 0
            ? <div style={{ color:THEME.textLight, fontSize:13 }}>Пока без медалей. Попади в топ-10 рейтинга недели.</div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(84px, 1fr))', gap:12 }}>
                {medals.slice(0, 12).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMedal(m)}
                    title="Открыть 3D"
                    style={{
                      display:'flex', justifyContent:'center', alignItems:'center',
                      background:'transparent', border:'none', padding:6, borderRadius:12,
                      cursor:'pointer', transition:'transform 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.background='rgba(212,175,55,0.08)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.background='transparent'; }}
                  >
                    <Medal type={m.type} category={m.category} weekId={m.weekId} position={m.position} size={72} />
                  </button>
                ))}
                {medals.length > 12 && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:THEME.textLight }}>+{medals.length - 12}</div>
                )}
              </div>
          }
        </div>

        {/* Достижения — публично: заработанные + текст следующего уровня (без живого X/Y) */}
        <div style={{ marginTop:18 }}>
          <AchievementsGrid uid={uid} />
        </div>
        </>)}

        {selectedMedal && <Medal3DModal medal={selectedMedal} onClose={() => setSelectedMedal(null)} />}
      </div>
    </div>
  );
}
