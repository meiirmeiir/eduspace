import React, { useState, useEffect, useRef } from "react";
import { collection, doc, getDoc, getDocs, query, updateDoc, where, db } from "../firestore-rest.js";
import { REG_GOALS, getSpecificList, KZ_REGIONS } from "../lib/appConstants.js";
import { useTheme } from "../ThemeContext.jsx";
import { isNpcEnabled, setNpcEnabled } from "../NpcContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import ChangePasswordInline from "./ChangePasswordInline.jsx";
import ExpertReportView from "../screens/ExpertReportView.jsx";
import ErrorCard from "./ui/ErrorCard.jsx";
import Medal from "./Medal.jsx";
import { getShopItem, FRAME_STYLES, computePlayerHp, completedSet, EQUIPMENT_SETS } from "../lib/shopItems.js";
import { getLevelInfo, LEVEL_TIERS } from "../lib/levelUtils.js";
import LevelRing from "./LevelRing.jsx";
import TierRing3D from "./TierRing3D.jsx";
import CreatorRing from "./CreatorRing.jsx";
import Character3D from "./Character3D.jsx";
import { isCreator } from "../lib/creator.js";
import XpBar from "./XpBar.jsx";
import AchievementsGrid from "./AchievementsGrid.jsx";
import InfoTooltip from "./InfoTooltip.jsx";

export default function ProfileSection({ user, statusObj, onOpenDiagnostics, onViewPlan, onUpdateUser, onOpenShop }) {
  const { firebaseUser } = useAuth();
  const { theme: THEME, dark, shopTheme } = useTheme();
  // Дарк-UI = либо системная dark тема, либо тёмная shop-тема (galaxy/matrix/fire).
  // sakura — светлая (text dark на pink), light/dark — по флагу.
  const isDarkUi = dark || (shopTheme && shopTheme !== 'sakura');
  const inputStyle = {
    background: THEME.surface,
    color: THEME.text,
    border: `1px solid ${THEME.border}`,
    colorScheme: isDarkUi ? 'dark' : 'light',
  };
  const uid = firebaseUser?.uid;
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState(false);
  const [expertMap,setExpertMap]=useState({});
  const [viewingExpert,setViewingExpert]=useState(null);
  const [viewingPhotos,setViewingPhotos]=useState([]);
  const [medals,setMedals]=useState([]);
  const [rankMedals,setRankMedals]=useState([]);
  const [masteredCount,setMasteredCount]=useState(0);
  const [isEditing,setIsEditing]=useState(false);
  const [editForm,setEditForm]=useState({
    firstName:user?.firstName||"",
    lastName:user?.lastName||"",
    gender:user?.gender||"male", // пол 3D-героя (male|female)
    goalKey:user?.goalKey||"",
    details:user?.details||"",
    region:user?.region||"",
    avatarUrl:user?.avatarUrl||"",
  });
  const [editSaving,setEditSaving]=useState(false);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const [npcOn,setNpcOn]=useState(()=>isNpcEnabled(uid));
  const avatarInputRef=useRef(null);

  const handleAvatarChange=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(file.size>2*1024*1024){alert("Файл слишком большой. Максимум 2 МБ.");return;}
    setAvatarUploading(true);
    try{
      const reader=new FileReader();
      reader.onload=ev=>{
        const dataUrl=ev.target.result;
        setEditForm(p=>({...p,avatarUrl:dataUrl}));
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    }catch{setAvatarUploading(false);}
  };

  const saveProfile=async()=>{
    if(!editForm.firstName.trim()){alert("Введите имя.");return;}
    if(!editForm.goalKey){alert("Выберите цель.");return;}
    if(!editForm.details){alert("Выберите класс или экзамен.");return;}
    if(!editForm.region){alert("Выберите область.");return;}
    setEditSaving(true);
    try{
      const newGender=editForm.gender||"male";
      // Смена пола → снять экипировку чужого пола: иначе сет другого пола остаётся
      // «надетым» (даёт бонус и показывается), хотя 3D-модель его не отрисовывает.
      const wornId=completedSet(user?.equipped);
      const clearEquip=wornId && EQUIPMENT_SETS[wornId]?.gender && EQUIPMENT_SETS[wornId].gender!==newGender;
      const updates={
        firstName:editForm.firstName.trim(),
        lastName:editForm.lastName.trim(),
        gender:newGender,
        goalKey:editForm.goalKey,
        goal:REG_GOALS[editForm.goalKey],
        details:editForm.details,
        region:editForm.region,
        ...(editForm.avatarUrl?{avatarUrl:editForm.avatarUrl}:{}),
        ...(clearEquip?{equipped:{...(user?.equipped||{}),helmet:null,top:null,bottom:null,boots:null}}:{}),
      };
      await updateDoc(doc(db,"users",user.uid),updates);
      onUpdateUser?.({...user,...updates});
      setIsEditing(false);
    }catch(e){alert("Ошибка: "+e.message);}
    setEditSaving(false);
  };

  const load=async()=>{
    const _uid=user?.uid||user?.id; if (!_uid) return;
    setLoading(true); setFetchError(false);
    try{
      const [resSnap,repSnap,medalSnap,rankMedalSnap,masterySnap]=await Promise.all([
        getDocs(query(collection(db,"diagnosticResults"),where("userId","==",_uid))),
        getDocs(query(collection(db,"expertReports"),where("userId","==",_uid))),
        getDocs(query(collection(db,"medals"),where("userId","==",_uid))),
        getDocs(collection(db,`users/${_uid}/medals`)),
        getDoc(doc(db,"skillMastery",_uid)),
      ]);
      const mskills=masterySnap.exists()?(masterySnap.data()?.skills||{}):{};
      setMasteredCount(Object.values(mskills).filter(s=>Number(s?.stagesCompleted||0)>=3).length);
      const mine=resSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.completedAt?.localeCompare(a.completedAt));
      setResults(mine);
      const map={};
      repSnap.docs.forEach(d=>{const r={id:d.id,...d.data()};if(r.resultId)map[r.resultId]=r;});
      setExpertMap(map);
      setMedals(medalSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.earnedAt?.localeCompare(a.earnedAt)));
      setRankMedals(rankMedalSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.awardedAt||'').localeCompare(a.awardedAt||'')));
    }catch(e){console.error(e);setFetchError(true);}
    setLoading(false);
  };
  useEffect(()=>{ load(); },[user?.uid||user?.id]);
  // Подтянуть toggle помощника при смене uid (другой аккаунт в том же браузере).
  useEffect(()=>{ setNpcOn(isNpcEnabled(uid)); },[uid]);

  if(viewingExpert) return <ExpertReportView report={viewingExpert} studentPhotos={viewingPhotos} onBack={()=>{setViewingExpert(null);setViewingPhotos([]);}}/>;

  const fmtTime=sec=>{const m=Math.floor(sec/60),s=sec%60;return m>0?`${m} мин ${s} с`:`${s} с`;};

  // ── Мотивирующие статы ──────────────────────────────────────────────────
  const activity = user?.activity || {};
  // Решено задач: ежедневные (activity по дням) + вопросы диагностик
  // activity начали записывать недавно — для старых аккаунтов нижняя оценка
  // через recentAnswers (последние 50 реально решённых задач).
  const ra = Array.isArray(user?.recentAnswers) ? user.recentAnswers : [];
  const tasksDaily = Object.values(activity).reduce((s, v) => s + (Number(v) || 0), 0);
  const tasksDiag  = results.reduce((s, r) => s + (Number(r.totalQuestions) || 0), 0);
  const tasksTotal = Math.max(tasksDaily + tasksDiag, ra.length);
  const accuracy = ra.length ? Math.round(ra.filter(Boolean).length / ra.length * 100) : null;
  // Лучший день: максимум activity → день недели + количество
  const bestDay = (() => {
    let bestKey = null, bestCount = 0;
    for (const [k, v] of Object.entries(activity)) {
      const n = Number(v) || 0;
      if (n > bestCount) { bestCount = n; bestKey = k; }
    }
    if (!bestKey) return null;
    const d = new Date(bestKey + 'T12:00:00');
    return { day: d.toLocaleDateString('ru-RU', { weekday: 'short' }), count: bestCount };
  })();
  // Герой: HP, надетый сет, собранные сеты. gender-фильтр: сет чужого пола
  // (после смены пола) не считается надетым → base HP, без бонуса.
  const heroGender = user?.gender || 'male';
  const heroHp = computePlayerHp(user?.equipped, heroGender);
  const heroSetId = completedSet(user?.equipped, heroGender);
  const inventoryArr = Array.isArray(user?.inventory) ? user.inventory : [];
  const ownedSets = Object.entries(EQUIPMENT_SETS).filter(([, s]) => s.items.every(id => inventoryArr.includes(id)));
  // equippedItems показываем только для сета своего пола (иначе чужие вещи в HUD)
  const equippedItems = heroSetId ? ['helmet','top','bottom','boots'].map(s => getShopItem(user?.equipped?.[s])).filter(Boolean) : [];
  // Следующий тир уровня — долгосрочная цель под XP-баром
  const levelInfo = getLevelInfo(user?.xp ?? 0);
  const nextTier = LEVEL_TIERS[LEVEL_TIERS.findIndex(t => t.tier === levelInfo.tier.tier) + 1] || null;

  const equippedBg    = user?.equipped?.background ? getShopItem(user.equipped.background) : null;
  const frameStyle    = user?.equipped?.frame ? (FRAME_STYLES[user.equipped.frame] || null) : null;

  return(
    <div
      className={`profile-page${equippedBg ? ' has-bg' : ''}`}
      style={{position:'relative', minHeight:'100vh', ...(equippedBg ? {isolation:'isolate'} : {})}}
    >
      {/* Фоновый layer для кастомного фона профиля (если надет equipped.background).
          isolation:isolate на .profile-page образует stacking context — иначе
          layer с отрицательным z-index уходит за непрозрачный .dashboard-layout.
          .has-bg делает карточки .dashboard-section полупрозрачными — см. index.css. */}
      {equippedBg && (
        <div aria-hidden="true" style={{
          position:'absolute', inset:0, zIndex:-1, pointerEvents:'none',
          backgroundImage:`url(${equippedBg.file})`,
          backgroundSize:'cover', backgroundPosition:'center',
          opacity:0.6, borderRadius:16,
        }}/>
      )}
      <div className="dashboard-header"><h1>Личный кабинет</h1></div>

      <div className="profile-layout">
      {/* ═══ ЛЕВАЯ КОЛОНКА (sticky): кто я ═══ */}
      <div className="profile-col-left">
      {/* Avatar card — вертикальная компоновка для узкой колонки */}
      <div className="dashboard-section" style={{marginBottom:0}}>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:12}}>
          {/* Avatar (CSS-frame применяется inline, перекрывая дефолтный gold-border) */}
          <div style={{position:"relative",flexShrink:0}}>
            {!isEditing
              ? (isCreator(user?.uid)
                  ? <CreatorRing size={150} avatarUrl={user?.avatarUrl} equippedFrame={user?.equipped?.frame}
                      label={`${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`} />
                  : <TierRing3D xp={user?.xp ?? 0} avatarUrl={user?.avatarUrl} equippedFrame={user?.equipped?.frame}
                      size={150} label={`${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`} />)
              : (editForm.avatarUrl
                  ? <img src={editForm.avatarUrl} alt="avatar"
                      style={{ width:120, height:120, borderRadius:"50%", objectFit:"cover", border:`3px solid ${THEME.accent}`, ...(frameStyle || {}) }}/>
                  : <div className="profile-avatar" style={{ ...(frameStyle || {}), width:120, height:120, fontSize:40 }}>
                      {editForm.firstName?.[0]}{editForm.lastName?.[0]}
                    </div>)
            }
            {isEditing&&(
              <>
                <button onClick={()=>avatarInputRef.current?.click()} disabled={avatarUploading}
                  style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderRadius:"50%",background:THEME.primary,color:"#fff",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer",padding:0}}>
                  {avatarUploading?"⏳":"📷"}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarChange}/>
              </>
            )}
          </div>
          <div className="profile-info" style={{width:'100%'}}>
            {isEditing?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Имя</div>
                    <input className="input-field" style={{marginBottom:0,padding:"8px 12px",background:THEME.surface,color:THEME.text,border:`1px solid ${THEME.border}`,colorScheme:isDarkUi?'dark':'light'}} value={editForm.firstName} onChange={e=>setEditForm(p=>({...p,firstName:e.target.value}))} placeholder="Имя"/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Фамилия</div>
                    <input className="input-field" style={{marginBottom:0,padding:"8px 12px",background:THEME.surface,color:THEME.text,border:`1px solid ${THEME.border}`,colorScheme:isDarkUi?'dark':'light'}} value={editForm.lastName} onChange={e=>setEditForm(p=>({...p,lastName:e.target.value}))} placeholder="Фамилия"/>
                  </div>
                </div>
                {/* Пол 3D-героя — модель в «Мой герой»/магазине обновится после сохранения */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Герой</div>
                  <div style={{display:"flex",gap:8}}>
                    {[["male","👦","Ученик"],["female","👧","Ученица"]].map(([val,emoji,label])=>(
                      <button key={val} type="button" onClick={()=>setEditForm(p=>({...p,gender:val}))}
                        style={{flex:1,padding:"9px 8px",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                          fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:700,
                          background:editForm.gender===val?"rgba(251,191,36,0.12)":"transparent",
                          border:editForm.gender===val?"2px solid #fbbf24":`2px solid ${THEME.border}`,
                          color:editForm.gender===val?(isDarkUi?"#fbbf24":"#92400e"):THEME.text,transition:"all 0.15s"}}>
                        <span style={{fontSize:17}}>{emoji}</span> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Цель</div>
                  <select className="input-field" style={{marginBottom:0,padding:"8px 12px",background:THEME.surface,color:THEME.text,border:`1px solid ${THEME.border}`,colorScheme:isDarkUi?'dark':'light'}} value={editForm.goalKey}
                    onChange={e=>setEditForm(p=>({...p,goalKey:e.target.value,details:""}))}>
                    <option value="">— Выберите цель —</option>
                    {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {editForm.goalKey&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>
                      {editForm.goalKey==="exam"?"Экзамен":"Класс"}
                    </div>
                    <select className="input-field" style={{marginBottom:0,padding:"8px 12px",background:THEME.surface,color:THEME.text,border:`1px solid ${THEME.border}`,colorScheme:isDarkUi?'dark':'light'}} value={editForm.details}
                      onChange={e=>setEditForm(p=>({...p,details:e.target.value}))}>
                      <option value="">— Выберите —</option>
                      {getSpecificList(editForm.goalKey).map(x=><option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Область</div>
                  <select className="input-field" style={{marginBottom:0,padding:"8px 12px",background:THEME.surface,color:THEME.text,border:`1px solid ${THEME.border}`,colorScheme:isDarkUi?'dark':'light'}} value={editForm.region}
                    onChange={e=>setEditForm(p=>({...p,region:e.target.value}))}>
                    <option value="">— Выберите —</option>
                    {KZ_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button onClick={saveProfile} disabled={editSaving} style={{background:THEME.accent,color:THEME.onAccent ?? '#0f172a',border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,fontSize:13,cursor:editSaving?"not-allowed":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Сохраняю...":"Сохранить"}</button>
                  <button onClick={()=>{setIsEditing(false);setEditForm({firstName:user?.firstName||"",lastName:user?.lastName||"",gender:user?.gender||"male",goalKey:user?.goalKey||"",details:user?.details||"",region:user?.region||"",avatarUrl:user?.avatarUrl||""});}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"}}>Отмена</button>
                </div>
              </div>
            ):(() => {
              const titleItem = user?.equipped?.title ? getShopItem(user.equipped.title) : null;
              return (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
                <div className={`profile-name${isCreator(user?.uid) ? ' creator-name' : ''}`} style={{fontSize:22, textAlign:'center'}}>{user?.firstName} {user?.lastName}</div>
                {isCreator(user?.uid) && (<span className="creator-badge">⚡ Основатель AAPA</span>)}
                {titleItem && (
                  <div style={{display:'inline-block', background:'linear-gradient(135deg, #1e1b4b, #312e81)', color:'#d4af37', fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12, padding:'4px 12px', borderRadius:99, border:'1px solid rgba(212,175,55,0.3)'}}>🏆 {titleItem.value}</div>
                )}
                <div className="profile-phone">{user?.phone}</div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, flexWrap:'wrap'}}>
                  <span style={{display:'inline-block', background:statusObj.color, color:'#fff', fontWeight:700, fontSize:12, padding:'4px 14px', borderRadius:99, border:`1px solid ${statusObj.color}`}}>{statusObj.label}</span>
                  {user?.goal && <span style={{display:'inline-block', background:'transparent', color:THEME.textLight, fontWeight:600, fontSize:12, padding:'4px 12px', borderRadius:6, border:`1px solid ${THEME.border}`}}>{user.goal}</span>}
                </div>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4, marginTop:2}}>
                  {user?.details && <div className="profile-detail">📚 {user.details}</div>}
                  {user?.region && <div className="profile-detail">📍 {user.region}</div>}
                  <div className="profile-date">📅 Зарегистрирован: {user?.registeredAt?new Date(user.registeredAt).toLocaleDateString("ru-RU"):"—"}</div>
                </div>
                <div style={{width:'100%', maxWidth:300, marginTop:8}}><XpBar xp={user?.xp ?? 0} help={<InfoTooltip text="Твой уровень и тир. Растёт за опыт (XP) и не сбрасывается." />} /></div>
                {nextTier && (
                  <div style={{fontSize:12, color:THEME.textLight, textAlign:'center'}}>
                    Следующий ранг: <b style={{color:nextTier.color}}>{nextTier.name}</b> — с {nextTier.min} уровня
                  </div>
                )}
                <button onClick={()=>setIsEditing(true)} style={{marginTop:8, padding:'10px 20px', fontSize:13, fontWeight:600, borderRadius:10, border:`1px solid ${THEME.border}`, background:'transparent', color:THEME.text, cursor:'pointer', whiteSpace:'nowrap'}}>✏️ Редактировать профиль</button>
              </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Мой герой — крупный 3D-персонаж + HUD-оверлей со снаряжением поверх канваса */}
      <div className="dashboard-section" style={{marginBottom:0, padding:'14px 18px'}}>
        <h2 className="section-title" style={{marginBottom:8}}>🦸 Мой герой</h2>
        <div style={{position:'relative', borderRadius:14, overflow:'hidden'}}>
          <Character3D
            gender={user?.gender || 'male'}
            equipped={{ helmet: user?.equipped?.helmet, top: user?.equipped?.top, bottom: user?.equipped?.bottom, boots: user?.equipped?.boots }}
            autoSpin={0.4} height={450} zoomable zoomBottom={96}
          />
          {/* HUD-оверлей: прозрачный сверху → тёмный снизу; pointer-events сквозные,
              кликабельна только кнопка (чтобы вращение/зум канваса работали) */}
          <div style={{
            position:'absolute', left:0, right:0, bottom:0, padding:'16px 20px',
            background:'linear-gradient(transparent, rgba(0,0,0,0.7))',
            pointerEvents:'none', display:'flex', flexDirection:'column', gap:10,
          }}>
            <div style={{display:'flex', flexWrap:'wrap', gap:'4px 14px', fontSize:13.5, fontWeight:600, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.7)'}}>
              <span>❤️ {heroHp} HP</span>
              <span>
                {heroSetId
                  ? `🛡 Сет «${EQUIPMENT_SETS[heroSetId].name}» (+${EQUIPMENT_SETS[heroSetId].bonus} ❤️)`
                  : equippedItems.length > 0
                    ? `🛡 ${equippedItems.map(it => it.name).join(' · ')}`
                    : '🛡 без снаряжения'}
              </span>
              <span>🎁 {ownedSets.length} из {Object.keys(EQUIPMENT_SETS).length} сетов</span>
            </div>
            {onOpenShop && (
              <button onClick={onOpenShop} style={{
                pointerEvents:'auto', alignSelf:'flex-start', padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer',
                fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:12.5,
                background:THEME.accent, color:THEME.onAccent ?? '#0f172a',
              }}>Изменить снаряжение →</button>
            )}
          </div>
        </div>
      </div>

      {/* ── 6 мотивирующих стат-карточек (3×2 компактно, см. .profile-col-left CSS) ── */}
      <div className="profile-stats-grid" style={{display:"grid",gap:10}}>
        <div className="stat-card"><div className="stat-icon">🎯</div><div style={{minWidth:0}}><div className="stat-value">{tasksTotal.toLocaleString('ru-RU')}</div><div className="stat-label">решено задач</div></div></div>
        <div className="stat-card"><div className="stat-icon">🔥</div><div style={{minWidth:0}}><div className="stat-value" style={{color:'#f59e0b'}}>{Number(user?.streak||0)}</div><div className="stat-label">дней подряд</div></div></div>
        <div className="stat-card"><div className="stat-icon">🪐</div><div style={{minWidth:0}}><div className="stat-value">{masteredCount}<span style={{fontSize:13, fontWeight:600, color:THEME.textLight}}> / 307</span></div><div className="stat-label">освоено навыков</div></div></div>
        <div className="stat-card"><div className="stat-icon">💎</div><div style={{minWidth:0}}><div className="stat-value">{(user?.crystals??0).toLocaleString('ru-RU')}</div><div className="stat-label">{(()=>{const n=user?.crystals??0,m=Math.abs(n)%100,b=m%10;if(m>10&&m<20)return 'кристаллов';if(b>1&&b<5)return 'кристалла';if(b===1)return 'кристалл';return 'кристаллов';})()}</div></div></div>
        <div className="stat-card"><div className="stat-icon">📈</div><div style={{minWidth:0}}><div className="stat-value" style={{color: accuracy==null?THEME.textLight:accuracy>=80?'#22c55e':accuracy>=60?'#f59e0b':'#ef4444'}}>{accuracy==null?'—':`${accuracy}%`}</div><div className="stat-label">средняя точность</div></div></div>
        <div className="stat-card"><div className="stat-icon">🏆</div><div style={{minWidth:0}}><div className="stat-value" style={{fontSize: bestDay?18:22}}>{bestDay?`${bestDay.day} · ${bestDay.count}`:'—'}</div><div className="stat-label">лучший день</div></div></div>
      </div>
      </div>{/* ═══ /ЛЕВАЯ КОЛОНКА ═══ */}

      {/* ═══ ПРАВАЯ КОЛОНКА (scroll): что я сделал ═══ */}
      <div className="profile-col-right">

      {/* Достижения — свой профиль, с живым прогрессом X/Y */}
      <div>
        <AchievementsGrid uid={uid} progress={{
          scholar:  masteredCount,
          streak:   Number(user?.streak || 0),
          wealth:   Number(user?.crystals || 0),
          accuracy: (Array.isArray(user?.recentAnswers) && user.recentAnswers.length)
            ? Math.round(user.recentAnswers.filter(Boolean).length / user.recentAnswers.length * 100)
            : undefined,
        }}/>
      </div>

      {/* Medals */}
      {medals.length>0&&(
        <div className="dashboard-section" style={{marginBottom:0}}>
          <h2 className="section-title" style={{marginBottom:16}}>🏅 Мои медали</h2>
          <div style={{display:"flex",flexWrap:"nowrap",gap:16,overflowX:"auto",paddingBottom:6}}>
            {medals.map(m=>(
              <div key={m.id} style={{flexShrink:0,background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:"16px 20px",minWidth:160,textAlign:"center",border:"1px solid rgba(212,175,55,0.3)",boxShadow:"0 4px 20px rgba(0,0,0,0.12)"}}>
                <div style={{fontSize:36,marginBottom:6}}>🏅</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:13,color:THEME.accent,marginBottom:4}}>{m.sectionName}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{m.earnedAt?new Date(m.earnedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):"—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Медали недельного рейтинга — секция видна только когда медали есть
          (пустая секция с замочком демотивирует) */}
      {rankMedals.length>0 && (
        <div className="dashboard-section" style={{marginBottom:0}}>
          <h2 className="section-title" style={{marginBottom:16, display:'inline-flex', alignItems:'center'}}>🏅 Медали рейтинга<InfoTooltip text="Награды за топ-10 в недельном рейтинге." /></h2>
          <div style={{display:"flex", flexWrap:"nowrap", gap:14, overflowX:"auto", paddingBottom:6}}>
            {rankMedals.map(m=>(
              <div key={m.id} style={{flexShrink:0, display:"flex", justifyContent:"center"}}>
                <Medal type={m.type} category={m.category} weekId={m.weekId} size={56} position={m.position}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div data-tour="diag-history" className="dashboard-section" style={{marginBottom:0}}>
        <h2 className="section-title" style={{marginBottom:20}}>📊 История диагностик</h2>
        {loading&&<div className="empty-state" style={{padding:"24px 0"}}>Загрузка...</div>}
        {!loading&&fetchError&&<ErrorCard onRetry={load}/>}
        {!loading&&!fetchError&&results.length===0&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:12,padding:"8px 0 4px"}}>
            <div style={{fontSize:13,color:THEME.textLight}}>Диагностика ещё не пройдена — узнай свои сильные и слабые темы.</div>
            {onOpenDiagnostics && (
              <button onClick={onOpenDiagnostics} style={{
                padding:"11px 22px", borderRadius:10, border:"none", cursor:"pointer",
                fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13,
                background:THEME.accent, color:THEME.onAccent ?? '#0f172a',
              }}>Пройти диагностику →</button>
            )}
          </div>
        )}
        {!loading&&!fetchError&&results.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {results.map((r,i)=>{
              const hasReport=!!expertMap[r.id];
              const pct=r.score||0;
              const color=pct>=80?THEME.success:pct>=60?THEME.warning:THEME.error;
              const num=results.length-i;
              const title=r.sectionName||"Общая диагностика";
              return(
                <div key={r.id} className="diag-history-item" onClick={hasReport?()=>{setViewingExpert(expertMap[r.id]);setViewingPhotos(r.studentPhotos||[]);}:undefined}
                  style={{padding:"16px 20px",borderRadius:12,border:`1px solid ${hasReport?THEME.accent:THEME.border}`,borderLeft:`4px solid ${hasReport?THEME.accent:THEME.border}`,cursor:hasReport?"pointer":"default",transition:"box-shadow 0.15s"}}
                  onMouseEnter={e=>{if(hasReport)e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.07)";}}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span className="diag-history-num" style={{fontSize:11,fontWeight:700,color:THEME.textLight,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:99,padding:"1px 9px"}}>#{num}</span>
                        <span className="diag-history-title" style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{title}</span>
                      </div>
                      <div style={{fontSize:12,color:THEME.textLight}}>{new Date(r.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})} · {r.totalQuestions} вопросов · {fmtTime(r.totalTime||0)}</div>
                      {hasReport
                        ? <div style={{fontSize:11,color:THEME.accent,fontWeight:700,marginTop:5}}>📋 Экспертный отчёт доступен — нажмите чтобы открыть →</div>
                        : <div style={{fontSize:11,color:'#22c55e',fontWeight:700,marginTop:5}}>✅ Завершено · {pct}% правильно</div>
                      }
                    </div>
                    {/* Процент-блок показываем для ВСЕХ строк (раньше — только с отчётом) */}
                    <div style={{flexShrink:0,textAlign:"center"}}>
                      <div style={{width:50,height:50,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15}}>{pct}%</div>
                      <div style={{marginTop:6,height:4,width:50,borderRadius:99,background:THEME.border,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:99}}/>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Настройки ── */}
      <div className="dashboard-section" style={{marginBottom:0}}>
        <h2 className="section-title" style={{marginBottom:16}}>⚙️ Настройки</h2>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <label style={{display:'flex', alignItems:'center', gap:10, fontSize:14, color:THEME.text, cursor:'pointer'}}>
            <input type="checkbox" checked={npcOn} onChange={e=>{setNpcOn(e.target.checked);setNpcEnabled(uid,e.target.checked);}} style={{width:16,height:16,cursor:'pointer'}}/>
            Показывать подсказки помощника
          </label>
          <div style={{maxWidth:280}}>
            <ChangePasswordInline />
          </div>
          {/* Место для будущих настроек (язык, тема и т.д.) */}
          <button
            onClick={()=>{
              if(window.confirm('Удалить аккаунт? Все данные будут потеряны безвозвратно.')){
                alert('Для удаления аккаунта напишите нам: meirbekbazarbek@gmail.com — удалим в течение 24 часов.');
              }
            }}
            style={{alignSelf:'flex-start', marginTop:8, background:'none', border:'none', padding:0,
              fontSize:11, color:THEME.textLight, opacity:0.7, cursor:'pointer', textDecoration:'underline'}}>
            Удалить аккаунт
          </button>
        </div>
      </div>

      </div>{/* ═══ /ПРАВАЯ КОЛОНКА ═══ */}
      </div>{/* ═══ /profile-layout ═══ */}
    </div>
  );
}
