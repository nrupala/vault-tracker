# 🚢 Deployment & Installation Guide

Vault Tracker can be deployed as an infinitely scaling static site since it has no backend.

## 🌐 Web Deployment (Vercel / Netlify / GitHub Pages)

1. **Build**: Run `npm run build`.
2. **Deploy**: Upload the `dist/` folder to your chosen host.
3. **PWA**: Once hosted, your browser will recognize the `manifest.json`. 

### iOS Installation (iPhone/iPad)
1. Open your hosted URL in **Safari**.
2. Tap the **Share** button (box with an upward arrow).
3. Select **"Add to Home Screen"**.
4. Launch "Vault" from your springboard for a standalone experience.

## 📱 Android Packaging (Capacitor)

Vault Tracker is pre-configured with Capacitor.

1. **Build Web Assets**: `npm run build`.
2. **Sync Native Projects**: `npx cap sync android`.
3. **Build APK**:
   - Open in Android Studio: `npx cap open android`.
   - Go to `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
   - Your APK will be located in `android/app/build/outputs/apk/debug/`.

## 💻 Local Development

1. **Install**: `npm install`
2. **Start Dev Server**: `npm run dev`
3. **Tests**: `npm test` or `npm run test:ui` for graphical test feedback.

## 💾 Backup & Data Safety

Since data is stored in the browser's **IndexedDB**, it is linked to the specific browser application.
- **Warning**: Clearing site data or "factory resetting" your browser will delete the vault.
- **Recommendation**: Use the **Export** feature in the Settings sidebar to periodically save encrypted backups (JSON/CSV) to an external drive.
