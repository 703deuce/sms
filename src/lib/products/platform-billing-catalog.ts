import {
  ADDON_PRODUCT_DEFS,
  type AiTranscriptionTier,
  type CallForwardingTier,
  type FaxTier,
  type MctbTier,
  type PlatformCatalogIds,
  type PlatformProductFamily,
  type SmartRoutingTier,
  type VerifyCreditPack,
} from "@/lib/products/platform-billing-catalog-definitions";
import { PLATFORM_BILLING_CATALOG_LIVE } from "@/lib/products/platform-billing-catalog-ids-live";
import { PLATFORM_BILLING_CATALOG_TEST } from "@/lib/products/platform-billing-catalog-ids-test";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

export type { MctbTier, SmartRoutingTier, CallForwardingTier, AiTranscriptionTier, FaxTier, VerifyCreditPack, PlatformProductFamily, PlatformCatalogIds };

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

export function resolveCallForwardingPriceId(tier: CallForwardingTier = "standard"): string {
  return getPlatformBillingCatalog().call_forwarding.tiers[tier].stripePriceId;
}

export function resolveAiTranscriptionPriceId(tier: AiTranscriptionTier): string {
  return getPlatformBillingCatalog().ai_transcription.tiers[tier].stripePriceId;
}

export function resolveFaxPriceId(tier: FaxTier): string {
  return getPlatformBillingCatalog().fax.tiers[tier].stripePriceId;
}

export function resolveVerifyCreditPackPriceId(pack: VerifyCreditPack): string {
  return getPlatformBillingCatalog().verify.packs[pack].stripePriceId;
}

export function creditsForVerifyPack(pack: VerifyCreditPack): number {
  return getPlatformBillingCatalog().verify.packs[pack].credits;
}

export function includedPagesForFaxTier(tier: FaxTier): number {
  return getPlatformBillingCatalog().fax.tiers[tier].includedPages;
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

export function includedMinutesForAiTranscriptionTier(tier: AiTranscriptionTier): number {
  return getPlatformBillingCatalog().ai_transcription.tiers[tier].includedMinutes ?? 0;
}

export function includedMinutesForCallForwardingTier(tier: CallForwardingTier = "standard"): number {
  return getPlatformBillingCatalog().call_forwarding.tiers[tier].includedMinutes ?? 0;
}

export function featureForProductFamily(family: PlatformProductFamily): TransovoProductFeature {
  if (family === "ai_transcription") return "ai_transcription";
  if (family === "fax") return "fax";
  return family;
}

export function addonFeature(productKey: string): TransovoProductFeature | null {
  const row = ADDON_PRODUCT_DEFS.find((d) => d.productKey === productKey);
  return row?.feature ?? null;
}

/** Legacy flat list for trial route compatibility. */
export type PlatformProductListItem = {
  productKey: string;
  family: PlatformProductFamily | "addon" | "verify_pack";
  tier?: MctbTier | SmartRoutingTier | CallForwardingTier | AiTranscriptionTier;
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
      description:
        "Professional call menu and routing. Call recording and AI summaries included.",
      amountCents: row.monthlyPriceCents,
      includedMinutes: row.includedMinutes,
      feature: "smart_routing",
    });
  }

  for (const tier of ["standard"] as CallForwardingTier[]) {
    const row = catalog.call_forwarding.tiers[tier];
    items.push({
      productKey: `call_forwarding_${tier}`,
      family: "call_forwarding",
      tier,
      displayName: "Call Forwarding",
      description:
        "Business number that rings your existing phone. Voicemail, business hours, and app-free callbacks.",
      amountCents: row.monthlyPriceCents,
      includedMinutes: row.includedMinutes,
      feature: "call_forwarding",
    });
  }

  for (const tier of ["starter", "business", "pro"] as AiTranscriptionTier[]) {
    const row = catalog.ai_transcription.tiers[tier];
    items.push({
      productKey: `ai_transcription_${tier}`,
      family: "ai_transcription",
      tier,
      displayName: `AI Transcription ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
      description:
        "Turn recorded calls and voicemails into searchable, readable transcripts. AI summaries included.",
      amountCents: row.monthlyPriceCents,
      includedMinutes: row.includedMinutes,
      feature: "ai_transcription",
    });
  }

  for (const tier of ["starter", "business", "pro"] as FaxTier[]) {
    const row = catalog.fax.tiers[tier];
    items.push({
      productKey: `fax_${tier}`,
      family: "fax",
      tier,
      displayName: `Fax ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
      description: "Send and receive faxes online with AI document intelligence.",
      amountCents: row.monthlyPriceCents,
      feature: "fax",
    });
  }

  for (const pack of ["1000", "5000", "10000", "50000"] as VerifyCreditPack[]) {
    const row = catalog.verify.packs[pack];
    items.push({
      productKey: `verify_${pack}`,
      family: "verify_pack",
      displayName: `${row.credits.toLocaleString()} Verification Credits`,
      description: "Phone number verification and list cleaning credits.",
      amountCents: row.amountCents,
      feature: "verify",
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
  family: PlatformProductFamily | "addon" | "verify_pack";
  tier?: MctbTier | SmartRoutingTier | CallForwardingTier | AiTranscriptionTier | FaxTier;
  verifyPack?: VerifyCreditPack;
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
  if (productKey.startsWith("call_forwarding_")) {
    const tier = productKey.replace("call_forwarding_", "") as CallForwardingTier;
    return {
      family: "call_forwarding",
      tier,
      stripePriceId: resolveCallForwardingPriceId(tier),
      feature: "call_forwarding",
    };
  }
  if (productKey.startsWith("ai_transcription_")) {
    const tier = productKey.replace("ai_transcription_", "") as AiTranscriptionTier;
    return {
      family: "ai_transcription",
      tier,
      stripePriceId: resolveAiTranscriptionPriceId(tier),
      feature: "ai_transcription",
    };
  }
  if (productKey.startsWith("fax_")) {
    const tier = productKey.replace("fax_", "") as FaxTier;
    return {
      family: "fax",
      tier,
      stripePriceId: resolveFaxPriceId(tier),
      feature: "fax",
    };
  }
  if (productKey.startsWith("verify_")) {
    const pack = productKey.replace("verify_", "") as VerifyCreditPack;
    return {
      family: "verify_pack",
      verifyPack: pack,
      stripePriceId: resolveVerifyCreditPackPriceId(pack),
      feature: "verify",
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
