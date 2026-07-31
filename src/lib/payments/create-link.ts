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

export async function markPaymentLinkPaid(stripeSessionId: string) {
  const prisma = getPrisma();
  const row = await prisma.paymentLink.findFirst({ where: { stripeSessionId } });
  if (!row) return null;
  if (row.status === "paid") return row;
  return prisma.paymentLink.update({
    where: { id: row.id },
    data: { status: "paid" },
  });
}
