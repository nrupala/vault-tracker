// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { getEntitlement, isPro, activatePro } from '@/lib/core/license';

describe('Licence activation (Stripe direct channel, F-1 rewire)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the free tier with no token', () => {
    expect(getEntitlement()).toBe('free');
    expect(isPro()).toBe(false);
  });

  it('rejects a too-short code and stays free', () => {
    expect(activatePro('cs_shor')).toBe(false);
    expect(getEntitlement()).toBe('free');
  });

  it('activates Pro with a checkout-session-shaped code and stores it on the token', () => {
    const code = 'cs_live_a1b2c3d4e5f6g7h8i9j0';
    expect(activatePro(code)).toBe(true);
    expect(getEntitlement()).toBe('pro');
    expect(isPro()).toBe(true);
    const token = JSON.parse(localStorage.getItem('vt_license_token') || '{}');
    expect(token.plan).toBe('pro');
    expect(token.activatedWith).toBe(code);
  });

  it('ignores a malformed stored token', () => {
    localStorage.setItem('vt_license_token', '{"plan":"enterprise"}');
    expect(getEntitlement()).toBe('free');
  });
});
