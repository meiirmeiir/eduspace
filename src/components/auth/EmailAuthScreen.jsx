import { useState } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '../../lib/firebase';
import { doc, setDoc, db } from '../../firestore-rest';
import { genFriendCode } from '../../lib/friendsUtils.js';

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
const KZ_REGIONS = [
  'Алматы (город)','Астана (город)','Шымкент (город)',
  'Алматинская область','Акмолинская область','Актюбинская область','Атырауская область',
  'Восточно-Казахстанская область','Жамбылская область','Западно-Казахстанская область',
  'Карагандинская область','Костанайская область','Кызылординская область',
  'Мангистауская область','Павлодарская область','Северо-Казахстанская область',
  'Туркестанская область','Жетісу область','Улытау область','Абай область',
];
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

// ── Шрифты (EmailAuthScreen рендерится до основного App, поэтому нужны здесь) ─
const FONTS_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#f8fafc;-webkit-font-smoothing:antialiased;color:#334155;font-family:'Inter',sans-serif;}
  .split-layout{display:flex;min-height:100vh;}
  .split-left{flex:1.1;background:#0f172a;padding:60px 80px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid #e2e8f0;}
  /* Правая панель: собственный скролл + лёгкий точечный паттерн, чтобы белая
     поверхность не выглядела голой. Центрирование карточки — через margin:auto
     на .form-card: в отличие от align-items:center это НЕ обрезает верх,
     когда форма (регистрация) выше вьюпорта. */
  .split-right{flex:1;display:flex;justify-content:center;padding:40px 60px;background:#f8fafc;max-height:100vh;overflow-y:auto;
    background-image:radial-gradient(circle, #e7e9f2 1.2px, transparent 1.2px);background-size:26px 26px;}
  .hero-title{font-family:'Montserrat',sans-serif;font-size:44px;font-weight:800;line-height:1.15;margin-bottom:16px;color:#fff;letter-spacing:-1.5px;}
  .hero-subtitle{font-size:17px;line-height:1.7;color:rgba(255,255,255,0.6);margin-bottom:0;max-width:520px;}
  /* Тонкий разделитель между текстом и фичами — вместо большого пробела */
  .hero-divider{width:64px;height:2px;border-radius:2px;background:linear-gradient(90deg,#d4af37,rgba(212,175,55,0.15));margin:26px 0;}
  .benefits-list{display:flex;flex-direction:column;gap:16px;}
  .benefit-item{display:flex;gap:16px;align-items:flex-start;color:#fff;}
  .benefit-item .icon{font-size:22px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.07);border-radius:12px;flex-shrink:0;}
  .benefit-item strong{font-weight:700;font-size:15px;display:block;margin-bottom:3px;color:#fff;}
  .benefit-item p{font-size:13px;color:rgba(255,255,255,0.55);line-height:1.5;margin:0;}
  .form-card{background:#fff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 24px 60px -12px rgba(10,25,47,0.18),0 4px 16px rgba(10,25,47,0.06);padding:40px;width:100%;max-width:460px;margin:auto;}
  .form-row{display:flex;gap:12px;}
  .input-group{margin-bottom:16px;}
  .input-label{display:block;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;}
  .input-field{width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;font-family:'Inter',sans-serif;color:#0f172a;background:#fff;outline:none;transition:border-color 0.15s;margin-bottom:0;}
  .input-field:focus{border-color:#0f172a;}
  select.input-field{cursor:pointer;}
  /* CTA всегда тёмная с золотым текстом — самый заметный элемент формы.
     Прежний неактивный вид (#e2e8f0/#94a3b8) на белом читался как disabled. */
  .cta-button{width:100%;padding:14px;border-radius:10px;border:none;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;cursor:pointer;transition:all 0.2s;background:#1a1a2e;color:#fbbf24;margin-top:8px;opacity:0.55;}
  .cta-button.active{opacity:1;box-shadow:0 8px 20px -5px rgba(10,25,47,0.35);}
  .cta-button.active:hover{background:#26263f;}
  .cta-button:disabled{cursor:not-allowed;}
  @media(max-width:768px){
    .split-layout{flex-direction:column;}
    .split-left{padding:40px 24px;}
    .split-right{padding:32px 20px;max-height:none;overflow-y:visible;}
    .hero-title{font-size:28px;}
    .form-card{padding:28px 20px;}
  }
`;

// ── Компонент ─────────────────────────────────────────────────────────────────
export default function EmailAuthScreen({ onSuccess, onBack, from }) {
  const [mode, setMode]         = useState(from === 'demo' ? 'register' : 'login');   // 'login' | 'register'
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
  const [regRegion,     setRegRegion]     = useState('');
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
    if (!regRegion)                    { setError('Выберите область.');           return; }
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
      const friendCode = genFriendCode();
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
          region:      regRegion,
          role:        'student',
          status:      'trial',
          friendCode,                       // код приглашения друзей
          friends:     [],
          registeredAt: new Date().toISOString(),
        });
        // Резолв-индекс кода → uid (для «добавить по коду» / invite-ссылок).
        // best-effort: при коллизии/фейле FriendsScreen перегенерит через ensureFriendCode.
        try { await setDoc(doc(db, 'friendCodes', friendCode), { uid }); } catch {}
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
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',backdropFilter:'blur(3px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:'#fff',borderRadius:16,padding:32,width:'100%',maxWidth:400,boxShadow:'0 24px 60px -10px rgba(10,25,47,0.3)'}}>
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
            <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:21,color:THEME.primary,marginBottom:6}}>Восстановление пароля</div>
            <p style={{color:THEME.textLight,fontSize:13.5,marginBottom:20}}>Введите email, указанный при регистрации.</p>
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
              {/* ghost-кнопка отмены — прозрачная с тонкой обводкой */}
              <button type="button" onClick={()=>{setShowReset(false);setResetError('');setResetEmail('');}}
                style={{...backBtn,border:'1.5px solid #cbd5e1',color:THEME.text,borderRadius:10}}>
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
      <style>{FONTS_STYLE}</style>
      {resetModal}
      {onBack && (
        <button onClick={onBack} style={{position:'absolute',top:16,left:16,zIndex:1100,background:'rgba(255,255,255,0.12)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>← На главную</button>
      )}

      {/* ── Левая колонка (идентична старому AuthScreen) ── */}
      <div className="split-left">
        <div style={{marginBottom:60}}>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:36,color:'#fff',lineHeight:1,letterSpacing:'1px'}}>AAPA</div>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:11,color:THEME.accent,letterSpacing:'1px',marginTop:4,textTransform:'uppercase'}}>Ad Astra Per Aspera</div>
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
          <h1 className="hero-title">Построй свой путь к <span style={{color:THEME.accent}}>звездам</span>.</h1>
          <p className="hero-subtitle">Пройди независимую диагностику компетенций. Система <b>AAPA</b> выявит скрытые пробелы и построит точный маршрут подготовки.</p>
          <div className="hero-divider"/>
          <div className="benefits-list">
            <div className="benefit-item"><span className="icon">🎯</span><div><strong>Когнитивная диагностика</strong><p>Анализируем не только верные ответы, но и вашу уверенность в них.</p></div></div>
            <div className="benefit-item"><span className="icon">🗺️</span><div><strong>Индивидуальный трек</strong><p>Пошаговая Карта Навыков для достижения вашей цели.</p></div></div>
            <div className="benefit-item"><span className="icon">🎮</span><div><strong>Геймификация</strong><p>Зарабатывай кристаллы, прокачивай героя и соревнуйся с друзьями в рейтинге.</p></div></div>
          </div>
        </div>
      </div>

      {/* ── Правая колонка ── */}
      <div className="split-right">
        <div className="form-card">

          {from === 'demo' && (
            <div style={{marginBottom:18,padding:'12px 16px',borderRadius:12,background:`${THEME.accent}1a`,border:`1px solid ${THEME.accent}55`,fontSize:13.5,color:'#334155',lineHeight:1.5}}>
              🎯 Результаты твоей диагностики сохранятся — после регистрации увидишь персональный план с подсвеченными пробелами.
            </div>
          )}

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
                <label className="input-label">Область</label>
                <select className="input-field" value={regRegion}
                  onChange={e=>setRegRegion(e.target.value)} required>
                  <option value="" disabled>Выберите...</option>
                  {KZ_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
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
                className={`cta-button ${regFirstName&&regLastName&&phoneOk&&regGoal&&regDetails&&regRegion&&regEmail&&regPassword&&regConfirm?'active':''}`}
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
