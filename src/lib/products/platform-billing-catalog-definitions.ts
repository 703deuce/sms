/** Product definitions — prices and tiers. Stripe IDs live in catalog-ids-*.ts */

export type MctbTier = "starter" | "growth" | "pro";
export type SmartRoutingTier = "starter" | "business" | "pro";
export type PlatformProductFamily = "mctb" | "smart_routing";

export const MCTB_TIERS: MctbTier[] = ["starter", "growth", "pro"];
export const SMART_ROUTING_TIERS: SmartRoutingTier[] = ["starter", "business", "pro"];

export const MCTB_TIER_PRICES_CENTS: Record<MctbTier, number> = {
  starter: 1999,
  growth: 2999,
  pro: 4999,
};

export const SMART_ROUTING_TIER_PRICES_CENTS: Record<SmartRoutingTier, number> = {
  starter: 1999,
  business: 3999,
  pro: 6999,
};

export const SMART_ROUTING_INCLUDED_MINUTES: Record<SmartRoutingTier, number> = {
  starter: 750,
  business: 2000,
  pro: 4000,
};

export const DUAL_PRODUCT_DISCOUNT_PERCENT = 20;
export const SMART_ROUTING_OVERAGE_CENTS_PER_MINUTE = 2;

export const MCTB_PRODUCT_NAME = "Transovo Missed Call Text Back";
export const SMART_ROUTING_PRODUCT_NAME = "Transovo Smart Routing";
export const DUAL_PRODUCT_COUPON_NAME = "Transovo MCTB + Smart Routing 20%";

export const BILLING_VERSION = "1";

export const ADDON_PRODUCT_DEFS = [
  {
    productKey: "visual_voicemail",
    displayName: "Visual Voicemail",
    description: "Voicemail inbox with playback and transcription.",
    amountCents: 999,
    feature: "visual_voicemail" as const,
  },
  {
    productKey: "callback_requests",
    displayName: "Callback Requests",
    description: "Let callers request a callback from your phone menu.",
    amountCents: 499,
    feature: "callback_requests" as const,
  },
] as const;

export type PlatformCatalogTierIds = {
  stripePriceId: string;
  monthlyPriceCents: number;
  includedMinutes?: number;
};

export type PlatformCatalogIds = {
  mctb: {
    stripeProductId: string;
    tiers: Record<MctbTier, PlatformCatalogTierIds>;
  };
  smart_routing: {
    stripeProductId: string;
    tiers: Record<SmartRoutingTier, PlatformCatalogTierIds>;
  };
  discounts: {
    dualProduct: {
      stripeCouponId: string;
      percentOff: number;
    };
  };
  addons: Record<
    string,
    {
      stripeProductId: string;
      stripePriceId: string;
      monthlyPriceCents: number;
    }
  >;
};
