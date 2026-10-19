import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

// Single source of truth for the app version: this package.json.
// Injected into the bundle as __APP_VERSION__ so every in-app version
// display (About page, shell, unlock screen) renders the shipped
// version. scripts/check-version.mjs fails the build if package.json,
// the Gradle versionName, and the built assets ever disagree again.
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
)

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative base so it works on GitHub Pages subpaths like /vault-tracker/
  base: process.env.VITE_BASE_URL || './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'generateSW',
      workbox: {
        // Precache all Vite build output so the app works fully offline on iOS
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Cache-first for static assets, network-first for navigation
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.+\/api\//i,
            handler: 'NetworkFirst',
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: false, // We maintain our own manifest.json in /public
      devOptions: {
        enabled: false, // Don't run SW in dev mode (breaks HMR)
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
