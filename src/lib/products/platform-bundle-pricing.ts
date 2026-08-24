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

/** All nine tier combinations with 20% bundle discount applied. */
export const BUNDLE_PRICING_MATRIX: Array<{
  mctbTier: MctbTier;
  srTier: SmartRoutingTier;
  expectedTotalDollars: number;
}> = [
  { mctbTier: "starter", srTier: "starter", expectedTotalDollars: 31.98 },
  { mctbTier: "starter", srTier: "business", expectedTotalDollars: 47.98 },
  { mctbTier: "starter", srTier: "pro", expectedTotalDollars: 71.98 },
  { mctbTier: "growth", srTier: "starter", expectedTotalDollars: 39.98 },
  { mctbTier: "growth", srTier: "business", expectedTotalDollars: 55.98 },
  { mctbTier: "growth", srTier: "pro", expectedTotalDollars: 79.98 },
  { mctbTier: "pro", srTier: "starter", expectedTotalDollars: 55.98 },
  { mctbTier: "pro", srTier: "business", expectedTotalDollars: 71.98 },
  { mctbTier: "pro", srTier: "pro", expectedTotalDollars: 95.98 },
];
