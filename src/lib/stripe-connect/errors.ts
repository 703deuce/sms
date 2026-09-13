/** Normalized Stripe Text-to-Pay errors — ST-ERR-001 */
export type StripeTextToPayErrorCode =
  | "STRIPE_AUTH_REQUIRED"
  | "STRIPE_ACCOUNT_DISCONNECTED"
  | "STRIPE_ACCOUNT_NOT_PAYMENT_READY"
  | "STRIPE_CAPABILITY_INACTIVE"
  | "STRIPE_INVALID_CONNECTED_ACCOUNT"
  | "STRIPE_CHECKOUT_CREATE_FAILED"
  | "STRIPE_PAYMENT_PROCESSING"
  | "STRIPE_PAYMENT_FAILED"
  | "STRIPE_RATE_LIMITED"
  | "STRIPE_PROVIDER_UNAVAILABLE"
  | "STRIPE_MODE_MISMATCH"
  | "STRIPE_UNKNOWN";

export class StripeTextToPayError extends Error {
  code: StripeTextToPayErrorCode;
  retryable: boolean;

  constructor(code: StripeTextToPayErrorCode, message: string, opts?: { retryable?: boolean }) {
    super(message);
    this.code = code;
    this.retryable = opts?.retryable ?? false;
  }
}

export function normalizeStripeSdkError(err: unknown, op: string): StripeTextToPayError {
  const message = err instanceof Error ? err.message : String(err);
  if (/rate.?limit/i.test(message)) {
    return new StripeTextToPayError("STRIPE_RATE_LIMITED", `${op}: rate limited`, { retryable: true });
  }
  if (/not connected|no such account|account_invalid/i.test(message)) {
    return new StripeTextToPayError("STRIPE_INVALID_CONNECTED_ACCOUNT", message);
  }
  if (/charges_enabled|cannot accept payments|onboarding/i.test(message)) {
    return new StripeTextToPayError("STRIPE_ACCOUNT_NOT_PAYMENT_READY", message);
  }
  return new StripeTextToPayError("STRIPE_UNKNOWN", `${op}: ${message.slice(0, 200)}`);
}
