import {
  ADDON_PRODUCT_DEFS,
  type MctbTier,
  type PlatformCatalogIds,
  type PlatformProductFamily,
  type SmartRoutingTier,
} from "@/lib/products/platform-billing-catalog-definitions";
import { PLATFORM_BILLING_CATALOG_LIVE } from "@/lib/products/platform-billing-catalog-ids-live";
import { PLATFORM_BILLING_CATALOG_TEST } from "@/lib/products/platform-billing-catalog-ids-test";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

export type { MctbTier, SmartRoutingTier, PlatformProductFamily, PlatformCatalogIds };

export function stripeBillingMode(): "test" | "live" {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_") ? "test" : "live";
}

export function getPlatformBillingCatalog(): PlatformCatalogIds {
  return stripeBillingMode() === "test"
    ? PLATFORM_BILLING_CATALOG_TEST
    : PLATFORM_BILLING_CATALOG_LIVE;
}

export function resolveMctbPriceId(tier: MctbTier): string {
  return getPlatformBillingCatalog().mctb.tiers[tier].stripePriceId;
}

export function resolveSmartRoutingPriceId(tier: SmartRoutingTier): string {
  return getPlatformBillingCatalog().smart_routing.tiers[tier].stripePriceId;
}

export function resolveAddonPriceId(productKey: string): string {
  const addon = getPlatformBillingCatalog().addons[productKey];
  if (!addon) throw new Error(`Unknown addon product: ${productKey}`);
  return addon.stripePriceId;
}

export function dualProductCouponId(): string {
  return getPlatformBillingCatalog().discounts.dualProduct.stripeCouponId;
}

export function includedMinutesForSmartRoutingTier(tier: SmartRoutingTier): number {
  return getPlatformBillingCatalog().smart_routing.tiers[tier].includedMinutes ?? 0;
}

export function featureForProductFamily(family: PlatformProductFamily): TransovoProductFeature {
  return family;
}

export function addonFeature(productKey: string): TransovoProductFeature | null {
  const row = ADDON_PRODUCT_DEFS.find((d) => d.productKey === productKey);
  return row?.feature ?? null;
}

/** Legacy flat list for trial route compatibility. */
export type PlatformProductListItem = {
  productKey: string;
  family: PlatformProductFamily | "addon";
  tier?: MctbTier | SmartRoutingTier;
  displayName: string;
  description: string;
  amountCents: number;
  includedMinutes?: number;
  feature: TransovoProductFeature;
};

export function listPlatformPurchasableProducts(): PlatformProductListItem[] {
  const catalog = getPlatformBillingCatalog();
  const items: PlatformProductListItem[] = [];

  for (const tier of ["starter", "growth", "pro"] as MctbTier[]) {
    const row = catalog.mctb.tiers[tier];
    items.push({
      productKey: `mctb_${tier}`,
      family: "mctb",
      tier,
      displayName: `MCTB ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
      description: "Recover missed calls with automatic or Press-1 consent text back.",
      amountCents: row.monthlyPriceCents,
      feature: "mctb",
    });
  }

  for (const tier of ["starter", "business", "pro"] as SmartRoutingTier[]) {
    const row = catalog.smart_routing.tiers[tier];
    items.push({
      productKey: `smart_routing_${tier}`,
      family: "smart_routing",
      tier,
      displayName: `Smart Routing ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
      description: "Professional call menu and routing on your existing business number.",
      amountCents: row.monthlyPriceCents,
      includedMinutes: row.includedMinutes,
      feature: "smart_routing",
    });
  }

  for (const def of ADDON_PRODUCT_DEFS) {
    const addon = catalog.addons[def.productKey];
    if (!addon) continue;
    items.push({
      productKey: def.productKey,
      family: "addon",
      displayName: def.displayName,
      description: def.description,
      amountCents: addon.monthlyPriceCents,
      feature: def.feature,
    });
  }

  return items;
}

export function parseCheckoutSelection(productKey: string): {
  family: PlatformProductFamily | "addon";
  tier?: MctbTier | SmartRoutingTier;
  stripePriceId: string;
  feature: TransovoProductFeature;
} {
  if (productKey.startsWith("mctb_")) {
    const tier = productKey.replace("mctb_", "") as MctbTier;
    return {
      family: "mctb",
      tier,
      stripePriceId: resolveMctbPriceId(tier),
      feature: "mctb",
    };
  }
  if (productKey.startsWith("smart_routing_")) {
    const tier = productKey.replace("smart_routing_", "") as SmartRoutingTier;
    return {
      family: "smart_routing",
      tier,
      stripePriceId: resolveSmartRoutingPriceId(tier),
      feature: "smart_routing",
    };
  }
  const addonFeatureKey = addonFeature(productKey);
  if (addonFeatureKey) {
    return {
      family: "addon",
      stripePriceId: resolveAddonPriceId(productKey),
      feature: addonFeatureKey,
    };
  }
  throw new Error(`Unknown platform product key: ${productKey}`);
}

/** @deprecated Use parseCheckoutSelection — kept for webhook migration. */
export function grantsForPlatformProduct(productKey: string): TransovoProductFeature[] {
  try {
    const sel = parseCheckoutSelection(productKey);
    return [sel.feature];
  } catch {
    if (productKey === "bundle_mctb_sr") return ["mctb", "smart_routing"];
    if (productKey === "mctb") return ["mctb"];
    if (productKey === "smart_routing") return ["smart_routing"];
    return [];
  }
}

/** @deprecated Runtime uses code-owned catalog IDs. */
export async function resolvePlatformCheckoutPriceId(productKey: string): Promise<string> {
  return parseCheckoutSelection(productKey).stripePriceId;
}

/** @deprecated Env overrides removed — catalog is code-owned. */
export function platformPriceIdFromEnv(_productKey: string): string | null {
  return null;
}

/** @deprecated Use listPlatformPurchasableProducts */
export const PLATFORM_BILLING_CATALOG = listPlatformPurchasableProducts();

/** @deprecated */
export async function syncPlatformBillingCatalog() {
  const { syncPlatformBillingCatalogToStripe } = await import(
    "@/lib/products/platform-billing-catalog-sync"
  );
  const result = await syncPlatformBillingCatalogToStripe();
  return Object.entries(result.catalog.mctb.tiers).map(([tier, row]) => ({
    productKey: `mctb_${tier}`,
    stripeProductId: result.catalog.mctb.stripeProductId,
    stripePriceId: row.stripePriceId,
  }));
}
