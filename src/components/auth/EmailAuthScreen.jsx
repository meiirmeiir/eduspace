import { useState } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '../../lib/firebase';
import { doc, setDoc, db } from '../../firestore-rest';

// ── Константы (дублированы здесь чтобы не импортировать из App.jsx) ──────────
const THEME = {
  primary: '#0f172a', accent: '#d4af37', bg: '#f8fafc', surface: '#ffffff',
  text: '#334155', textLight: '#64748b', border: '#e2e8f0',
};
const REG_GOALS = {
  exam:   'Подготовка к экзамену',
  gaps:   'Закрытие пробелов',
  future: 'Подготовка к следующему классу',
};
const EXAMS_LIST  = ['ЕНТ','SAT','NUET','Further Pure Math','IGCSE','Mechanics 1','Mechanics 2','Mechanics 3','Calculus'];
const GRADES_LIST = ['5 класс','6 класс','7 класс','8 класс','9 класс','10 класс','11 класс','12 класс'];
const getSpecificList = (goalKey) =>
  goalKey === 'exam' ? EXAMS_LIST :
  (goalKey === 'gaps' || goalKey === 'future') ? GRADES_LIST : [];

// ── Утилиты валидации ─────────────────────────────────────────────────────────
const emailRe  = /\S+@\S+\.\S+/;
const pwdRe    = /^(?=.*[a-zA-Zа-яА-Я])(?=.*\d).{8,}$/;
const phoneNorm = (raw) => '+7' + raw.replace(/\D/g, '').slice(-10);

function mapFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-email':         return 'Некорректный email.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':    return 'Неверный email или пароль.';
    case 'auth/email-already-in-use':  return 'Этот email уже зарегистрирован. Попробуйте войти.';
    case 'auth/weak-password':         return 'Пароль слишком слабый — минимум 8 символов.';
    case 'auth/too-many-requests':     return 'Слишком много попыток. Попробуйте позже.';
    case 'auth/network-request-failed':return 'Нет соединения. Проверьте интернет.';
    default:                           return `Ошибка: ${code}. Попробуйте позже.`;
  }
}

// ── Компонент ─────────────────────────────────────────────────────────────────
export default function EmailAuthScreen({ onSuccess }) {
  const [mode, setMode]         = useState('login');   // 'login' | 'register'
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Поля входа
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Поля регистрации
  const [regFirstName,  setRegFirstName]  = useState('');
  const [regLastName,   setRegLastName]   = useState('');
  const [regPhone,      setRegPhone]      = useState('+7 ');
  const [regGoal,       setRegGoal]       = useState('');
  const [regDetails,    setRegDetails]    = useState('');
  const [regEmail,      setRegEmail]      = useState('');
  const [regPassword,   setRegPassword]   = useState('');
  const [regConfirm,    setRegConfirm]    = useState('');

  // Восстановление пароля
  const [showReset, setShowReset]         = useState(false);
  const [resetEmail, setResetEmail]       = useState('');
  const [resetSent,  setResetSent]        = useState(false);
  const [resetLoading, setResetLoading]   = useState(false);
  const [resetError,   setResetError]     = useState('');

  // ── Маска телефона ──────────────────────────────────────────────────────────
  const handlePhone = (e) => {
    let v = e.target.value;
    if (!v.startsWith('+7 ')) { setRegPhone('+7 '); return; }
    const digits = v.slice(3).replace(/\D/g, '').slice(0, 10);
    setRegPhone('+7 ' + digits);
  };
  const phoneOk = regPhone.replace(/\D/g, '').length === 11;

  // ── Вход ───────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!emailRe.test(loginEmail)) { setError('Некорректный email.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // AuthContext подхватит пользователя через onIdTokenChanged
      onSuccess?.();
    } catch (err) {
      setError(mapFirebaseError(err.code));
    }
    setLoading(false);
  };

  // ── Регистрация ────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!regFirstName.trim())          { setError('Введите имя.');                return; }
    if (!regLastName.trim())           { setError('Введите фамилию.');            return; }
    if (!phoneOk)                      { setError('Введите корректный номер телефона.'); return; }
    if (!regGoal)                      { setError('Выберите цель обучения.');     return; }
    if (!regDetails)                   { setError('Выберите класс или экзамен.'); return; }
    if (!emailRe.test(regEmail))       { setError('Некорректный email.');         return; }
    if (!pwdRe.test(regPassword))      { setError('Пароль должен содержать минимум 8 символов, хотя бы одну букву и одну цифру.'); return; }
    if (regPassword !== regConfirm)    { setError('Пароли не совпадают.');        return; }

    setLoading(true);
    let userCredential = null;
    try {
      // Шаг 1: создать пользователя в Firebase Auth
      userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const uid = userCredential.user.uid;

      // Шаг 2: создать профиль в Firestore users/{uid}
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          email:       regEmail,
          phone:       phoneNorm(regPhone),
          firstName:   regFirstName.trim(),
          lastName:    regLastName.trim(),
          goalKey:     regGoal,
          goal:        REG_GOALS[regGoal],
          details:     regDetails,
          role:        'student',
          status:      'trial',
          registeredAt: new Date().toISOString(),
        });
      } catch (fsErr) {
        // TODO: orphaned auth user cleanup
        // Auth-пользователь создан, но профиль не записался.
        // Пользователь увидит ошибку и может попробовать снова.
        console.error('[register] Firestore write failed:', fsErr);
        throw new Error('profile_write_failed');
      }

      // AuthContext подхватит пользователя через onIdTokenChanged
      onSuccess?.();
    } catch (err) {
      if (err.message === 'profile_write_failed') {
        setError('Аккаунт создан, но профиль не сохранился. Попробуйте войти — если не получится, зарегистрируйтесь снова.');
      } else {
        setError(mapFirebaseError(err.code));
      }
    }
    setLoading(false);
  };

  // ── Общие стили (должны быть до resetModal) ─────────────────────────────
  const inlineError = {
    background:'rgba(239,68,68,0.08)',
    border:'1px solid rgba(239,68,68,0.25)',
    borderRadius:8,
    padding:'10px 14px',
    marginBottom:16,
    fontSize:13,
    color:'#dc2626',
    fontWeight:500,
  };
  const backBtn = {
    width:'100%',marginTop:10,padding:'12px',
    borderRadius:8,border:`1px solid ${THEME.border}`,
    background:'transparent',color:THEME.textLight,
    fontFamily:"'Montserrat',sans-serif",fontWeight:600,fontSize:13,cursor:'pointer',
  };
  const tabActive   = { borderBottom:`2px solid ${THEME.primary}`, color:THEME.primary, fontWeight:700 };
  const tabInactive = { borderBottom:'2px solid transparent', color:THEME.textLight, fontWeight:600 };

  // ── Восстановление пароля ─────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!emailRe.test(resetEmail)) { setResetError('Введите корректный email.'); return; }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err) {
      // Не раскрываем, существует ли email (enumeration protection)
      setResetSent(true);
    }
    setResetLoading(false);
  };

  // ── Модалка восстановления ────────────────────────────────────────────────
  const resetModal = showReset && (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:'#fff',borderRadius:16,padding:32,width:'100%',maxWidth:400,boxShadow:'0 20px 50px -10px rgba(10,25,47,0.2)'}}>
        {resetSent ? (
          <>
            <div style={{fontSize:32,marginBottom:12,textAlign:'center'}}>📬</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:8,textAlign:'center'}}>Письмо отправлено</div>
            <p style={{color:THEME.textLight,fontSize:14,lineHeight:1.6,textAlign:'center',marginBottom:24}}>
              Если такой email зарегистрирован, на него отправлено письмо для сброса пароля. Проверьте папку «Спам».
            </p>
            <button onClick={()=>{setShowReset(false);setResetSent(false);setResetEmail('');}} className="cta-button active" style={{width:'100%'}}>
              Закрыть
            </button>
          </>
        ) : (
          <>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:4}}>Восстановление пароля</div>
            <p style={{color:THEME.textLight,fontSize:13,marginBottom:20}}>Введите email, указанный при регистрации.</p>
            {resetError && <div style={inlineError}>{resetError}</div>}
            <form onSubmit={handleReset}>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input
                  type="email" className="input-field" autoFocus
                  value={resetEmail} onChange={e=>setResetEmail(e.target.value)}
                  placeholder="example@mail.com" autoComplete="email" required
                />
              </div>
              <button type="submit" className={`cta-button ${resetEmail?'active':''}`} disabled={!resetEmail||resetLoading} style={{width:'100%',marginTop:8}}>
                {resetLoading ? 'Отправляю...' : 'Отправить ссылку'}
              </button>
              <button type="button" onClick={()=>{setShowReset(false);setResetError('');setResetEmail('');}}
                style={backBtn}>
                Отмена
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );

  // ── Рендер ───────────────────────────────────────────────────────────────
  return (
    <div className="split-layout">
      {resetModal}

      {/* ── Левая колонка (идентична старому AuthScreen) ── */}
      <div className="split-left">
        <div style={{marginBottom:60}}>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:36,color:'#fff',lineHeight:1,letterSpacing:'1px'}}>AAPA</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:11,color:THEME.accent,letterSpacing:'1px',marginTop:4,textTransform:'uppercase'}}>Ad Astra Per Aspera</div>
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
          <h1 className="hero-title">Построй свой путь к <span style={{color:THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">Пройди независимую диагностику компетенций. Система <b>AAPA</b> выявит скрытые пробелы и построит точный маршрут подготовки.</p>
          <div className="benefits-list">
            <div className="benefit-item"><span className="icon">🎯</span><div><strong>Когнитивная диагностика</strong><p>Анализируем не только верные ответы, но и вашу уверенность в них.</p></div></div>
            <div className="benefit-item"><span className="icon">🗺️</span><div><strong>Индивидуальный трек</strong><p>Пошаговая Карта Навыков для достижения вашей цели.</p></div></div>
          </div>
        </div>
        <div className="trust-badge">
          <span style={{color:THEME.accent,letterSpacing:'2px',fontSize:18}}>★★★★★</span>
          <span style={{fontSize:13,color:THEME.textLight,fontWeight:600}}>Нам доверяют подготовку к будущему</span>
        </div>
      </div>

      {/* ── Правая колонка ── */}
      <div className="split-right">
        <div className="form-card">

          {/* Табы */}
          <div style={{display:'flex',gap:0,marginBottom:24,borderBottom:`1px solid ${THEME.border}`}}>
            {[['login','Войти'],['register','Регистрация']].map(([m,label])=>(
              <button key={m} type="button" onClick={()=>{setMode(m);setError('');}}
                style={{flex:1,padding:'10px 0',background:'none',border:'none',cursor:'pointer',fontSize:14,fontFamily:"'Montserrat',sans-serif",transition:'all 0.15s',...(mode===m?tabActive:tabInactive)}}>
                {label}
              </button>
            ))}
          </div>

          {error && <div style={inlineError}>{error}</div>}

          {/* ── Форма входа ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input type="email" className="input-field" autoFocus
                  value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}
                  placeholder="example@mail.com" autoComplete="email" required/>
              </div>
              <div className="input-group">
                <label className="input-label">Пароль</label>
                <input type="password" className="input-field"
                  value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}
                  placeholder="Введите пароль..." autoComplete="current-password" required/>
              </div>
              <button type="submit" className={`cta-button ${loginEmail&&loginPassword?'active':''}`}
                disabled={!loginEmail||!loginPassword||loading}>
                {loading ? 'Вхожу...' : 'Войти →'}
              </button>
              <button type="button" onClick={()=>setShowReset(true)}
                style={{...backBtn,marginTop:12,fontSize:13,color:THEME.accent,border:'none',background:'none',padding:'8px 0'}}>
                Забыли пароль?
              </button>
            </form>
          )}

          {/* ── Форма регистрации ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-row">
                <div className="input-group" style={{marginBottom:0}}>
                  <label className="input-label">Имя</label>
                  <input type="text" className="input-field"
                    value={regFirstName} onChange={e=>setRegFirstName(e.target.value)}
                    autoComplete="given-name" required/>
                </div>
                <div className="input-group" style={{marginBottom:0}}>
                  <label className="input-label">Фамилия</label>
                  <input type="text" className="input-field"
                    value={regLastName} onChange={e=>setRegLastName(e.target.value)}
                    autoComplete="family-name" required/>
                </div>
              </div>
              <div className="input-group" style={{marginTop:16}}>
                <label className="input-label">Номер телефона (WhatsApp)</label>
                <input type="tel" className="input-field"
                  value={regPhone} onChange={handlePhone}
                  placeholder="+7 700 000 00 00" autoComplete="tel" required/>
              </div>
              <div className="input-group">
                <label className="input-label">Цель обучения</label>
                <select className="input-field" value={regGoal}
                  onChange={e=>{setRegGoal(e.target.value);setRegDetails('');}} required>
                  <option value="" disabled>Выберите...</option>
                  {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {regGoal && (
                <div className="input-group">
                  <label className="input-label">{regGoal==='exam'?'Какой экзамен?':'Класс'}</label>
                  <select className="input-field" value={regDetails}
                    onChange={e=>setRegDetails(e.target.value)} required>
                    <option value="" disabled>Выберите...</option>
                    {getSpecificList(regGoal).map(x=><option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Email</label>
                <input type="email" className="input-field"
                  value={regEmail} onChange={e=>setRegEmail(e.target.value)}
                  placeholder="example@mail.com" autoComplete="email" required/>
              </div>
              <div className="input-group">
                <label className="input-label">Пароль</label>
                <input type="password" className="input-field"
                  value={regPassword} onChange={e=>setRegPassword(e.target.value)}
                  placeholder="Минимум 8 символов, буква и цифра" autoComplete="new-password" required/>
              </div>
              <div className="input-group">
                <label className="input-label">Повторите пароль</label>
                <input type="password" className="input-field"
                  value={regConfirm} onChange={e=>setRegConfirm(e.target.value)}
                  placeholder="Повторите пароль..." autoComplete="new-password" required/>
              </div>
              <button type="submit"
                className={`cta-button ${regFirstName&&regLastName&&phoneOk&&regGoal&&regDetails&&regEmail&&regPassword&&regConfirm?'active':''}`}
                disabled={loading}>
                {loading ? 'Создаю аккаунт...' : 'Зарегистрироваться →'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
