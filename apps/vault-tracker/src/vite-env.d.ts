/// <reference types="vite/client" />

/** App version injected at build time from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Build channel: 'direct' (fleet Stripe checkout) or 'play' (Google Play build — no web checkout). Set by the build workflows (F-1 rewire, 2026-10-26). */
  readonly VITE_BUILD_CHANNEL?: string;
}
