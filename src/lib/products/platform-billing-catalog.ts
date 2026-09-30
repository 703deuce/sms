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
import { isPlatformFamilyPurchasable } from "@/lib/products/v1-product-status";

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
  const tiers = getPlatformBillingCatalog().mctb.tiers;
  const row = tiers[tier] ?? tiers.text_back ?? tiers.starter;
  if (!row) throw new Error(`Unknown MCTB tier: ${tier}`);
  return row.stripePriceId;
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

export function resolveAddonOneTimePriceId(productKey: string): string | null {
  const addon = getPlatformBillingCatalog().addons[productKey];
  if (!addon?.stripeOneTimePriceId) return null;
  return addon.stripeOneTimePriceId;
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
export type PlatformCheckoutFamily =
  | PlatformProductFamily
  | "addon"
  | "verify_pack"
  | "mctb_ai_recovery"
  | "mctb_own_sender";

export type PlatformProductListItem = {
  productKey: string;
  family: PlatformCheckoutFamily;
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

  const textBackRow = catalog.mctb.tiers.text_back ?? catalog.mctb.tiers.starter;
  items.push({
    productKey: "mctb_text_back",
    family: "mctb",
    tier: "text_back",
    displayName: "Text Back",
    description:
      "50 missed-call recoveries per month, booking links, Press-1 and existing-consent modes.",
    amountCents: textBackRow.monthlyPriceCents,
    feature: "mctb",
  });

  const aiRecoveryAddon = catalog.addons.mctb_ai_recovery;
  if (aiRecoveryAddon) {
    items.push({
      productKey: "mctb_ai_recovery",
      family: "mctb_ai_recovery",
      displayName: "AI Recovery",
      description:
        "100 recoveries per month with AI reply, intake, urgency detection, and lead summary.",
      amountCents: aiRecoveryAddon.monthlyPriceCents,
      feature: "mctb",
    });
  }

  const ownSenderAddon = catalog.addons.mctb_own_sender;
  if (ownSenderAddon) {
    items.push({
      productKey: "mctb_own_sender",
      family: "mctb_own_sender",
      displayName: "Own Local Number",
      description:
        "Your registered local texting number (+$19.50 one-time A2P registration at checkout).",
      amountCents: ownSenderAddon.monthlyPriceCents,
      feature: "mctb",
    });
  }

  for (const tier of ["starter", "business", "pro"] as SmartRoutingTier[]) {
    if (!isPlatformFamilyPurchasable("smart_routing")) continue;
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
    if (!isPlatformFamilyPurchasable("call_forwarding")) continue;
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
    if (!isPlatformFamilyPurchasable("ai_transcription")) continue;
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
    if (!isPlatformFamilyPurchasable("verify_pack")) continue;
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
    if (!isPlatformFamilyPurchasable("addon")) continue;
    if (def.productKey === "mctb_ai_recovery" || def.productKey === "mctb_own_sender") {
      continue;
    }
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
  family: PlatformCheckoutFamily;
  tier?: MctbTier | SmartRoutingTier | CallForwardingTier | AiTranscriptionTier | FaxTier | string;
  verifyPack?: VerifyCreditPack;
  stripePriceId: string;
  feature: TransovoProductFeature;
} {
  if (productKey === "mctb_ai_recovery" || productKey === "mctb_own_sender") {
    return {
      family: productKey,
      tier: "standard",
      stripePriceId: resolveAddonPriceId(productKey),
      feature: "mctb",
    };
  }
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
    if (!isPlatformFamilyPurchasable("verify_pack")) {
      throw new Error("VERIFY_DORMANT");
    }
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
  if (productKey === "mctb_ai_recovery" || productKey === "mctb_own_sender") {
    return [];
  }
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
