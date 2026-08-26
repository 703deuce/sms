import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
  MASS_TEXT_ADDITIONAL_NUMBER,
  MASS_TEXT_MONTHLY_PLANS,
  MASS_TEXT_MONTHLY_TIERS,
  MASS_TEXT_PAYG_LINE,
  MASS_TEXT_PAYG_PACKS,
  MASS_TEXT_PAYG_PACK_KEYS,
  MASS_TEXT_PRICING_VERSION,
  type MassTextMonthlyTier,
  type MassTextPaygPackKey,
} from "@/lib/mass-texting/pricing";
import type { MassTextingStripeCatalogIds } from "@/lib/mass-texting/stripe-catalog-types";

export type MassTextCatalogSyncResult = {
  mode: "test" | "live";
  catalog: MassTextingStripeCatalogIds;
  created: string[];
  reused: string[];
  warnings: string[];
};

const PRODUCT_NAME = "Transovo Mass Texting";

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

function findProduct(products: Stripe.Product[]): Stripe.Product | undefined {
  return products.find(
    (p) =>
      !p.deleted &&
      p.metadata?.product === "mass_texting" &&
      p.metadata?.version === String(MASS_TEXT_PRICING_VERSION),
  );
}

function findPrice(
  prices: Stripe.Price[],
  metadata: Record<string, string>,
  amountCents: number,
  recurring?: "month",
): Stripe.Price | undefined {
  return prices.find((p) => {
    if (p.currency !== "usd") return false;
    if (p.unit_amount !== amountCents) return false;
    for (const [k, v] of Object.entries(metadata)) {
      if (p.metadata?.[k] !== v) return false;
    }
    if (recurring) return p.recurring?.interval === recurring;
    return !p.recurring;
  });
}

async function ensureProduct(
  stripe: Stripe,
  products: Stripe.Product[],
  dryRun: boolean,
  result: MassTextCatalogSyncResult,
): Promise<string> {
  const existing = findProduct(products);
  if (existing) {
    result.reused.push(`product:${existing.id}`);
    return existing.id;
  }
  if (dryRun) {
    result.created.push("product:mass_texting");
    return "prod_mass_texting_dry_run";
  }
  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    metadata: {
      product: "mass_texting",
      version: String(MASS_TEXT_PRICING_VERSION),
    },
  });
  result.created.push(`product:${created.id}`);
  return created.id;
}

async function ensurePrice(input: {
  stripe: Stripe;
  prices: Stripe.Price[];
  productId: string;
  amountCents: number;
  metadata: Record<string, string>;
  recurring?: "month";
  dryRun: boolean;
  result: MassTextCatalogSyncResult;
  label: string;
}): Promise<string> {
  const existing = findPrice(input.prices, input.metadata, input.amountCents, input.recurring);
  if (existing) {
    input.result.reused.push(`price:${input.label}:${existing.id}`);
    return existing.id;
  }
  if (input.dryRun) {
    input.result.created.push(`price:${input.label}`);
    return `price_mt_${input.label}_dry_run`;
  }
  const created = await input.stripe.prices.create({
    product: input.productId,
    currency: "usd",
    unit_amount: input.amountCents,
    ...(input.recurring
      ? { recurring: { interval: input.recurring } }
      : {}),
    metadata: {
      product: "mass_texting",
      version: String(MASS_TEXT_PRICING_VERSION),
      ...input.metadata,
    },
  });
  input.result.created.push(`price:${input.label}:${created.id}`);
  return created.id;
}

export async function syncMassTextingCatalogToStripe(options?: {
  dryRun?: boolean;
}): Promise<MassTextCatalogSyncResult> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured");

  const dryRun = options?.dryRun ?? false;
  const result: MassTextCatalogSyncResult = {
    mode: stripeMode(),
    catalog: {
      stripeProductId: "",
      monthly: {
        starter: { stripePriceId: "" },
        growth: { stripePriceId: "" },
        pro: { stripePriceId: "" },
        business: { stripePriceId: "" },
        scale: { stripePriceId: "" },
      },
      payg_line: { stripePriceId: "" },
      payg_packs: {
        pack_500: { stripePriceId: "" },
        pack_1000: { stripePriceId: "" },
        pack_2500: { stripePriceId: "" },
        pack_5000: { stripePriceId: "" },
        pack_10000: { stripePriceId: "" },
      },
      a2p_registration: { stripePriceId: "" },
      additional_number: { stripePriceId: "" },
    },
    created: [],
    reused: [],
    warnings: [],
  };

  const products = await listAllProducts(stripe);
  const productId = await ensureProduct(stripe, products, dryRun, result);
  result.catalog.stripeProductId = productId;

  const prices = dryRun ? [] : await listActivePrices(stripe, productId);

  for (const tier of MASS_TEXT_MONTHLY_TIERS) {
    const plan = MASS_TEXT_MONTHLY_PLANS[tier];
    result.catalog.monthly[tier].stripePriceId = await ensurePrice({
      stripe,
      prices,
      productId,
      amountCents: plan.monthlyPriceCents,
      metadata: { billing_model: "monthly", plan: tier },
      recurring: "month",
      dryRun,
      result,
      label: `monthly_${tier}`,
    });
  }

  result.catalog.payg_line.stripePriceId = await ensurePrice({
    stripe,
    prices,
    productId,
    amountCents: MASS_TEXT_PAYG_LINE.monthlyPriceCents,
    metadata: { billing_model: "payg_line" },
    recurring: "month",
    dryRun,
    result,
    label: "payg_line",
  });

  for (const packKey of MASS_TEXT_PAYG_PACK_KEYS) {
    const pack = MASS_TEXT_PAYG_PACKS[packKey];
    result.catalog.payg_packs[packKey].stripePriceId = await ensurePrice({
      stripe,
      prices,
      productId,
      amountCents: pack.priceCents,
      metadata: { billing_model: "payg_pack", segments: String(pack.segments), pack: packKey },
      dryRun,
      result,
      label: packKey,
    });
  }

  result.catalog.a2p_registration.stripePriceId = await ensurePrice({
    stripe,
    prices,
    productId,
    amountCents: MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
    metadata: { billing_model: "a2p_registration" },
    dryRun,
    result,
    label: "a2p_registration",
  });

  result.catalog.additional_number.stripePriceId = await ensurePrice({
    stripe,
    prices,
    productId,
    amountCents: MASS_TEXT_ADDITIONAL_NUMBER.monthlyPriceCents,
    metadata: { billing_model: "additional_number" },
    recurring: "month",
    dryRun,
    result,
    label: "additional_number",
  });

  return result;
}

export function catalogToTsExport(
  mode: "test" | "live",
  catalog: MassTextingStripeCatalogIds,
): string {
  const constName =
    mode === "test" ? "MASS_TEXTING_STRIPE_CATALOG_TEST" : "MASS_TEXTING_STRIPE_CATALOG_LIVE";
  return `/** Auto-generated by scripts/sync-mass-texting-stripe-catalog.ts — ${mode} mode */\nimport type { MassTextingStripeCatalogIds } from "./stripe-catalog-types";\n\nexport const ${constName}: MassTextingStripeCatalogIds = ${JSON.stringify(catalog, null, 2)} as const;\n`;
}
