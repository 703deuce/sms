/** Placeholder test catalog — run sync with sk_test_ key and --write-ids to populate. */
import type { PlatformCatalogIds } from "./platform-billing-catalog-definitions";

export const PLATFORM_BILLING_CATALOG_TEST: PlatformCatalogIds = {
  mctb: {
    stripeProductId: "prod_test_mctb_placeholder",
    tiers: {
      starter: { stripePriceId: "price_test_mctb_starter", monthlyPriceCents: 1999 },
      growth: { stripePriceId: "price_test_mctb_growth", monthlyPriceCents: 2999 },
      pro: { stripePriceId: "price_test_mctb_pro", monthlyPriceCents: 4999 },
    },
  },
  smart_routing: {
    stripeProductId: "prod_test_sr_placeholder",
    tiers: {
      starter: {
        stripePriceId: "price_test_sr_starter",
        monthlyPriceCents: 1999,
        includedMinutes: 750,
      },
      business: {
        stripePriceId: "price_test_sr_business",
        monthlyPriceCents: 3999,
        includedMinutes: 2000,
      },
      pro: {
        stripePriceId: "price_test_sr_pro",
        monthlyPriceCents: 6999,
        includedMinutes: 4000,
      },
    },
  },
  ai_transcription: {
    stripeProductId: "prod_test_at_placeholder",
    tiers: {
      starter: {
        stripePriceId: "price_test_at_starter",
        monthlyPriceCents: 799,
        includedMinutes: 750,
      },
      business: {
        stripePriceId: "price_test_at_business",
        monthlyPriceCents: 1999,
        includedMinutes: 2000,
      },
      pro: {
        stripePriceId: "price_test_at_pro",
        monthlyPriceCents: 3999,
        includedMinutes: 4000,
      },
    },
  },
  discounts: {
    dualProduct: { stripeCouponId: "coupon_test_dual_product", percentOff: 20 },
  },
  addons: {
    visual_voicemail: {
      stripeProductId: "prod_test_vv",
      stripePriceId: "price_test_vv",
      monthlyPriceCents: 999,
    },
    callback_requests: {
      stripeProductId: "prod_test_cb",
      stripePriceId: "price_test_cb",
      monthlyPriceCents: 499,
    },
  },
} as const;
