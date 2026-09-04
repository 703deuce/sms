import "server-only";

import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { createId } from "@/lib/supabase/id";
import {
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  getMerchantConnection,
  upsertMerchantConnection,
} from "./connection-store";
import { MERCHANT_PAYMENT_TRANSACTION_TYPE } from "./types";
import type { CreateMerchantPaymentInput, MerchantPaymentResult, SquarePaymentTokenInput } from "./types";
import { calculatePaymentAmounts } from "./amounts";
import { createPaymentRecord, updatePaymentRecord, getPaymentByAppointment } from "./payment-record-store";
import {
  markAppointmentPaymentFailed,
  markAppointmentPaymentSucceeded,
  setAppointmentPendingPayment,
  syncAppointmentPaymentMetadata,
} from "./appointment-lifecycle";

const SQUARE_SANDBOX = process.env.SQUARE_ENVIRONMENT !== "production";

function squareBaseUrl() {
  return SQUARE_SANDBOX
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function squareApiUrl() {
  return SQUARE_SANDBOX
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

export function isSquarePlatformConfigured() {
  return Boolean(
    process.env.SQUARE_APPLICATION_ID?.trim() &&
      process.env.SQUARE_APPLICATION_SECRET?.trim(),
  );
}

export function getSquareApplicationId() {
  return process.env.SQUARE_APPLICATION_ID?.trim() || "";
}

export function buildSquareOAuthUrl(workspaceId: string, state: string): string {
  const appId = getSquareApplicationId();
  const base = getAppBaseUrl();
  const redirectUri = `${base}/api/merchant-payments/square/callback`;
  const scopes = ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE", "PAYMENTS_READ"];
  const params = new URLSearchParams({
    client_id: appId,
    scope: scopes.join(" "),
    session: "false",
    state,
    redirect_uri: redirectUri,
  });
  return `${squareBaseUrl()}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeSquareOAuthCode(
  workspaceId: string,
  code: string,
): Promise<void> {
  const secret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  const appId = getSquareApplicationId();
  if (!secret || !appId) throw new Error("Square is not configured");

  const base = getAppBaseUrl();
  const res = await fetch(`${squareApiUrl()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${base}/api/merchant-payments/square/callback`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square OAuth failed: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    merchant_id: string;
  };

  let defaultLocationId: string | undefined;
  try {
    const locRes = await fetch(`${squareApiUrl()}/v2/locations`, {
      headers: {
        Authorization: `Bearer ${json.access_token}`,
        "Square-Version": "2024-08-21",
      },
    });
    if (locRes.ok) {
      const locJson = (await locRes.json()) as { locations?: Array<{ id: string; status?: string }> };
      const active = locJson.locations?.find((l) => l.status === "ACTIVE") || locJson.locations?.[0];
      defaultLocationId = active?.id;
    }
  } catch {
    // location fetch optional
  }

  await upsertMerchantConnection(workspaceId, "SQUARE", {
    merchantAccountId: json.merchant_id,
    defaultLocationId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token || "",
    tokenExpiresAt: json.expires_at ? new Date(json.expires_at) : undefined,
    chargesEnabled: Boolean(defaultLocationId),
    onboardingComplete: Boolean(defaultLocationId),
    status: defaultLocationId ? "connected" : "onboarding_incomplete",
    connectedAt: new Date(),
    disconnectedAt: null,
    lastError: defaultLocationId ? null : "No active Square location found",
  });
}

export async function refreshSquareAccessToken(workspaceId: string): Promise<string | null> {
  const connection = await getMerchantConnection(workspaceId, "SQUARE");
  if (!connection) return null;

  const refresh = getDecryptedRefreshToken(connection);
  const secret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  const appId = getSquareApplicationId();
  if (!refresh || !secret || !appId) return getDecryptedAccessToken(connection);

  const res = await fetch(`${squareApiUrl()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return getDecryptedAccessToken(connection);

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  };

  await upsertMerchantConnection(workspaceId, "SQUARE", {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refresh,
    tokenExpiresAt: json.expires_at ? new Date(json.expires_at) : undefined,
  });

  return json.access_token;
}

async function getSquareAccessToken(workspaceId: string): Promise<string | null> {
  const connection = await getMerchantConnection(workspaceId, "SQUARE");
  if (!connection) return null;
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    return refreshSquareAccessToken(workspaceId);
  }
  return getDecryptedAccessToken(connection);
}

export async function prepareSquarePayment(
  input: CreateMerchantPaymentInput,
): Promise<MerchantPaymentResult> {
  if (!isSquarePlatformConfigured()) {
    return {
      configured: false,
      provider: "SQUARE",
      paymentRequired: true,
      checkoutUrl: null,
      sessionId: null,
      paymentRecordId: null,
      error: "Square is not configured on this platform",
    };
  }

  const connection = await getMerchantConnection(input.workspaceId, "SQUARE");
  if (!connection?.defaultLocationId || !connection.chargesEnabled) {
    return {
      configured: false,
      provider: "SQUARE",
      paymentRequired: true,
      checkoutUrl: null,
      sessionId: null,
      paymentRecordId: null,
      error: "Square is not connected for this business",
    };
  }

  const amounts = calculatePaymentAmounts({
    mode: input.payment.mode,
    priceCents: input.payment.priceCents,
    depositCents: input.payment.depositCents,
    depositPercent: input.payment.depositPercent,
    currency: input.payment.currency,
    provider: "square",
  });

  const idempotencyKey = input.idempotencyKey || createId();
  const paymentRecord = await createPaymentRecord({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    provider: "SQUARE",
    paymentMode: amounts.paymentMode,
    currency: amounts.currency,
    totalPriceCents: amounts.totalPriceCents,
    amountDueCents: amounts.amountDueCents,
    balanceDueCents: amounts.balanceDueCents,
    idempotencyKey,
  });

  await setAppointmentPendingPayment(input.workspaceId, input.appointmentId, paymentRecord);

  return {
    configured: true,
    provider: "SQUARE",
    paymentRequired: true,
    checkoutUrl: null,
    sessionId: null,
    paymentRecordId: paymentRecord.id,
    square: {
      applicationId: getSquareApplicationId(),
      locationId: connection.defaultLocationId!,
      amountCents: amounts.amountDueCents,
      currency: amounts.currency.toUpperCase(),
      sandbox: SQUARE_SANDBOX,
    },
    error: null,
  };
}

export async function createSquarePaymentFromToken(
  input: SquarePaymentTokenInput,
): Promise<{ success: boolean; error?: string }> {
  const connection = await getMerchantConnection(input.workspaceId, "SQUARE");
  if (!connection?.defaultLocationId) {
    return { success: false, error: "Square not connected" };
  }

  const token = await getSquareAccessToken(input.workspaceId);
  if (!token) return { success: false, error: "Square access token unavailable" };

  const record = await getPaymentByAppointment(input.workspaceId, input.appointmentId);
  if (!record) return { success: false, error: "Payment record not found" };

  const res = await fetch(`${squareApiUrl()}/v2/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-08-21",
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      source_id: input.sourceId,
      amount_money: {
        amount: record.amountDueCents,
        currency: record.currency.toUpperCase(),
      },
      location_id: connection.defaultLocationId,
      reference_id: input.appointmentId,
      note: MERCHANT_PAYMENT_TRANSACTION_TYPE,
    }),
  });

  const json = (await res.json()) as {
    payment?: { id: string; status: string; amount_money?: { amount: number } };
    errors?: Array<{ detail?: string }>;
  };

  if (!res.ok || !json.payment) {
    const err = json.errors?.[0]?.detail || "Square payment failed";
    await markAppointmentPaymentFailed(input.workspaceId, input.appointmentId, err);
    await updatePaymentRecord(record.id, { status: "failed", failedAt: new Date() });
    return { success: false, error: err };
  }

  const amountPaid = json.payment.amount_money?.amount || record.amountDueCents;
  await updatePaymentRecord(record.id, {
    status: "succeeded",
    providerPaymentId: json.payment.id,
    amountPaidCents: amountPaid,
    balanceDueCents:
      record.paymentMode === "deposit"
        ? Math.max(0, record.totalPriceCents - amountPaid)
        : 0,
    paidAt: new Date(),
  });

  await markAppointmentPaymentSucceeded(
    input.workspaceId,
    input.appointmentId,
    record,
    json.payment.id,
    amountPaid,
  );

  return { success: true };
}

export async function refundSquarePayment(input: {
  workspaceId: string;
  appointmentId: string;
  amountCents?: number;
  providerPaymentId: string;
}) {
  const token = await getSquareAccessToken(input.workspaceId);
  if (!token) throw new Error("Square not connected");

  const connection = await getMerchantConnection(input.workspaceId, "SQUARE");
  const record = await getPaymentByAppointment(input.workspaceId, input.appointmentId);
  const refundAmount = input.amountCents || record?.amountPaidCents;

  const res = await fetch(`${squareApiUrl()}/v2/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-08-21",
    },
    body: JSON.stringify({
      idempotency_key: createId(),
      payment_id: input.providerPaymentId,
      amount_money: refundAmount
        ? { amount: refundAmount, currency: (record?.currency || "usd").toUpperCase() }
        : undefined,
      reason: "Appointment refund",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square refund failed: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { refund?: { id: string; amount_money?: { amount: number } } };
  if (record) {
    const refunded = json.refund?.amount_money?.amount || refundAmount || 0;
    const isFull = refunded >= record.amountPaidCents;
    await updatePaymentRecord(record.id, {
      refundAmountCents: refunded,
      refundStatus: isFull ? "refunded" : "partially_refunded",
      status: isFull ? "refunded" : "partially_refunded",
    });
  }

  return json.refund;
}

export async function handleSquareWebhookPayment(event: {
  type: string;
  data?: { object?: { payment?: { id: string; status: string; reference_id?: string; amount_money?: { amount: number } } } };
}) {
  const payment = event.data?.object?.payment;
  if (!payment?.id) return { handled: false };

  const {
    getPaymentByProviderPaymentId,
    getPaymentByAppointment,
    findPaymentByAppointmentId,
  } = await import("./payment-record-store");
  let resolved = await getPaymentByProviderPaymentId(payment.id);
  if (!resolved && payment.reference_id) {
    resolved = await findPaymentByAppointmentId(payment.reference_id);
    if (!resolved) {
      const prisma = (await import("@/lib/db")).getPrisma();
      const row = await prisma.voiceAppointment.findFirst({ where: { id: payment.reference_id } });
      if (row) {
        resolved = await getPaymentByAppointment(row.workspaceId, payment.reference_id);
      }
    }
  }
  if (!resolved) return { handled: false };

  if (payment.status === "COMPLETED") {
    await markAppointmentPaymentSucceeded(
      resolved.workspaceId,
      resolved.appointmentId,
      resolved,
      payment.id,
      payment.amount_money?.amount || resolved.amountDueCents,
    );
    return { handled: true };
  }

  if (payment.status === "FAILED" || payment.status === "CANCELED") {
    await markAppointmentPaymentFailed(resolved.workspaceId, resolved.appointmentId, payment.status);
    return { handled: true };
  }

  return { handled: false };
}
