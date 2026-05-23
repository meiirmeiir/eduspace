import React, { useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import { SHOP_ITEMS, SHOP_TYPES, FRAME_STYLES } from "../lib/shopItems.js";
import { purchaseItem, equipItem } from "../lib/shopUtils.js";
import { getLeague } from "../lib/pointsUtils.js";
import Logo from "../components/ui/Logo.jsx";

const THEME_SWATCHES = {
  galaxy: ['#1e1b4b', '#312e81', '#a78bfa'],
  sakura: ['#fce7f3', '#f9a8d4', '#831843'],
  matrix: ['#0a0a0a', '#16a34a', '#bbf7d0'],
  fire:   ['#0f172a', '#dc2626', '#fbbf24'],
};

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
    return (
      <div style={{
        width:'100%', aspectRatio:'16/9', borderRadius:10, overflow:'hidden',
        background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <img
          src={item.preview} alt={item.name}
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
  return null;
}

export default function ShopScreen({ user, onBack, onUpdateUser }) {
  const { theme: THEME, setShopTheme } = useTheme();
  const [activeType, setActiveType] = useState('background');
  const [pendingId, setPendingId] = useState(null);   // id предмета в покупке/экипировке
  const [errMsg, setErrMsg]       = useState(null);

  const uid       = user?.uid || user?.id;
  const crystals  = Number(user?.crystals || 0);
  const inventory = Array.isArray(user?.inventory) ? user.inventory : [];
  const equipped  = user?.equipped || {};
  const weekPts   = Number(user?.weekPoints || 0);
  const myLeague  = getLeague(weekPts).current.name.toLowerCase(); // "бронза" / "серебро" / "золото" / "алмаз"
  // Маппинг id-лиги: requiredLeague:'diamond' → должно быть 'алмаз'
  const LEAGUE_MAP = { diamond: 'алмаз', gold: 'золото', silver: 'серебро', bronze: 'бронза' };

  const items = SHOP_ITEMS.filter(i => i.type === activeType);

  const handlePurchase = async (item) => {
    if (pendingId) return;
    setErrMsg(null); setPendingId(item.id);
    const res = await purchaseItem(uid, item.id, crystals);
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
    } else {
      setErrMsg(`Не удалось надеть: ${res.error}`);
    }
    setPendingId(null);
  };

  const renderButton = (item) => {
    const owned     = inventory.includes(item.id);
    const isEquipped= equipped[item.type] === item.id;
    const requires  = item.requiredLeague ? LEAGUE_MAP[item.requiredLeague] : null;
    const leagueOk  = !requires || myLeague === requires;
    const busy      = pendingId === item.id;
    const baseStyle = {
      width:'100%', padding:'10px 14px', borderRadius:10,
      fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:13,
      border:'none', cursor:'pointer', transition:'all 0.15s',
    };

    if (isEquipped) {
      return <button disabled style={{...baseStyle, background:'rgba(16,185,129,0.15)', color:'#10b981', cursor:'default', border:'1px solid rgba(16,185,129,0.4)'}}>Надето ✓</button>;
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
    if (crystals < item.price) {
      return <button disabled style={{...baseStyle, background:'rgba(239,68,68,0.08)', color:'#dc2626', cursor:'not-allowed', border:'1px solid rgba(239,68,68,0.25)'}}>Недостаточно 💎</button>;
    }
    return <button onClick={() => handlePurchase(item)} disabled={busy}
      style={{...baseStyle, background:THEME.accent, color:THEME.onAccent ?? '#0f172a', opacity:busy?0.6:1}}>
      {busy ? '...' : `Купить · ${item.price} 💎`}
    </button>;
  };

  return (
    <div className="page-themed" style={{minHeight:'100vh', background:THEME.bg, paddingBottom:80}}>
      <div style={{background:THEME.primary, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64}}>
        <Logo size={32} light/>
        <button onClick={onBack} style={{background:'transparent', border:`1px solid ${THEME.onPrimary ?? 'rgba(255,255,255,0.2)'}33`, color:THEME.onPrimary ?? '#fff', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontFamily:"'Inter',sans-serif"}}>← Назад</button>
      </div>

      <div style={{maxWidth:1100, margin:'0 auto', padding:'24px 16px'}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18}}>
          <h1 style={{fontFamily:"'Montserrat',sans-serif", fontSize:28, fontWeight:800, color:THEME.primary, margin:0}}>🛍️ Магазин</h1>
          <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:20, color:THEME.primary}}>
            💎 {crystals.toLocaleString('ru-RU')} <span style={{fontSize:14, color:THEME.textLight, fontWeight:600}}>кристаллов</span>
          </div>
        </div>

        {errMsg && (
          <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#dc2626'}}>
            {errMsg}
          </div>
        )}

        <div style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap'}}>
          {SHOP_TYPES.map(t => (
            <button key={t.id} className={`theme-tab${activeType===t.id?' active':''}`} onClick={() => setActiveType(t.id)} style={{
              padding:'10px 16px', borderRadius:99, fontSize:13, fontWeight:700, fontFamily:"'Inter',sans-serif",
              cursor:'pointer',
              background: activeType === t.id ? THEME.primary : '#fff',
              color:      activeType === t.id ? '#fff'        : THEME.textLight,
              border: `1px solid ${activeType === t.id ? THEME.primary : THEME.border}`,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:16}}>
          {items.map(item => (
            <div key={item.id} className="dashboard-section" style={{padding:14, display:'flex', flexDirection:'column', gap:10}}>
              <Preview item={item}/>
              <div>
                <div style={{fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:14, color:THEME.primary, marginBottom:2}}>
                  {item.name}{item.isExclusive ? ' ✨' : ''}
                </div>
                <div style={{fontSize:12, color:THEME.textLight, fontWeight:600}}>{item.price} 💎</div>
              </div>
              {renderButton(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
