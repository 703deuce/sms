import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { MARKETPLACE_PRODUCT_KEY } from "@/lib/payments/stripe-marketplace-metadata";

export type CatalogProductDef = {
  productKey: string;
  displayName: string;
  description: string;
  amountCents: number;
  includedUsageMinutes?: number;
};

export const MARKETPLACE_BILLING_CATALOG: CatalogProductDef[] = [
  {
    productKey: "vault",
    displayName: "Transovo Number Vault",
    description: "Secure number parking and vault storage.",
    amountCents: 299,
  },
  {
    productKey: "voicemail",
    displayName: "Transovo Voicemail",
    description: "Voicemail for your Transovo number.",
    amountCents: 499,
  },
  {
    productKey: "forwarding_200",
    displayName: "Transovo Call Forwarding",
    description: "Call forwarding with 200 included forwarding minutes per monthly billing period.",
    amountCents: 999,
    includedUsageMinutes: 200,
  },
];

function catalogDef(productKey: string): CatalogProductDef {
  const row = MARKETPLACE_BILLING_CATALOG.find((p) => p.productKey === productKey);
  if (!row) throw new Error(`Unknown marketplace product key: ${productKey}`);
  return row;
}

async function findStripeProductByKey(productKey: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.products.list({ limit: 100, starting_after: startingAfter });
    const match = page.data.find(
      (p) => p.metadata?.[MARKETPLACE_PRODUCT_KEY] === productKey && !p.deleted,
    );
    if (match) return match;
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return null;
}

async function findStripePriceForProduct(stripeProductId: string, amountCents: number) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const prices = await stripe.prices.list({
    product: stripeProductId,
    active: true,
    limit: 100,
  });
  return (
    prices.data.find(
      (p) =>
        p.recurring?.interval === "month" &&
        p.currency === "usd" &&
        p.unit_amount === amountCents &&
        p.metadata?.[MARKETPLACE_PRODUCT_KEY] !== "legacy",
    ) ?? null
  );
}

export async function syncMarketplaceBillingCatalog(): Promise<
  Array<{
    productKey: string;
    stripeProductId: string | null;
    stripePriceId: string | null;
    amountCents: number;
    active: boolean;
  }>
> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const prisma = getPrisma();
  const results: Array<{
    productKey: string;
    stripeProductId: string | null;
    stripePriceId: string | null;
    amountCents: number;
    active: boolean;
  }> = [];

  for (const def of MARKETPLACE_BILLING_CATALOG) {
    let row = await prisma.marketplaceBillingProduct.findUnique({
      where: { productKey: def.productKey },
    });

    let stripeProductId = row?.stripeProductId ?? null;
    if (stripeProductId) {
      try {
        const existing = await stripe.products.retrieve(stripeProductId);
        if (existing.deleted) stripeProductId = null;
      } catch {
        stripeProductId = null;
      }
    }
    if (!stripeProductId) {
      const found = await findStripeProductByKey(def.productKey);
      stripeProductId = found?.id ?? null;
    }
    if (!stripeProductId) {
      const created = await stripe.products.create({
        name: def.displayName,
        description: def.description,
        metadata: { [MARKETPLACE_PRODUCT_KEY]: def.productKey },
      });
      stripeProductId = created.id;
    }

    let stripePriceId = row?.stripePriceId ?? null;
    let priceValid = false;
    if (stripePriceId) {
      try {
        const price = await stripe.prices.retrieve(stripePriceId);
        priceValid =
          price.active &&
          price.unit_amount === def.amountCents &&
          price.recurring?.interval === "month";
      } catch {
        priceValid = false;
      }
    }
    if (!priceValid) {
      const foundPrice = await findStripePriceForProduct(stripeProductId, def.amountCents);
      if (foundPrice) {
        stripePriceId = foundPrice.id;
      } else {
        const createdPrice = await stripe.prices.create({
          product: stripeProductId,
          currency: "usd",
          unit_amount: def.amountCents,
          recurring: { interval: "month" },
          metadata: { [MARKETPLACE_PRODUCT_KEY]: def.productKey },
        });
        stripePriceId = createdPrice.id;
      }
    }

    const previousPriceId = row?.stripePriceId ?? null;
    if (previousPriceId && stripePriceId && previousPriceId !== stripePriceId) {
      try {
        await stripe.prices.update(previousPriceId, { active: false });
      } catch {
        // old price may already be inactive
      }
    }

    row = await prisma.marketplaceBillingProduct.upsert({
      where: { productKey: def.productKey },
      create: {
        productKey: def.productKey,
        displayName: def.displayName,
        description: def.description,
        amountCents: def.amountCents,
        includedUsageMinutes: def.includedUsageMinutes ?? null,
        stripeProductId,
        stripePriceId,
        active: true,
      },
      update: {
        displayName: def.displayName,
        description: def.description,
        amountCents: def.amountCents,
        includedUsageMinutes: def.includedUsageMinutes ?? null,
        stripeProductId,
        stripePriceId,
        active: true,
      },
    });

    if (stripePriceId) {
      if (previousPriceId && previousPriceId !== stripePriceId) {
        await prisma.marketplaceBillingPriceHistory.updateMany({
          where: { productId: row.id, stripePriceId: previousPriceId },
          data: { activeForNewPurchases: false },
        });
      }
      await prisma.marketplaceBillingPriceHistory.upsert({
        where: { stripePriceId },
        create: {
          productId: row.id,
          stripePriceId,
          amountCents: def.amountCents,
          activeForNewPurchases: true,
        },
        update: {
          productId: row.id,
          amountCents: def.amountCents,
          activeForNewPurchases: true,
        },
      });
    }

    results.push({
      productKey: def.productKey,
      stripeProductId,
      stripePriceId,
      amountCents: def.amountCents,
      active: row.active,
    });
  }

  return results;
}

export async function getMarketplaceBillingProduct(productKey: string) {
  const prisma = getPrisma();
  let row = await prisma.marketplaceBillingProduct.findUnique({ where: { productKey } });
  if (!row?.stripePriceId) {
    await syncMarketplaceBillingCatalog();
    row = await prisma.marketplaceBillingProduct.findUnique({ where: { productKey } });
  }
  if (!row?.stripePriceId) {
    throw new Error(`Marketplace billing product not provisioned: ${productKey}`);
  }
  catalogDef(productKey);
  return row;
}

export async function listMarketplaceBillingCatalog() {
  const prisma = getPrisma();
  const rows = await prisma.marketplaceBillingProduct.findMany({
    where: { active: true },
    orderBy: { amountCents: "asc" },
  });
  if (rows.length < MARKETPLACE_BILLING_CATALOG.length) {
    await syncMarketplaceBillingCatalog();
    return prisma.marketplaceBillingProduct.findMany({
      where: { active: true },
      orderBy: { amountCents: "asc" },
    });
  }
  return rows;
}
