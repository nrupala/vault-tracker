import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nrupal.vaulttracker',
  appName: 'Vault Tracker',
  webDir: 'dist',
  plugins: {
    // DB-1 spike: enable the community SQLite plugin's SQLCipher mode on
    // Android. The database passphrase is a per-device random secret set by
    // the app via setEncryptionSecret(); the plugin stores it in
    // EncryptedSharedPreferences wrapped by an Android Keystore master key.
    // Nothing reads this config until the plugin is actually called.
    CapacitorSQLite: {
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Log in using your biometric',
        biometricSubTitle: 'Log in using your biometric',
      },
    },
  },
};

export default config;
