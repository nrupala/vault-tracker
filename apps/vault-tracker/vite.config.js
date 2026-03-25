import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
// https://vitejs.dev/config/
export default defineConfig({
    // Use relative base so it works on GitHub Pages subpaths like /vault-tracker/
    base: '',
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
});
