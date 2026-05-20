import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "../lib/firebase";
import { THEME } from "../lib/appConstants.js";

export default function ChangePasswordInline() {
  const { firebaseUser } = useAuth();
  const [open, setOpen]           = useState(false);
  const [current, setCurrent]     = useState('');
  const [next, setNext]           = useState('');
  const [confirm, setConfirm]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  // Показываем только если пользователь вошёл через Firebase Auth
  if (!firebaseUser) return null;

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); setSuccess(false); setOpen(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 8)                { setError('Новый пароль — минимум 8 символов.'); return; }
    if (!/(?=.*[a-zA-Zа-яА-Я])(?=.*\d)/.test(next)) { setError('Пароль должен содержать букву и цифру.'); return; }
    if (next !== confirm)               { setError('Пароли не совпадают.'); return; }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, current);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, next);
      setSuccess(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      switch (err.code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential': setError('Текущий пароль введён неверно.'); break;
        case 'auth/weak-password':      setError('Новый пароль слишком слабый.'); break;
        case 'auth/requires-recent-login': setError('Войдите заново и попробуйте снова.'); break;
        default: setError(`Ошибка: ${err.code}`);
      }
    }
    setSaving(false);
  };

  return (
    <div style={{marginTop:8}}>
      {!open ? (
        <button onClick={()=>setOpen(true)} data-tour="change-password"
          style={{background:'transparent',border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:'6px 16px',fontWeight:600,fontSize:12,cursor:'pointer',marginTop:4}}>
          🔑 Сменить пароль
        </button>
      ) : (
        <div style={{marginTop:12,background:THEME.bg,borderRadius:10,padding:'16px',border:`1px solid ${THEME.border}`}}>
          <div style={{fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:10}}>Смена пароля</div>
          {error   && <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:12,color:'#dc2626'}}>{error}</div>}
          {success && <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:12,color:'#065f46'}}>Пароль успешно изменён.</div>}
          {!success && (
            <form onSubmit={handleSubmit}>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <input type="password" className="input-field" style={{padding:'8px 12px',marginBottom:0}}
                  placeholder="Текущий пароль" autoComplete="current-password"
                  value={current} onChange={e=>setCurrent(e.target.value)} required/>
                <input type="password" className="input-field" style={{padding:'8px 12px',marginBottom:0}}
                  placeholder="Новый пароль (мин. 8 симв.)" autoComplete="new-password"
                  value={next} onChange={e=>setNext(e.target.value)} required/>
                <input type="password" className="input-field" style={{padding:'8px 12px',marginBottom:0}}
                  placeholder="Повторите новый пароль" autoComplete="new-password"
                  value={confirm} onChange={e=>setConfirm(e.target.value)} required/>
              </div>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button type="submit" disabled={saving}
                  style={{background:THEME.primary,color:THEME.accent,border:'none',borderRadius:8,padding:'8px 18px',fontWeight:700,fontSize:12,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>
                  {saving ? 'Сохраняю...' : 'Сохранить'}
                </button>
                <button type="button" onClick={reset}
                  style={{background:'transparent',border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:'8px 14px',fontWeight:600,fontSize:12,cursor:'pointer'}}>
                  Отмена
                </button>
              </div>
            </form>
          )}
          {success && <button onClick={reset} style={{background:'transparent',border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:'6px 14px',fontWeight:600,fontSize:12,cursor:'pointer',marginTop:4}}>Закрыть</button>}
        </div>
      )}
    </div>
  );
}
