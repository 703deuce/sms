import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import type { MessagingRegistration } from "@/lib/domain";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  ensureRegistrationRow,
  getRegistrationByWorkspace,
} from "@/lib/messaging/store";
import {
  getNumberPaymentProvider,
  type NumberPaymentConfirmResult,
} from "@/lib/payments/number-payment-provider";
import { normalizeTelnyxError, type NormalizedTelnyxError } from "./telnyx-errors";

export type CompletePremiumPurchaseInput = {
  workspaceId: string;
  userId: string;
  reservationId: string;
  idempotencyKey?: string;
  /** When true, payment + validation run but Telnyx order is skipped (automated tests). */
  dryRunProviderPurchase?: boolean;
};

export type CompletePremiumPurchaseResult = {
  ok: boolean;
  status: string;
  phoneNumberId?: string;
  e164?: string;
  paymentId?: string;
  telnyxOrderId?: string;
  providerNumberId?: string;
  dryRun?: boolean;
  error?: string;
  normalizedError?: NormalizedTelnyxError;
  operationId: string;
};

function logPurchaseEvent(input: {
  operationId: string;
  workspaceId: string;
  userId: string;
  phoneNumberId?: string;
  provider: string;
  action: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  normalizedError?: NormalizedTelnyxError;
  retryCount?: number;
  reservationId?: string;
}) {
  console.info(
    JSON.stringify({
      scope: "number_purchase",
      operation_id: input.operationId,
      workspace_id: input.workspaceId,
      user_id: input.userId,
      phone_number_id: input.phoneNumberId,
      provider: input.provider,
      action: input.action,
      status: input.status,
      start_time: input.startedAt,
      completion_time: input.completedAt,
      normalized_error: input.normalizedError?.category,
      provider_error_code: input.normalizedError?.providerStatus,
      retry_count: input.retryCount ?? 0,
      reservation_id: input.reservationId,
    }),
  );
}

function defaultParkedSettings(input: {
  searchMode: string;
  premiumPriceCents: number;
  premiumPriceBand?: string | null;
  vanityDisplay?: string | null;
  displayNumber?: string | null;
  reservationId: string;
  paymentId: string;
}) {
  const isPersonal = input.searchMode === "personal";
  return {
    parked: true,
    personalParked: isPersonal,
    personalServiceState: "PARKED",
    parkedSince: new Date().toISOString(),
    acquisitionType: "PREMIUM_PURCHASE",
    premiumPurchase: true,
    premiumPriceCents: input.premiumPriceCents,
    premiumPriceBand: input.premiumPriceBand,
    vanityDisplay: input.vanityDisplay,
    displayNumber: input.displayNumber,
    premiumReservationId: input.reservationId,
    paymentId: input.paymentId,
    provisioning: {
      state: "purchased",
    },
  };
}

async function reconcileTelnyxOwnedNumber(e164: string): Promise<{
  providerNumberId: string;
  orderId?: string;
} | null> {
  try {
    const res = await telnyxRequest<{
      data?: Array<{ id: string; phone_number?: string }>;
    }>("/phone_numbers", {
      query: { "filter[phone_number]": e164 },
    });
    const row = res.data?.find((n) => n.phone_number === e164);
    if (!row?.id) return null;
    return { providerNumberId: row.id };
  } catch {
    return null;
  }
}

export async function finalizeNumberOwnership(input: {
  workspaceId: string;
  userId: string;
  e164: string;
  providerNumberId: string;
  telnyxOrderId?: string | null;
  reservationId: string;
  searchMode: string;
  premiumPriceCents: number;
  premiumPriceBand?: string | null;
  vanityDisplay?: string | null;
  displayNumber?: string | null;
  paymentId: string;
  operationId: string;
}) {
  const prisma = getPrisma();
  const e164 = normalizeE164(input.e164);
  const digits = e164.replace(/\D/g, "");
  const npa = digits.slice(1, 4);
  const isTollFree = /^(800|833|844|855|866|877|888)$/.test(npa);
  const providerName = getMessagingProviderName();

  const settingsJson = defaultParkedSettings({
    searchMode: input.searchMode,
    premiumPriceCents: input.premiumPriceCents,
    premiumPriceBand: input.premiumPriceBand,
    vanityDisplay: input.vanityDisplay,
    displayNumber: input.displayNumber,
    reservationId: input.reservationId,
    paymentId: input.paymentId,
  });

  const phoneRow = await prisma.phoneNumber.upsert({
    where: { workspaceId_e164: { workspaceId: input.workspaceId, e164 } },
    create: {
      workspaceId: input.workspaceId,
      e164,
      type: isTollFree ? "TollFree" : "Local",
      areaCode: npa || null,
      friendlyName: input.vanityDisplay || input.displayNumber || e164,
      twilioSid: providerName === "twilio" ? input.providerNumberId : null,
      providerNumberId: input.providerNumberId,
      status: "Active",
      purchasedAt: new Date(),
      a2pStatus: "PENDING",
      voiceForwardTo: null,
      settingsJson,
      capabilitiesJson: {
        voice: true,
        sms: true,
        source: "premium_purchase",
      },
    },
    update: {
      providerNumberId: input.providerNumberId,
      status: "Active",
      releasedAt: null,
      purchasedAt: new Date(),
      voiceForwardTo: null,
      friendlyName: input.vanityDisplay || input.displayNumber || undefined,
      settingsJson,
    },
  });

  await prisma.phoneNumberAssignment.upsert({
    where: {
      phoneNumberId_userId: { phoneNumberId: phoneRow.id, userId: input.userId },
    },
    create: { phoneNumberId: phoneRow.id, userId: input.userId },
    update: {},
  });

  await prisma.premiumNumberReservation.update({
    where: { id: input.reservationId },
    data: {
      paymentStatus: "paid",
      orderStatus: "completed",
      telnyxOrderId: input.telnyxOrderId,
      phoneNumberId: phoneRow.id,
      reservationStatus: "active",
    },
  });

  if (input.reservationId) {
    const reservation = await prisma.premiumNumberReservation.findUnique({
      where: { id: input.reservationId },
      select: { searchLogId: true },
    });
    if (reservation?.searchLogId) {
      await prisma.premiumNumberSearchLog.update({
        where: { id: reservation.searchLogId },
        data: { purchaseCompleted: true, selectedNumber: e164 },
      });
    }
  }

  if (
    providerName === "telnyx" &&
    !input.providerNumberId.startsWith("ORDER:") &&
    !input.providerNumberId.startsWith("DRY_RUN:")
  ) {
    try {
      const { provisionPurchasedNumber } = await import("@/lib/phone/telnyx-dual-provision");
      await provisionPurchasedNumber({
        workspaceId: input.workspaceId,
        phoneNumberId: phoneRow.id,
      });
    } catch (err) {
      const normalized = normalizeTelnyxError(err);
      logPurchaseEvent({
        operationId: input.operationId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        phoneNumberId: phoneRow.id,
        provider: providerName,
        action: "dual_provision",
        status: "recoverable_failure",
        startedAt: new Date().toISOString(),
        normalizedError: normalized,
        reservationId: input.reservationId,
      });
    }
  }

  return phoneRow;
}

export async function completePremiumPurchase(
  input: CompletePremiumPurchaseInput,
): Promise<CompletePremiumPurchaseResult> {
  const operationId = `prem_${randomBytes(6).toString("hex")}`;
  const startedAt = new Date().toISOString();
  const prisma = getPrisma();
  const idempotencyKey =
    input.idempotencyKey?.trim() || `premium:${input.reservationId}`;

  const reservation = await prisma.premiumNumberReservation.findFirst({
    where: { id: input.reservationId, workspaceId: input.workspaceId },
  });
  if (!reservation) {
    return {
      ok: false,
      status: "not_found",
      error: "Reservation not found",
      operationId,
    };
  }

  if (reservation.paymentStatus === "paid" && reservation.phoneNumberId) {
    const existing = await prisma.phoneNumber.findFirst({
      where: { id: reservation.phoneNumberId, workspaceId: input.workspaceId },
    });
    if (existing) {
      return {
        ok: true,
        status: "already_completed",
        phoneNumberId: existing.id,
        e164: existing.e164,
        telnyxOrderId: reservation.telnyxOrderId,
        providerNumberId: existing.providerNumberId,
        operationId,
      };
    }
  }

  if (reservation.reservationStatus !== "reserved" && reservation.reservationStatus !== "active") {
    return {
      ok: false,
      status: "reservation_invalid",
      error: `Reservation is ${reservation.reservationStatus}`,
      operationId,
    };
  }

  if (
    reservation.reservationExpiresAt &&
    reservation.reservationExpiresAt < new Date() &&
    reservation.reservationStatus === "reserved"
  ) {
    return {
      ok: false,
      status: "reservation_expired",
      error: "Reservation expired — search again",
      operationId,
    };
  }

  const existingOwned = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: reservation.phoneNumber, releasedAt: null },
  });
  if (existingOwned) {
    return {
      ok: false,
      status: "already_owned",
      error: "This workspace already owns this number",
      operationId,
    };
  }

  const claimToken = `PAY:${randomBytes(8).toString("hex")}`;
  const claimed = await prisma.premiumNumberReservation.updateMany({
    where: {
      id: reservation.id,
      workspaceId: input.workspaceId,
      paymentStatus: { in: ["none", "failed", "processing"] },
    },
    data: { paymentStatus: "processing", orderStatus: "ordering" },
  });

  if (claimed.count !== 1 && reservation.paymentStatus !== "paid") {
    return {
      ok: false,
      status: "purchase_in_progress",
      error: "Purchase already in progress — retry shortly",
      operationId,
    };
  }

  let payment: NumberPaymentConfirmResult | null = null;
  try {
    const paymentProvider = getNumberPaymentProvider();
    payment = await paymentProvider.confirm({
      workspaceId: input.workspaceId,
      userId: input.userId,
      reservationId: reservation.id,
      phoneNumber: reservation.phoneNumber,
      amountCents: reservation.premiumPriceCents,
      idempotencyKey,
    });
    logPurchaseEvent({
      operationId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: paymentProvider.name,
      action: "payment_confirm",
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      reservationId: reservation.id,
    });
  } catch (err) {
    await prisma.premiumNumberReservation.updateMany({
      where: { id: reservation.id, paymentStatus: "processing" },
      data: { paymentStatus: "failed", orderStatus: "none" },
    });
    return {
      ok: false,
      status: "payment_failed",
      error: err instanceof Error ? err.message : "Payment failed",
      operationId,
    };
  }

  const dryRun =
    input.dryRunProviderPurchase ||
    process.env.NUMBER_SKIP_TELNYX_PURCHASE?.trim() === "1";

  if (dryRun) {
    const mockProviderId = `DRY_RUN:${reservation.id}`;
    const phoneRow = await finalizeNumberOwnership({
      workspaceId: input.workspaceId,
      userId: input.userId,
      e164: reservation.phoneNumber,
      providerNumberId: mockProviderId,
      telnyxOrderId: null,
      reservationId: reservation.id,
      searchMode: reservation.searchMode,
      premiumPriceCents: reservation.premiumPriceCents,
      premiumPriceBand: reservation.premiumPriceBand,
      vanityDisplay: reservation.vanityDisplay,
      displayNumber: reservation.displayNumber,
      paymentId: payment.paymentId,
      operationId,
    });

    logPurchaseEvent({
      operationId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      phoneNumberId: phoneRow.id,
      provider: "dry_run",
      action: "complete_purchase",
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      reservationId: reservation.id,
    });

    return {
      ok: true,
      status: "completed",
      phoneNumberId: phoneRow.id,
      e164: phoneRow.e164,
      paymentId: payment.paymentId,
      providerNumberId: mockProviderId,
      dryRun: true,
      operationId,
    };
  }

  const e164 = normalizeE164(reservation.phoneNumber);
  let providerNumberId: string | null = null;
  let telnyxOrderId: string | null = null;
  const providerName = getMessagingProviderName();

  try {
    const reconciled = await reconcileTelnyxOwnedNumber(e164);
    if (reconciled) {
      providerNumberId = reconciled.providerNumberId;
      telnyxOrderId = reconciled.orderId ?? null;
      logPurchaseEvent({
        operationId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: providerName,
        action: "reconcile_existing",
        status: "success",
        startedAt,
        completedAt: new Date().toISOString(),
        reservationId: reservation.id,
      });
    } else {
      await ensureRegistrationRow(input.workspaceId);
      const reg = (await getRegistrationByWorkspace(input.workspaceId)) as MessagingRegistration;
      const bought = await getMessagingProvider().buyPhoneNumber(reg, e164);
      providerNumberId = bought.id;
      telnyxOrderId = bought.orderId ?? null;

      logPurchaseEvent({
        operationId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: providerName,
        action: "telnyx_order",
        status: bought.pending ? "pending_activation" : "success",
        startedAt,
        completedAt: new Date().toISOString(),
        reservationId: reservation.id,
      });
    }
  } catch (err) {
    const normalized = normalizeTelnyxError(err);
    await prisma.premiumNumberReservation.updateMany({
      where: { id: reservation.id, paymentStatus: "processing" },
      data: {
        paymentStatus: normalized.outcome === "RECOVERABLE_FAILURE" ? "processing" : "failed",
        orderStatus: "failed",
      },
    });
    logPurchaseEvent({
      operationId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: providerName,
      action: "telnyx_order",
      status: "failure",
      startedAt,
      completedAt: new Date().toISOString(),
      normalizedError: normalized,
      reservationId: reservation.id,
    });
    return {
      ok: false,
      status: "provider_failed",
      error: normalized.message,
      normalizedError: normalized,
      paymentId: payment.paymentId,
      operationId,
    };
  }

  if (!providerNumberId) {
    await prisma.premiumNumberReservation.updateMany({
      where: { id: reservation.id },
      data: { paymentStatus: "failed", orderStatus: "failed" },
    });
    return {
      ok: false,
      status: "provider_failed",
      error: "Telnyx did not return a number id",
      paymentId: payment.paymentId,
      operationId,
    };
  }

  const phoneRow = await finalizeNumberOwnership({
    workspaceId: input.workspaceId,
    userId: input.userId,
    e164,
    providerNumberId,
    telnyxOrderId,
    reservationId: reservation.id,
    searchMode: reservation.searchMode,
    premiumPriceCents: reservation.premiumPriceCents,
    premiumPriceBand: reservation.premiumPriceBand,
    vanityDisplay: reservation.vanityDisplay,
    displayNumber: reservation.displayNumber,
    paymentId: payment.paymentId,
    operationId,
  });

  logPurchaseEvent({
    operationId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    phoneNumberId: phoneRow.id,
    provider: providerName,
    action: "complete_purchase",
    status: "success",
    startedAt,
    completedAt: new Date().toISOString(),
    reservationId: reservation.id,
  });

  return {
    ok: true,
    status: providerNumberId.startsWith("ORDER:") ? "pending_activation" : "completed",
    phoneNumberId: phoneRow.id,
    e164: phoneRow.e164,
    paymentId: payment.paymentId,
    telnyxOrderId,
    providerNumberId,
    operationId,
  };
}
