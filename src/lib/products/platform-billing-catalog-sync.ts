import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  ADDON_PRODUCT_DEFS,
  BILLING_VERSION,
  DUAL_PRODUCT_COUPON_NAME,
  DUAL_PRODUCT_DISCOUNT_PERCENT,
  MCTB_PRODUCT_NAME,
  MCTB_TIER_PRICES_CENTS,
  MCTB_TIERS,
  SMART_ROUTING_INCLUDED_MINUTES,
  SMART_ROUTING_PRODUCT_NAME,
  SMART_ROUTING_TIER_PRICES_CENTS,
  SMART_ROUTING_TIERS,
  CALL_FORWARDING_PRODUCT_NAME,
  CALL_FORWARDING_INCLUDED_MINUTES,
  CALL_FORWARDING_TIER_PRICES_CENTS,
  CALL_FORWARDING_TIERS,
  AI_TRANSCRIPTION_PRODUCT_NAME,
  AI_TRANSCRIPTION_TIER_PRICES_CENTS,
  AI_TRANSCRIPTION_INCLUDED_MINUTES,
  AI_TRANSCRIPTION_TIERS,
  type AiTranscriptionTier,
  type MctbTier,
  type PlatformCatalogIds,
  type SmartRoutingTier,
} from "@/lib/products/platform-billing-catalog-definitions";

export type CatalogSyncResult = {
  mode: "test" | "live";
  catalog: PlatformCatalogIds;
  created: string[];
  reused: string[];
  warnings: string[];
};

function stripeMode(): "test" | "live" {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_") ? "test" : "live";
}

async function listAllProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const out: Stripe.Product[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.products.list({ limit: 100, starting_after: startingAfter });
    out.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return out;
}

async function listActivePrices(stripe: Stripe, productId: string): Promise<Stripe.Price[]> {
  const out: Stripe.Price[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      starting_after: startingAfter,
    });
    out.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return out;
}

function findProduct(
  products: Stripe.Product[],
  transovoProduct: string,
  billingVersion = BILLING_VERSION,
): Stripe.Product | undefined {
  return products.find(
    (p) =>
      !p.deleted &&
      p.metadata?.transovo_product === transovoProduct &&
      p.metadata?.billing_version === billingVersion,
  );
}

function findTierPrice(
  prices: Stripe.Price[],
  transovoProduct: string,
  tier: string,
  amountCents: number,
  opts?: { metered?: boolean },
): Stripe.Price | undefined {
  return prices.find((p) => {
    if (p.currency !== "usd") return false;
    if (p.metadata?.transovo_product !== transovoProduct) return false;
    if (p.metadata?.tier !== tier) return false;
    if (p.metadata?.billing_version !== BILLING_VERSION) return false;
    if (opts?.metered) {
      return p.recurring?.usage_type === "metered" && p.unit_amount === amountCents;
    }
    return (
      p.recurring?.interval === "month" &&
      p.recurring?.usage_type !== "metered" &&
      p.unit_amount === amountCents
    );
  });
}

async function ensureProduct(
  stripe: Stripe,
  products: Stripe.Product[],
  input: {
    name: string;
    description: string;
    transovoProduct: string;
  },
  audit: { created: string[]; reused: string[] },
): Promise<Stripe.Product> {
  const existing = findProduct(products, input.transovoProduct);
  if (existing) {
    audit.reused.push(`product:${input.transovoProduct}:${existing.id}`);
    return existing;
  }
  const created = await stripe.products.create({
    name: input.name,
    description: input.description,
    metadata: {
      transovo_product: input.transovoProduct,
      billing_version: BILLING_VERSION,
      catalog: "platform",
    },
  });
  products.push(created);
  audit.created.push(`product:${input.transovoProduct}:${created.id}`);
  return created;
}

async function ensureMonthlyPrice(
  stripe: Stripe,
  productId: string,
  transovoProduct: string,
  tier: string,
  amountCents: number,
  extraMetadata: Record<string, string> = {},
  audit: { created: string[]; reused: string[] },
): Promise<Stripe.Price> {
  const prices = await listActivePrices(stripe, productId);
  const existing = findTierPrice(prices, transovoProduct, tier, amountCents);
  if (existing) {
    audit.reused.push(`price:${transovoProduct}:${tier}:${existing.id}`);
    return existing;
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountCents,
    recurring: { interval: "month" },
    metadata: {
      transovo_product: transovoProduct,
      tier,
      billing_version: BILLING_VERSION,
      catalog: "platform",
      ...extraMetadata,
    },
  });
  audit.created.push(`price:${transovoProduct}:${tier}:${created.id}`);
  return created;
}

async function ensureDualProductCoupon(
  stripe: Stripe,
  audit: { created: string[]; reused: string[]; warnings: string[] },
): Promise<Stripe.Coupon> {
  const coupons = await stripe.coupons.list({ limit: 100 });
  const existing = coupons.data.find(
    (c) =>
      c.valid &&
      c.percent_off === DUAL_PRODUCT_DISCOUNT_PERCENT &&
      c.duration === "forever" &&
      c.metadata?.transovo_discount === "dual_product" &&
      c.metadata?.billing_version === BILLING_VERSION,
  );
  if (existing) {
    audit.reused.push(`coupon:dual_product:${existing.id}`);
    return existing;
  }
  const created = await stripe.coupons.create({
    name: DUAL_PRODUCT_COUPON_NAME,
    percent_off: DUAL_PRODUCT_DISCOUNT_PERCENT,
    duration: "forever",
    metadata: {
      transovo_discount: "dual_product",
      billing_version: BILLING_VERSION,
      catalog: "platform",
    },
  });
  audit.created.push(`coupon:dual_product:${created.id}`);
  return created;
}

export async function syncPlatformBillingCatalogToStripe(options?: {
  dryRun?: boolean;
}): Promise<CatalogSyncResult> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const dryRun = options?.dryRun === true;
  const audit = { created: [] as string[], reused: [] as string[], warnings: [] as string[] };
  const products = await listAllProducts(stripe);

  if (dryRun) {
    audit.warnings.push("dry_run: no Stripe objects created");
  }

  const mctbProduct = dryRun
    ? ({ id: "prod_mctb_dry_run" } as Stripe.Product)
    : await ensureProduct(
        stripe,
        products,
        {
          name: MCTB_PRODUCT_NAME,
          description: "Recover missed calls with automatic or Press-1 consent text back.",
          transovoProduct: "mctb",
        },
        audit,
      );

  const mctbTiers = {} as PlatformCatalogIds["mctb"]["tiers"];
  for (const tier of MCTB_TIERS) {
    const amountCents = MCTB_TIER_PRICES_CENTS[tier as MctbTier];
    const price = dryRun
      ? ({ id: `price_mctb_${tier}_dry_run` } as Stripe.Price)
      : await ensureMonthlyPrice(
          stripe,
          mctbProduct.id,
          "mctb",
          tier,
          amountCents,
          {},
          audit,
        );
    mctbTiers[tier as MctbTier] = {
      stripePriceId: price.id,
      monthlyPriceCents: amountCents,
    };
  }

  const srProduct = dryRun
    ? ({ id: "prod_sr_dry_run" } as Stripe.Product)
    : await ensureProduct(
        stripe,
        products,
        {
          name: SMART_ROUTING_PRODUCT_NAME,
          description:
            "Professional call menu and routing on your existing business number.",
          transovoProduct: "smart_routing",
        },
        audit,
      );

  const srTiers = {} as PlatformCatalogIds["smart_routing"]["tiers"];
  for (const tier of SMART_ROUTING_TIERS) {
    const amountCents = SMART_ROUTING_TIER_PRICES_CENTS[tier as SmartRoutingTier];
    const includedMinutes = SMART_ROUTING_INCLUDED_MINUTES[tier as SmartRoutingTier];
    const price = dryRun
      ? ({ id: `price_sr_${tier}_dry_run` } as Stripe.Price)
      : await ensureMonthlyPrice(
          stripe,
          srProduct.id,
          "smart_routing",
          tier,
          amountCents,
          { included_minutes: String(includedMinutes) },
          audit,
        );
    srTiers[tier as SmartRoutingTier] = {
      stripePriceId: price.id,
      monthlyPriceCents: amountCents,
      includedMinutes,
    };
  }

  const cfProduct = dryRun
    ? ({ id: "prod_cf_dry_run" } as Stripe.Product)
    : await ensureProduct(
        stripe,
        products,
        {
          name: CALL_FORWARDING_PRODUCT_NAME,
          description:
            "Business number that rings your existing phone. Voicemail and app-free callbacks included.",
          transovoProduct: "call_forwarding",
        },
        audit,
      );

  const cfTiers = {} as PlatformCatalogIds["call_forwarding"]["tiers"];
  for (const tier of CALL_FORWARDING_TIERS) {
    const amountCents = CALL_FORWARDING_TIER_PRICES_CENTS[tier];
    const includedMinutes = CALL_FORWARDING_INCLUDED_MINUTES[tier];
    const price = dryRun
      ? ({ id: `price_cf_${tier}_dry_run` } as Stripe.Price)
      : await ensureMonthlyPrice(
          stripe,
          cfProduct.id,
          "call_forwarding",
          tier,
          amountCents,
          { included_minutes: String(includedMinutes) },
          audit,
        );
    cfTiers[tier] = {
      stripePriceId: price.id,
      monthlyPriceCents: amountCents,
      includedMinutes,
    };
  }

  const atProduct = dryRun
    ? ({ id: "prod_at_dry_run" } as Stripe.Product)
    : await ensureProduct(
        stripe,
        products,
        {
          name: AI_TRANSCRIPTION_PRODUCT_NAME,
          description:
            "Automatically turn voicemails and recorded calls into readable transcripts.",
          transovoProduct: "ai_transcription",
        },
        audit,
      );

  const atTiers = {} as PlatformCatalogIds["ai_transcription"]["tiers"];
  for (const tier of AI_TRANSCRIPTION_TIERS) {
    const amountCents = AI_TRANSCRIPTION_TIER_PRICES_CENTS[tier as AiTranscriptionTier];
    const includedMinutes = AI_TRANSCRIPTION_INCLUDED_MINUTES[tier as AiTranscriptionTier];
    const price = dryRun
      ? ({ id: `price_at_${tier}_dry_run` } as Stripe.Price)
      : await ensureMonthlyPrice(
          stripe,
          atProduct.id,
          "ai_transcription",
          tier,
          amountCents,
          { included_minutes: String(includedMinutes) },
          audit,
        );
    atTiers[tier as AiTranscriptionTier] = {
      stripePriceId: price.id,
      monthlyPriceCents: amountCents,
      includedMinutes,
    };
  }

  const coupon = dryRun
    ? ({ id: "coupon_dual_dry_run" } as Stripe.Coupon)
    : await ensureDualProductCoupon(stripe, audit);

  const addons: PlatformCatalogIds["addons"] = {};
  for (const def of ADDON_PRODUCT_DEFS) {
    const addonProduct = dryRun
      ? ({ id: `prod_addon_${def.productKey}_dry_run` } as Stripe.Product)
      : await ensureProduct(
          stripe,
          products,
          {
            name: `Transovo ${def.displayName}`,
            description: def.description,
            transovoProduct: def.productKey,
          },
          audit,
        );
    const addonPrice = dryRun
      ? ({ id: `price_addon_${def.productKey}_dry_run` } as Stripe.Price)
      : await ensureMonthlyPrice(
          stripe,
          addonProduct.id,
          def.productKey,
          "default",
          def.amountCents,
          {},
          audit,
        );
    addons[def.productKey] = {
      stripeProductId: addonProduct.id,
      stripePriceId: addonPrice.id,
      monthlyPriceCents: def.amountCents,
    };
  }

  return {
    mode: stripeMode(),
    catalog: {
      mctb: { stripeProductId: mctbProduct.id, tiers: mctbTiers },
      smart_routing: {
        stripeProductId: srProduct.id,
        tiers: srTiers,
      },
      call_forwarding: {
        stripeProductId: cfProduct.id,
        tiers: cfTiers,
      },
      ai_transcription: {
        stripeProductId: atProduct.id,
        tiers: atTiers,
      },
      discounts: {
        dualProduct: {
          stripeCouponId: coupon.id,
          percentOff: DUAL_PRODUCT_DISCOUNT_PERCENT,
        },
      },
      addons,
    },
    created: audit.created,
    reused: audit.reused,
    warnings: audit.warnings,
  };
}
