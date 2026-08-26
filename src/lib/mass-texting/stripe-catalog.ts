/**
 * Stripe Price IDs for Mass Texting — populated by scripts/sync-mass-texting-stripe-catalog.ts
 * Commercial amounts live in pricing.ts; only external Stripe IDs belong here.
 */
import { MASS_TEXTING_STRIPE_CATALOG_TEST as GENERATED_TEST } from "./stripe-catalog-ids-test";
import { MASS_TEXTING_STRIPE_CATALOG_LIVE as GENERATED_LIVE } from "./stripe-catalog-ids-live";
import type { MassTextingStripeCatalogIds } from "./stripe-catalog-types";

export type { MassTextingStripeCatalogIds } from "./stripe-catalog-types";

const PLACEHOLDER_CATALOG: MassTextingStripeCatalogIds = {
  stripeProductId: "prod_mass_texting_test_placeholder",
  monthly: {
    starter: { stripePriceId: "price_mt_starter_test" },
    growth: { stripePriceId: "price_mt_growth_test" },
    pro: { stripePriceId: "price_mt_pro_test" },
    business: { stripePriceId: "price_mt_business_test" },
    scale: { stripePriceId: "price_mt_scale_test" },
  },
  payg_line: { stripePriceId: "price_mt_payg_line_test" },
  payg_packs: {
    pack_500: { stripePriceId: "price_mt_pack_500_test" },
    pack_1000: { stripePriceId: "price_mt_pack_1000_test" },
    pack_2500: { stripePriceId: "price_mt_pack_2500_test" },
    pack_5000: { stripePriceId: "price_mt_pack_5000_test" },
    pack_10000: { stripePriceId: "price_mt_pack_10000_test" },
  },
  a2p_registration: { stripePriceId: "price_mt_a2p_test" },
  additional_number: { stripePriceId: "price_mt_add_number_test" },
};

export const MASS_TEXTING_STRIPE_CATALOG_TEST: MassTextingStripeCatalogIds =
  GENERATED_TEST.stripeProductId.startsWith("prod_") &&
  !GENERATED_TEST.stripeProductId.includes("placeholder")
    ? GENERATED_TEST
    : PLACEHOLDER_CATALOG;

export const MASS_TEXTING_STRIPE_CATALOG_LIVE: MassTextingStripeCatalogIds =
  GENERATED_LIVE.stripeProductId.startsWith("prod_") &&
  !GENERATED_LIVE.stripeProductId.includes("placeholder")
    ? GENERATED_LIVE
    : MASS_TEXTING_STRIPE_CATALOG_TEST;

export function getMassTextingStripeCatalog(): MassTextingStripeCatalogIds {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_")
    ? MASS_TEXTING_STRIPE_CATALOG_TEST
    : MASS_TEXTING_STRIPE_CATALOG_LIVE;
}

export type MassTextingStripePriceKey =
  | `monthly_${"starter" | "growth" | "pro" | "business" | "scale"}`
  | "payg_line"
  | "pack_500"
  | "pack_1000"
  | "pack_2500"
  | "pack_5000"
  | "pack_10000"
  | "a2p_registration"
  | "additional_number";

export function getMassTextingStripePriceId(key: MassTextingStripePriceKey): string {
  const catalog = getMassTextingStripeCatalog();
  if (key === "payg_line") return catalog.payg_line.stripePriceId;
  if (key === "a2p_registration") return catalog.a2p_registration.stripePriceId;
  if (key === "additional_number") return catalog.additional_number.stripePriceId;
  if (key.startsWith("monthly_")) {
    const tier = key.replace("monthly_", "") as keyof typeof catalog.monthly;
    return catalog.monthly[tier].stripePriceId;
  }
  return catalog.payg_packs[key as keyof typeof catalog.payg_packs].stripePriceId;
}
