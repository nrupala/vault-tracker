// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRO_CHECKOUT_URL, PRO_PRICE_LABEL, getProCheckoutUrl } from '../lib/core/checkout';

describe('pro checkout seam (lib/core/checkout)', () => {
  it('ships with checkout closed: no URL configured, no action offered', () => {
    // No Vault Tracker Stripe Payment Link exists yet (creating one is a
    // billing-lane act). Until it does, the seam must report "closed" so the
    // upgrade prompt renders no checkout action at all.
    expect(PRO_CHECKOUT_URL).toBeNull();
    expect(getProCheckoutUrl()).toBeNull();
  });

  it('carries the decided price label ($29 one-time, decided 2026-07-22)', () => {
    expect(PRO_PRICE_LABEL).toBe('$29 one-time');
  });

  it('no placeholder or third-party checkout reference remains in the shipped source', () => {
    const srcRoot = fileURLToPath(new URL('..', import.meta.url));
    const banned = ['REPLACE_WITH_VARIANT_ID', 'lemonsqueezy', 'LemonSqueezy', 'LEMONSQUEEZY'];
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) return entry === 'tests' ? [] : walk(p);
        return [p];
      });
    for (const file of walk(srcRoot)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const token of banned) {
        expect(text, `${file} must not contain "${token}"`).not.toContain(token);
      }
    }
  });
});
