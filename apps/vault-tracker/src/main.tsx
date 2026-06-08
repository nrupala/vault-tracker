import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ensureStartupSnapshot } from './lib/core/db'
import './index.css'

// P0 data-safety: guarantee a recent pre-session rescue snapshot exists before the
// app mutates data or a schema upgrade runs. Fire-and-forget; never blocks render.
ensureStartupSnapshot().catch((e) => console.error('Startup rescue snapshot failed', e));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
