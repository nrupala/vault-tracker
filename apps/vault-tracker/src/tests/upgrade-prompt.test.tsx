// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// The configured destination, as it will be once the billing lane creates
// Vault Tracker's Stripe Payment Link and sets it in lib/core/checkout.ts.
vi.mock('../lib/core/checkout', () => ({
  PRO_CHECKOUT_URL: 'https://buy.stripe.com/vault_tracker_pro_test',
  PRO_PRICE_LABEL: '$29 one-time',
  getProCheckoutUrl: () => 'https://buy.stripe.com/vault_tracker_pro_test',
}));

import { UpgradePrompt } from '../components/UpgradePrompt';

describe('UpgradePrompt — checkout configured', () => {
  afterEach(() => cleanup());

  it('the upgrade action reaches the configured destination', async () => {
    render(<UpgradePrompt />);
    fireEvent(
      window,
      new CustomEvent('vault-limit-reached', { detail: { moduleType: 'note', limit: 100 } }),
    );
    const link = await screen.findByRole('link', { name: /Upgrade/ });
    expect(link.getAttribute('href')).toBe('https://buy.stripe.com/vault_tracker_pro_test');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
