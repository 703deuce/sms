import "server-only";

import type { PaymentRequest, PaymentRequestStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { publicToken } from "@/lib/appointments/settings";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getMerchantConnection } from "@/lib/merchant-payments/connection-store";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveAppointmentOutboundSmsRoute } from "@/lib/appointments/sms-sender";
import { recordPaymentRequestEvent } from "@/lib/payment-requests/events";
import { buildPaymentRequestPublicUrl } from "@/lib/payment-requests/public-url";
import { createPaymentRequestStripeCheckout } from "@/lib/payment-requests/stripe-checkout";
import { createPaymentRequestStripeInvoice } from "@/lib/payment-requests/stripe-invoice";
import { reconcilePaymentRequestPaid } from "@/lib/payment-requests/reconcile";
import { resolvePaymentRequestMessaging } from "@/lib/payment-requests/messaging";
import { statusFilterMatches } from "@/lib/payment-requests/status";
import type {
  PaymentRequestCreateInput,
  PaymentRequestDetailView,
  PaymentRequestListFilters,
  PaymentRequestSummary,
  PaymentRequestView,
} from "@/lib/payment-requests/types";

const OUTSTANDING_STATUSES: PaymentRequestStatus[] = [
  "draft",
  "ready",
  "sent",
  "delivered",
  "opened",
];

function mapRow(row: PaymentRequest): PaymentRequestView {
  const sentEvent = row.status !== "draft";
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    processor: row.processor,
    customerName: row.customerName,
    customerPhoneE164: row.customerPhoneE164,
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    customerNote: row.customerNote,
    status: row.status,
    deliveryStatus: row.deliveryStatus,
    sourceType: row.sourceType,
    conversationId: row.conversationId,
    missedCallId: row.missedCallId,
    appointmentId: row.appointmentId,
    publicUrl: buildPaymentRequestPublicUrl(row.publicToken),
    paidAt: row.paidAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    sentAt: sentEvent ? row.updatedAt.toISOString() : null,
    amountPaidMinor: row.amountPaidMinor,
    smsError: row.smsError,
    processorCheckoutId: row.processorCheckoutId,
    collectionMethod: row.collectionMethod || "checkout",
    messageId: row.messageId,
  };
}

export async function getStripeConnectionSummary(workspaceId: string) {
  const { getStripeTextToPayCapabilities } = await import("@/lib/stripe-connect/capabilities");
  const caps = await getStripeTextToPayCapabilities(workspaceId);
  return {
    connected: caps.canCreateCheckoutSession,
    status:
      caps.health === "DISCONNECTED"
        ? "not_connected"
        : caps.health === "STRIPE_CONNECTED_NOT_PAYMENT_READY"
          ? "onboarding_incomplete"
          : caps.needsAttention
            ? "needs_attention"
            : "connected",
    merchantAccountId: caps.accountId,
    paymentReady: caps.liveModeReady,
    health: caps.health,
  };
}

export async function listPaymentRequests(
  workspaceId: string,
  filters: PaymentRequestListFilters,
): Promise<{ rows: PaymentRequestView[]; total: number; page: number; pageSize: number }> {
  const prisma = getPrisma();
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 10));
  const page = Math.max(1, filters.page ?? 1);

  const where: Record<string, unknown> = { workspaceId };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhoneE164: { contains: q.replace(/\D/g, "") } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const all = await prisma.paymentRequest.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
  });

  const statusFilter = filters.status?.toLowerCase() || "all";
  const filtered = all.filter((row) =>
    statusFilter === "all" ? true : statusFilterMatches(statusFilter, row.status, row.deliveryStatus),
  );

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize).map(mapRow);

  return { rows: pageRows, total, page, pageSize };
}

export async function summarizePaymentRequests(
  workspaceId: string,
  filters: Pick<PaymentRequestListFilters, "dateFrom" | "dateTo">,
): Promise<PaymentRequestSummary> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { workspaceId };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const rows = await prisma.paymentRequest.findMany({ where: where as never });
  let requestedMinor = 0;
  let paidMinor = 0;
  let outstandingMinor = 0;

  for (const row of rows) {
    if (row.status === "cancelled" || row.status === "expired") continue;
    requestedMinor += row.amountMinor;
    if (row.status === "paid") {
      paidMinor += row.amountPaidMinor ?? row.amountMinor;
    } else if (OUTSTANDING_STATUSES.includes(row.status)) {
      outstandingMinor += row.amountMinor;
    }
  }

  return {
    requestedMinor,
    paidMinor,
    outstandingMinor,
    requestCount: rows.filter((r) => r.status !== "cancelled").length,
  };
}

export async function getPaymentRequestDetail(
  workspaceId: string,
  id: string,
): Promise<PaymentRequestDetailView | null> {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({
    where: { id, workspaceId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) return null;
  const stripe = await getStripeConnectionSummary(workspaceId);
  return {
    ...mapRow(row),
    events: row.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorType: e.actorType,
      createdAt: e.createdAt.toISOString(),
      payload: (e.payload as Record<string, unknown>) ?? null,
    })),
    stripeConnected: stripe.connected,
  };
}

async function attachConversationOutboundMessage(input: {
  conversationId: string;
  body: string;
  fromE164?: string;
  userName?: string | null;
}) {
  const prisma = getPrisma();
  const msg = await prisma.conversationMessage.create({
    data: {
      conversationId: input.conversationId,
      direction: "out",
      body: input.body,
      userName: input.userName ?? null,
      fromE164: input.fromE164 ?? null,
    },
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { unread: false, status: "OPEN", updatedAt: new Date() },
  });
  return { messageId: msg.id };
}

export async function createAndSendPaymentRequest(input: PaymentRequestCreateInput) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.customerPhoneE164);

  if (input.idempotencyKey) {
    const existing = await prisma.paymentRequest.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { request: mapRow(existing), replay: true as const };
    }
  }

  const token = publicToken();
  let row = await prisma.paymentRequest.create({
    data: {
      workspaceId: input.workspaceId,
      processor: "STRIPE",
      customerPhoneE164: phone,
      amountMinor: input.amountMinor,
      currency: (input.currency || "usd").toLowerCase(),
      description: input.description.trim(),
      customerNote: input.customerNote?.trim() || null,
      customerName: input.customerName?.trim() || null,
      customerId: input.customerId || null,
      contactId: input.contactId || null,
      sourceType: input.sourceType ?? "standalone",
      sourceId: input.sourceId || null,
      conversationId: input.conversationId || null,
      missedCallId: input.missedCallId || null,
      appointmentId: input.appointmentId || null,
      createdByUserId: input.createdByUserId || null,
      expiresAt: input.expiresAt ?? null,
      idempotencyKey: input.idempotencyKey || null,
      publicToken: token,
      status: "draft",
    },
  });

  await recordPaymentRequestEvent({
    paymentRequestId: row.id,
    workspaceId: input.workspaceId,
    eventType: "request_created",
    actorType: input.createdByUserId ? "user" : "system",
    actorUserId: input.createdByUserId,
  });

  const deliveryMethod = input.deliveryMethod === "invoice" ? "invoice" : "checkout";

  if (deliveryMethod === "invoice") {
    const invoice = await createPaymentRequestStripeInvoice({
      workspaceId: input.workspaceId,
      paymentRequestId: row.id,
      amountMinor: row.amountMinor,
      currency: row.currency,
      description: row.description,
      sourceType: row.sourceType,
      customerPhoneE164: phone,
      customerName: input.customerName,
      customerEmail: undefined,
      contactId: input.contactId,
      conversationId: row.conversationId,
      appointmentId: row.appointmentId,
      publicToken: row.publicToken,
    });

    if ("error" in invoice) {
      row = await prisma.paymentRequest.update({
        where: { id: row.id },
        data: { status: "failed", failedAt: new Date(), smsError: invoice.error },
      });
      await recordPaymentRequestEvent({
        paymentRequestId: row.id,
        workspaceId: input.workspaceId,
        eventType: "invoice_failed",
        payload: { error: invoice.error },
      });
      throw new Error(invoice.error);
    }

    row = await prisma.paymentRequest.update({
      where: { id: row.id },
      data: {
        status: "ready",
        collectionMethod: "invoice",
        processorInvoiceId: invoice.invoiceId,
        processorHostedInvoiceUrl: invoice.hostedInvoiceUrl,
        processorConnectedAccountId: invoice.connectedAccountId,
        customerId: invoice.stripeCustomerId,
      },
    });

    await recordPaymentRequestEvent({
      paymentRequestId: row.id,
      workspaceId: input.workspaceId,
      eventType: "invoice_sent",
      payload: { invoiceId: invoice.invoiceId, hostedInvoiceUrl: invoice.hostedInvoiceUrl },
    });
  } else {
    const checkout = await createPaymentRequestStripeCheckout({
      workspaceId: input.workspaceId,
      paymentRequestId: row.id,
      amountMinor: row.amountMinor,
      currency: row.currency,
      description: row.description,
      sourceType: row.sourceType,
      conversationId: row.conversationId,
      appointmentId: row.appointmentId,
      publicToken: row.publicToken,
    });

    if ("error" in checkout) {
      row = await prisma.paymentRequest.update({
        where: { id: row.id },
        data: { status: "failed", failedAt: new Date(), smsError: checkout.error },
      });
      await recordPaymentRequestEvent({
        paymentRequestId: row.id,
        workspaceId: input.workspaceId,
        eventType: "checkout_failed",
        payload: { error: checkout.error },
      });
      throw new Error(checkout.error);
    }

    row = await prisma.paymentRequest.update({
      where: { id: row.id },
      data: {
        status: "ready",
        collectionMethod: "checkout",
        processorCheckoutId: checkout.sessionId,
        processorConnectedAccountId: checkout.connectedAccountId,
      },
    });

    await recordPaymentRequestEvent({
      paymentRequestId: row.id,
      workspaceId: input.workspaceId,
      eventType: "checkout_created",
      payload: { sessionId: checkout.sessionId },
    });
  }

  const publicUrl = buildPaymentRequestPublicUrl(row.publicToken);
  const shouldSend = input.sendSms !== false;

  if (!shouldSend) {
    return { request: mapRow(row), replay: false as const };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });

  const resolved = await resolvePaymentRequestMessaging(input.workspaceId, {
    businessDisplayName: workspace?.name || "",
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    customerNote: row.customerNote,
    publicUrl,
  });

  if (!resolved.canSend) {
    row = await prisma.paymentRequest.update({
      where: { id: row.id },
      data: {
        status: "sent",
        deliveryStatus: "failed",
        smsError: resolved.blockReason || "Messaging unavailable",
      },
    });
    await recordPaymentRequestEvent({
      paymentRequestId: row.id,
      workspaceId: input.workspaceId,
      eventType: "sms_failed",
      payload: { reason: resolved.blockReason },
    });
    return { request: mapRow(row), replay: false as const, smsFailed: true as const };
  }

  try {
    const platformRoute = await resolveAppointmentOutboundSmsRoute(input.workspaceId);
    const sendResult = await sendQuickSms({
      workspaceId: input.workspaceId,
      to: phone,
      body: resolved.body,
      destinationUrl: publicUrl,
      idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:sms` : undefined,
      ...(platformRoute
        ? {
            from: platformRoute.fromE164,
            senderRoute: {
              sendWorkspaceId: platformRoute.sendWorkspaceId,
              fromE164: platformRoute.fromE164,
            },
          }
        : {}),
    });

    let messageId: string | null = sendResult.messageId ?? null;
    if (input.conversationId) {
      const convo = await attachConversationOutboundMessage({
        conversationId: input.conversationId,
        body: resolved.body,
        fromE164: platformRoute?.fromE164,
        userName: null,
      });
      messageId = convo.messageId ?? messageId;
    }

    row = await prisma.paymentRequest.update({
      where: { id: row.id },
      data: {
        status: "sent",
        deliveryStatus: "sent",
        messageId,
        smsError: null,
      },
    });

    await recordPaymentRequestEvent({
      paymentRequestId: row.id,
      workspaceId: input.workspaceId,
      eventType: "sms_sent",
      payload: { messageId },
    });

    return { request: mapRow(row), replay: false as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMS failed";
    row = await prisma.paymentRequest.update({
      where: { id: row.id },
      data: {
        status: "sent",
        deliveryStatus: "failed",
        smsError: msg,
      },
    });
    await recordPaymentRequestEvent({
      paymentRequestId: row.id,
      workspaceId: input.workspaceId,
      eventType: "sms_failed",
      payload: { error: msg },
    });
    return { request: mapRow(row), replay: false as const, smsFailed: true as const };
  }
}

export async function retryPaymentRequestMessage(workspaceId: string, id: string, userId?: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({ where: { id, workspaceId } });
  if (!row) throw new Error("Payment request not found");
  if (row.status === "paid" || row.status === "cancelled" || row.status === "expired") {
    throw new Error("Cannot resend message for this request");
  }

  const publicUrl = buildPaymentRequestPublicUrl(row.publicToken);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  const resolved = await resolvePaymentRequestMessaging(workspaceId, {
    businessDisplayName: workspace?.name || "",
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    customerNote: row.customerNote,
    publicUrl,
  });
  if (!resolved.canSend) throw new Error(resolved.blockReason || "Messaging unavailable");

  const platformRoute = await resolveAppointmentOutboundSmsRoute(workspaceId);
  const sendResult = await sendQuickSms({
    workspaceId,
    to: row.customerPhoneE164,
    body: resolved.body,
    destinationUrl: publicUrl,
    idempotencyKey: `payment-request-retry:${row.id}:${Date.now()}`,
    ...(platformRoute
      ? {
          from: platformRoute.fromE164,
          senderRoute: {
            sendWorkspaceId: platformRoute.sendWorkspaceId,
            fromE164: platformRoute.fromE164,
          },
        }
      : {}),
  });

  let messageId = sendResult.messageId ?? row.messageId;
  if (row.conversationId) {
    const convo = await attachConversationOutboundMessage({
      conversationId: row.conversationId,
      body: resolved.body,
      fromE164: platformRoute?.fromE164,
      userName: userNameFromUserId(userId),
    });
    messageId = convo.messageId ?? messageId;
  }

  const updated = await prisma.paymentRequest.update({
    where: { id: row.id },
    data: {
      deliveryStatus: "sent",
      smsError: null,
      messageId,
    },
  });

  await recordPaymentRequestEvent({
    paymentRequestId: row.id,
    workspaceId,
    eventType: "sms_retry",
    actorType: userId ? "user" : "system",
    actorUserId: userId,
  });

  return mapRow(updated);
}

function userNameFromUserId(_userId?: string) {
  return null;
}

export async function sendPaymentRequestReminder(workspaceId: string, id: string, userId?: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({ where: { id, workspaceId } });
  if (!row) throw new Error("Payment request not found");
  if (row.status === "paid" || row.status === "cancelled") throw new Error("Invalid state for reminder");

  const publicUrl = buildPaymentRequestPublicUrl(row.publicToken);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  const resolved = await resolvePaymentRequestMessaging(workspaceId, {
    businessDisplayName: workspace?.name || "",
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    customerNote: row.customerNote,
    publicUrl,
  });
  const reminderBody = `Reminder: ${resolved.body}`;
  const platformRoute = await resolveAppointmentOutboundSmsRoute(workspaceId);
  await sendQuickSms({
    workspaceId,
    to: row.customerPhoneE164,
    body: reminderBody,
    destinationUrl: publicUrl,
    idempotencyKey: `payment-request-reminder:${row.id}:${row.reminderCount + 1}`,
    ...(platformRoute
      ? {
          from: platformRoute.fromE164,
          senderRoute: {
            sendWorkspaceId: platformRoute.sendWorkspaceId,
            fromE164: platformRoute.fromE164,
          },
        }
      : {}),
  });

  const updated = await prisma.paymentRequest.update({
    where: { id: row.id },
    data: {
      lastReminderAt: new Date(),
      reminderCount: { increment: 1 },
    },
  });

  await recordPaymentRequestEvent({
    paymentRequestId: row.id,
    workspaceId,
    eventType: "reminder_sent",
    actorType: userId ? "user" : "system",
    actorUserId: userId,
  });

  return mapRow(updated);
}

export async function cancelPaymentRequest(workspaceId: string, id: string, userId?: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({ where: { id, workspaceId } });
  if (!row) throw new Error("Payment request not found");
  if (row.status === "paid") throw new Error("Paid requests cannot be cancelled");

  const updated = await prisma.paymentRequest.update({
    where: { id: row.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
    },
  });

  await recordPaymentRequestEvent({
    paymentRequestId: row.id,
    workspaceId,
    eventType: "cancelled",
    actorType: userId ? "user" : "system",
    actorUserId: userId,
  });

  return mapRow(updated);
}

export async function resolvePublicPaymentRequest(publicToken: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findUnique({ where: { publicToken } });
  if (!row) return { kind: "not_found" as const };

  if (row.status === "cancelled") return { kind: "cancelled" as const, row };
  if (row.status === "expired" || (row.expiresAt && row.expiresAt < new Date())) {
    if (row.status !== "expired") {
      await prisma.paymentRequest.update({
        where: { id: row.id },
        data: { status: "expired" },
      });
    }
    return { kind: "expired" as const, row };
  }
  if (row.status === "paid") return { kind: "paid" as const, row };

  return { kind: "active" as const, row };
}

export async function recordPaymentRequestOpen(publicToken: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findUnique({ where: { publicToken } });
  if (!row) return null;

  const now = new Date();
  const firstOpen = !row.firstOpenedAt;
  await prisma.paymentRequest.update({
    where: { id: row.id },
    data: {
      firstOpenedAt: row.firstOpenedAt ?? now,
      lastOpenedAt: now,
      openCount: { increment: 1 },
      status: row.status === "paid" ? row.status : "opened",
    },
  });

  if (firstOpen) {
    await recordPaymentRequestEvent({
      paymentRequestId: row.id,
      workspaceId: row.workspaceId,
      eventType: "link_opened",
    });
  }

  return row;
}

export async function listPaymentRequestsForConversation(
  workspaceId: string,
  conversationId: string,
): Promise<PaymentRequestView[]> {
  const prisma = getPrisma();
  const rows = await prisma.paymentRequest.findMany({
    where: { workspaceId, conversationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapRow);
}

export async function handlePaymentRequestCheckoutCompleted(
  session: {
    id: string;
    metadata?: Record<string, string | null | undefined> | null;
    amount_total?: number | null;
    payment_intent?: string | null;
    payment_status?: string | null;
  },
  opts?: { stripeEventId?: string | null; source?: "checkout_session" | "checkout_async" },
) {
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  const requestId = metadata.transovo_payment_request_id;
  const workspaceId = metadata.workspace_id;
  if (!requestId || !workspaceId) return { handled: false as const, skipped: true as const };

  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({
    where: { id: requestId, workspaceId },
  });
  if (!row) return { handled: false as const, skipped: true as const };

  const { isCheckoutSessionPaid } = await import("@/lib/stripe-connect/constants");
  if (!isCheckoutSessionPaid(session)) {
    if (row.status !== "paid") {
      await recordPaymentRequestEvent({
        paymentRequestId: row.id,
        workspaceId,
        eventType: "payment_processing",
        actorType: "provider",
        payload: { sessionId: session.id, payment_status: session.payment_status || "unpaid" },
      });
    }
    return {
      handled: true as const,
      paymentRequestId: row.id,
      awaitingAsyncPayment: true as const,
    };
  }

  const amountCents = session.amount_total ?? row.amountMinor;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent || null;

  const source =
    opts?.source ||
    (opts?.stripeEventId?.includes("async") ? "checkout_async" : "checkout_session");

  const result = await reconcilePaymentRequestPaid({
    paymentRequestId: row.id,
    workspaceId,
    source,
    amountMinor: amountCents,
    processorCheckoutId: session.id,
    processorPaymentIntentId: paymentIntent,
    stripeEventId: opts?.stripeEventId,
  });

  return {
    handled: true as const,
    paymentRequestId: row.id,
    duplicate: result.duplicate,
  };
}

export async function handlePaymentRequestInvoicePaid(
  invoice: {
    id: string;
    metadata?: Record<string, string | null | undefined> | null;
    amount_paid?: number | null;
    total?: number | null;
    payment_intent?: string | null;
    charge?: string | null;
    status?: string | null;
    paid?: boolean | null;
  },
  opts?: { stripeEventId?: string | null },
) {
  const metadata = (invoice.metadata || {}) as Record<string, string | undefined>;
  const requestId = metadata.transovo_payment_request_id;
  const workspaceId = metadata.workspace_id;
  if (!requestId || !workspaceId) return { handled: false as const, skipped: true as const };

  const { isStripeInvoicePaid } = await import("@/lib/stripe-connect/invoice");
  if (!isStripeInvoicePaid({ status: invoice.status || null, paid: invoice.paid === true })) {
    return { handled: true as const, paymentRequestId: requestId, awaitingPayment: true as const };
  }

  const amountMinor =
    invoice.amount_paid ?? invoice.total ?? (await getPrisma().paymentRequest.findFirst({
      where: { id: requestId, workspaceId },
      select: { amountMinor: true },
    }))?.amountMinor ?? 0;

  const paymentIntent =
    typeof invoice.payment_intent === "string" ? invoice.payment_intent : null;
  const chargeId = typeof invoice.charge === "string" ? invoice.charge : null;

  const result = await reconcilePaymentRequestPaid({
    paymentRequestId: requestId,
    workspaceId,
    source: "invoice",
    amountMinor,
    processorInvoiceId: invoice.id,
    processorPaymentIntentId: paymentIntent,
    processorChargeId: chargeId,
    stripeEventId: opts?.stripeEventId,
  });

  return {
    handled: true as const,
    paymentRequestId: requestId,
    duplicate: result.duplicate,
  };
}

/** Reusable hook for appointments — manual payment request later. */
export async function createPaymentRequestFromAppointment(input: {
  workspaceId: string;
  appointmentId: string;
  customerPhoneE164: string;
  amountMinor: number;
  description: string;
  createdByUserId?: string;
}) {
  return createAndSendPaymentRequest({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    customerPhoneE164: input.customerPhoneE164,
    amountMinor: input.amountMinor,
    description: input.description,
    sourceType: "appointment",
    sourceId: input.appointmentId,
    createdByUserId: input.createdByUserId,
  });
}
