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
  call_forwarding: {
    stripeProductId: "prod_test_cf_placeholder",
    tiers: {
      standard: {
        stripePriceId: "price_test_cf_standard",
        monthlyPriceCents: 2999,
        includedMinutes: 2000,
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
  fax: {
    stripeProductId: "prod_test_fax_placeholder",
    tiers: {
      starter: {
        stripePriceId: "price_test_fax_starter",
        monthlyPriceCents: 999,
        includedPages: 200,
      },
      business: {
        stripePriceId: "price_test_fax_business",
        monthlyPriceCents: 1499,
        includedPages: 500,
      },
      pro: {
        stripePriceId: "price_test_fax_pro",
        monthlyPriceCents: 2499,
        includedPages: 1000,
      },
    },
  },
  verify: {
    stripeProductId: "prod_test_verify_placeholder",
    packs: {
      "1000": { stripePriceId: "price_test_verify_1000", amountCents: 999, credits: 1000 },
      "5000": { stripePriceId: "price_test_verify_5000", amountCents: 1999, credits: 5000 },
      "10000": { stripePriceId: "price_test_verify_10000", amountCents: 3499, credits: 10000 },
      "50000": { stripePriceId: "price_test_verify_50000", amountCents: 9900, credits: 50000 },
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
