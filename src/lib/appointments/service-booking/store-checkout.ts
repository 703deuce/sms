import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { createId } from "@/lib/supabase/id";
import {
  getMerchantConnection,
} from "@/lib/merchant-payments/connection-store";
import { refreshStripeConnectAccount } from "@/lib/merchant-payments/stripe-connect";
import { issueGiftCertificate } from "./gift-certificates";
import { purchasePackageForContact } from "./packages";
import { startMembershipSubscription } from "./memberships";

export const STORE_PURCHASE_TRANSACTION_TYPE = "service_booking_store_purchase";

export type StoreProductKind = "package" | "gift" | "membership";

export type StoreProductView = {
  id: string;
  kind: StoreProductKind;
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  billingInterval?: string | null;
  allowCustomAmount?: boolean;
  fixedAmountCents?: number | null;
  denominations?: number[];
  minAmountCents?: number | null;
  maxAmountCents?: number | null;
};

export async function listActiveStoreProducts(workspaceId: string): Promise<StoreProductView[]> {
  const prisma = getPrisma();
  const [packages, gifts, memberships] = await Promise.all([
    prisma.packageProduct.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" } }),
    prisma.giftCertificateProduct.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" } }),
    prisma.serviceMembershipProduct.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" } }),
  ]);

  const items: StoreProductView[] = [
    ...packages.map((p: (typeof packages)[number]) => ({
      id: p.id,
      kind: "package" as const,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceCents: p.priceCents,
    })),
    ...gifts.map((g: (typeof gifts)[number]) => ({
      id: g.id,
      kind: "gift" as const,
      name: g.name,
      slug: g.slug,
      description: g.description,
      priceCents: g.fixedAmountCents ?? 0,
      allowCustomAmount: g.allowCustomAmount,
      fixedAmountCents: g.fixedAmountCents,
      denominations: (g.denominations || []) as number[],
      minAmountCents: g.minAmountCents,
      maxAmountCents: g.maxAmountCents,
    })),
    ...memberships.map((m: (typeof memberships)[number]) => ({
      id: m.id,
      kind: "membership" as const,
      name: m.name,
      slug: m.slug,
      description: m.description,
      priceCents: m.priceCents,
      billingInterval: m.billingInterval,
    })),
  ];

  return items;
}

async function resolveOrCreateStoreContact(
  workspaceId: string,
  input: { firstName?: string; lastName?: string; phone: string; email?: string },
) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  const existing = await prisma.contact.findFirst({ where: { workspaceId, phone } });
  if (existing) {
    if (input.email && !existing.email) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: { email: input.email.trim() },
      });
    }
    return existing.id;
  }
  const created = await prisma.contact.create({
    data: {
      workspaceId,
      firstName: input.firstName?.trim() || "Guest",
      lastName: input.lastName?.trim() || "",
      phone,
      email: input.email?.trim() || null,
      status: "SUBSCRIBED",
      consentSource: "store_purchase",
      consentDate: new Date(),
    },
  });
  return created.id;
}

function resolveGiftAmountCents(
  product: {
    fixedAmountCents: number | null;
    allowCustomAmount: boolean;
    minAmountCents: number | null;
    maxAmountCents: number | null;
  },
  amountCents?: number,
) {
  if (product.fixedAmountCents != null && product.fixedAmountCents > 0) {
    return product.fixedAmountCents;
  }
  const value = amountCents ?? 0;
  if (value <= 0) throw new Error("Gift amount is required");
  if (product.minAmountCents != null && value < product.minAmountCents) {
    throw new Error(`Minimum gift amount is ${product.minAmountCents / 100}`);
  }
  if (product.maxAmountCents != null && value > product.maxAmountCents) {
    throw new Error(`Maximum gift amount is ${product.maxAmountCents / 100}`);
  }
  return value;
}

export async function fulfillStorePurchase(input: {
  workspaceId: string;
  kind: StoreProductKind;
  productId: string;
  contactId: string;
  amountCents?: number;
  recipientName?: string;
  recipientEmail?: string;
  giftMessage?: string;
}) {
  switch (input.kind) {
    case "package": {
      const balance = await purchasePackageForContact(input.workspaceId, input.productId, input.contactId);
      return { kind: input.kind, balanceId: balance.id };
    }
    case "gift": {
      const prisma = getPrisma();
      const product = await prisma.giftCertificateProduct.findFirst({
        where: { id: input.productId, workspaceId: input.workspaceId, active: true },
      });
      if (!product) throw new Error("Gift certificate not found");
      const amountCents = resolveGiftAmountCents(product, input.amountCents);
      const cert = await issueGiftCertificate(input.workspaceId, {
        productId: input.productId,
        amountCents,
        purchaserContactId: input.contactId,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        giftMessage: input.giftMessage,
      });
      return { kind: input.kind, code: cert.code, balanceId: cert.id };
    }
    case "membership": {
      const sub = await startMembershipSubscription(
        input.workspaceId,
        input.productId,
        input.contactId,
      );
      return { kind: input.kind, subscriptionId: sub.id };
    }
    default:
      throw new Error("Unsupported product type");
  }
}

export async function createStoreCheckoutSession(input: {
  workspaceSlug: string;
  workspaceId: string;
  kind: StoreProductKind;
  productId: string;
  contactId: string;
  customerEmail?: string;
  amountCents: number;
  description: string;
  fulfillment: Record<string, string | undefined>;
}) {
  const stripe = getStripe();
  if (!stripe) {
    return { configured: false, checkoutUrl: null, sessionId: null, error: "Payments are not configured" };
  }

  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) {
    return { configured: false, checkoutUrl: null, sessionId: null, error: "Stripe is not connected" };
  }

  const refreshed = await refreshStripeConnectAccount(input.workspaceId, connection);
  if (!refreshed.chargesEnabled) {
    return {
      configured: false,
      checkoutUrl: null,
      sessionId: null,
      error: "This business cannot accept payments yet",
    };
  }

  const base = getAppBaseUrl();
  const fulfillmentId = createId();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: `${base}/book/${encodeURIComponent(input.workspaceSlug)}/store?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/book/${encodeURIComponent(input.workspaceSlug)}/store?canceled=1`,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.amountCents,
            product_data: { name: input.description },
          },
        },
      ],
      metadata: {
        transaction_type: STORE_PURCHASE_TRANSACTION_TYPE,
        workspaceId: input.workspaceId,
        fulfillmentId,
        kind: input.kind,
        productId: input.productId,
        contactId: input.contactId,
        amountCents: String(input.amountCents),
        ...input.fulfillment,
      },
    },
    { stripeAccount: refreshed.merchantAccountId! },
  );

  return {
    configured: true,
    checkoutUrl: session.url,
    sessionId: session.id,
    fulfillmentId,
    error: null,
  };
}

const fulfilledSessions = new Set<string>();

export async function handleStoreCheckoutCompleted(session: {
  id: string;
  metadata?: Record<string, string | null | undefined> | null;
}) {
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  if (metadata.transaction_type !== STORE_PURCHASE_TRANSACTION_TYPE) {
    return { handled: false, skipped: true };
  }

  const workspaceId = metadata.workspaceId;
  const kind = metadata.kind as StoreProductKind | undefined;
  const productId = metadata.productId;
  const contactId = metadata.contactId;
  if (!workspaceId || !kind || !productId || !contactId) {
    return { handled: false, skipped: true };
  }

  if (fulfilledSessions.has(session.id)) {
    return { handled: true, duplicate: true };
  }

  const result = await fulfillStorePurchase({
    workspaceId,
    kind,
    productId,
    contactId,
    amountCents: metadata.amountCents ? Number(metadata.amountCents) : undefined,
    recipientName: metadata.recipientName,
    recipientEmail: metadata.recipientEmail,
    giftMessage: metadata.giftMessage,
  });

  fulfilledSessions.add(session.id);
  return { handled: true, result };
}

export async function processStoreCheckout(input: {
  workspaceSlug: string;
  workspaceId: string;
  kind: StoreProductKind;
  productId: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  amountCents?: number;
  recipientName?: string;
  recipientEmail?: string;
  giftMessage?: string;
}) {
  const prisma = getPrisma();
  const contactId = await resolveOrCreateStoreContact(input.workspaceId, input);

  let priceCents = 0;
  let description = "Store purchase";

  if (input.kind === "package") {
    const product = await prisma.packageProduct.findFirst({
      where: { id: input.productId, workspaceId: input.workspaceId, active: true },
    });
    if (!product) throw new Error("Package not found");
    priceCents = product.priceCents;
    description = product.name;
  } else if (input.kind === "gift") {
    const product = await prisma.giftCertificateProduct.findFirst({
      where: { id: input.productId, workspaceId: input.workspaceId, active: true },
    });
    if (!product) throw new Error("Gift certificate not found");
    priceCents = resolveGiftAmountCents(product, input.amountCents);
    description = product.name;
  } else {
    const product = await prisma.serviceMembershipProduct.findFirst({
      where: { id: input.productId, workspaceId: input.workspaceId, active: true },
    });
    if (!product) throw new Error("Membership not found");
    priceCents = product.priceCents;
    description = product.name;
  }

  if (priceCents <= 0) {
    const result = await fulfillStorePurchase({
      workspaceId: input.workspaceId,
      kind: input.kind,
      productId: input.productId,
      contactId,
      amountCents: input.amountCents,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      giftMessage: input.giftMessage,
    });
    return { paymentRequired: false, result };
  }

  const checkout = await createStoreCheckoutSession({
    workspaceSlug: input.workspaceSlug,
    workspaceId: input.workspaceId,
    kind: input.kind,
    productId: input.productId,
    contactId,
    customerEmail: input.email,
    amountCents: priceCents,
    description,
    fulfillment: {
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      giftMessage: input.giftMessage,
    },
  });

  if (!checkout.configured || !checkout.checkoutUrl) {
    throw new Error(checkout.error || "Unable to start checkout");
  }

  return {
    paymentRequired: true,
    checkoutUrl: checkout.checkoutUrl,
    sessionId: checkout.sessionId,
  };
}

export async function fulfillStoreCheckoutBySessionId(workspaceId: string, sessionId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Payments are not configured");

  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) throw new Error("Stripe is not connected");

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {},
    { stripeAccount: connection.merchantAccountId },
  );

  if (session.payment_status !== "paid") {
    return { fulfilled: false, status: session.payment_status };
  }

  const outcome = await handleStoreCheckoutCompleted(session);
  return { fulfilled: outcome.handled, result: outcome };
}
