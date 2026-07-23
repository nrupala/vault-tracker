import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check } from 'lucide-react';
import type { ModuleType } from '../lib/core/license';

/**
 * TODO(store): replace with the real LemonSqueezy checkout URL once the store and
 * the "$29 one-time Pro" variant exist. Pricing decided 2026-07-22: $29 one-time
 * (perpetual license, not a subscription). The offline Ed25519 license check lands
 * in Phase 3 (see lib/core/license.ts).
 */
const LEMONSQUEEZY_CHECKOUT_URL = 'https://vault-tracker.lemonsqueezy.com/buy/REPLACE_WITH_VARIANT_ID';
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

            <div className="flex gap-3 pt-1">
              <button
                onClick={close}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Maybe later
              </button>
              <a
                href={LEMONSQUEEZY_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-center"
              >
                Upgrade — {PRO_PRICE_LABEL}
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
