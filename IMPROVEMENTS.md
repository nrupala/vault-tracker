# 🚀 Vault Tracker: Technical Improvements & Hardening

To ensure production stability and zero-vulnerability status, the following improvements are prioritized for deployment.

---

## 🛡️ Security & Deprecations
- [ ] **Patch Legacy Glob**: Update `glob` to `v10+` to resolve reported security vulnerabilities in the file-matching logic.
- [ ] **Eslint Migration**: Transition to `@eslint/config-array` and `@eslint/object-schema` to eliminate deprecation warnings in the build pipeline.
- [ ] **Rimraf Upgrade**: Update `rimraf` to `v5+` for better performance and support.
- [ ] **Dependency Audit**: Run `pnpm audit fix` to resolve high-risk CVEs in the underlying utility libraries.

## 🧱 Code Consistency & Architecture
- [ ] **Uniform Lockfiles**: Remove all `package-lock.json` files and standardize on `pnpm-lock.yaml` across the entire fleet to prevent build-time "frozen-lockfile" errors.
- [ ] **Shared Component Library**: (Long-term) Extract `AppShell`, `ThemeProvider`, and `IntelligenceEngine` into a shared internal package to eliminate "copy-paste" sync errors.
- [ ] **Strict Typing**: Finalize absolute type safety in `useItems` and `useVoiceCommands` to prevent runtime crashes during data sync.

## 🌐 Integrations (Sovereign Webhooks)
- [ ] **Public-Key Inbound Support**: Allow external scripts (e.g., a "Mail-to-Vault" bridge) to write encrypted items to a shared folder.
- [ ] **Inbox Sweeper**: Automatically scan for new external blobs on startup and import them into the vault.
- [ ] **Tokenized Access**: Allow specific tokens for specific providers to post data without full vault access.

## 🔄 Resilience & Failsafes
- [ ] **Failsafe Migration Engine**: Automated pre-upgrade snapshots. If a schema migration fails, the vault automatically rolls back to the previous stable state.
- [ ] **Item-Level Versioning**: Implement a version history for every task, note, and expense to enable "Time Travel" recovery and conflict resolution during sync.
- [ ] **Integrity Checks**: Post-sync validation to ensure decrypted Blobs match the source checksums perfectly.
