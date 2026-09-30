import {
  DUAL_PRODUCT_DISCOUNT_PERCENT,
  MCTB_TIER_PRICES_CENTS,
  SMART_ROUTING_TIER_PRICES_CENTS,
  type MctbTier,
  type SmartRoutingTier,
} from "@/lib/products/platform-billing-catalog-definitions";

export function bundleMonthlyTotalCents(
  mctbTier: MctbTier,
  srTier: SmartRoutingTier,
  dualDiscountActive: boolean,
): { subtotalCents: number; discountCents: number; totalCents: number } {
  const subtotalCents =
    MCTB_TIER_PRICES_CENTS[mctbTier] + SMART_ROUTING_TIER_PRICES_CENTS[srTier];
  if (!dualDiscountActive) {
    return { subtotalCents, discountCents: 0, totalCents: subtotalCents };
  }
  const discountCents = Math.round((subtotalCents * DUAL_PRODUCT_DISCOUNT_PERCENT) / 100);
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

/** Text Back ($9.99) × Smart Routing tiers with 20% bundle discount. */
export const BUNDLE_PRICING_MATRIX: Array<{
  mctbTier: MctbTier;
  srTier: SmartRoutingTier;
  expectedTotalDollars: number;
}> = [
  { mctbTier: "text_back", srTier: "starter", expectedTotalDollars: 23.98 },
  { mctbTier: "text_back", srTier: "business", expectedTotalDollars: 39.98 },
  { mctbTier: "text_back", srTier: "pro", expectedTotalDollars: 63.98 },
];
