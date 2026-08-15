/**
 * Isolated payment gate for number purchases.
 * Replace testPaymentProvider.confirm with stripePaymentProvider.confirm later —
 * number provisioning orchestration stays unchanged.
 */

export type NumberPaymentConfirmInput = {
  workspaceId: string;
  userId: string;
  reservationId: string;
  phoneNumber: string;
  amountCents: number;
  idempotencyKey: string;
};

export type NumberPaymentConfirmResult = {
  ok: true;
  paymentId: string;
  provider: string;
};

export type NumberPaymentProvider = {
  readonly name: string;
  confirm(input: NumberPaymentConfirmInput): Promise<NumberPaymentConfirmResult>;
};

export const testPaymentProvider: NumberPaymentProvider = {
  name: "test",
  async confirm(input) {
    return {
      ok: true,
      paymentId: `test_pay_${input.idempotencyKey}`,
      provider: "test",
    };
  },
};

/** Placeholder — real Stripe integration lands here later. */
export const stripePaymentProvider: NumberPaymentProvider = {
  name: "stripe",
  async confirm(_input) {
    throw new Error("Stripe number checkout is not enabled yet");
  },
};

function isExplicitTestPaymentAllowed(): boolean {
  const mode = process.env.NUMBER_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (mode === "test") return true;
  if (mode === "stripe") return false;
  // Never allow silent free purchases in production.
  if (process.env.NODE_ENV === "production") return false;
  // Dev/staging: test mode when unset (launch gate uses explicit NUMBER_PAYMENT_PROVIDER=test).
  return mode === "" || mode === "mock";
}

export function getNumberPaymentProvider(): NumberPaymentProvider {
  const mode = process.env.NUMBER_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (mode === "stripe") return stripePaymentProvider;
  if (mode === "test" || isExplicitTestPaymentAllowed()) return testPaymentProvider;
  throw new Error(
    "Number purchases require NUMBER_PAYMENT_PROVIDER=test or stripe. Test payment is disabled in production.",
  );
}

export function isNumberTestPaymentMode(): boolean {
  return getNumberPaymentProvider().name === "test";
}
