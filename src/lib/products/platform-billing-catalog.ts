import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { MARKETPLACE_PRODUCT_KEY } from "@/lib/payments/stripe-marketplace-metadata";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

export type PlatformProductDef = {
  productKey: string;
  feature: TransovoProductFeature | "bundle_mctb_sr";
  displayName: string;
  description: string;
  amountCents: number;
  grantsFeatures?: TransovoProductFeature[];
};

/** Workspace-level Transovo subscriptions (not per-number marketplace). */
export const PLATFORM_BILLING_CATALOG: PlatformProductDef[] = [
  {
    productKey: "mctb",
    feature: "mctb",
    displayName: "Missed Call Text Back",
    description: "Recover missed calls with automatic or Press-1 consent text back.",
    amountCents: 2900,
    grantsFeatures: ["mctb"],
  },
  {
    productKey: "smart_routing",
    feature: "smart_routing",
    displayName: "Smart Routing",
    description: "Professional call menu and routing on your existing business number.",
    amountCents: 3900,
    grantsFeatures: ["smart_routing"],
  },
  {
    productKey: "bundle_mctb_sr",
    feature: "bundle_mctb_sr",
    displayName: "MCTB + Smart Routing Bundle",
    description: "Missed call recovery plus call routing on the number you already have.",
    amountCents: 5900,
    grantsFeatures: ["mctb", "smart_routing"],
  },
  {
    productKey: "visual_voicemail",
    feature: "visual_voicemail",
    displayName: "Visual Voicemail",
    description: "Voicemail inbox with playback and transcription.",
    amountCents: 999,
    grantsFeatures: ["visual_voicemail"],
  },
  {
    productKey: "callback_requests",
    feature: "callback_requests",
    displayName: "Callback Requests",
    description: "Let callers request a callback from your phone menu.",
    amountCents: 499,
    grantsFeatures: ["callback_requests"],
  },
];

function catalogDef(productKey: string): PlatformProductDef {
  const row = PLATFORM_BILLING_CATALOG.find((p) => p.productKey === productKey);
  if (!row) throw new Error(`Unknown platform product key: ${productKey}`);
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

export async function syncPlatformBillingCatalog(): Promise<
  Array<{ productKey: string; stripeProductId: string | null; stripePriceId: string | null }>
> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const prisma = getPrisma();
  const out: Array<{
    productKey: string;
    stripeProductId: string | null;
    stripePriceId: string | null;
  }> = [];

  for (const def of PLATFORM_BILLING_CATALOG) {
    let stripeProduct = await findStripeProductByKey(def.productKey);
    if (!stripeProduct) {
      stripeProduct = await stripe.products.create({
        name: def.displayName,
        description: def.description,
        metadata: { [MARKETPLACE_PRODUCT_KEY]: def.productKey, catalog: "platform" },
      });
    }
    const prices = await stripe.prices.list({
      product: stripeProduct.id,
      active: true,
      limit: 100,
    });
    let price =
      prices.data.find(
        (p) =>
          p.recurring?.interval === "month" &&
          p.currency === "usd" &&
          p.unit_amount === def.amountCents,
      ) ?? null;
    if (!price) {
      price = await stripe.prices.create({
        product: stripeProduct.id,
        currency: "usd",
        unit_amount: def.amountCents,
        recurring: { interval: "month" },
        metadata: { [MARKETPLACE_PRODUCT_KEY]: def.productKey, catalog: "platform" },
      });
    }
    out.push({
      productKey: def.productKey,
      stripeProductId: stripeProduct.id,
      stripePriceId: price.id,
    });
  }

  return out;
}

export function platformPriceIdFromEnv(productKey: string): string | null {
  const envKey = `STRIPE_PRICE_PLATFORM_${productKey.toUpperCase().replace(/-/g, "_")}`;
  const val = process.env[envKey];
  return val?.trim() || null;
}

export async function resolvePlatformCheckoutPriceId(productKey: string): Promise<string> {
  const fromEnv = platformPriceIdFromEnv(productKey);
  if (fromEnv) return fromEnv;
  const synced = await syncPlatformBillingCatalog();
  const row = synced.find((r) => r.productKey === productKey);
  if (!row?.stripePriceId) throw new Error(`No Stripe price for platform product ${productKey}`);
  return row.stripePriceId;
}

export function grantsForPlatformProduct(productKey: string): TransovoProductFeature[] {
  return catalogDef(productKey).grantsFeatures ?? [];
}
