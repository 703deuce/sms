/** Placeholder — run `npx tsx scripts/sync-ar-stripe-catalog.ts --write-ids` with sk_test_ */
import type { ArStripeCatalog } from "@/lib/appointment-reminders/commercial/ar-stripe-catalog";

export const AR_STRIPE_CATALOG_TEST: ArStripeCatalog = {
  productIds: {
    free: null,
    starter: "prod_test_ar_starter_placeholder",
    growth: "prod_test_ar_growth_placeholder",
    business: "prod_test_ar_business_placeholder",
  },
  priceIds: {
    free: null,
    starter: "price_test_ar_starter_placeholder",
    growth: "price_test_ar_growth_placeholder",
    business: "price_test_ar_business_placeholder",
  },
};
