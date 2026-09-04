/**
 * Entitlement-ready capability keys for merchant appointment payments.
 * Not wired to billing plans yet — all return true by default.
 */
export const MERCHANT_PAYMENT_CAPABILITY_KEYS = {
  merchantPayments: "appointments.merchant.payments",
  stripeConnect: "appointments.merchant.stripe_connect",
  squareConnect: "appointments.merchant.square_connect",
  deposits: "appointments.merchant.deposits",
  fullPayment: "appointments.merchant.full_payment",
  refunds: "appointments.merchant.refunds",
} as const;

export type MerchantPaymentCapabilityKey =
  (typeof MERCHANT_PAYMENT_CAPABILITY_KEYS)[keyof typeof MERCHANT_PAYMENT_CAPABILITY_KEYS];

export function hasMerchantPaymentCapability(
  _workspaceId: string,
  _capability: MerchantPaymentCapabilityKey,
): boolean {
  return true;
}
