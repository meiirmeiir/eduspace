// Родительский раздел (Шаг 5а): список привязанных детей + привязка по коду.
// Список детей — из parent.childUids (пишет только Cloud Function), имена/аватары
// из publicProfiles через fetchFriendProfiles. Привязка — addDoc parentLinkRequests
// + опрос статуса (как в Шаге 3); после успеха перечитываем users/{parentUid}
// (профиль в AuthContext отстаёт). Под-вью ребёнка — заглушка для Шага 6 (отчёт)
// и Шага 7 (карта). Отвязка — Шаг 5б (через Cloud Function, self-write заблокирован).
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../ThemeContext.jsx";
import { addDoc, collection, doc, getDoc, db } from "../firestore-rest.js";
import { fetchFriendProfiles } from "../lib/friendsUtils.js";
import { parseParentCode } from "../lib/parentLinkUtils.js";
import ChildReport from "../components/ChildReport.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import OnboardingGuide from "../components/OnboardingGuide.jsx";

const RESULT_MSG = {
  linked:         { ok: true,  text: "✓ Привязка успешна — ребёнок добавлен." },
  code_not_found: { ok: false, text: "Код не найден. Проверьте код у ребёнка." },
  self_link:      { ok: false, text: "Нельзя привязать самого себя." },
  missing_fields: { ok: false, text: "Ошибка данных запроса." },
  timeout:        { ok: false, text: "Привязка не подтвердилась — попробуйте ещё раз." },
  bad_format:     { ok: false, text: "Неверный формат кода. Пример: P-123456." },
  error:          { ok: false, text: "Ошибка отправки. Попробуйте ещё раз." },
};

function Avatar({ p, size = 52, accent }) {
  const initials = ((p?.firstName?.[0] || "") + (p?.lastName?.[0] || "")).toUpperCase() || "?";
  const base = { width: size, height: size, borderRadius: "50%", border: `2px solid ${accent}`, flexShrink: 0 };
  return p?.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ ...base, objectFit: "cover", display: "block" }} />
    : <div style={{ ...base, background: "linear-gradient(135deg,#6366f1,#a78bfa)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: size * 0.34 }}>{initials}</div>;
}

export default function ParentScreen({ user, onLogout }) {
  const { firebaseUser, profile } = useAuth();
  const { theme: THEME } = useTheme();
  const parentUid = firebaseUser?.uid || user?.uid || profile?.uid;

  const [selectedChildUid, setSelectedChildUid] = useState(null);
  const [childUids, setChildUids] = useState([]);
  const [childProfiles, setChildProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  // форма привязки
  const [showAddForm, setShowAddForm] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addResult, setAddResult] = useState(null);

  // отвязка
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkResult, setUnlinkResult] = useState(null);

  // Свежий список детей: читаем users/{parentUid} напрямую (profile в AuthContext
  // отстаёт — после привязки Cloud Function обновляет childUids в Firestore, а не в стейте).
  const reloadChildren = React.useCallback(async () => {
    if (!parentUid) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, "users", parentUid));
      const uids = (snap.exists() ? snap.data()?.childUids : null) || [];
      setChildUids(uids);
      // Авто-выбор: держим текущего, если он ещё в списке; иначе первый (или null → онбординг).
      setSelectedChildUid(prev => (prev && uids.includes(prev)) ? prev : (uids[0] || null));
      setChildProfiles(uids.length ? await fetchFriendProfiles(uids) : {});
    } catch (e) {
      console.warn("[parent] reloadChildren failed", e?.message || e);
    }
    setLoading(false);
  }, [parentUid]);

  useEffect(() => { reloadChildren(); }, [reloadChildren]);

  const handleAdd = async () => {
    if (addBusy) return;
    setAddResult(null);
    const code = parseParentCode(addInput);
    if (!code) { setAddResult(RESULT_MSG.bad_format); return; }
    if (!parentUid) { setAddResult(RESULT_MSG.error); return; }
    setAddBusy(true);
    try {
      const ref = await addDoc(collection(db, "parentLinkRequests"), {
        parentUid, code, status: "pending", createdAt: new Date().toISOString(),
      });
      let final = null;
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const snap = await getDoc(doc(db, "parentLinkRequests", ref.id));
        const st = snap.exists() ? snap.data()?.status : null;
        if (st && st !== "pending") {
          final = st === "linked" ? RESULT_MSG.linked : (RESULT_MSG[snap.data()?.reason] || RESULT_MSG.error);
          break;
        }
      }
      setAddResult(final || RESULT_MSG.timeout);
      if (final?.ok) {
        setAddInput("");
        await reloadChildren();        // ребёнок появляется в списке без перелогина
        setShowAddForm(false);
      }
    } catch (e) {
      console.error("[parent] link failed", e?.message || e);
      setAddResult(RESULT_MSG.error);
    }
    setAddBusy(false);
  };

  // Отвязка ребёнка — через Cloud Function (self-write childUids/parentUids
  // заблокирован rules Шага 4). addDoc parentUnlinkRequests + опрос статуса.
  const handleUnlink = async (childUid, childName) => {
    if (unlinkBusy) return;
    if (!window.confirm(`Отвязать ${childName}? Вы перестанете видеть его прогресс.`)) return;
    if (!parentUid || !childUid) return;
    setUnlinkResult(null);
    setUnlinkBusy(true);
    try {
      const ref = await addDoc(collection(db, "parentUnlinkRequests"), {
        parentUid, childUid, status: "pending", createdAt: new Date().toISOString(),
      });
      let done = false;
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const snap = await getDoc(doc(db, "parentUnlinkRequests", ref.id));
        const st = snap.exists() ? snap.data()?.status : null;
        if (st && st !== "pending") { done = st === "done"; break; }
      }
      if (done) {
        // reloadChildren переключит selectedChildUid на первого оставшегося
        // (или null → онбординг, если открепили последнего).
        await reloadChildren();
      } else {
        setUnlinkResult("Не удалось отвязать — попробуйте ещё раз.");
      }
    } catch (e) {
      console.error("[parent] unlink failed", e?.message || e);
      setUnlinkResult("Ошибка отвязки. Попробуйте ещё раз.");
    }
    setUnlinkBusy(false);
  };

  const card = {
    background: THEME.surface, borderRadius: 18, padding: "18px 20px",
    boxShadow: "0 8px 28px -8px rgba(10,25,47,0.12), 0 2px 8px rgba(10,25,47,0.05)",
  };
  const wrap = { maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px" };
  const wrapWide = { maxWidth: 1040, margin: "0 auto", padding: "24px 16px 60px" }; // под-вью ребёнка — шире для 2 колонок
  const pageBg = { minHeight: "100vh", background: THEME.bg };

  const cp = childProfiles[selectedChildUid] || {};
  const curName = `${cp.firstName || ""} ${cp.lastName || ""}`.trim() || "Ребёнок";

  // Инлайн-панель добавления (онбординг + кнопка «+ Добавить»). Поле кода — крупное
  // (ключевое действие онбординга): большой padding/шрифт, заметная CTA.
  const addPanel = (
    <div style={{ ...card, marginBottom: 14, padding: "24px 22px" }}>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 17, color: THEME.text, marginBottom: 6 }}>Привязать ребёнка</div>
      <p style={{ fontSize: 13.5, color: THEME.textLight, marginBottom: 16, lineHeight: 1.5 }}>
        Введите код из профиля ребёнка (вид <b>P-123456</b>).
      </p>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: THEME.textLight, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Код ребёнка</label>
      <input
        type="text" value={addInput}
        onChange={e => {
          // Нормализация (б): только цифры (после возможного P-/кириллицы), ≤6, авто-префикс «P-».
          const digits = String(e.target.value).toUpperCase().replace(/^P-?/, "").replace(/\D/g, "").slice(0, 6);
          setAddInput(digits ? `P-${digits}` : "");
        }}
        placeholder="P-123456" autoComplete="off" inputMode="numeric" maxLength={8}
        onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
        style={{ width: "100%", padding: "16px 18px", border: `1.5px solid ${THEME.border}`, borderRadius: 12, fontSize: 22, fontWeight: 700, letterSpacing: "2px", textAlign: "center", color: THEME.text, background: THEME.bg, outline: "none", marginBottom: 8 }}
      />
      {addInput && !/^P-\d{6}$/.test(addInput) && (
        <div style={{ fontSize: 12.5, color: THEME.textLight, marginBottom: 10 }}>Код вида <b>P-123456</b> (6 цифр).</div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button type="button" onClick={handleAdd} disabled={addBusy || !/^P-\d{6}$/.test(addInput)}
          style={{ flex: 1, padding: "15px", borderRadius: 12, border: "none", background: "#1a1a2e", color: "#d4af37", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, cursor: addBusy ? "wait" : "pointer", opacity: /^P-\d{6}$/.test(addInput) ? 1 : 0.6 }}>
          {addBusy ? "Привязываю…" : "Привязать"}
        </button>
        {childUids.length > 0 && (
          <button type="button" onClick={() => { setShowAddForm(false); setAddResult(null); setAddInput(""); }}
            style={{ padding: "15px 18px", borderRadius: 12, border: `1px solid ${THEME.border}`, background: "transparent", color: THEME.textLight, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Отмена
          </button>
        )}
      </div>
      {addResult && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          background: addResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${addResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
          color: addResult.ok ? "#15803d" : "#dc2626" }}>
          {addResult.text}
        </div>
      )}
    </div>
  );

  const logoutBtn = onLogout && (
    <button type="button" onClick={onLogout}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "8px 14px", color: THEME.text, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Выйти
    </button>
  );

  // ── Онбординг: нет привязанных детей → просторный приветственный экран ──
  if (!loading && childUids.length === 0) {
    return (
      <div style={pageBg}>
        <AppTopbar onBack={null} title="Кабинет родителя" rightSlot={logoutBtn} />
        <style>{`.ob-grid{display:grid;gap:18px;grid-template-columns:1fr 1fr;align-items:start;}@media(max-width:760px){.ob-grid{grid-template-columns:1fr;}}`}</style>
        <div style={wrapWide}>
          {/* Приветствие — крупное, по центру */}
          <div style={{ textAlign: "center", padding: "20px 16px 4px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 26, color: THEME.text, marginBottom: 10 }}>Добавьте ребёнка</div>
            <div style={{ fontSize: 15, color: THEME.textLight, lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
              Привяжите аккаунт ребёнка по коду — и увидите его прогресс по математике: что освоено, над чем работать и динамику занятий.
            </div>
          </div>
          {/* 2 колонки: карусель-гайд (слева) | форма + подсказки (справа), равной высоты.
              Подсказки flex:1 — добирают высоту колонки до карусели (низ на одном уровне). */}
          <div className="ob-grid" style={{ marginTop: 22, alignItems: "stretch" }}>
            <OnboardingGuide />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {addPanel}
              <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontWeight: 700, color: THEME.text, fontSize: 14, marginBottom: 12 }}>💡 Полезно знать</div>
                {[
                  "Можно добавить нескольких детей — у каждого свой код.",
                  "Если код не подошёл — ребёнок обновит его в профиле (кнопка «Обновить код»).",
                  "Вы видите только прогресс ребёнка — изменить что-либо нельзя.",
                ].map((t, k) => (
                  <div key={k} style={{ display: "flex", gap: 8, marginBottom: k < 2 ? 12 : 0, fontSize: 13.5, color: THEME.textLight, lineHeight: 1.5 }}>
                    <span style={{ color: THEME.accent, flexShrink: 0, fontWeight: 800 }}>•</span><span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Основной: header + табы детей + действия + дашборд выбранного ──
  return (
    <div style={pageBg}>
      <AppTopbar onBack={null} title="Кабинет родителя" rightSlot={logoutBtn} />
      <div style={wrapWide}>
      {loading ? (
        <div style={{ ...card, textAlign: "center", color: THEME.textLight }}>Загрузка…</div>
      ) : (
        <>
          {/* Верхняя панель: табы детей (слева) + действия (справа).
              На узких экранах — в колонку: иначе блок действий (широкая CTA) наезжает
              на сжатый flex:1 контейнер табов (min-width:0 даёт ему схлопнуться под контент). */}
          <style>{`.cab-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;}
.cab-tabs{display:flex;gap:8px;flex-wrap:wrap;flex:1;min-width:0;}
.cab-actions{display:flex;gap:8px;flex-wrap:wrap;}
@media(max-width:560px){.cab-top{flex-direction:column;align-items:stretch;}.cab-tabs{flex:none;}}`}</style>
          <div className="cab-top">
            <div className="cab-tabs">
              {childUids.map(uid => {
                const p = childProfiles[uid] || {};
                const nm = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Ребёнок";
                const active = uid === selectedChildUid;
                return (
                  <button key={uid} type="button" onClick={() => setSelectedChildUid(uid)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px 7px 8px",
                      borderRadius: 12, cursor: "pointer", maxWidth: 220,
                      background: active ? THEME.surface : "transparent",
                      border: active ? `1.5px solid ${THEME.accent}` : `1px solid ${THEME.border}`,
                      boxShadow: active ? "0 4px 14px -6px rgba(10,25,47,0.25)" : "none" }}>
                    <Avatar p={p} size={26} accent={active ? THEME.accent : THEME.border} />
                    <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: active ? 800 : 600, fontSize: 14,
                      color: active ? THEME.text : THEME.textLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</span>
                  </button>
                );
              })}
            </div>
            <div className="cab-actions">
              {/* Основная: акцентная CTA (тёмный фон + золото — фирменный стиль) */}
              <button type="button" onClick={() => { setShowAddForm(v => !v); setAddResult(null); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1a1a2e", border: "none", borderRadius: 10, padding: "9px 16px", color: "#d4af37", fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Добавить ребёнка
              </button>
              {/* Вторичная: видимый контур (не голый текст) */}
              {selectedChildUid && (
                <button type="button" onClick={() => handleUnlink(selectedChildUid, curName)} disabled={unlinkBusy}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "9px 14px", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: unlinkBusy ? "wait" : "pointer", opacity: unlinkBusy ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                  {unlinkBusy ? "Открепляю…" : "Открепить"}
                </button>
              )}
            </div>
          </div>

          {showAddForm && addPanel}
          {unlinkResult && <div style={{ marginBottom: 12, fontSize: 13, color: "#dc2626" }}>{unlinkResult}</div>}

          {/* Дашборд выбранного ребёнка (ChildReport сам грузит данные + карту в «Подробнее») */}
          {selectedChildUid && <ChildReport childUid={selectedChildUid} />}
        </>
      )}
    </div></div>
  );
}
