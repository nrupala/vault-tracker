// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ensureStartupSnapshot, initStorage } from './lib/core/db'
import './index.css'

// Storage init (v1.2.0): open the SQLite store and, if legacy Dexie data
// exists, run the verified one-time migration. Fire-and-forget; never blocks
// render — the storage facade awaits init internally before serving calls,
// and on any failure the app stays on the legacy store with a visible error.
initStorage()
  .catch((e) => console.error('Storage init failed', e))
  // P0 data-safety: guarantee a recent pre-session rescue snapshot exists before the
  // app mutates data or a schema upgrade runs.
  .finally(() => ensureStartupSnapshot().catch((e) => console.error('Startup rescue snapshot failed', e)));

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
