import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { NpcProvider } from './NpcContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import './index.css'

// BUG-13: apply saved dark theme before first render.
// Default = light (no attribute). data-theme="dark" activates the
// filter:invert dark mode from MapStyles.css.
try {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <NpcProvider>
        <App />
      </NpcProvider>
    </AuthProvider>
  </React.StrictMode>,
)
