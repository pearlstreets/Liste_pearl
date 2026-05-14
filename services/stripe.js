/**
 * Stripe payment service for Pearl List
 *
 * Flow:
 *   1. processPayment({ amountCents, currency }) → POST /payment/user-payment/
 *      Backend creates PaymentIntent, returns clientSecret.
 *   2. stripe.confirmPayment(clientSecret, { paymentMethodType: 'Card' })
 *      SDK handles SCA/3DS natively.
 *
 * Card management:
 *   saveCard(paymentMethodId) → POST /payment/cards/save/
 *   getSavedCards()           → GET  /payment/get-cards/
 */

import { apiPost, apiGet } from './api';

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// ─── Payment processing ────────────────────────────────────────────────────────

/**
 * Create a PaymentIntent on the backend and return its clientSecret.
 * @param {number} amountCents - Amount in smallest currency unit (e.g. 1099 for €10.99)
 * @param {string} currency    - ISO 4217 lowercase (default: 'eur')
 */
export async function processPayment({ amountCents, currency = 'eur' }) {
  const res = await apiPost('/payment/user-payment/', {
    amountCents,
    currency,
  });
  return res;
}

// ─── Card management ───────────────────────────────────────────────────────────

export async function saveCard(paymentMethodId) {
  try {
    const res = await apiPost('/payment/cards/save/', {
      stripe_payment_method_id: paymentMethodId,
    });
    return res;
  } catch (_) { return null; }
}

export async function getSavedCards() {
  try {
    const res = await apiGet('/payment/get-cards/');
    return res?.cards || res?.data || [];
  } catch (_) { return []; }
}
