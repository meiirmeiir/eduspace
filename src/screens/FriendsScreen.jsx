import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import Logo from "../components/ui/Logo.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import { FRAME_STYLES, getShopItem } from "../lib/shopItems.js";
import { getLevelInfo } from "../lib/levelUtils.js";
import {
  ensureFriendCode, resolveFriendCode, sendFriendRequest,
  fetchIncomingPending, fetchOutgoing, acceptRequest, declineRequest,
  markAcceptedSeen, cancelRequest, unfriend, fetchMyFriendsUids,
  fetchFriendProfiles, shareLinks,
} from "../lib/friendsUtils.js";

// Экран «Друзья»: код приглашения + добавление по коду + запросы + список
// друзей с недельным прогрессом (publicProfiles). Тёмный фон как у рейтинга.

const ADD_MESSAGES = {
  sent:             { ok: true,  text: '✅ Запрос отправлен! Друг увидит его в своём разделе «Друзья».' },
  already_friends:  { ok: true,  text: 'Вы уже друзья 🙂' },
  already_pending:  { ok: true,  text: 'Запрос уже отправлен — ждём ответа.' },
  incoming_pending: { ok: true,  text: 'Этот ученик уже отправил тебе запрос — прими его в блоке «Запросы».' },
  self:             { ok: false, text: 'Это твой собственный код 🙂' },
  not_found:        { ok: false, text: 'Код не найден. Проверь 6 цифр и попробуй ещё раз.' },
  error:            { ok: false, text: 'Не получилось отправить запрос. Попробуй позже.' },
};

// ── SVG-иконки кнопок шаринга (бренд-логотипы вместо эмодзи) ─────────────────
const IconCopy = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconTelegram = ({ size = 20, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, display: 'block' }}>
    <path d="M9.04 15.51l-.38 5.36c.54 0 .78-.23 1.06-.51l2.55-2.44 5.28 3.87c.97.53 1.66.25 1.92-.9l3.48-16.3c.31-1.42-.51-1.98-1.46-1.63L1.5 10.18c-1.4.54-1.38 1.32-.24 1.67l5.12 1.6L18.3 6.07c.56-.37 1.07-.17.65.2L9.04 15.51z"/>
  </svg>
);
const IconWhatsApp = ({ size = 20, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, display: 'block' }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function Avatar({ p, size = 56, accent }) {
  const initials = ((p?.firstName?.[0] || '') + (p?.lastName?.[0] || '')).toUpperCase() || '?';
  const frameStyle = p?.equippedFrame ? (FRAME_STYLES[p.equippedFrame] || null) : null;
  const base = { width: size, height: size, borderRadius: '50%', border: `2px solid ${accent}`, flexShrink: 0, ...(frameStyle || {}) };
  return p?.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ ...base, objectFit: 'cover', display: 'block' }} />
    : <div style={{ ...base, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: size * 0.32 }}>{initials}</div>;
}

export default function FriendsScreen({ user, onBack, onOpenPublicProfile }) {
  const { theme: THEME } = useTheme();
  // Светлый экран как дашборд (адаптируется к dark через THEME_DARK).
  // Карточки — мягкие заливки + тени, без тонких бордеров.
  const card = {
    background: THEME.surface, borderRadius: 18, padding: '20px 22px',
    boxShadow: '0 8px 28px -8px rgba(10,25,47,0.12), 0 2px 8px rgba(10,25,47,0.05)',
  };

  const [code, setCode]           = useState(user?.friendCode || null);
  const [friendUids, setFriendUids] = useState(user?.friends || []);
  const [profiles, setProfiles]   = useState({});
  const [incoming, setIncoming]   = useState([]);
  const [outgoing, setOutgoing]   = useState({ pending: [], acceptedNew: [] });
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);
  const [addCode, setAddCode]     = useState('');
  const [addBusy, setAddBusy]     = useState(false);
  const [addMsg, setAddMsg]       = useState(null);

  const reload = React.useCallback(async () => {
    if (!user?.uid) return;
    const [uids, inc, out] = await Promise.all([
      fetchMyFriendsUids(user.uid),
      fetchIncomingPending(user.uid),
      fetchOutgoing(user.uid),
    ]);
    setFriendUids(uids);
    setIncoming(inc);
    setOutgoing(out);
    const needProfiles = [...new Set([
      ...uids,
      ...inc.map(r => r.fromUid),
      ...out.pending.map(r => r.toUid),
      ...out.acceptedNew.map(r => r.toUid),
    ])];
    if (needProfiles.length) setProfiles(await fetchFriendProfiles(needProfiles));
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // страховка для аккаунтов без кода (до миграции)
      const c = await ensureFriendCode(user);
      if (!cancelled && c) setCode(c);
      await reload();
    })();
    return () => { cancelled = true; };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = useMemo(() => code ? shareLinks(code, user?.firstName) : null, [code, user?.firstName]);

  const handleCopy = async () => {
    if (!share) return;
    try { await navigator.clipboard.writeText(share.link); } catch {
      try { const ta = document.createElement('textarea'); ta.value = share.link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch {}
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  // Копирование только 6-значного кода (иконка 📋 рядом с кодом в hero)
  const [codeCopied, setCodeCopied] = useState(false);
  const handleCopyCode = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); } catch {
      try { const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch {}
    }
    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleAdd = async () => {
    if (addBusy) return;
    setAddMsg(null);
    const clean = addCode.trim();
    if (!/^\d{6}$/.test(clean)) { setAddMsg(ADD_MESSAGES.not_found); return; }
    setAddBusy(true);
    const toUid = await resolveFriendCode(clean);
    const result = toUid ? await sendFriendRequest({ ...user, friends: friendUids }, toUid) : 'not_found';
    setAddMsg(ADD_MESSAGES[result] || ADD_MESSAGES.error);
    setAddBusy(false);
    if (result === 'sent') { setAddCode(''); reload(); }
  };

  const handleAccept = async (req) => {
    setIncoming(prev => prev.filter(r => r.id !== req.id));
    try { await acceptRequest(req.id); } catch { reload(); return; }
    // Cloud Function пишет friends обоим — перечитываем с небольшим лагом
    setTimeout(reload, 2500);
  };
  const handleDecline = async (req) => {
    setIncoming(prev => prev.filter(r => r.id !== req.id));
    try { await declineRequest(req.id); } catch {}
  };
  const handleUnfriend = async (uid, name) => {
    if (!confirm(`Удалить ${name || 'друга'} из друзей? Вы исчезнете из списков друг у друга.`)) return;
    setFriendUids(prev => prev.filter(u => u !== uid));
    await unfriend(user.uid, uid);
  };
  const handleSeen = async (req) => {
    setOutgoing(prev => ({ ...prev, acceptedNew: prev.acceptedNew.filter(r => r.id !== req.id) }));
    markAcceptedSeen(req.id);
  };
  const handleCancelOutgoing = async (req) => {
    setOutgoing(prev => ({ ...prev, pending: prev.pending.filter(r => r.id !== req.id) }));
    cancelRequest(req.id);
  };

  // мини-лидерборд друзей: по weekPoints, я — тоже строчка
  const friendRows = useMemo(() => {
    const rows = friendUids.map(uid => ({ uid, ...(profiles[uid] || {}) }));
    return rows.sort((a, b) => (b.weekPoints || 0) - (a.weekPoints || 0));
  }, [friendUids, profiles]);

  const nameOf = (uid, fallback) => {
    const p = profiles[uid];
    const n = p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : '';
    return n || fallback || 'Ученик';
  };

  const btn = (bg, color = '#fff') => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 16px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
  });

  // Кнопки шаринга — одинаковая высота/стиль, SVG-иконки по центру с текстом
  const shareBtn = (bg, color = '#fff') => ({
    flex: '1 1 150px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: bg, color, border: 'none', borderRadius: 12, padding: '13px 18px', minHeight: 48,
    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", lineHeight: 1,
    textDecoration: 'none', boxSizing: 'border-box', transition: 'transform 0.15s, filter 0.15s',
  });

  return (
    <div className="page-themed" style={{ minHeight: '100vh', background: THEME.bg, paddingBottom: 80 }}>
      <style>{`
        .fr-share:hover { transform: translateY(-1px); filter: brightness(1.07); }
        .fr-card { transition: transform 0.15s, box-shadow 0.15s; }
        .fr-card:hover { transform: translateY(-2px); box-shadow: 0 12px 32px -8px rgba(10,25,47,0.18); }
      `}</style>
      <AppTopbar variant="dark" title="Друзья" onBack={onBack} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        {/* «X принял твой запрос» */}
        {outgoing.acceptedNew.map(req => (
          <div key={req.id} style={{ ...card, marginBottom: 16, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <span style={{ flex: 1, fontSize: 14, color: THEME.text, minWidth: 200 }}>
              <b>{nameOf(req.toUid)}</b> принял(а) твой запрос — теперь вы друзья!
            </span>
            <button onClick={() => handleSeen(req)} style={btn('#10b981')}>Отлично!</button>
          </div>
        ))}

        {/* Входящие запросы */}
        {incoming.length > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: THEME.primary, marginBottom: 12 }}>
              📨 Запросы дружбы <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, padding: '2px 8px', verticalAlign: '2px' }}>{incoming.length}</span>
            </div>
            {incoming.map(req => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', flexWrap: 'wrap' }}>
                <Avatar p={profiles[req.fromUid]} size={44} accent={THEME.accent} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: THEME.primary }}>{nameOf(req.fromUid, req.fromName)}</div>
                  <div style={{ fontSize: 12, color: THEME.textLight }}>хочет добавить тебя в друзья</div>
                </div>
                <button onClick={() => handleAccept(req)} style={btn('#10b981')}>Принять</button>
                <button onClick={() => handleDecline(req)} style={btn('rgba(148,163,184,0.25)', THEME.text)}>Отклонить</button>
              </div>
            ))}
          </div>
        )}

        {/* ── БЛОК 1 · HERO «Пригласи друга» — градиент, крупный код, шаринг ── */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 22, marginBottom: 16,
          background: 'linear-gradient(125deg, #1e1b4b 0%, #312e81 55%, #6d28d9 100%)',
          boxShadow: '0 16px 44px -12px rgba(49,46,129,0.55)',
          padding: '30px 28px',
        }}>
          {/* декоративные эмодзи */}
          <div aria-hidden="true" style={{ position: 'absolute', right: -14, top: -18, fontSize: 120, opacity: 0.12, transform: 'rotate(12deg)', pointerEvents: 'none' }}>👥</div>
          <div aria-hidden="true" style={{ position: 'absolute', right: 86, bottom: -26, fontSize: 90, opacity: 0.1, transform: 'rotate(-10deg)', pointerEvents: 'none' }}>🏆</div>

          <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.25 }}>
            Учись вместе с друзьями!
          </h1>
          <p style={{ fontSize: 15, fontWeight: 400, color: 'rgba(226,232,240,0.75)', margin: '8px 0 22px', maxWidth: 440 }}>
            Создайте свой рейтинг и мотивируйте друг друга каждый день.
          </p>

          {/* Код приглашения — центральный элемент */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', borderRadius: 16, padding: '12px 22px',
              boxShadow: '0 8px 24px rgba(251,191,36,0.4)',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono','Menlo',monospace", fontWeight: 800, fontSize: 36, letterSpacing: 8, color: '#0f172a', lineHeight: 1 }}>
                {code || '······'}
              </span>
              <button onClick={handleCopyCode} disabled={!code} title="Скопировать код"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.18)', border: 'none', borderRadius: 10, padding: 9, cursor: 'pointer', color: '#0f172a' }}>
                {codeCopied ? <span style={{ fontSize: 16, lineHeight: 1 }}>✓</span> : <IconCopy size={18} />}
              </button>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(226,232,240,0.75)', fontWeight: 600 }}>твой код<br />приглашения</div>
          </div>

          {/* Кнопки шаринга — ряд одинаковых, SVG-логотипы */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="fr-share" onClick={handleCopy} disabled={!share} style={shareBtn('#fbbf24', '#0f172a')}>
              <IconCopy size={20} /> {copied ? 'Скопировано ✓' : 'Копировать ссылку'}
            </button>
            {share && <a className="fr-share" href={share.telegram} target="_blank" rel="noreferrer" style={shareBtn('#229ed9')}><IconTelegram size={20} /> Telegram</a>}
            {share && <a className="fr-share" href={share.whatsapp} target="_blank" rel="noreferrer" style={shareBtn('#25d366')}><IconWhatsApp size={20} /> WhatsApp</a>}
          </div>
        </div>

        {/* ── БЛОК 2 · Добавить по коду — компактная полоска ── */}
        <div style={{ ...card, marginBottom: 16, padding: '16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🔢</span>
            <input
              value={addCode}
              onChange={e => setAddCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Код друга"
              inputMode="numeric"
              style={{ background: THEME.bg, border: `1.5px solid ${THEME.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 15, letterSpacing: 4, color: THEME.primary, width: 150, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, outline: 'none' }}
            />
            <button onClick={handleAdd} disabled={addBusy || addCode.length !== 6}
              style={{ ...btn('#fbbf24', '#0f172a'), padding: '11px 22px', fontSize: 15, fontWeight: 700, opacity: addBusy ? 0.6 : 1, filter: addCode.length !== 6 ? 'saturate(0.4)' : 'none' }}>
              {addBusy ? '...' : 'Добавить'}
            </button>
            <span style={{ fontSize: 13, color: THEME.textLight, flex: '1 1 160px' }}>Введи код друга, чтобы добавить его</span>
          </div>
          {addMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: addMsg.ok ? '#10b981' : '#ef4444' }}>{addMsg.text}</div>}
          {outgoing.pending.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: THEME.textLight }}>
              Ожидают ответа: {outgoing.pending.map(r => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(148,163,184,0.15)', borderRadius: 99, padding: '3px 10px', margin: '2px 4px 0 0' }}>
                  {nameOf(r.toUid)} <button onClick={() => handleCancelOutgoing(r)} title="Отменить запрос" style={{ background: 'transparent', border: 'none', color: THEME.textLight, cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── БЛОК 3 · Список друзей / empty state ── */}
        {loading && <div style={{ ...card, textAlign: 'center', color: THEME.textLight, padding: '32px 0' }}>Загрузка...</div>}

        {!loading && friendRows.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '44px 24px', background: THEME.surface }}>
            <div aria-hidden="true" style={{ fontSize: 56, lineHeight: 1, marginBottom: 6 }}>👥</div>
            <div aria-hidden="true" style={{ fontSize: 26, opacity: 0.5, marginBottom: 14 }}>🙂 😎 🤓</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 20, color: THEME.primary, marginBottom: 8 }}>
              Здесь появятся твои друзья
            </div>
            <div style={{ fontSize: 14, fontWeight: 400, color: THEME.textLight, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
              Отправь код другу — после регистрации вы сразу окажетесь в одном рейтинге!
            </div>
          </div>
        )}

        {!loading && friendRows.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 2px 12px' }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 20, color: THEME.primary }}>🏆 Твои друзья</div>
              <div style={{ fontSize: 13, color: THEME.textLight }}>{friendRows.length} · по очкам этой недели</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {friendRows.map((p, i) => {
                const name = nameOf(p.uid);
                const li = getLevelInfo(p.xp || 0);
                const titleItem = p.equippedTitle ? getShopItem(p.equippedTitle) : null;
                return (
                  <div key={p.uid} className="fr-card" style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 30, fontSize: 17, fontWeight: 700, color: i < 3 ? THEME.accent : THEME.textLight, fontFamily: "'Montserrat',sans-serif" }}>
                      {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    <div
                      onClick={() => onOpenPublicProfile?.(p.uid)}
                      role={onOpenPublicProfile ? 'button' : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: onOpenPublicProfile ? 'pointer' : 'default', flex: 1, minWidth: 220 }}
                    >
                      <div style={{ position: 'relative' }}>
                        <Avatar p={p} size={56} accent={THEME.accent} />
                        <div title={`Уровень ${li.level}`} style={{ position: 'absolute', right: -3, bottom: -3, minWidth: 20, height: 20, borderRadius: 20, padding: '0 4px', boxSizing: 'border-box', background: li.tier.color, color: '#0f172a', border: `2px solid ${THEME.surface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 10 }}>{li.level}</div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 16, color: THEME.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{name}</span>
                          {i === 0 && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: '#b45309', background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.45)', borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap', lineHeight: 1.3 }}>лидер недели</span>}
                        </div>
                        {titleItem?.value && <div style={{ fontSize: 11, color: '#d4af37' }}>{titleItem.value}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 14, color: THEME.text }}>
                      <span title="Очки этой недели" style={{ fontWeight: 800, fontFamily: "'Montserrat',sans-serif" }}>{(p.weekPoints || 0).toLocaleString('ru-RU')}<span style={{ fontSize: 11, color: THEME.textLight, fontWeight: 400 }}> очк.</span></span>
                      <span title="Кристаллы">💎 {(p.crystals || 0).toLocaleString('ru-RU')}</span>
                      <span title="Серия дней">🔥 {p.streak || 0}</span>
                    </div>
                    <button onClick={() => handleUnfriend(p.uid, name)} title="Удалить из друзей"
                      style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
