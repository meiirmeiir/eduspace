import React from 'react';

// Глобальный error boundary: ловит краши рендера/lifecycle в дочернем дереве и
// показывает дружелюбный экран вместо белого. Стили self-contained (boundary
// стоит выше ThemeProvider, поэтому не зависит от темы/контекстов).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: '#0f172a', fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{
          maxWidth: 420, width: '100%', textAlign: 'center', background: '#fff',
          borderRadius: 18, padding: '40px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😕</div>
          <h1 style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 22, fontWeight: 800,
            color: '#0f172a', margin: '0 0 10px',
          }}>
            Что-то пошло не так
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#64748b', margin: '0 0 24px' }}>
            Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу — обычно это помогает.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#0f172a', color: '#d4af37', border: 'none', borderRadius: 10,
              padding: '13px 32px', fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
              fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px -5px rgba(10,25,47,0.3)',
            }}
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
