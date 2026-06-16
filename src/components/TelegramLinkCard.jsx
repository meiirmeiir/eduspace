// Карточка «Уведомления в Telegram» в кабинете родителя (Этап 2, фаза B2).
// Parent-level (не per-child): подключение Telegram-бота для отчётов о детях.
//
// Состояния:
//   • НЕ привязан, нет кода → кнопка «Подключить Telegram».
//   • НЕ привязан, код выдан → deep-link «Открыть бота» (авто /start КОД) + ручной
//     /link КОД + «код действует 10 минут» + опрос статуса (~2 мин).
//   • Привязан (users.telegramLink — пишет webhook в B3) → «✓ Подключён Telegram:
//     [имя] (@username), [дата] · Это не вы? Отключить» (отвязка — B4).
//
// Статус читаем из users/{parentUid}.telegramLink (ОБЪЕКТ {chatId,tgUsername,tgName,
// linkedAt}, не булев флаг — родитель видит КТО привязан → перехват кода заметен).
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import { db, doc, getDoc, addDoc, collection } from "../firestore-rest.js";
import { createTelegramLinkCode, telegramDeepLink, TELEGRAM_BOT_USERNAME } from "../lib/telegramLinkUtils.js";

const TG_BLUE = "#229ED9";

export default function TelegramLinkCard({ parentUid }) {
  const { theme: THEME } = useTheme();
  const [link, setLink] = useState(undefined);   // undefined=загрузка, null=не привязан, {}=привязан
  const [code, setCode] = useState(null);        // { code, expiresAt } после генерации
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const linkCodeRef = useRef(null);              // users.telegramLinkCode (для revoke прежнего)
  const pollRef = useRef(null);

  const readLink = React.useCallback(async () => {
    if (!parentUid) return null;
    try {
      const snap = await getDoc(doc(db, "users", parentUid));
      const data = snap.exists() ? snap.data() : {};
      linkCodeRef.current = data?.telegramLinkCode || null;
      return data?.telegramLink || null;
    } catch (e) {
      console.warn("[tgcard] readLink failed", e?.message || e);
      return null;
    }
  }, [parentUid]);

  // Первичное чтение статуса привязки.
  useEffect(() => {
    let cancelled = false;
    (async () => { const l = await readLink(); if (!cancelled) setLink(l); })();
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [readLink]);

  // Генерация кода + опрос: ждём, пока webhook (B3) поставит users.telegramLink.
  const handleConnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createTelegramLinkCode({ uid: parentUid, telegramLinkCode: linkCodeRef.current });
      if (res?.code) {
        setCode(res);
        linkCodeRef.current = res.code;
        startPolling();
      }
    } catch (e) {
      console.error("[tgcard] connect failed", e?.message || e);
    }
    setBusy(false);
  };

  // Опрос статуса ~2 мин (40 × 3с): как только telegramLink появился — переходим в «привязан».
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(true);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks++;
      const l = await readLink();
      if (l) {
        clearInterval(pollRef.current); pollRef.current = null;
        setLink(l); setCode(null); setPolling(false);
      } else if (ticks >= 40) {
        clearInterval(pollRef.current); pollRef.current = null;
        setPolling(false);
      }
    }, 3000);
  };

  const copyCmd = async () => {
    if (!code?.code) return;
    try { await navigator.clipboard.writeText(`/link ${code.code}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  // Отвязка из кабинета (B4): request-doc → CF onTelegramUnlinkRequestWritten удаляет
  // telegramLinks + сбрасывает users.telegramLink. Опрашиваем, пока telegramLink исчезнет.
  const handleUnlink = async () => {
    if (busy) return;
    if (!window.confirm("Отключить Telegram-уведомления?")) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "telegramUnlinkRequests"), {
        parentUid, status: "pending", createdAt: new Date().toISOString(),
      });
      let done = false;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const l = await readLink();
        if (!l) { done = true; break; }
      }
      if (done) { setLink(null); setCode(null); }
    } catch (e) {
      console.error("[tgcard] unlink failed", e?.message || e);
    }
    setBusy(false);
  };

  const card = {
    background: THEME.surface, borderRadius: 18, padding: "18px 20px",
    boxShadow: "0 8px 28px -8px rgba(10,25,47,0.12), 0 2px 8px rgba(10,25,47,0.05)",
    marginBottom: 16,
  };
  const tgIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={TG_BLUE} aria-hidden style={{ flexShrink: 0 }}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );

  // ── Загрузка ─────────────────────────────────────────────────────────────
  if (link === undefined) {
    return <div style={{ ...card, color: THEME.textLight, fontSize: 13.5 }}>Загрузка…</div>;
  }

  // ── Привязан ─────────────────────────────────────────────────────────────
  if (link) {
    const uname = link.tgUsername ? `@${link.tgUsername}` : "";
    const when = link.linkedAt ? new Date(link.linkedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {tgIcon}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: THEME.text, marginBottom: 4 }}>
              <span style={{ color: "#22c55e" }}>✓</span> Telegram подключён
            </div>
            <div style={{ fontSize: 13.5, color: THEME.textLight, lineHeight: 1.5 }}>
              Аккаунт: <b style={{ color: THEME.text }}>{link.tgName || "—"}</b>{uname && <span> ({uname})</span>}{when && <span> · {when}</span>}
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: THEME.textLight }}>Это не вы?</span>
              <button type="button" onClick={handleUnlink} disabled={busy}
                style={{ background: "transparent", border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "6px 12px", color: "#dc2626", fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Отключаю…" : "Отключить"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Не привязан: код выдан ───────────────────────────────────────────────
  if (code) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {tgIcon}
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: THEME.text }}>Подтвердите привязку</div>
        </div>
        <a href={telegramDeepLink(code.code)} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px", borderRadius: 12, background: TG_BLUE, color: "#fff", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, textDecoration: "none", boxSizing: "border-box" }}>
          {tgIcon && <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>}
          Открыть бота
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px" }}>
          <div style={{ flex: 1, height: 1, background: THEME.border }} />
          <span style={{ fontSize: 12, color: THEME.textLight }}>или вручную</span>
          <div style={{ flex: 1, height: 1, background: THEME.border }} />
        </div>
        <div style={{ fontSize: 13, color: THEME.textLight, marginBottom: 8, lineHeight: 1.5 }}>
          Откройте бота <b style={{ color: THEME.text }}>@{TELEGRAM_BOT_USERNAME}</b> и отправьте:
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <code style={{ flex: 1, padding: "11px 14px", borderRadius: 10, background: THEME.bg, border: `1.5px solid ${THEME.border}`, fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: THEME.text, letterSpacing: "1px" }}>
            /link {code.code}
          </code>
          <button type="button" onClick={copyCmd}
            style={{ padding: "11px 14px", borderRadius: 10, border: `1px solid ${THEME.border}`, background: THEME.surface, color: THEME.text, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {copied ? "✓ Скопировано" : "Копировать"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: THEME.textLight }}>⏱ Код действует 10 минут.</span>
          {polling
            ? <span style={{ fontSize: 12.5, color: TG_BLUE, fontWeight: 600 }}>Ожидаем подтверждения…</span>
            : <button type="button" onClick={handleConnect} disabled={busy}
                style={{ background: "transparent", border: "none", color: THEME.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                Сгенерировать заново
              </button>}
        </div>
      </div>
    );
  }

  // ── Не привязан: начальное состояние ─────────────────────────────────────
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {tgIcon}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: THEME.text, marginBottom: 3 }}>Уведомления в Telegram</div>
          <div style={{ fontSize: 13.5, color: THEME.textLight, lineHeight: 1.5 }}>Получайте еженедельный отчёт о прогрессе ребёнка прямо в Telegram.</div>
        </div>
        <button type="button" onClick={handleConnect} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: TG_BLUE, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontFamily: "'Montserrat',sans-serif", fontSize: 13.5, fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, whiteSpace: "nowrap" }}>
          {busy ? "Генерирую…" : "Подключить Telegram"}
        </button>
      </div>
    </div>
  );
}
