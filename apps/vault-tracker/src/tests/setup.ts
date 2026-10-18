// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import '@testing-library/jest-dom';

// Mock Web Crypto if needed (jsdom doesn't support it fully in all environments)
// However, modern Node has it on globalThis.crypto
if (!globalThis.crypto) {
  const { webcrypto } = require('node:crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}
