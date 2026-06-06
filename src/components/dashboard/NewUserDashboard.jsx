import React from "react";
import { useTheme } from "../../ThemeContext.jsx";

// Этап 1 онбординга дашборда: пользователь ещё не прошёл диагностику.
// Вместо пустых виджетов (рейтинг 0, корабль-голограмма, нулевые метрики) —
// одна понятная задача: пройти диагностику. Сайдбар/топбар остаются у родителя.

export default function NewUserDashboard({ user, diagPause, onStart }) {
  const { theme: THEME } = useTheme();
  const hasPartial = !!user?.smartDiagNextSection || !!diagPause;
  const ctaLabel = diagPause
    ? `Продолжить с вопроса ${diagPause.qNum + 1} →`
    : user?.smartDiagNextSection
    ? `Продолжить — раздел ${user.smartDiagNextSection} →`
    : 'Пройти диагностику →';

  const perks = [
    ['🎯', 'Адаптивные вопросы', 'сложность подстраивается под твои ответы'],
    ['🗺️', 'Персональный план', 'маршрут по навыкам именно для тебя'],
    ['🎁', 'Бесплатно', 'диагностика не тратит ни кристалла'],
  ];

  return (
    <div style={{ maxWidth: 760, margin: '4vh auto 0', padding: '0 8px' }}>
      <div className="dashboard-section" style={{
        padding: 'clamp(36px, 6vw, 64px) clamp(24px, 5vw, 56px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(150deg, ${THEME.primary} 0%, #1e1b4b 60%, #312e81 100%)`,
        border: '1px solid rgba(212,175,55,0.3)',
        boxShadow: '0 20px 60px -16px rgba(15,23,42,0.5)',
      }}>
        {/* декоративная мишень в углу */}
        <div aria-hidden="true" style={{ position: 'absolute', right: -30, top: -30, fontSize: 200, opacity: 0.05, lineHeight: 1, pointerEvents: 'none' }}>🎯</div>

        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 18 }}>🚀</div>
        <h1 style={{
          fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: '#fff',
          fontSize: 'clamp(26px, 4.5vw, 40px)', letterSpacing: '-0.5px', margin: '0 0 14px',
        }}>
          {hasPartial ? 'Продолжим диагностику' : 'Начнём с диагностики'}
        </h1>
        <p style={{ fontSize: 'clamp(15px, 2vw, 17px)', color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, maxWidth: 480, margin: '0 auto 28px' }}>
          {hasPartial
            ? 'Ты уже начал — осталось немного. Доведи диагностику до конца, и мы построим твой план обучения.'
            : 'За 15 минут мы определим твой уровень и построим план обучения — после этого здесь появятся рейтинг, корабль прогресса и задания.'}
        </p>

        <button onClick={onStart} style={{
          background: THEME.accent, color: THEME.onAccent ?? '#0f172a', border: 'none', borderRadius: 14,
          padding: '18px 44px', fontFamily: "'Montserrat',sans-serif", fontWeight: 800,
          fontSize: 'clamp(16px, 2.2vw, 19px)', cursor: 'pointer',
          boxShadow: '0 10px 32px -6px rgba(212,175,55,0.6)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px -6px rgba(212,175,55,0.75)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 10px 32px -6px rgba(212,175,55,0.6)'; }}
        >{ctaLabel}</button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(14px, 3vw, 32px)', marginTop: 34, flexWrap: 'wrap' }}>
          {perks.map(([icon, t, s]) => (
            <div key={t} style={{ maxWidth: 180, textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: '#fff', fontFamily: "'Montserrat',sans-serif" }}>✓ {t}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 1.5 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: THEME.textLight, marginTop: 16 }}>
        Рейтинг, корабль прогресса и задания откроются после диагностики ✨
      </p>
    </div>
  );
}
