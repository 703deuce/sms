import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { createId } from "@/lib/supabase/id";

export type CreatePaymentLinkInput = {
  workspaceId: string;
  phone: string;
  amountCents: number;
  currency?: string;
  description?: string;
  contactId?: string;
  campaignId?: string;
};

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

async function createStripeCheckoutSession(input: CreatePaymentLinkInput, linkId: string) {
  const key = process.env.STRIPE_SECRET_KEY!;
  const base = getAppBaseUrl();
  const body = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: (input.currency || "usd").toLowerCase(),
          product_data: {
            name: input.description || "Payment",
          },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/messaging/payments?paid=${linkId}`,
    cancel_url: `${base}/messaging/payments?canceled=${linkId}`,
    metadata: {
      paymentLinkId: linkId,
      workspaceId: input.workspaceId,
    },
  };

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: body.mode,
      success_url: body.success_url,
      cancel_url: body.cancel_url,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": body.line_items[0].price_data.currency,
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": body.line_items[0].price_data.product_data.name,
      "metadata[paymentLinkId]": linkId,
      "metadata[workspaceId]": input.workspaceId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stripe session failed: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as { id: string; url: string };
  return { sessionId: json.id, url: json.url };
}

export async function createPaymentLink(input: CreatePaymentLinkInput) {
  const phone = normalizeE164(input.phone);
  if (!input.amountCents || input.amountCents < 50) {
    throw new Error("amountCents must be at least 50");
  }

  const prisma = getPrisma();
  const linkId = createId();
  let url: string;
  let stripeSessionId: string | null = null;

  if (stripeConfigured()) {
    const session = await createStripeCheckoutSession(input, linkId);
    url = session.url;
    stripeSessionId = session.sessionId;
  } else {
    url = `${getAppBaseUrl()}/messaging/payments/mock/${linkId}`;
  }

  const row = await prisma.paymentLink.create({
    data: {
      id: linkId,
      workspaceId: input.workspaceId,
      contactId: input.contactId || null,
      phone,
      amountCents: input.amountCents,
      currency: (input.currency || "usd").toLowerCase(),
      description: input.description || null,
      stripeSessionId,
      status: "pending",
      url,
      campaignId: input.campaignId || null,
    },
  });

  return row;
}

export async function resolvePaymentLinkForTemplate(
  workspaceId: string,
  phone: string,
  opts?: { contactId?: string; campaignId?: string; amountCents?: number; description?: string },
) {
  const configAmount = opts?.amountCents;
  const amountCents = configAmount && configAmount >= 50 ? configAmount : 1000;
  const link = await createPaymentLink({
    workspaceId,
    phone,
    amountCents,
    description: opts?.description || "Payment",
    contactId: opts?.contactId,
    campaignId: opts?.campaignId,
  });
  return link.url;
}

const ACTIVE_RECIPIENT_STATUSES = ["pending", "scheduled", "in_progress", "waiting"] as const;

/**
 * On payment, flip the link to paid (idempotent) and propagate a
 * `payment_received` fact to any active campaign recipients for the same
 * workspace + phone. Recipients enrolled in payment-category campaigns
 * (invoice / overdue reminders) are stopped so no further dunning is sent.
 */
export async function markPaymentLinkPaidById(linkId: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentLink.findUnique({ where: { id: linkId } });
  if (!row) return null;
  if (row.status === "paid") return row;

  const updated = await prisma.paymentLink.update({
    where: { id: row.id },
    data: { status: "paid" },
  });

  try {
    await applyPaymentReceivedFacts(row.workspaceId, row.phone, row.campaignId);
  } catch (err) {
    console.warn("[markPaymentLinkPaidById] failed to propagate payment_received", row.id, err);
  }

  return updated;
}

export async function markPaymentLinkPaid(stripeSessionId: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentLink.findFirst({ where: { stripeSessionId } });
  if (!row) return null;
  return markPaymentLinkPaidById(row.id);
}

async function applyPaymentReceivedFacts(
  workspaceId: string,
  phone: string | null,
  campaignId: string | null,
) {
  if (!phone) return;
  const prisma = getPrisma();

  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      workspaceId,
      phone,
      workflowStatus: { in: [...ACTIVE_RECIPIENT_STATUSES] },
      ...(campaignId ? { campaignId } : {}),
    },
    include: { campaign: true },
  });

  for (const recipient of recipients) {
    const prev =
      recipient.metadata && typeof recipient.metadata === "object"
        ? (recipient.metadata as Record<string, unknown>)
        : {};
    if (!prev.payment_received) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { metadata: { ...prev, payment_received: true } },
      });
    }

    // Stop dunning sequences (invoice / overdue reminders) once paid.
    if (recipient.campaign?.category === "payment") {
      const stopped = await prisma.campaignRecipient.updateMany({
        where: {
          id: recipient.id,
          workflowStatus: { in: [...ACTIVE_RECIPIENT_STATUSES] },
        },
        data: {
          workflowStatus: "stopped",
          stopReason: "payment_received",
          completedAt: new Date(),
          enrollmentKey: null,
          nextActionAt: null,
        },
      });
      if (stopped.count > 0) {
        await prisma.campaignMessage.updateMany({
          where: { recipientId: recipient.id, status: "queued" },
          data: { status: "skipped", error: "stopped: payment_received" },
        });
      }
    }
  }
}
