#!/bin/bash

# ==============================================================================
# Sovereign Vault v2.0 - Universal Packager
# Generates a Progressive Web App (PWA) and scaffolding for Android APK
# ==============================================================================

set -e

echo "🔒 Initializing Sovereign E2EE Packager..."

# Ensure we're in the v2-prototype directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: Please run this script from inside the v2-prototype/ directory."
    exit 1
fi

echo "📦 1. Verifying PWA Assets..."
if [ ! -f "manifest.json" ] || [ ! -f "sw.js" ]; then
    echo "❌ Error: PWA manifest.json or sw.js missing."
    exit 1
else
    echo "  ✓ manifest.json found."
    echo "  ✓ sw.js found."
fi

echo "📦 2. Preparing Android APK / Capacitor Workspace..."

# Instead of polluting the native ES project root, we create an APK wrapper zone
WRAPPER_DIR=".apk-wrapper"

if [ -d "$WRAPPER_DIR" ]; then
    echo "  ! Cleaning existing APK wrapper..."
    rm -rf "$WRAPPER_DIR"
fi

mkdir "$WRAPPER_DIR"
cd "$WRAPPER_DIR"

echo "  -> Initializing npm wrapper..."
npm init -y > /dev/null 2>&1

echo "  -> Installing Capacitor dependencies locally..."
npm install @capacitor/core > /dev/null 2>&1
npm install -D @capacitor/cli @capacitor/android > /dev/null 2>&1

echo "  -> Initializing Capacitor Web-to-Mobile..."
npx cap init "Sovereign Vault" "com.sovereign.vault" --web-dir ../ > /dev/null 2>&1

echo "  -> Attaching Android platform bindings..."
npx cap add android > /dev/null 2>&1

# Disable Capacitor sync from failing on missing standard web folder, sync it explicitly
echo "  -> Syncing static assets into Android shell..."
npx cap sync android > /dev/null 2>&1

cd ..

echo "=============================================================================="
echo "✅ Packaging Complete!"
echo " "
echo "🌐 PWA Deployment:"
echo "   Simply serve the /v2-prototype directory directly. The service worker and"
echo "   manifest are already fully integrated."
echo " "
echo "📱 Android Deployment:"
echo "   1. cd v2-prototype/.apk-wrapper"
echo "   2. npx cap open android   (To build APK via Android Studio)"
echo "   -- OR --"
echo "   2. cd android && ./gradlew assembleDebug (To build instantly from terminal)"
echo "=============================================================================="
