import "server-only";

import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { createId } from "@/lib/supabase/id";
import {
  getDecryptedAccessToken,
  getMerchantConnection,
  upsertMerchantConnection,
  type ConnectionRecord,
} from "./connection-store";
import { MERCHANT_PAYMENT_TRANSACTION_TYPE } from "./types";
import type { CreateMerchantPaymentInput, MerchantPaymentResult } from "./types";
import { calculatePaymentAmounts } from "./amounts";
import { createPaymentRecord, updatePaymentRecord } from "./payment-record-store";
import {
  setAppointmentPendingPayment,
  syncAppointmentPaymentMetadata,
} from "./appointment-lifecycle";

function platformStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeConnectPlatformConfigured() {
  return platformStripeConfigured();
}

export async function refreshStripeConnectAccount(
  workspaceId: string,
  connection: ConnectionRecord,
): Promise<ConnectionRecord> {
  const stripe = getStripe();
  if (!stripe || !connection.merchantAccountId) return connection;

  const account = await stripe.accounts.retrieve(connection.merchantAccountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const onboardingComplete = chargesEnabled && account.details_submitted;
  const needsAttention = Boolean(
    account.requirements?.currently_due?.length || account.requirements?.past_due?.length,
  );

  return upsertMerchantConnection(workspaceId, "STRIPE", {
    chargesEnabled,
    payoutsEnabled,
    onboardingComplete,
    status: needsAttention
      ? "needs_attention"
      : onboardingComplete && chargesEnabled
        ? "connected"
        : "onboarding_incomplete",
    providerMetadata: {
      requirements: account.requirements,
      capabilities: account.capabilities,
    },
    lastError: needsAttention ? "Stripe requires additional information" : null,
  });
}

export async function startStripeConnectOnboarding(workspaceId: string): Promise<{
  url: string;
  accountId: string;
}> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe platform is not configured");

  let connection = await getMerchantConnection(workspaceId, "STRIPE");
  let accountId = connection?.merchantAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { workspaceId, purpose: "appointment_merchant_payments" },
    });
    accountId = account.id;
    connection = await upsertMerchantConnection(workspaceId, "STRIPE", {
      merchantAccountId: accountId,
      status: "onboarding_incomplete",
      connectedAt: new Date(),
    });
  }

  const base = getAppBaseUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/merchant-payments/stripe/refresh?workspaceId=${encodeURIComponent(workspaceId)}`,
    return_url: `${base}/settings/payments?stripe=return`,
    type: "account_onboarding",
  });

  return { url: link.url, accountId };
}

/** Stripe Express Dashboard login link for connected merchant account management. */
export async function createStripeExpressDashboardLink(workspaceId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe platform is not configured");

  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) {
    throw new Error("Stripe is not connected for this business");
  }

  const refreshed = await refreshStripeConnectAccount(workspaceId, connection);
  if (!refreshed.merchantAccountId) {
    throw new Error("Stripe account is not available");
  }

  const link = await stripe.accounts.createLoginLink(refreshed.merchantAccountId);
  return link.url;
}

export async function createStripeConnectCheckout(
  input: CreateMerchantPaymentInput,
): Promise<MerchantPaymentResult> {
  const stripe = getStripe();
  if (!stripe) {
    return {
      configured: false,
      provider: "STRIPE",
      paymentRequired: true,
      checkoutUrl: null,
      sessionId: null,
      paymentRecordId: null,
      error: "Stripe platform is not configured",
    };
  }

  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) {
    return {
      configured: false,
      provider: "STRIPE",
      paymentRequired: true,
      checkoutUrl: null,
      sessionId: null,
      paymentRecordId: null,
      error: "Stripe is not connected for this business",
    };
  }

  const refreshed = await refreshStripeConnectAccount(input.workspaceId, connection);
  if (!refreshed.chargesEnabled) {
    return {
      configured: false,
      provider: "STRIPE",
      paymentRequired: true,
      checkoutUrl: null,
      sessionId: null,
      paymentRecordId: null,
      error: "Stripe account cannot accept payments yet — complete onboarding",
    };
  }

  const amounts = calculatePaymentAmounts({
    mode: input.payment.mode,
    priceCents: input.payment.priceCents,
    depositCents: input.payment.depositCents,
    depositPercent: input.payment.depositPercent,
    currency: input.payment.currency,
    provider: "stripe",
  });

  const idempotencyKey = input.idempotencyKey || createId();
  const paymentRecord = await createPaymentRecord({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    provider: "STRIPE",
    paymentMode: amounts.paymentMode,
    currency: amounts.currency,
    totalPriceCents: amounts.totalPriceCents,
    amountDueCents: amounts.amountDueCents,
    balanceDueCents: amounts.balanceDueCents,
    idempotencyKey,
  });

  await setAppointmentPendingPayment(input.workspaceId, input.appointmentId, paymentRecord);

  const base = getAppBaseUrl();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: `${base}/book/payment/success?session_id={CHECKOUT_SESSION_ID}&appointment=${input.appointmentId}`,
      cancel_url: `${base}/book/payment/canceled?appointment=${input.appointmentId}`,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: amounts.currency,
            unit_amount: amounts.amountDueCents,
            product_data: {
              name: input.description || "Appointment payment",
            },
          },
        },
      ],
      metadata: {
        transaction_type: MERCHANT_PAYMENT_TRANSACTION_TYPE,
        appointmentId: input.appointmentId,
        workspaceId: input.workspaceId,
        paymentMode: input.payment.mode,
        merchantPaymentId: paymentRecord.id,
        paymentAmountCents: String(amounts.amountDueCents),
      },
    },
    { stripeAccount: refreshed.merchantAccountId! },
  );

  await updatePaymentRecord(paymentRecord.id, {
    providerSessionId: session.id,
  });
  await syncAppointmentPaymentMetadata(input.workspaceId, input.appointmentId, {
    ...paymentRecord,
    providerSessionId: session.id,
  });

  return {
    configured: true,
    provider: "STRIPE",
    paymentRequired: true,
    checkoutUrl: session.url,
    sessionId: session.id,
    paymentRecordId: paymentRecord.id,
    error: null,
  };
}

export async function handleStripeConnectCheckoutCompleted(session: {
  id: string;
  metadata?: Record<string, string | null | undefined> | null;
  amount_total?: number | null;
  payment_intent?: string | null;
}) {
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  if (metadata.transaction_type !== MERCHANT_PAYMENT_TRANSACTION_TYPE) {
    return { handled: false, skipped: true };
  }

  const appointmentId = metadata.appointmentId;
  const workspaceId = metadata.workspaceId;
  const merchantPaymentId = metadata.merchantPaymentId;
  if (!appointmentId || !workspaceId) return { handled: false, skipped: true };

  const amountCents = session.amount_total ?? Number(metadata.paymentAmountCents || 0);
  const providerPaymentId = session.payment_intent || session.id;

  const { getPaymentByProviderSession, updatePaymentRecord } = await import("./payment-record-store");
  const { markAppointmentPaymentSucceeded } = await import("./appointment-lifecycle");

  const record =
    (merchantPaymentId
      ? await getPrisma().appointmentMerchantPayment.findUnique({ where: { id: merchantPaymentId } })
      : null) || (await getPaymentByProviderSession(session.id));

  if (record) {
    await updatePaymentRecord(record.id, {
      status: "succeeded",
      amountPaidCents: amountCents,
      balanceDueCents: record.paymentMode === "deposit"
        ? Math.max(0, record.totalPriceCents - amountCents)
        : 0,
      providerPaymentId: String(providerPaymentId),
      paidAt: new Date(),
    });
  }

  await markAppointmentPaymentSucceeded(
    workspaceId,
    appointmentId,
    (record || {
      id: merchantPaymentId || "",
      paymentMode: metadata.paymentMode || "full",
      totalPriceCents: amountCents,
      provider: "STRIPE",
    }) as import("./payment-record-store").PaymentRecord,
    String(providerPaymentId),
    amountCents,
  );

  return { handled: true, appointmentId, workspaceId };
}

export async function refundStripeConnectPayment(input: {
  workspaceId: string;
  appointmentId: string;
  amountCents?: number;
  paymentRecordId: string;
  providerPaymentId: string;
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe not connected");

  const refund = await stripe.refunds.create(
    {
      payment_intent: input.providerPaymentId,
      ...(input.amountCents ? { amount: input.amountCents } : {}),
      metadata: {
        transaction_type: MERCHANT_PAYMENT_TRANSACTION_TYPE,
        appointmentId: input.appointmentId,
        workspaceId: input.workspaceId,
      },
    },
    { stripeAccount: connection.merchantAccountId },
  );

  const { updatePaymentRecord, getPaymentByAppointment } = await import("./payment-record-store");
  const record = await getPaymentByAppointment(input.workspaceId, input.appointmentId);
  if (record) {
    const refundAmount = refund.amount || input.amountCents || record.amountPaidCents;
    const isFull = refundAmount >= record.amountPaidCents;
    await updatePaymentRecord(record.id, {
      refundAmountCents: refundAmount,
      refundStatus: isFull ? "refunded" : "partially_refunded",
      status: isFull ? "refunded" : "partially_refunded",
    });
  }

  return refund;
}

export async function handleStripeConnectAccountUpdated(account: {
  id: string;
  metadata?: Record<string, string | null | undefined> | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { currently_due?: string[]; past_due?: string[] };
}) {
  const workspaceId = account.metadata?.workspaceId;
  if (!workspaceId) {
    const { findConnectionByMerchantAccountId } = await import("./connection-store");
    const conn = await findConnectionByMerchantAccountId(account.id, "STRIPE");
    if (!conn) return { handled: false };
    await refreshStripeConnectAccount(conn.workspaceId, conn);
    return { handled: true };
  }

  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (!connection) return { handled: false };
  await refreshStripeConnectAccount(workspaceId, connection);
  return { handled: true };
}
