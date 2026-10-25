// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Pro checkout — the SINGLE source of truth for where the upgrade action leads.
 *
 * Owner ruling 2026-10-22: Vault Tracker sells Pro through the fleet's own
 * AIMLDS Stripe gateway (a Stripe Payment Link on the shared AIMLDS Stripe
 * account), never a third-party checkout. No Vault Tracker payment link
 * exists yet — creating one is a billing-lane act (a live Stripe object).
 * Until the link exists, PRO_CHECKOUT_URL stays null and the upgrade prompt
 * renders NO checkout action at all: a dead or placeholder checkout link is
 * a Play payments-policy rejection risk and a broken promise to the user.
 *
 * To open checkout: set PRO_CHECKOUT_URL to the live Stripe Payment Link
 * (https://buy.stripe.com/…) created for Vault Tracker Pro. Nothing else
 * changes — the prompt and the tests all read from here.
 */

/** Live Stripe Payment Link for Vault Tracker Pro, or null while checkout is closed. */
export const PRO_CHECKOUT_URL: string | null = null;

/** Price shown on the upgrade action. Decided 2026-07-22: $29 one-time (perpetual). */
export const PRO_PRICE_LABEL = '$29 one-time';

/**
 * The URL the upgrade action must lead to, or null when no checkout may be
 * offered. Anything that is not an https URL is treated as "closed" — a
 * misconfiguration fails safe (no action offered), never a dead link.
 */
export function getProCheckoutUrl(): string | null {
  return PRO_CHECKOUT_URL !== null && PRO_CHECKOUT_URL.startsWith('https://') ? PRO_CHECKOUT_URL : null;
}
