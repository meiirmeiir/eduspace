import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import { NpcProvider } from './NpcContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import './index.css'

// Apply saved light theme before first render (BUG-4)
try {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <NpcProvider>
          <App />
        </NpcProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
