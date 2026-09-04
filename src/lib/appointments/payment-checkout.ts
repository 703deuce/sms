import "server-only";

/**
 * @deprecated Use merchant-payments service — this module delegates to Stripe Connect.
 * Platform SaaS billing remains in src/lib/payments/stripe-billing-webhook.ts
 */
import type { PaymentRequirement } from "@/lib/appointments/types";
import { resolvePaymentProvider } from "@/lib/merchant-payments/amounts";
import { createMerchantAppointmentPayment } from "@/lib/merchant-payments/service";
import { MERCHANT_PAYMENT_TRANSACTION_TYPE } from "@/lib/merchant-payments/types";
import { handleStripeConnectCheckoutCompleted } from "@/lib/merchant-payments/stripe-connect";

export type AppointmentCheckoutInput = {
  workspaceId: string;
  appointmentId: string;
  payment: PaymentRequirement;
  customerEmail?: string;
  description?: string;
  idempotencyKey?: string;
};

export async function createAppointmentCheckoutSession(input: AppointmentCheckoutInput) {
  const provider = resolvePaymentProvider(input.payment);
  if (!provider) {
    return {
      configured: false,
      url: null,
      sessionId: null,
      error: "No payment provider configured on this appointment type",
    };
  }

  const result = await createMerchantAppointmentPayment({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    payment: {
      mode: input.payment.mode as "deposit" | "full",
      priceCents: input.payment.priceCents || 0,
      depositCents: input.payment.depositCents,
      depositPercent: input.payment.depositPercent,
      currency: input.payment.currency,
      provider,
    },
    customerEmail: input.customerEmail,
    description: input.description,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    configured: result.configured,
    url: result.checkoutUrl,
    sessionId: result.sessionId,
    square: result.square,
    paymentRecordId: result.paymentRecordId,
    provider: result.provider,
    error: result.error,
  };
}

export async function markAppointmentPaid(
  workspaceId: string,
  appointmentId: string,
  amountCents: number,
  stripeSessionId: string,
) {
  const { markAppointmentPaymentSucceeded } = await import("@/lib/merchant-payments/appointment-lifecycle");
  const { getPaymentByAppointment } = await import("@/lib/merchant-payments/payment-record-store");
  const record = await getPaymentByAppointment(workspaceId, appointmentId);
  return markAppointmentPaymentSucceeded(
    workspaceId,
    appointmentId,
    record || {
      id: "",
      workspaceId,
      appointmentId,
      provider: "STRIPE",
      status: "pending",
      paymentMode: "full",
      currency: "usd",
      totalPriceCents: amountCents,
      amountDueCents: amountCents,
      amountPaidCents: 0,
      balanceDueCents: 0,
      providerPaymentId: null,
      providerSessionId: stripeSessionId,
      idempotencyKey: null,
      refundAmountCents: 0,
      refundStatus: null,
      paidAt: null,
      metadata: null,
    },
    stripeSessionId,
    amountCents,
  );
}

export function isAppointmentCheckoutMetadata(metadata: Record<string, string | undefined>) {
  return metadata.transaction_type === MERCHANT_PAYMENT_TRANSACTION_TYPE;
}

export async function handleAppointmentCheckoutCompleted(
  session: { id: string; metadata?: Record<string, string | null | undefined> | null; amount_total?: number | null; payment_intent?: string | null },
) {
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  if (metadata.transaction_type === MERCHANT_PAYMENT_TRANSACTION_TYPE) {
    return handleStripeConnectCheckoutCompleted(session);
  }
  // Legacy platform-account appointment checkouts (pre-Connect migration)
  if (metadata.appointmentId && metadata.paymentMode && !metadata.transaction_type) {
    const appointmentId = metadata.appointmentId;
    const workspaceId = metadata.workspaceId;
    if (!appointmentId || !workspaceId) return { handled: false, skipped: true };
    const amountCents = session.amount_total ?? Number(metadata.paymentAmountCents || 0);
    await markAppointmentPaid(workspaceId, appointmentId, amountCents, session.id);
    return { handled: true, appointmentId, workspaceId };
  }
  return { handled: false, skipped: true };
}

export async function handleAppointmentCheckoutExpired(
  workspaceId: string,
  appointmentId: string,
) {
  const { expirePendingPaymentAppointment } = await import("@/lib/merchant-payments/appointment-lifecycle");
  await expirePendingPaymentAppointment(workspaceId, appointmentId);
}
