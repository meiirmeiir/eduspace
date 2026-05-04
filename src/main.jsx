import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import { NpcProvider } from './NpcContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

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
