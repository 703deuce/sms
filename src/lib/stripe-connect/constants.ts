/**
 * Canonical Stripe Connect charge model for Transovo Text-to-Pay.
 * @see docs/runtime-rules/providers/STRIPE-CONNECT-TEXT-TO-PAY-RULES.md ST-CHG-001
 */
export const STRIPE_TEXT_TO_PAY_CHARGE_MODEL = "direct" as const;

export type StripeTextToPayChargeModel = typeof STRIPE_TEXT_TO_PAY_CHARGE_MODEL;

/** Server API calls use platform secret key + stripeAccount option (Stripe-Account header). ST-AUTH-001 */
export const STRIPE_CONNECTED_ACCOUNT_AUTH_MODE = "platform_key_stripe_account_header" as const;

/** ST-PAY-001 — webhook authority; success URL is not payment proof */
export function isCheckoutSessionPaid(session: { payment_status?: string | null }): boolean {
  return session.payment_status === "paid";
}
