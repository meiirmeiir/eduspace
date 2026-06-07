import React, { useState, useEffect } from "react";
import { useTheme } from "../ThemeContext.jsx";
import {
  SHOP_ITEMS, SHOP_TYPES, FRAME_STYLES, EQUIPMENT_SETS, computePlayerHp, completedSet,
  RARITY, ACHIEVEMENT_EXCLUSIVES, getWeeklyOffer, setFullPrice, setPurchasePrice, getShopItem,
} from "../lib/shopItems.js";
import { purchaseItem, equipItem, purchaseSet } from "../lib/shopUtils.js";
import { getLeague, getWeekId } from "../lib/pointsUtils.js";
import Logo from "../components/ui/Logo.jsx";
import InfoTooltip from "../components/InfoTooltip.jsx";
import LegoCharacter3D from "../components/LegoCharacter3D.jsx";

// Слоты снаряжения (Этап 2A — каркас; варианты наполняются в 2B).
const EQUIP_SLOTS = [
  { id: 'helmet', icon: '🪖', label: 'Головной убор' },
  { id: 'top',    icon: '👕', label: 'Верх' },
  { id: 'bottom', icon: '👖', label: 'Низ' },
  { id: 'boots',  icon: '👟', label: 'Обувь' },
];

const THEME_SWATCHES = {
  galaxy: ['#1e1b4b', '#312e81', '#a78bfa'],
  sakura: ['#fce7f3', '#f9a8d4', '#831843'],
  matrix: ['#0a0a0a', '#16a34a', '#bbf7d0'],
  fire:   ['#0f172a', '#dc2626', '#fbbf24'],
};

// Табы: «Витрина» — первая и дефолтная.
const SHOP_TABS = [{ id: 'showcase', icon: '✨', label: 'Витрина' }, ...SHOP_TYPES];

// Время до понедельника 00:00 UTC — сброс «предложения недели» (синхронно с рейтингом).
function getTimeUntilMonday() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() + (((8 - day) % 7) || 7));
  const ms = Math.max(0, next.getTime() - now.getTime());
  return { days: Math.floor(ms / 86400000), hours: Math.floor((ms % 86400000) / 3600000) };
}

// Рамка карточки по редкости (тёмная аниме-эстетика; epic/legendary анимируются CSS-классом).
function rarityFrame(rarity) {
  switch (rarity) {
    case 'rare':      return { border: '1px solid rgba(59,130,246,0.55)',  boxShadow: '0 0 10px rgba(59,130,246,0.18)' };
    case 'epic':      return { border: '1px solid rgba(167,139,250,0.65)', boxShadow: '0 0 12px rgba(167,139,250,0.25)' };
    case 'legendary': return { border: '1px solid rgba(251,191,36,0.7)',   boxShadow: '0 0 14px rgba(251,191,36,0.28)' };
    default:          return { border: '1px solid rgba(148,163,184,0.3)',  boxShadow: 'none' };
  }
}

function Preview({ item }) {
  if (item.type === 'frame') {
    // Круглый аватар-плейсхолдер 64×64 с применённым CSS-стилем рамки.
    const style = FRAME_STYLES[item.id] || null;
    return (
      <div style={{
        width:'100%', aspectRatio:'16/9', borderRadius:10,
        background:'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          width:64, height:64, borderRadius:'50%',
          background:'linear-gradient(135deg, #6366f1, #a78bfa)',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:18,
          ...(style || {}),
        }}>МБ</div>
      </div>
    );
  }
  if (item.type === 'background') {
    // Эксклюзив без файла (bg-fire-streak) — процедурный градиент.
    if (!item.preview && !item.file) {
      return (
        <div style={{
          width:'100%', aspectRatio:'16/9', borderRadius:10,
          background:'radial-gradient(ellipse at 50% 100%, #f97316 0%, #dc2626 35%, #7c2d12 65%, #0f172a 100%)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:40,
        }}>{item.icon || '🔥'}</div>
      );
    }
    return (
      <div style={{
        width:'100%', aspectRatio:'16/9', borderRadius:10, overflow:'hidden',
        background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <img
          src={item.preview || item.file} alt={item.name}
          loading="lazy"
          style={{width:'100%', height:'100%', objectFit:'cover'}}
          onError={(e) => {
            // Файл не загружен — деликатный заглушка-фон, не битая иконка.
            e.currentTarget.style.display = 'none';
            const slot = e.currentTarget.parentElement;
            if (slot && !slot.dataset.fallback) {
              slot.dataset.fallback = '1';
              const span = document.createElement('span');
              span.style.cssText = 'color:rgba(255,255,255,0.45);font-size:13px;font-weight:600';
              span.textContent = 'превью скоро';
              slot.appendChild(span);
            }
          }}
        />
      </div>
    );
  }
  if (item.type === 'title') {
    return (
      <div style={{
        width:'100%', aspectRatio:'16/9', borderRadius:10,
        background:'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:14,
      }}>
        <div style={{
          color:'#d4af37', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:15,
          textAlign:'center', lineHeight:1.3,
        }}>«{item.value}»</div>
      </div>
    );
  }
  if (item.type === 'theme') {
    const sw = THEME_SWATCHES[item.value] || ['#666','#999','#ccc'];
    return (
      <div style={{
        width:'100%', aspectRatio:'16/9', borderRadius:10, overflow:'hidden',
        display:'flex',
      }}>
        {sw.map((c, i) => (
          <div key={i} style={{flex:1, background:c}}/>
        ))}
      </div>
    );
  }
  // Снаряжение — иконка на тёмном фоне (для карусели новинок/хитов).
  return (
    <div style={{
      width:'100%', aspectRatio:'16/9', borderRadius:10,
      background:'linear-gradient(135deg, #1e293b, #0f172a)',
      display:'flex', alignItems:'center', justifyContent:'center', fontSize:42,
    }}>{item.icon || '⚙️'}</div>
  );
}

export default function ShopScreen({ user, onBack, onUpdateUser, onGoDaily }) {
  const { theme: THEME, setShopTheme } = useTheme();
  const [activeType, setActiveType] = useState('showcase');
  const [pendingId, setPendingId] = useState(null);   // id предмета/сета в покупке
  const [errMsg, setErrMsg]       = useState(null);
  const [previewItem, setPreviewItem] = useState(null);  // item для модалки «Примерить»
  const [previewSet, setPreviewSet]   = useState(null);  // setId для модалки примерки сета
  const [activeSlot, setActiveSlot]   = useState('helmet'); // активный слот снаряжения
  const [tryOn, setTryOn]             = useState({}); // временная примерка { [slot]: itemId }
  const [resetIn, setResetIn]         = useState(() => getTimeUntilMonday());

  const uid       = user?.uid || user?.id;
  const crystals  = Number(user?.crystals || 0);
  const inventory = Array.isArray(user?.inventory) ? user.inventory : [];
  const equipped  = user?.equipped || {};
  const weekPts   = Number(user?.weekPoints || 0);
  const myLeague  = getLeague(weekPts).current.name.toLowerCase(); // "бронза" / "серебро" / "золото" / "алмаз"
  // Маппинг id-лиги: requiredLeague:'diamond' → должно быть 'алмаз'
  const LEAGUE_MAP = { diamond: 'алмаз', gold: 'золото', silver: 'серебро', bronze: 'бронза' };

  const weekId = getWeekId();
  const offer = getWeeklyOffer(weekId);
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Ученик';
  const userInitials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase() || '?';

  // Таймер сброса предложения недели — раз в минуту достаточно.
  useEffect(() => {
    const t = setInterval(() => setResetIn(getTimeUntilMonday()), 60000);
    return () => clearInterval(t);
  }, []);

  const items = SHOP_ITEMS.filter(i => i.type === activeType);

  const handlePurchase = async (item, priceOverride = null) => {
    if (pendingId) return;
    setErrMsg(null); setPendingId(item.id);
    const res = await purchaseItem(uid, item.id, crystals, priceOverride);
    if (res.success) {
      onUpdateUser?.({
        ...user,
        crystals: res.newCrystals,
        inventory: inventory.includes(item.id) ? inventory : [...inventory, item.id],
      });
    } else {
      setErrMsg(`Покупка не удалась: ${res.error}`);
    }
    setPendingId(null);
  };

  // Покупка полного сета: один атомарный :commit за недостающие предметы.
  const handleBuySet = async (setId) => {
    if (pendingId) return;
    const { missing, price } = setPurchasePrice(setId, inventory);
    if (!missing.length) return;
    setErrMsg(null); setPendingId(`set-${setId}`);
    const res = await purchaseSet(uid, missing, price, crystals);
    if (res.success) {
      onUpdateUser?.({
        ...user,
        crystals: res.newCrystals,
        inventory: [...new Set([...inventory, ...missing])],
      });
    } else {
      setErrMsg(`Покупка сета не удалась: ${res.error}`);
    }
    setPendingId(null);
  };

  const handleEquip = async (item) => {
    if (pendingId) return;
    setErrMsg(null); setPendingId(item.id);
    const res = await equipItem(uid, item.id, item.type);
    if (res.success) {
      onUpdateUser?.({
        ...user,
        equipped: { ...equipped, [item.type]: item.id },
      });
      // Шортcat для shop-темы: обновляем ThemeContext синхронно. Без этого
      // палитра подменится только после того, как Firestore onSnapshot
      // прокатится через AuthContext → outer App → ThemeProvider prop.
      if (item.type === 'theme') setShopTheme(item.value);
      // Надетое теперь = equipped → снимаем временную примерку этого слота.
      setTryOn(t => { const n = { ...t }; delete n[item.type]; return n; });
    } else {
      setErrMsg(`Не удалось надеть: ${res.error}`);
    }
    setPendingId(null);
  };

  // Снять предмет: equipItem(uid, null, type) → nullValue в Firestore (см.
  // firestore-rest.js:22 toFsValue). Локально пишем equipped[type]=null.
  // Для shop-темы дополнительно очищаем ThemeContext, чтобы UI не ждал sync.
  const handleUnequip = async (item) => {
    if (pendingId) return;
    setErrMsg(null); setPendingId(item.id);
    const res = await equipItem(uid, null, item.type);
    if (res.success) {
      onUpdateUser?.({
        ...user,
        equipped: { ...equipped, [item.type]: null },
      });
      if (item.type === 'theme') setShopTheme(null);
      setTryOn(t => { const n = { ...t }; delete n[item.type]; return n; });
    } else {
      setErrMsg(`Не удалось снять: ${res.error}`);
    }
    setPendingId(null);
  };

  const renderButton = (item, { salePrice = null } = {}) => {
    const owned     = inventory.includes(item.id);
    const isEquipped= equipped[item.type] === item.id;
    const requires  = item.requiredLeague ? LEAGUE_MAP[item.requiredLeague] : null;
    const leagueOk  = !requires || myLeague === requires;
    const busy      = pendingId === item.id;
    const price     = salePrice != null ? salePrice : item.price;
    const baseStyle = {
      width:'100%', padding:'10px 14px', borderRadius:10,
      fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13,
      border:'none', cursor:'pointer', transition:'all 0.15s',
    };

    if (isEquipped) {
      return (
        <div style={{display:'flex', flexDirection:'column', gap:6, width:'100%'}}>
          <button disabled style={{...baseStyle, width:'100%', background:'rgba(16,185,129,0.15)', color:'#10b981', cursor:'default', border:'1px solid rgba(16,185,129,0.4)', opacity:0.7}}>Надето ✓</button>
          <button onClick={() => handleUnequip(item)} disabled={busy} style={{...baseStyle, width:'100%', background:'transparent', border:`1px solid ${THEME.border}`, color:THEME.text, opacity:busy?0.6:1}}>{busy?'...':'Снять'}</button>
        </div>
      );
    }
    if (owned) {
      return <button onClick={() => handleEquip(item)} disabled={busy}
        style={{...baseStyle, background:THEME.accent, color:THEME.onAccent ?? '#0f172a', opacity:busy?0.6:1}}>
        {busy ? '...' : 'Надеть'}
      </button>;
    }
    if (item.isExclusive && !leagueOk) {
      return <button disabled style={{...baseStyle, background:'rgba(167,139,250,0.12)', color:'#a78bfa', cursor:'not-allowed', border:'1px solid rgba(167,139,250,0.35)'}}>🔒 Только Алмаз</button>;
    }
    if (crystals < price) {
      // Не хватает: нейтральная подпись + кнопка-мотиватор «Заработать» (без красного).
      const need = price - crystals;
      return (
        <div style={{display:'flex', flexDirection:'column', gap:6, width:'100%'}}>
          <div style={{fontSize:12, color:THEME.textLight, fontWeight:600, textAlign:'center', opacity:0.8}}>Нужно ещё {need} 💎</div>
          {onGoDaily && (
            <button onClick={onGoDaily} style={{...baseStyle, background:'rgba(99,102,241,0.14)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.35)'}}>
              Заработать {need} 💎 →
            </button>
          )}
        </div>
      );
    }
    return <button onClick={() => handlePurchase(item, salePrice)} disabled={busy}
      style={{...baseStyle, background:'#22c55e', color:'#052e16', opacity:busy?0.6:1}}>
      {busy ? '...' : `Купить за ${price} 💎`}
    </button>;
  };

  // Бейджи карточки: редкость (★) + NEW / HIT / SALE.
  const renderBadges = (item, { sale = false } = {}) => {
    const r = RARITY[item.rarity] || RARITY.common;
    return (
      <div style={{position:'absolute', top:8, left:8, right:8, display:'flex', justifyContent:'space-between', pointerEvents:'none', zIndex:2}}>
        <span title={r.name} style={{fontSize:10, fontWeight:800, letterSpacing:1, color:r.color, background:'rgba(10,14,26,0.8)', padding:'3px 8px', borderRadius:99, border:`1px solid ${r.color}55`}}>{r.stars}</span>
        <span style={{display:'flex', gap:4}}>
          {sale && <span style={{fontSize:10, fontWeight:800, color:'#fff', background:'#dc2626', padding:'3px 8px', borderRadius:99}}>SALE</span>}
          {item.isNew && <span style={{fontSize:10, fontWeight:800, color:'#052e16', background:'#4ade80', padding:'3px 8px', borderRadius:99}}>NEW</span>}
          {item.isHit && <span style={{fontSize:10, fontWeight:800, color:'#451a03', background:'#fbbf24', padding:'3px 8px', borderRadius:99}}>HIT</span>}
        </span>
      </div>
    );
  };

  // Общая карточка товара (каталог + витрина). minWidth — для карусели.
  const renderItemCard = (item, { salePrice = null, minWidth = null } = {}) => (
    <div key={item.id} className={`dashboard-section shop-card shop-rarity-${item.rarity || 'common'}`} style={{
      position:'relative', padding:14, display:'flex', flexDirection:'column', gap:10,
      ...(minWidth ? { minWidth, scrollSnapAlign:'start' } : {}),
      ...rarityFrame(item.rarity),
    }}>
      {renderBadges(item, { sale: salePrice != null })}
      <Preview item={item}/>
      <div>
        <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.primary, marginBottom:2}}>
          {item.name}{item.isExclusive ? ' ✨' : ''}
        </div>
        <div style={{fontSize:12, color:THEME.textLight, fontWeight:600}}>
          {salePrice != null
            ? <><s style={{opacity:0.6}}>{item.price}</s> <b style={{color:'#4ade80'}}>{salePrice} 💎</b></>
            : <>{item.price} 💎</>}
          {item.hp ? <span style={{color:'#ef4444'}}> · +{item.hp} ❤️</span> : null}
        </div>
      </div>
      {renderButton(item, { salePrice })}
      {['background','theme','frame','title'].includes(item.type) && (
        <button onClick={() => setPreviewItem(item)} style={{
          width:'100%', padding:'8px 14px', borderRadius:10,
          fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12,
          border:`1px solid ${THEME.border}`, background:'transparent',
          color:THEME.text, cursor:'pointer', transition:'all 0.15s',
        }}>👁 Примерить</button>
      )}
    </div>
  );

  // ── Витрина ──────────────────────────────────────────────────────────────
  const renderShowcase = () => {
    const newItems = SHOP_ITEMS.filter(i => i.isNew);
    const hitItems = SHOP_ITEMS.filter(i => i.isHit).slice(0, 3);
    const sectionTitle = (emoji, text) => (
      <div style={{display:'flex', alignItems:'center', gap:8, margin:'26px 0 12px'}}>
        <span style={{fontSize:18}}>{emoji}</span>
        <span style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:17, color:THEME.primary, letterSpacing:'0.3px'}}>{text}</span>
      </div>
    );
    return (
      <div>
        {/* ── Баннер «Предложение недели» (ротация по weekId, -30%) ── */}
        {offer && (() => {
          const it = offer.item;
          const owned = inventory.includes(it.id);
          return (
            <div style={{
              position:'relative', borderRadius:18, overflow:'hidden', marginBottom:8,
              background:'linear-gradient(120deg, #1e1b4b 0%, #0f172a 55%, #2d1252 100%)',
              border:'1px solid rgba(167,139,250,0.45)', boxShadow:'0 8px 32px rgba(124,58,237,0.25)',
              padding:'22px 24px', display:'flex', gap:20, flexWrap:'wrap', alignItems:'center',
            }}>
              <div style={{flex:'1 1 260px', minWidth:240}}>
                <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                  <span style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:'#fbbf24', letterSpacing:1, textTransform:'uppercase'}}>🔥 Предложение недели</span>
                  <span style={{fontSize:11, fontWeight:800, color:'#fff', background:'#dc2626', padding:'3px 10px', borderRadius:99}}>-{offer.discountPct}%</span>
                </div>
                <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, color:'#f0f6fc', margin:'8px 0 4px'}}>{it.name}</div>
                <div style={{fontSize:15, fontWeight:700, color:'#e2e8f0', marginBottom:10}}>
                  <s style={{opacity:0.55}}>{it.price} 💎</s>{' '}
                  <span style={{color:'#4ade80', fontSize:20}}>{offer.salePrice} 💎</span>
                </div>
                <div style={{fontSize:12, color:'rgba(226,232,240,0.65)', marginBottom:14}}>
                  ⏳ Сбрасывается через {resetIn.days}д {resetIn.hours}ч · каждый понедельник — новый товар
                </div>
                <div style={{maxWidth:260}}>
                  {owned
                    ? <div style={{fontSize:13, fontWeight:700, color:'#4ade80'}}>Уже в твоём инвентаре ✓</div>
                    : renderButton(it, { salePrice: offer.salePrice })}
                </div>
              </div>
              <div style={{flex:'0 1 300px', minWidth:200}}>
                <Preview item={it}/>
              </div>
            </div>
          );
        })()}

        {/* ── Новинки: горизонтальная карусель (свайп на мобильном) ── */}
        {newItems.length > 0 && (
          <>
            {sectionTitle('🆕', 'Новинки')}
            <div style={{display:'flex', gap:14, overflowX:'auto', paddingBottom:10, scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch'}}>
              {newItems.map(i => renderItemCard(i, { minWidth: 230 }))}
            </div>
          </>
        )}

        {/* ── Хит продаж ── */}
        {hitItems.length > 0 && (
          <>
            {sectionTitle('🏆', 'Хит продаж')}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14}}>
              {hitItems.map(i => renderItemCard(i))}
            </div>
          </>
        )}

        {/* ── Наборы со скидкой ── */}
        {sectionTitle('📦', 'Наборы со скидкой')}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14}}>
          {Object.entries(EQUIPMENT_SETS).map(([setId, set]) => {
            const full = setFullPrice(setId);
            const { missing, price } = setPurchasePrice(setId, inventory);
            const allOwned = missing.length === 0;
            const busy = pendingId === `set-${setId}`;
            const discountPct = Math.round(set.discount * 100);
            return (
              <div key={setId} className="dashboard-section shop-card shop-rarity-epic" style={{
                position:'relative', padding:16, display:'flex', flexDirection:'column', gap:10,
                ...rarityFrame('epic'),
              }}>
                <div style={{position:'absolute', top:10, right:10, fontSize:11, fontWeight:800, color:'#fff', background:'#dc2626', padding:'3px 10px', borderRadius:99}}>СКИДКА -{discountPct}%</div>
                <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:17, color:THEME.primary}}>
                  {set.icon} Полный сет «{set.name}»
                </div>
                {/* Состав сета */}
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {set.items.map(id => {
                    const it = getShopItem(id);
                    const has = inventory.includes(id);
                    return (
                      <span key={id} title={it?.name} style={{
                        width:46, height:46, borderRadius:10, fontSize:22,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'linear-gradient(135deg, #1e293b, #0f172a)',
                        border:`1px solid ${has ? 'rgba(34,197,94,0.6)' : 'rgba(148,163,184,0.25)'}`,
                        position:'relative',
                      }}>
                        {it?.icon || '⚙️'}
                        {has && <span style={{position:'absolute', top:-5, right:-5, fontSize:10, background:'#22c55e', color:'#fff', borderRadius:'50%', width:14, height:14, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800}}>✓</span>}
                      </span>
                    );
                  })}
                </div>
                <div style={{fontSize:12, color:THEME.textLight, fontWeight:600}}>
                  Бонус сета: <b style={{color:'#ef4444'}}>+{set.bonus} ❤️</b> в боях с боссами
                </div>
                <div style={{fontSize:14, fontWeight:700, color:THEME.text}}>
                  {allOwned
                    ? <span style={{color:'#4ade80'}}>Сет полностью собран ✓</span>
                    : <><s style={{opacity:0.55}}>{full} 💎</s> <b style={{color:'#4ade80', fontSize:17}}>{price} 💎</b>
                       {missing.length < 4 && <span style={{fontSize:11, color:THEME.textLight, fontWeight:600}}> · за {missing.length} недостающих</span>}</>}
                </div>
                {!allOwned && (crystals >= price
                  ? <button onClick={() => handleBuySet(setId)} disabled={busy} style={{
                      width:'100%', padding:'11px 14px', borderRadius:10, border:'none', cursor:'pointer',
                      fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13,
                      background:'#22c55e', color:'#052e16', opacity:busy?0.6:1,
                    }}>{busy ? '...' : 'Купить полный сет'}</button>
                  : <div style={{fontSize:12, color:THEME.textLight, fontWeight:600, textAlign:'center', opacity:0.8}}>
                      Нужно ещё {price - crystals} 💎
                      {onGoDaily && <button onClick={onGoDaily} style={{display:'block', width:'100%', marginTop:6, padding:'9px 14px', borderRadius:10, fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:12, cursor:'pointer', background:'rgba(99,102,241,0.14)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.35)'}}>Заработать →</button>}
                    </div>)}
                <button onClick={() => setPreviewSet(setId)} style={{
                  width:'100%', padding:'8px 14px', borderRadius:10,
                  fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12,
                  border:`1px solid ${THEME.border}`, background:'transparent',
                  color:THEME.text, cursor:'pointer',
                }}>👁 Примерить на герое</button>
              </div>
            );
          })}
        </div>

        {/* ── Эксклюзивы — только за достижения ── */}
        {sectionTitle('🔒', 'Только за достижения')}
        <div style={{fontSize:13, color:THEME.textLight, margin:'-6px 0 12px'}}>Эти предметы нельзя купить за кристаллы — только заслужить.</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14}}>
          {[...ACHIEVEMENT_EXCLUSIVES.map(ex => ({ ...ex, _req: ex.requirement })),
            { ...getShopItem('frame-diamond'), _req: 'Будь в Алмаз-лиге (1200+ очков за неделю) и накопи 800 💎' }]
            .map(ex => {
            const owned = inventory.includes(ex.id);
            return (
              <div key={ex.id} className="dashboard-section shop-card shop-rarity-legendary" style={{
                position:'relative', padding:14, display:'flex', flexDirection:'column', gap:10,
                ...rarityFrame('legendary'),
              }}>
                {renderBadges(ex)}
                <div style={{position:'relative'}}>
                  <Preview item={ex}/>
                  {!owned && (
                    <div style={{position:'absolute', inset:0, borderRadius:10, background:'rgba(10,14,26,0.55)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34}}>🔒</div>
                  )}
                </div>
                <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.primary}}>{ex.name}</div>
                <div style={{fontSize:12, color:THEME.textLight, lineHeight:1.5}}>
                  {owned ? <span style={{color:'#4ade80', fontWeight:700}}>Получено ✓</span> : <>🎯 {ex._req}</>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="page-themed" style={{minHeight:'100vh', background:THEME.bg, paddingBottom:80}}>
      {/* Анимации рамок редкости + hover-подъём карточек */}
      <style>{`
        .shop-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .shop-card:hover { transform: translateY(-4px); }
        .shop-rarity-rare:hover      { box-shadow: 0 6px 20px rgba(59,130,246,0.35) !important; }
        .shop-rarity-epic:hover      { box-shadow: 0 6px 22px rgba(167,139,250,0.45) !important; }
        .shop-rarity-legendary:hover { box-shadow: 0 6px 24px rgba(251,191,36,0.45) !important; }
        .shop-rarity-epic      { animation: shopEpicPulse 2.6s ease-in-out infinite; }
        .shop-rarity-legendary { position: relative; overflow: hidden; }
        .shop-rarity-legendary::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 60px;
          background: linear-gradient(105deg, transparent, rgba(251,191,36,0.18), transparent);
          animation: shopLegendShine 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes shopEpicPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(167,139,250,0.25); }
          50%      { box-shadow: 0 0 20px rgba(167,139,250,0.45); }
        }
        @keyframes shopLegendShine {
          0%   { left: -80px; }
          60%  { left: 110%; }
          100% { left: 110%; }
        }
      `}</style>
      <div style={{background:THEME.primary, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64}}>
        <Logo size={32} light/>
        <button onClick={onBack} style={{background:'transparent', border:`1px solid ${THEME.onPrimary ?? 'rgba(255,255,255,0.2)'}33`, color:THEME.onPrimary ?? '#fff', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontFamily:"'Inter',sans-serif"}}>← Назад</button>
      </div>

      <div style={{maxWidth:1100, margin:'0 auto', padding:'24px 16px'}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color:THEME.primary, margin:'0 0 14px', display:'inline-flex', alignItems:'center'}}>🛍️ Магазин<InfoTooltip text="Трать кристаллы на оформление профиля: фоны, рамки, титулы, темы и снаряжение героя." /></h1>

        {/* ── Баланс крупно + подсказка заработка ── */}
        <div className="dashboard-section" style={{
          padding:'16px 20px', marginBottom:18, display:'flex', gap:18, flexWrap:'wrap', alignItems:'center',
          border:'1px solid rgba(212,175,55,0.35)', boxShadow:'0 2px 14px rgba(212,175,55,0.12)',
        }}>
          <div style={{flex:'0 0 auto'}}>
            <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:24, color:THEME.primary, lineHeight:1.2}}>
              💎 У тебя {crystals.toLocaleString('ru-RU')} <span style={{fontSize:15, color:THEME.textLight, fontWeight:600}}>кристаллов</span>
            </div>
          </div>
          <div style={{flex:'1 1 260px', minWidth:220}}>
            <div style={{fontSize:12, fontWeight:700, color:THEME.textLight, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4}}>Как заработать больше:</div>
            <div style={{display:'flex', gap:'4px 16px', flexWrap:'wrap', fontSize:13, color:THEME.text, fontFamily:"'Inter',sans-serif"}}>
              <span>· <b style={{color:'#22c55e'}}>+15</b> — 5 ежедневных задач</span>
              <span>· <b style={{color:'#22c55e'}}>+50</b> — 3 навыка на этой неделе</span>
              <span>· <b style={{color:'#22c55e'}}>+200</b> — стрик 7 дней</span>
            </div>
          </div>
          {onGoDaily && (
            <button onClick={onGoDaily} style={{
              flex:'0 0 auto', padding:'11px 20px', borderRadius:12, border:'none', cursor:'pointer',
              fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14,
              background:THEME.accent, color:THEME.onAccent ?? '#0f172a',
            }}>Решать задачи →</button>
          )}
        </div>

        {errMsg && (
          <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#dc2626'}}>
            {errMsg}
          </div>
        )}

        <div style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap'}}>
          {SHOP_TABS.map(t => (
            <button key={t.id} className={`theme-tab${activeType===t.id?' active':''}`} onClick={() => setActiveType(t.id)} style={{
              padding:'10px 16px', borderRadius:99, fontSize:13, fontWeight:700, fontFamily:"'Inter',sans-serif",
              cursor:'pointer',
              background: activeType === t.id ? THEME.primary : THEME.surface,
              color:      activeType === t.id ? (THEME.onPrimary ?? '#fff') : THEME.text,
              border: `1px solid ${activeType === t.id ? THEME.primary : THEME.border}`,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {activeType === 'showcase' ? renderShowcase() : activeType === 'equipment' ? (
          /* ── Раздел «Снаряжение»: слоты слева + Lego-персонаж на подиуме справа ── */
          <div style={{display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start'}}>
            {/* Боковое меню слотов */}
            <div style={{flex:'0 0 180px', display:'flex', flexDirection:'column', gap:8, minWidth:160}}>
              {EQUIP_SLOTS.map(s => {
                const on = activeSlot === s.id;
                return (
                  <button key={s.id} onClick={() => setActiveSlot(s.id)} style={{
                    display:'flex', alignItems:'center', gap:10, textAlign:'left',
                    padding:'12px 14px', borderRadius:12, cursor:'pointer',
                    fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:14,
                    background: on ? THEME.primary : THEME.surface,
                    color:      on ? (THEME.onPrimary ?? '#fff') : THEME.text,
                    border: `1px solid ${on ? THEME.primary : THEME.border}`,
                    transition:'all 0.15s',
                  }}>
                    <span style={{fontSize:18}}>{s.icon}</span>{s.label}
                  </button>
                );
              })}
            </div>
            {/* Персонаж + варианты слота */}
            <div style={{flex:'1 1 280px', minWidth:280, display:'flex', flexDirection:'column', gap:14}}>
              <div className="dashboard-section" style={{padding:0, overflow:'hidden', borderRadius:14}}>
                <LegoCharacter3D
                  equipped={{ helmet: equipped.helmet, top: equipped.top, bottom: equipped.bottom, boots: equipped.boots }}
                  tryOn={tryOn}
                />
              </div>
              {/* Суммарный HP героя + статус сета */}
              {(() => {
                const setId = completedSet(equipped);
                return (
                  <div className="dashboard-section" style={{padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
                    <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:15, color:THEME.primary}}>
                      Твой герой: <span style={{color:'#ef4444'}}>❤️ {computePlayerHp(equipped)}</span>
                    </div>
                    {setId
                      ? <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:'#f5c518', textShadow:'0 0 10px rgba(245,197,24,0.5)'}}>
                          ⭐ Сет «{EQUIPMENT_SETS[setId].name}» собран! +{EQUIPMENT_SETS[setId].bonus} ❤️
                        </div>
                      : <div style={{fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight}}>Собери полный сет для бонуса ❤️</div>}
                  </div>
                );
              })()}
              <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:15, color:THEME.primary}}>
                {EQUIP_SLOTS.find(s => s.id === activeSlot)?.label}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:12}}>
                {SHOP_ITEMS.filter(i => i.type === activeSlot).map(item => {
                  const trying = tryOn[activeSlot] === item.id;
                  return (
                    <div key={item.id} className={`dashboard-section shop-card shop-rarity-${item.rarity || 'common'}`} style={{position:'relative', padding:12, display:'flex', flexDirection:'column', gap:8, ...rarityFrame(item.rarity)}}>
                      {renderBadges(item)}
                      <div style={{aspectRatio:'1/1', borderRadius:10, background:'linear-gradient(135deg, #1e293b, #0f172a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40}}>
                        {item.icon || '⚙️'}
                      </div>
                      <div>
                        <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13, color:THEME.primary, lineHeight:1.2}}>{item.name}</div>
                        <div style={{fontSize:12, color:THEME.textLight, fontWeight:600, marginTop:2}}>{item.price} 💎{item.hp ? <span style={{color:'#ef4444'}}> · +{item.hp} ❤️</span> : null}</div>
                      </div>
                      {renderButton(item)}
                      <button onClick={() => setTryOn(t => ({ ...t, [activeSlot]: item.id }))} style={{
                        width:'100%', padding:'7px 12px', borderRadius:10,
                        fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12, cursor:'pointer', transition:'all 0.15s',
                        background: trying ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border:`1px solid ${trying ? THEME.primary : THEME.border}`,
                        color: trying ? THEME.primary : THEME.text,
                      }}>{trying ? '👁 Примеряется' : '👁 Примерить'}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:16}}>
          {items.map(item => renderItemCard(item))}
        </div>
        )}
      </div>

      {/* ── Модалка примерки сета: 3D-герой с полным сетом ── */}
      {previewSet && (() => {
        const set = EQUIPMENT_SETS[previewSet];
        const setTry = {};
        set.items.forEach(id => { const it = getShopItem(id); if (it) setTry[it.type] = id; });
        const { missing, price } = setPurchasePrice(previewSet, inventory);
        const busy = pendingId === `set-${previewSet}`;
        return (
          <div onClick={() => setPreviewSet(null)} style={{position:'fixed', inset:0, zIndex:1000, background:'rgba(5,8,18,0.88)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}} role="dialog" aria-modal="true">
            <div onClick={e => e.stopPropagation()} style={{width:'100%', maxWidth:460, background:'#0f172a', border:'1px solid rgba(167,139,250,0.45)', borderRadius:18, overflow:'hidden'}}>
              <div style={{padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                <span style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:'#f0f6fc'}}>{set.icon} Сет «{set.name}» на твоём герое</span>
                <button onClick={() => setPreviewSet(null)} style={{background:'none', border:'none', color:'#94a3b8', fontSize:20, cursor:'pointer', lineHeight:1}}>×</button>
              </div>
              <LegoCharacter3D equipped={{}} tryOn={setTry}/>
              <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
                <div style={{fontSize:13, color:'#94a3b8'}}>Бонус сета: <b style={{color:'#ef4444'}}>+{set.bonus} ❤️</b> · 4 предмета</div>
                {missing.length > 0
                  ? (crystals >= price
                    ? <button onClick={() => { handleBuySet(previewSet); setPreviewSet(null); }} disabled={busy} style={{padding:'12px 18px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, background:'#22c55e', color:'#052e16'}}>
                        {busy ? '...' : `Купить полный сет за ${price} 💎`}
                      </button>
                    : <div style={{fontSize:13, color:'#94a3b8', textAlign:'center'}}>Нужно ещё {price - crystals} 💎</div>)
                  : <div style={{fontSize:13, fontWeight:700, color:'#4ade80', textAlign:'center'}}>Сет полностью собран ✓</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Модалка «Примерить»: превью предмета на профиле владельца ── */}
      {previewItem && (() => {
        const it = previewItem;
        const owned = inventory.includes(it.id);
        const isEquipped = equipped[it.type] === it.id;
        const requires = it.requiredLeague ? LEAGUE_MAP[it.requiredLeague] : null;
        const leagueOk = !requires || myLeague === requires;
        const busy = pendingId === it.id;
        const sw = it.type === 'theme' ? (THEME_SWATCHES[it.value] || ['#666','#999','#ccc']) : null;
        const frameStyle = it.type === 'frame' ? (FRAME_STYLES[it.id] || {}) : {};
        let action;
        const btnBase = { padding:'12px 24px', borderRadius:10, fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, border:'none', cursor:'pointer', minWidth:150 };
        if (isEquipped) {
          action = <button disabled style={{...btnBase, background:'rgba(16,185,129,0.2)', color:'#10b981', cursor:'default'}}>Надето ✓</button>;
        } else if (owned) {
          action = <button onClick={() => { handleEquip(it); setPreviewItem(null); }} disabled={busy} style={{...btnBase, background:THEME.accent, color:THEME.onAccent ?? '#0f172a', opacity:busy?0.6:1}}>{busy?'...':'Надеть'}</button>;
        } else if (it.isExclusive && !leagueOk) {
          action = <button disabled style={{...btnBase, background:'rgba(167,139,250,0.2)', color:'#a78bfa', cursor:'not-allowed'}}>🔒 Только Алмаз</button>;
        } else if (crystals < it.price) {
          action = onGoDaily
            ? <button onClick={() => { setPreviewItem(null); onGoDaily(); }} style={{...btnBase, background:'rgba(99,102,241,0.2)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.4)'}}>Заработать {it.price - crystals} 💎 →</button>
            : <button disabled style={{...btnBase, background:'rgba(148,163,184,0.15)', color:'#94a3b8', cursor:'not-allowed'}}>Нужно ещё {it.price - crystals} 💎</button>;
        } else {
          action = <button onClick={() => handlePurchase(it)} disabled={busy} style={{...btnBase, background:'#22c55e', color:'#052e16', opacity:busy?0.6:1}}>{busy?'...':`Купить за ${it.price} 💎`}</button>;
        }

        // Карточка профиля владельца с применённым предметом.
        const profileCard = (extraStyle = {}, children = null) => (
          <div style={{
            position:'relative', width:'100%', maxWidth:380, borderRadius:18, overflow:'hidden',
            background:'#0f172a', border:'1px solid rgba(255,255,255,0.12)', ...extraStyle,
          }}>
            {children}
            <div style={{position:'relative', zIndex:1, padding:'28px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
              <div style={{
                width:96, height:96, borderRadius:'50%',
                background:'linear-gradient(135deg, #6366f1, #a78bfa)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:28,
                border:'3px solid rgba(255,255,255,0.25)',
                ...(it.type === 'frame' ? frameStyle : {}),
              }}>{userInitials}</div>
              <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:18, color:'#f0f6fc', textShadow:'0 1px 6px rgba(0,0,0,0.6)'}}>{userName}</div>
              {it.type === 'title'
                ? <div style={{fontSize:14, fontWeight:700, color:'#d4af37', textShadow:'0 1px 6px rgba(0,0,0,0.6)'}}>«{it.value}»</div>
                : (user?.equipped?.title && getShopItem(user.equipped.title)?.value)
                  ? <div style={{fontSize:13, color:'rgba(226,232,240,0.75)'}}>«{getShopItem(user.equipped.title).value}»</div>
                  : <div style={{fontSize:13, color:'rgba(226,232,240,0.55)'}}>Ученик · {user?.details || ''}</div>}
            </div>
          </div>
        );

        let preview;
        if (it.type === 'background') {
          // Профиль с применённым фоном
          preview = profileCard({}, (
            <div aria-hidden="true" style={{position:'absolute', inset:0}}>
              <img src={it.file} alt="" style={{width:'100%', height:'100%', objectFit:'cover', opacity:0.85}}/>
              <div style={{position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(10,14,26,0.15), rgba(10,14,26,0.55))'}}/>
            </div>
          ));
        } else if (it.type === 'frame' || it.type === 'title') {
          preview = profileCard();
        } else {
          // theme — мини-предпросмотр интерфейса в цветах темы
          preview = (
            <div style={{width:'100%', maxWidth:380, borderRadius:18, overflow:'hidden', border:'1px solid rgba(255,255,255,0.12)', background:sw[0]}}>
              <div style={{height:42, background:sw[1], display:'flex', alignItems:'center', padding:'0 14px', gap:8}}>
                <span style={{width:10, height:10, borderRadius:'50%', background:sw[2]}}/>
                <span style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:12, color:sw[2]}}>{it.name}</span>
              </div>
              <div style={{padding:14, display:'flex', flexDirection:'column', gap:10}}>
                {[0,1].map(i => (
                  <div key={i} style={{borderRadius:10, background:sw[1], padding:'10px 12px'}}>
                    <div style={{width:'62%', height:8, borderRadius:99, background:sw[2], opacity:0.85, marginBottom:6}}/>
                    <div style={{width:'88%', height:6, borderRadius:99, background:sw[2], opacity:0.35}}/>
                  </div>
                ))}
                <div style={{alignSelf:'flex-start', padding:'8px 18px', borderRadius:10, background:sw[2], color:sw[0], fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:12}}>Кнопка</div>
              </div>
            </div>
          );
        }

        return (
          <div onClick={() => setPreviewItem(null)} style={{position:'fixed', inset:0, zIndex:1000, background:'rgba(5,8,18,0.88)', backdropFilter:'blur(4px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, padding:16}} role="dialog" aria-modal="true">
            <div style={{padding:'7px 16px', borderRadius:99, background:'rgba(255,255,255,0.08)', color:'#e2e8f0', fontSize:13, fontWeight:700, fontFamily:"'Montserrat',sans-serif"}}>
              👁 Примерка · {it.name}
            </div>
            <div onClick={e => e.stopPropagation()} style={{width:'100%', display:'flex', justifyContent:'center'}}>
              {preview}
            </div>
            {errMsg && <div style={{background:'rgba(239,68,68,0.95)', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:13, fontFamily:"'Inter',sans-serif"}}>{errMsg}</div>}
            <div onClick={e => e.stopPropagation()} style={{display:'flex', justifyContent:'center', gap:14, flexWrap:'wrap'}}>
              {action}
              <button onClick={() => setPreviewItem(null)} style={{...btnBase, background:'rgba(255,255,255,0.08)', color:'#e2e8f0', border:'1px solid rgba(255,255,255,0.2)'}}>Закрыть</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
