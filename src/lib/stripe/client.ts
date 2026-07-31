import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Returns a configured Stripe client, or null when STRIPE_SECRET_KEY is not set
 * (dev / mock mode). Callers must treat a null return as "Stripe not configured".
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (cached) return cached;
  cached = new Stripe(key);
  return cached;
}

/** True when a live Stripe secret key is configured. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
