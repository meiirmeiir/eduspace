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
import ChildMap from "../components/ChildMap.jsx";

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

  const [view, setView] = useState("list");          // 'list' | 'child'
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
        await reloadChildren();
        setView("list");
        setSelectedChildUid(null);
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
  const pageBg = { minHeight: "100vh", background: THEME.bg };

  // ── Под-вью ребёнка: заглушки Шага 6/7 ──
  if (view === "child" && selectedChildUid) {
    const cp = childProfiles[selectedChildUid] || {};
    const name = `${cp.firstName || ""} ${cp.lastName || ""}`.trim() || "Ребёнок";
    return (
      <div style={pageBg}><div style={wrap}>
        <button type="button" onClick={() => { setView("list"); setSelectedChildUid(null); }}
          style={{ background: "none", border: "none", color: THEME.textLight, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "4px 0", marginBottom: 16 }}>
          ← Назад к списку
        </button>
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <Avatar p={cp} accent={THEME.accent} />
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 19, color: THEME.text }}>{name}</div>
            {cp.details && <div style={{ fontSize: 13, color: THEME.textLight }}>{cp.details}{cp.region ? ` · ${cp.region}` : ""}</div>}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <ChildReport childUid={selectedChildUid} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <ChildMap childUid={selectedChildUid} />
        </div>
        {/* Отвязка ребёнка (через Cloud Function) */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          {unlinkResult && (
            <div style={{ marginBottom: 10, fontSize: 13, color: "#dc2626" }}>{unlinkResult}</div>
          )}
          <button type="button" onClick={() => handleUnlink(selectedChildUid, name)} disabled={unlinkBusy}
            style={{ background: "none", border: "none", color: "#dc2626", fontSize: 13, fontWeight: 600,
              textDecoration: "underline", cursor: unlinkBusy ? "wait" : "pointer", opacity: unlinkBusy ? 0.6 : 1 }}>
            {unlinkBusy ? "Отвязываю…" : "Отвязать ребёнка"}
          </button>
        </div>
      </div></div>
    );
  }

  // ── Главный вид: список детей + привязка ──
  return (
    <div style={pageBg}><div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 24, color: THEME.text }}>Мои дети</div>
          <div style={{ fontSize: 13.5, color: THEME.textLight, marginTop: 2 }}>Прогресс и план ваших детей</div>
        </div>
        {onLogout && (
          <button type="button" onClick={onLogout}
            style={{ background: "none", border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "8px 14px", color: THEME.textLight, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Выйти
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: THEME.textLight }}>Загрузка…</div>
      ) : childUids.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: THEME.textLight, marginBottom: 18 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>👨‍👩‍👧</div>
          <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 4 }}>Пока нет привязанных детей</div>
          <div style={{ fontSize: 13.5 }}>Введите код, который ребёнок показывает в своём профиле.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          {childUids.map(uid => {
            const cp = childProfiles[uid] || {};
            const name = `${cp.firstName || ""} ${cp.lastName || ""}`.trim() || "Ребёнок";
            return (
              <button key={uid} type="button" onClick={() => { setSelectedChildUid(uid); setView("child"); }}
                style={{ ...card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", border: "none", width: "100%" }}>
                <Avatar p={cp} accent={THEME.accent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 16, color: THEME.text }}>{name}</div>
                  {cp.details && <div style={{ fontSize: 13, color: THEME.textLight }}>{cp.details}{cp.region ? ` · ${cp.region}` : ""}</div>}
                </div>
                <span style={{ color: THEME.textLight, fontSize: 20 }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Привязка ребёнка */}
      {!showAddForm ? (
        <button type="button" onClick={() => { setShowAddForm(true); setAddResult(null); }}
          style={{ width: "100%", padding: 13, borderRadius: 12, border: `1.5px dashed ${THEME.border}`, background: "transparent", color: THEME.text, fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
          + Добавить ребёнка
        </button>
      ) : (
        <div style={card}>
          <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 6 }}>Привязать ребёнка</div>
          <p style={{ fontSize: 13, color: THEME.textLight, marginBottom: 12 }}>
            Введите код из профиля ребёнка (вид <b>P-123456</b>).
          </p>
          <input
            type="text" value={addInput} onChange={e => setAddInput(e.target.value)}
            placeholder="P-123456" autoComplete="off"
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${THEME.border}`, borderRadius: 10, fontSize: 16, letterSpacing: "1px", color: THEME.text, background: THEME.surface, outline: "none", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={handleAdd} disabled={addBusy || !addInput.trim()}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#1a1a2e", color: "#d4af37", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 14.5, cursor: addBusy ? "wait" : "pointer", opacity: addInput.trim() ? 1 : 0.6 }}>
              {addBusy ? "Привязываю…" : "Привязать"}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setAddResult(null); setAddInput(""); }}
              style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${THEME.border}`, background: "transparent", color: THEME.textLight, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Отмена
            </button>
          </div>
          {addResult && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
              background: addResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${addResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
              color: addResult.ok ? "#15803d" : "#dc2626" }}>
              {addResult.text}
            </div>
          )}
        </div>
      )}
    </div></div>
  );
}
