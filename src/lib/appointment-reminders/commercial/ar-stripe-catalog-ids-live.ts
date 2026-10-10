/** Placeholder — run `npx tsx scripts/sync-ar-stripe-catalog.ts --write-ids` with sk_live_ */
import type { ArStripeCatalog } from "@/lib/appointment-reminders/commercial/ar-stripe-catalog";

export const AR_STRIPE_CATALOG_LIVE: ArStripeCatalog = {
  productIds: {
    free: null,
    starter: "prod_live_ar_starter_placeholder",
    growth: "prod_live_ar_growth_placeholder",
    business: "prod_live_ar_business_placeholder",
  },
  priceIds: {
    free: null,
    starter: "price_live_ar_starter_placeholder",
    growth: "price_live_ar_growth_placeholder",
    business: "price_live_ar_business_placeholder",
  },
};
