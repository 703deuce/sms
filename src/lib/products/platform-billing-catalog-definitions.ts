/** Product definitions — prices and tiers. Stripe IDs live in catalog-ids-*.ts */

export type MctbTier = "text_back" | "starter" | "growth" | "pro";
export type SmartRoutingTier = "starter" | "business" | "pro";
export type CallForwardingTier = "standard";
export type AiTranscriptionTier = "starter" | "business" | "pro";
export type FaxTier = "starter" | "business" | "pro";
export type VerifyCreditPack = "1000" | "5000" | "10000" | "50000";
export type PlatformProductFamily =
  | "mctb"
  | "smart_routing"
  | "call_forwarding"
  | "ai_transcription"
  | "fax";

/** Purchasable MCTB subscription tier for new checkouts (`mctb_pro`). */
export const MCTB_PRIMARY_TIER: MctbTier = "pro";

export const MCTB_TIERS: MctbTier[] = ["text_back", "starter", "growth", "pro"];
export const SMART_ROUTING_TIERS: SmartRoutingTier[] = ["starter", "business", "pro"];
export const CALL_FORWARDING_TIERS: CallForwardingTier[] = ["standard"];
export const AI_TRANSCRIPTION_TIERS: AiTranscriptionTier[] = ["starter", "business", "pro"];
export const FAX_TIERS: FaxTier[] = ["starter", "business", "pro"];
export const VERIFY_CREDIT_PACKS: VerifyCreditPack[] = ["1000", "5000", "10000", "50000"];

export const MCTB_TIER_PRICES_CENTS: Record<MctbTier, number> = {
  text_back: 1999,
  starter: 1999,
  growth: 1999,
  pro: 1999,
};

export const MCTB_TIER_DISPLAY_NAMES: Record<MctbTier, string> = {
  text_back: "Pro",
  starter: "Pro",
  growth: "Pro",
  pro: "Pro",
};

export const SMART_ROUTING_TIER_PRICES_CENTS: Record<SmartRoutingTier, number> = {
  starter: 1999,
  business: 3999,
  pro: 6999,
};

export const CALL_FORWARDING_TIER_PRICES_CENTS: Record<CallForwardingTier, number> = {
  standard: 2999,
};

export const CALL_FORWARDING_INCLUDED_MINUTES: Record<CallForwardingTier, number> = {
  standard: 2000,
};

export const SMART_ROUTING_INCLUDED_MINUTES: Record<SmartRoutingTier, number> = {
  starter: 750,
  business: 2000,
  pro: 4000,
};

export const AI_TRANSCRIPTION_TIER_PRICES_CENTS: Record<AiTranscriptionTier, number> = {
  starter: 799,
  business: 1999,
  pro: 3999,
};

export const AI_TRANSCRIPTION_INCLUDED_MINUTES: Record<AiTranscriptionTier, number> = {
  starter: 750,
  business: 2000,
  pro: 4000,
};

export const FAX_TIER_PRICES_CENTS: Record<FaxTier, number> = {
  starter: 999,
  business: 1499,
  pro: 2499,
};

export const FAX_TIER_INCLUDED_PAGES: Record<FaxTier, number> = {
  starter: 200,
  business: 500,
  pro: 1000,
};

export const FAX_OVERAGE_CENTS_PER_PAGE = 5;

export const VERIFY_CREDIT_PACK_PRICES_CENTS: Record<VerifyCreditPack, number> = {
  "1000": 999,
  "5000": 1999,
  "10000": 3499,
  "50000": 9900,
};

export const VERIFY_CREDIT_PACK_QUANTITIES: Record<VerifyCreditPack, number> = {
  "1000": 1000,
  "5000": 5000,
  "10000": 10000,
  "50000": 50000,
};

export const FAX_PRODUCT_NAME = "Transovo Fax";
export const VERIFY_PRODUCT_NAME = "Transovo Verify";

export const DUAL_PRODUCT_DISCOUNT_PERCENT = 20;
export const SMART_ROUTING_OVERAGE_CENTS_PER_MINUTE = 2;

export const MCTB_PRODUCT_NAME = "Transovo Missed Call Text Back";
export const SMART_ROUTING_PRODUCT_NAME = "Transovo Smart Routing";
export const CALL_FORWARDING_PRODUCT_NAME = "Transovo Call Forwarding";
export const AI_TRANSCRIPTION_PRODUCT_NAME = SMART_ROUTING_PRODUCT_NAME.replace(
  "Smart Routing",
  "AI Transcription",
);
export const DUAL_PRODUCT_COUPON_NAME = "Transovo MCTB + Smart Routing 20%";

export const BILLING_VERSION = "2";

export const ADDON_PRODUCT_DEFS = [
  {
    productKey: "visual_voicemail",
    displayName: "Visual Voicemail",
    description: "Voicemail inbox with playback.",
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
  {
    productKey: "mctb_ai_recovery",
    displayName: "AI Recovery",
    description:
      "100 recoveries/mo. AI handles replies, custom intake, urgency detection, and lead summary.",
    amountCents: 1999,
    feature: "mctb" as const,
  },
  {
    productKey: "mctb_own_sender",
    displayName: "Customer-owned A2P messaging",
    description:
      "Optional add-on on any plan: $19.50 one-time carrier registration (pass-through) plus $10/month standard campaign fee (pass-through). Unlocks customer-branded texting and manual two-way conversations after approval.",
    amountCents: 1000,
    feature: "mctb" as const,
  },
] as const;

/** One-time fee bundled at Own Local Number checkout (carrier A2P registration). */
export const MCTB_OWN_SENDER_A2P_REGISTRATION_CENTS = 1950;

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
  call_forwarding: {
    stripeProductId: string;
    tiers: Record<CallForwardingTier, PlatformCatalogTierIds>;
  };
  ai_transcription: {
    stripeProductId: string;
    tiers: Record<AiTranscriptionTier, PlatformCatalogTierIds>;
  };
  fax: {
    stripeProductId: string;
    tiers: Record<FaxTier, PlatformCatalogTierIds & { includedPages: number }>;
  };
  verify: {
    stripeProductId: string;
    packs: Record<
      VerifyCreditPack,
      { stripePriceId: string; amountCents: number; credits: number }
    >;
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
      stripeOneTimePriceId?: string;
      oneTimePriceCents?: number;
    }
  >;
};
