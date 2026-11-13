import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 自動清理舊版 Service Worker 快取池，避免快取到舊版 Vite 依賴 chunk 造成 React 雙實例衝突
if (typeof window !== 'undefined') {
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => {
          if (key !== 'tabi-amazing-travel-v4') {
            caches.delete(key).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((reg) => reg.unregister().catch(() => {}));
      })
      .catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

