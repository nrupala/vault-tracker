// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check } from 'lucide-react';
import type { ModuleType } from '../lib/core/license';
import { activatePro, isPro } from '../lib/core/license';

/**
 * Upgrade target is selected by build channel (F-1 rewire, 2026-10-26 —
 * the fleet runs on Stripe; there is no Lemon Squeezy store. Design:
 * channel-wiring F1-REWIRE-DESIGN.md §3):
 * - 'play' builds (Google Play): NO web checkout — Play policy requires
 *   Play Billing for digital goods, and the Play Billing bridge is a
 *   listing-work item. Until it lands, the Play build shows the Pro
 *   terms plus activation-code entry only; a code bought through the
 *   direct channel activates Pro in every build.
 * - 'direct' builds (GitHub Pages web, direct APK/Electron): the fleet
 *   Stripe Payment Link for Vault Tracker Pro — $29 one-time (perpetual
 *   licence, not a subscription; pricing decided 2026-07-22). After
 *   payment Stripe lands the buyer on the activation page, which shows
 *   the activation code to enter below (see lib/core/license.ts). The
 *   offline Ed25519 licence check lands in Phase 3.
 * VITE_BUILD_CHANNEL is set by the build workflows (deploy-pages.yml
 * builds 'direct'; android-release.yml builds 'play'). Unset = direct.
 */
const BUILD_CHANNEL = import.meta.env.VITE_BUILD_CHANNEL ?? 'direct';
const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/3cI4gzaWC4cg5uL9r09Zm0g';
const PRO_PRICE_LABEL = '$29 one-time';

const MODULE_LABELS: Record<ModuleType, string> = {
  note: 'notes',
  task: 'tasks',
  habit: 'habits',
  expense: 'expenses',
};

interface LimitDetail {
  moduleType: ModuleType;
  limit: number;
}

/**
 * Global upgrade prompt. Mount once inside <VaultProvider>. Opens whenever the
 * license gate dispatches a `vault-limit-reached` CustomEvent (fired from
 * useItems.createItem when a free-tier user hits the per-module cap).
 */
export function UpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<LimitDetail | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [activationNote, setActivationNote] = useState<string | null>(null);
  const [proActive, setProActive] = useState(false);

  const tryActivate = () => {
    if (activatePro(activationCode)) {
      setProActive(true);
      setActivationNote(null);
    } else {
      setActivationNote('That code does not look complete — paste the full code from your post-payment page.');
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<LimitDetail>).detail;
      if (d) setDetail(d);
      setOpen(true);
    };
    window.addEventListener('vault-limit-reached', handler);
    return () => window.removeEventListener('vault-limit-reached', handler);
  }, []);

  const moduleLabel = detail ? MODULE_LABELS[detail.moduleType] ?? `${detail.moduleType}s` : 'items';
  const limit = detail?.limit ?? 100;

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[220] flex items-end sm:items-center justify-center p-4"
          onClick={close}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl shrink-0 bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base mb-1">You've reached the free limit</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The free plan includes {limit} {moduleLabel} per module. Upgrade to Pro for
                  unlimited entries — limited only by your device's storage.
                </p>
              </div>
              <button onClick={close} className="p-1 rounded-lg hover:bg-secondary transition-colors shrink-0">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <ul className="space-y-2">
              {[
                'Unlimited entries in every module',
                'One-time payment — yours forever, no subscription',
                'Same zero-knowledge, on-device encryption',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {proActive || isPro() ? (
              <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-center">
                Pro is active on this device — unlimited entries unlocked.
              </div>
            ) : (
              <>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={close}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    Maybe later
                  </button>
                  {BUILD_CHANNEL === 'play' ? (
                    <div className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-secondary/60 text-center">
                      Pro unlocks via Google Play
                    </div>
                  ) : (
                    <a
                      href={STRIPE_CHECKOUT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-center"
                    >
                      Upgrade — {PRO_PRICE_LABEL}
                    </a>
                  )}
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Already paid? Enter the activation code from your post-payment page
                    (it is also in your Stripe receipt trail):
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value)}
                      placeholder="Activation code"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm bg-secondary/60 border border-border"
                    />
                    <button
                      onClick={tryActivate}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      Activate
                    </button>
                  </div>
                  {activationNote && <p className="text-xs text-destructive">{activationNote}</p>}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
