/** Placeholder until scripts/sync-mass-texting-stripe-catalog.ts --write-ids runs against Stripe. */
import type { MassTextingStripeCatalogIds } from "./stripe-catalog-types";

export const MASS_TEXTING_STRIPE_CATALOG_TEST: MassTextingStripeCatalogIds = {
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
