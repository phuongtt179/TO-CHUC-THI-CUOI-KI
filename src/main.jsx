import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'text-sm font-medium',
        style: {
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        },
        success: {
          iconTheme: { primary: '#10b981', secondary: '#fff' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#fff' },
        },
      }}
    />
  </StrictMode>
)
