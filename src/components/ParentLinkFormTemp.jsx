// ВРЕМЕННЫЙ компонент (артефакт 5, Шаг 3): минимальная форма привязки ребёнка
// по коду — для сквозного теста клиентской стороны под реальными Firestore rules.
// Полноценный родительский UI — Шаг 5. УДАЛИТЬ при реализации Шага 5.
import React, { useState } from "react";
import { addDoc, collection, doc, getDoc, db } from "../firestore-rest.js";
import { parseParentCode } from "../lib/parentLinkUtils.js";

const RESULT_MSG = {
  linked:         { ok: true,  text: "✓ Привязка успешна — ребёнок добавлен." },
  code_not_found: { ok: false, text: "Код не найден. Проверьте код у ребёнка." },
  self_link:      { ok: false, text: "Нельзя привязать самого себя." },
  missing_fields: { ok: false, text: "Ошибка данных запроса." },
  timeout:        { ok: false, text: "Привязка не подтвердилась — попробуйте ещё раз." },
  bad_format:     { ok: false, text: "Неверный формат кода. Пример: P-123456." },
  error:          { ok: false, text: "Ошибка отправки. Попробуйте ещё раз." },
};

export default function ParentLinkFormTemp({ user, onLogout }) {
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(null); // {ok, text} | null

  const handleSubmit = async () => {
    if (busy) return;
    setResult(null);
    const code = parseParentCode(input); // убирает "P-", валидирует 6 цифр
    if (!code) { setResult(RESULT_MSG.bad_format); return; }
    if (!user?.uid) { setResult(RESULT_MSG.error); return; }
    setBusy(true);
    try {
      // create под реальными rules: parentUid должен == auth.uid
      const ref = await addDoc(collection(db, "parentLinkRequests"), {
        parentUid: user.uid,
        code,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      // опрос статуса (Cloud Function доводит pending → linked/invalid)
      let final = null;
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const snap = await getDoc(doc(db, "parentLinkRequests", ref.id));
        const st = snap.exists() ? snap.data()?.status : null;
        if (st && st !== "pending") {
          final = st === "linked"
            ? RESULT_MSG.linked
            : (RESULT_MSG[snap.data()?.reason] || RESULT_MSG.error);
          break;
        }
      }
      setResult(final || RESULT_MSG.timeout);
      if (final?.ok) setInput("");
    } catch (e) {
      console.error("[parentLinkTemp] submit failed", e?.message || e);
      setResult(RESULT_MSG.error);
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, boxShadow: "0 16px 40px -12px rgba(10,25,47,0.15)" }}>
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 20, color: "#0f172a", marginBottom: 6 }}>
          Привязка ребёнка <span style={{ fontSize: 12, fontWeight: 700, color: "#d4af37" }}>(временно · Шаг 3)</span>
        </div>
        <p style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.5, marginBottom: 18 }}>
          Введите код, который ребёнок показывает в своём профиле (вид <b>P-123456</b>).
        </p>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="P-123456" autoComplete="off"
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
          style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 16, letterSpacing: "1px", color: "#0f172a", outline: "none", marginBottom: 12 }}
        />
        <button
          type="button" onClick={handleSubmit} disabled={busy || !input.trim()}
          style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#1a1a2e", color: "#d4af37", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, cursor: busy ? "wait" : "pointer", opacity: input.trim() ? 1 : 0.6 }}>
          {busy ? "Привязываю…" : "Привязать"}
        </button>
        {result && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            background: result.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${result.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
            color: result.ok ? "#15803d" : "#dc2626" }}>
            {result.text}
          </div>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout}
            style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            Выйти
          </button>
        )}
      </div>
    </div>
  );
}
