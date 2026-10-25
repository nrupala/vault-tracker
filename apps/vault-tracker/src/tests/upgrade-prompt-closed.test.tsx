// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// No mock: this exercises the REAL lib/core/checkout module in its shipped
// state (checkout closed — no Vault Tracker payment link exists yet).
import { UpgradePrompt } from '../components/UpgradePrompt';

describe('UpgradePrompt — checkout closed (shipped default)', () => {
  afterEach(() => cleanup());

  it('offers no checkout link at all — no dead or placeholder CTA', async () => {
    render(<UpgradePrompt />);
    fireEvent(
      window,
      new CustomEvent('vault-limit-reached', { detail: { moduleType: 'task', limit: 100 } }),
    );
    expect(await screen.findByText(/reached the free limit/)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
