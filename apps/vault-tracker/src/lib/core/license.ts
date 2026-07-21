/**
 * Licensing / entitlement — P0 gate.
 *
 * Free tier:  FREE_LIMIT_PER_MODULE items per module (note / task / habit / expense).
 * Paid ("pro"): unlimited — bounded only by the device/browser's storage.
 *
 * This is an HONEST-UX gate for a local-first app (same model as Obsidian /
 * Standard Notes offline): enforcement lives client-side because there is no
 * server. A real offline Ed25519-signed license token will be *verified* here in
 * Phase 3; for now the presence of a well-formed token in localStorage flips the
 * entitlement to 'pro'. Keep this module the SINGLE source of truth for the gate.
 */

export type Entitlement = 'free' | 'pro';
export type ModuleType = 'note' | 'task' | 'habit' | 'expense';

/** Free-plan cap, per module (not per vault). */
export const FREE_LIMIT_PER_MODULE = 100;

const LICENSE_STORAGE_KEY = 'vt_license_token';

/** Thrown by createItem when a free-tier user hits the per-module cap. */
export class LicenseLimitError extends Error {
  readonly moduleType: ModuleType;
  readonly limit: number;
  constructor(moduleType: ModuleType, limit: number) {
    super(
      `Free plan limit reached: ${limit} ${moduleType}s in this module. ` +
        `Upgrade for unlimited entries (bounded only by your device storage).`
    );
    this.name = 'LicenseLimitError';
    this.moduleType = moduleType;
    this.limit = limit;
  }
}

/**
 * Current entitlement.
 * Phase 3 TODO: replace the presence check with offline Ed25519 signature
 * verification of the license token (public key baked into the build).
 */
export function getEntitlement(): Entitlement {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) return 'free';
    const token = JSON.parse(raw) as { plan?: string } | null;
    if (token && typeof token === 'object' && token.plan === 'pro') return 'pro';
    return 'free';
  } catch {
    return 'free';
  }
}

export function isPro(): boolean {
  return getEntitlement() === 'pro';
}

/**
 * Fired when a free-tier user hits the per-module cap so a global UI listener can
 * show the upgrade prompt regardless of which module triggered it.
 */
export function emitLimitReached(moduleType: ModuleType, limit: number): void {
  try {
    window.dispatchEvent(
      new CustomEvent('vault-limit-reached', { detail: { moduleType, limit } })
    );
  } catch {
    /* non-browser context — ignore */
  }
}
