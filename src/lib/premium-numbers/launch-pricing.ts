/** Legacy display adapter. The authoritative product quote must never be remapped. */
export const LAUNCH_PRICING_ACTIVE = false;

export type LaunchPriceDisplay = {
  priceCents: number;
  listPriceCents?: number;
  showLaunchBadge: boolean;
};

export function displayLaunchPrice(
  premiumPriceCents: number,
  _band?: string,
): LaunchPriceDisplay {
  void _band;
  return { priceCents: premiumPriceCents, showLaunchBadge: false };
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
