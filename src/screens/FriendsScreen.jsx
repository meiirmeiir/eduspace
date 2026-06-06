import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import Logo from "../components/ui/Logo.jsx";
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
  const lt  = '#e2e8f0';
  const ltd = 'rgba(226,232,240,0.7)';
  const card = { background: 'rgba(30,41,59,0.65)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 16, padding: '18px 20px', backdropFilter: 'blur(8px)' };

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
  const maxWeek = Math.max(1, ...friendRows.map(r => r.weekPoints || 0), user?.weekPoints || 0);

  const nameOf = (uid, fallback) => {
    const p = profiles[uid];
    const n = p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : '';
    return n || fallback || 'Ученик';
  };

  const btn = (bg, color = '#fff') => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '9px 16px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
  });

  return (
    <div className="page-themed leaderboard-bg" style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: THEME.primary, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Logo size={32} light />
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: THEME.onPrimary ?? '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif" }}>← Назад</button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 28, fontWeight: 800, color: lt, marginBottom: 6 }}>👥 Друзья</h1>
        <p style={{ fontSize: 13, color: ltd, marginBottom: 20 }}>Добавляй одноклассников и родных — соревнуйтесь в собственном рейтинге.</p>

        {/* «X принял твой запрос» */}
        {outgoing.acceptedNew.map(req => (
          <div key={req.id} style={{ ...card, marginBottom: 14, border: '1px solid rgba(52,211,153,0.45)', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <span style={{ flex: 1, fontSize: 14, color: lt, minWidth: 200 }}>
              <b>{nameOf(req.toUid)}</b> принял(а) твой запрос — теперь вы друзья!
            </span>
            <button onClick={() => handleSeen(req)} style={btn('#10b981')}>Отлично!</button>
          </div>
        ))}

        {/* Входящие запросы */}
        {incoming.length > 0 && (
          <div style={{ ...card, marginBottom: 14, border: `1px solid ${THEME.accent}66` }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: lt, marginBottom: 12 }}>
              📨 Запросы дружбы <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, padding: '2px 8px', verticalAlign: '2px' }}>{incoming.length}</span>
            </div>
            {incoming.map(req => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(148,163,184,0.12)', flexWrap: 'wrap' }}>
                <Avatar p={profiles[req.fromUid]} size={44} accent={THEME.accent} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: lt }}>{nameOf(req.fromUid, req.fromName)}</div>
                  <div style={{ fontSize: 12, color: ltd }}>хочет добавить тебя в друзья</div>
                </div>
                <button onClick={() => handleAccept(req)} style={btn('#10b981')}>Принять</button>
                <button onClick={() => handleDecline(req)} style={btn('rgba(148,163,184,0.25)', lt)}>Отклонить</button>
              </div>
            ))}
          </div>
        )}

        {/* Пригласить друга */}
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: lt, marginBottom: 4 }}>✉️ Пригласи друга</div>
          <div style={{ fontSize: 12.5, color: ltd, marginBottom: 14 }}>Отправь ссылку — после регистрации вы автоматически станете друзьями.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', border: `1px dashed ${THEME.accent}88`, borderRadius: 12, padding: '10px 18px', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: 6, color: THEME.accent }}>
              {code || '· · · · · ·'}
            </div>
            <div style={{ fontSize: 11.5, color: ltd }}>твой код<br />приглашения</div>
            <div style={{ flex: 1 }} />
            <button onClick={handleCopy} disabled={!share} style={btn(THEME.accent, '#0f172a')}>{copied ? '✓ Скопировано' : '🔗 Копировать ссылку'}</button>
            {share && <a href={share.whatsapp} target="_blank" rel="noreferrer" style={{ ...btn('#25d366'), textDecoration: 'none', display: 'inline-block' }}>WhatsApp</a>}
            {share && <a href={share.telegram} target="_blank" rel="noreferrer" style={{ ...btn('#229ed9'), textDecoration: 'none', display: 'inline-block' }}>Telegram</a>}
          </div>
        </div>

        {/* Добавить по коду */}
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: lt, marginBottom: 12 }}>🔢 Добавить по коду</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={addCode}
              onChange={e => setAddCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="6 цифр"
              inputMode="numeric"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 16, letterSpacing: 4, color: lt, width: 140, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, outline: 'none' }}
            />
            <button onClick={handleAdd} disabled={addBusy || addCode.length !== 6} style={{ ...btn(THEME.accent, '#0f172a'), opacity: addBusy || addCode.length !== 6 ? 0.5 : 1 }}>
              {addBusy ? '...' : 'Отправить запрос'}
            </button>
          </div>
          {addMsg && <div style={{ marginTop: 10, fontSize: 13, color: addMsg.ok ? '#34d399' : '#f87171' }}>{addMsg.text}</div>}
          {outgoing.pending.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: ltd }}>
              Ожидают ответа: {outgoing.pending.map(r => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(148,163,184,0.15)', borderRadius: 99, padding: '3px 10px', margin: '2px 4px 0 0' }}>
                  {nameOf(r.toUid)} <button onClick={() => handleCancelOutgoing(r)} title="Отменить запрос" style={{ background: 'transparent', border: 'none', color: ltd, cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Список друзей */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: lt }}>🏆 Твои друзья</div>
            <div style={{ fontSize: 12, color: ltd }}>{friendRows.length > 0 ? `${friendRows.length} · по очкам этой недели` : ''}</div>
          </div>

          {loading && <div style={{ textAlign: 'center', color: ltd, padding: '24px 0' }}>Загрузка...</div>}

          {!loading && friendRows.length === 0 && (
            <div style={{ textAlign: 'center', color: ltd, padding: '20px 0', fontSize: 14 }}>
              Пока никого нет. Отправь другу ссылку-приглашение или добавь его по коду — и соревнуйтесь каждую неделю! 🚀
            </div>
          )}

          {friendRows.map((p, i) => {
            const name = nameOf(p.uid);
            const li = getLevelInfo(p.xp || 0);
            const titleItem = p.equippedTitle ? getShopItem(p.equippedTitle) : null;
            const barPct = Math.round(((p.weekPoints || 0) / maxWeek) * 100);
            return (
              <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid rgba(148,163,184,0.12)', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 28, fontSize: 15, fontWeight: 800, color: i < 3 ? THEME.accent : ltd, fontFamily: "'Montserrat',sans-serif" }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </div>
                <div
                  onClick={() => onOpenPublicProfile?.(p.uid)}
                  role={onOpenPublicProfile ? 'button' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: onOpenPublicProfile ? 'pointer' : 'default', flex: 1, minWidth: 220 }}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar p={p} size={56} accent={THEME.accent} />
                    <div title={`Уровень ${li.level}`} style={{ position: 'absolute', right: -3, bottom: -3, minWidth: 20, height: 20, borderRadius: 20, padding: '0 4px', boxSizing: 'border-box', background: li.tier.color, color: '#0f172a', border: '2px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 10 }}>{li.level}</div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: lt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {titleItem?.value && <div style={{ fontSize: 11, color: '#d4af37' }}>{titleItem.value}</div>}
                    {/* прогресс недели относительно лидера среди друзей */}
                    <div style={{ marginTop: 6, height: 6, borderRadius: 99, background: 'rgba(148,163,184,0.18)', overflow: 'hidden', maxWidth: 220 }}>
                      <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${THEME.accent}, #f59e0b)` }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, color: lt }}>
                  <span title="Очки этой недели" style={{ fontWeight: 800, fontFamily: "'Montserrat',sans-serif" }}>{(p.weekPoints || 0).toLocaleString('ru-RU')}<span style={{ fontSize: 10, color: ltd, fontWeight: 400 }}> очк.</span></span>
                  <span title="Кристаллы">💎 {(p.crystals || 0).toLocaleString('ru-RU')}</span>
                  <span title="Серия дней">🔥 {p.streak || 0}</span>
                </div>
                <button onClick={() => handleUnfriend(p.uid, name)} title="Удалить из друзей"
                  style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
